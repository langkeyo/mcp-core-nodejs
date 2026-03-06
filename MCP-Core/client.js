import { spawn } from 'child_process'

const pendingRequests = new Map()
const MAX_BUFFER_SIZE = 1024 * 1024
const MAX_CONTENT_LENGTH = 256 * 1024

let requestId = 0
let serverProcess

// MCP 服务器端状态
let initialized = false
let initializeDone = false

class MessageParser {
  constructor() {
    this.buffer = ''
  }

  push(chunk) {
    this.buffer += chunk
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      throw new Error('Buffer overflow: message too large')
    }
    const messages = []

    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break

      const headerText = this.buffer.slice(0, headerEnd)
      const m = headerText.match(/Content-Length:\s*(\d+)/i)
      if (!m) throw new Error('Missing Content-Length')

      const contentLength = Number(m[1])
      if (
        isNaN(contentLength) ||
        contentLength < 0 ||
        contentLength > MAX_CONTENT_LENGTH
      ) {
        throw new Error('Invalid Content-Length: ' + m[1])
      }
      const bodyStart = headerEnd + 4 // 这里的 4 代表的是 '\r\n\r\n' 的长度，一共四个字节
      const bodyEnd = bodyStart + contentLength
      if (this.buffer.length < bodyEnd) break // 半包：继续等下一段

      const body = this.buffer.slice(bodyStart, bodyEnd)
      messages.push(JSON.parse(body))
      this.buffer = this.buffer.slice(bodyEnd) // 吃掉已完成消息，继续while处理粘包
    }

    return messages
  }
}

// send
function encodeMessage(obj) {
  const body = JSON.stringify(obj)
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`
}

async function sendRequest(method, params) {
  const id = ++requestId
  const req = { jsonrpc: '2.0', id, method, params }
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })
    serverProcess.stdin.write(encodeMessage(req))
  })
}

function sendNotification(method, params) {
  const req = { jsonrpc: '2.0', method, params }
  serverProcess.stdin.write(encodeMessage(req))
}

async function main() {
  // 启动子进程
  serverProcess = spawn('node', ['server.js'])
  const parser = new MessageParser()

  serverProcess.stdout.on('data', (chunk) => {
    const messages = parser.push(chunk.toString())
    for (const msg of messages) {
      if (msg.id !== undefined) {
        const { resolve, reject } = pendingRequests.get(msg.id)
        pendingRequests.delete(msg.id)
        if (msg.error) {
          reject(new Error(msg.error.message))
        } else {
          resolve(msg.result)
        }
      }
    }
  })

  const initializeResponse = await sendRequest('initialize', {
    /* ... */
  })
  console.log(initializeResponse)
  sendNotification('notifications/initialized', {
    /* ... */
  })
  const list = await sendRequest('tools/list', {})
  console.log(list)
  const resources = await sendRequest('resources/list', {})
  console.log(resources)
  const readResult = await sendRequest('resources/read', {
    uri: 'memo://welcome'
  })
  console.log(readResult)
  const sumResult = await sendRequest('tools/call', {
    name: 'sum',
    arguments: { a: 5, b: 7 }
  })
  console.log('Sum result:', sumResult)
  serverProcess.kill()
}
main()
