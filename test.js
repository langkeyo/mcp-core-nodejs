import assert from 'assert'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const MAX_BUFFER_SIZE = 1024 * 1024
const MAX_CONTENT_LENGTH = 256 * 1024
const REQUEST_TIMEOUT_MS = 3000

class MessageParser {
  constructor() {
    this.buffer = ''
  }

  push(chunk) {
    this.buffer += chunk
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      throw new Error('Buffer overflow in test parser')
    }

    const messages = []
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break

      const headerText = this.buffer.slice(0, headerEnd)
      const match = headerText.match(/Content-Length:\s*(\d+)/i)
      if (!match) throw new Error('Missing Content-Length in test parser')

      const contentLength = Number(match[1])
      if (
        Number.isNaN(contentLength) ||
        contentLength < 0 ||
        contentLength > MAX_CONTENT_LENGTH
      ) {
        throw new Error(`Invalid Content-Length in test parser: ${match[1]}`)
      }

      const bodyStart = headerEnd + 4
      const bodyEnd = bodyStart + contentLength
      if (this.buffer.length < bodyEnd) break

      const body = this.buffer.slice(bodyStart, bodyEnd)
      messages.push(JSON.parse(body))
      this.buffer = this.buffer.slice(bodyEnd)
    }

    return messages
  }
}

function encodeMessage(obj) {
  const body = JSON.stringify(obj)
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`
}

class TestClient {
  constructor(serverProcess) {
    this.serverProcess = serverProcess
    this.requestId = 0
    this.pending = new Map()
    this.parser = new MessageParser()

    this.serverProcess.stdout.on('data', (chunk) => {
      const messages = this.parser.push(chunk.toString('utf8'))
      for (const msg of messages) {
        if (msg.id === undefined || !this.pending.has(msg.id)) continue
        const pending = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        clearTimeout(pending.timer)

        if (msg.error) {
          pending.reject(msg.error)
        } else {
          pending.resolve(msg.result)
        }
      }
    })
  }

  sendRequest(method, params) {
    const id = ++this.requestId
    const req = { jsonrpc: '2.0', id, method, params }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, REQUEST_TIMEOUT_MS)

      this.pending.set(id, { resolve, reject, timer })
      this.serverProcess.stdin.write(encodeMessage(req))
    })
  }

  sendNotification(method, params) {
    const req = { jsonrpc: '2.0', method, params }
    this.serverProcess.stdin.write(encodeMessage(req))
  }
}

async function expectRpcError(promise, expectedCode) {
  try {
    await promise
    throw new Error(`Expected RPC error ${expectedCode}, but request succeeded`)
  } catch (err) {
    assert.strictEqual(err.code, expectedCode)
  }
}

async function run() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname
  })

  let stderr = ''
  serverProcess.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8')
  })

  const client = new TestClient(serverProcess)

  try {
    const initResult = await client.sendRequest('initialize', {})
    assert.strictEqual(initResult.protocolVersion, '2025-11-25')
    assert.ok(initResult.capabilities.tools)
    assert.ok(initResult.capabilities.resources)

    await expectRpcError(client.sendRequest('tools/list', {}), -32002)

    client.sendNotification('notifications/initialized', {})

    const toolsResult = await client.sendRequest('tools/list', {})
    assert.ok(Array.isArray(toolsResult))
    assert.ok(toolsResult.some((tool) => tool.name === 'sum'))

    const sumResult = await client.sendRequest('tools/call', {
      name: 'sum',
      arguments: { a: 5, b: 7 }
    })
    assert.strictEqual(sumResult, 999)

    const resourcesResult = await client.sendRequest('resources/list', {})
    assert.ok(Array.isArray(resourcesResult.resources))
    assert.ok(resourcesResult.resources.some((r) => r.uri === 'memo://welcome'))

    const readResult = await client.sendRequest('resources/read', {
      uri: 'memo://welcome'
    })
    assert.ok(Array.isArray(readResult.contents))
    assert.strictEqual(readResult.contents[0].uri, 'memo://welcome')

    await expectRpcError(
      client.sendRequest('resources/read', { uri: 'memo://404' }),
      -32602
    )

    console.log('All tests passed.')
  } finally {
    serverProcess.kill()
    if (stderr.trim()) {
      console.error(stderr.trim())
    }
  }
}

run().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
