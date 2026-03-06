import tools from './tools.js'

const MAX_BUFFER_SIZE = 1024 * 1024
const MAX_CONTENT_LENGTH = 256 * 1024

// 收过 initialize 请求
let initialized = false
// 收过 notifications/initialized
let initializeDone = false

class RpcError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

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

function validateArgs(tool, args) {
  const schema = tool.inputSchema
  if (
    !schema ||
    schema.type !== 'object' ||
    typeof args !== 'object' ||
    args === null
  ) {
    throw new RpcError(-32602, 'Invalid arguments: expected an object')
  }

  for (const key of schema.required || []) {
    if (!(key in args))
      throw new RpcError(-32602, `Missing required field: ${key}`)
  }

  for (const [key, rule] of Object.entries(schema.properties || {})) {
    if (key in args && typeof args[key] !== rule.type) {
      throw new RpcError(
        -32602,
        `Invalid type for field ${key}: expected ${rule.type}`
      )
    }
  }
}

function callTool({ name, arguments: toolArgs }) {
  const tool = tools[name]
  if (!tool) {
    throw new RpcError(-32602, `Tool not found: ${name}`)
  }
  validateArgs(tool, toolArgs)
  return tool.call(toolArgs)
}

function handleRequest(req) {
  const { id, method, params } = req
  if (!initialized && method !== 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32002, message: 'Server not initialized' }
    }
  }

  if (
    (method === 'tools/list' ||
      method === 'tools/call' ||
      method === 'resources/list' ||
      method === 'resources/read') &&
    !initializeDone
  ) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32002, message: 'Client not initialized' }
    }
  }

  let result
  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: '2025-11-25',
        capabilities: {
          tools: {},
          resources: {}
        },
        serverInfo: {
          name: 'mcp-core-demo',
          version: '0.1.0'
        }
      }
      initialized = true
      return { jsonrpc: '2.0', id, result }
    case 'tools/list':
      result = Object.keys(tools).map((name) => ({
        name,
        description: tools[name]?.description || 'No description',
        inputSchema: tools[name]?.inputSchema || null
      }))
      return { jsonrpc: '2.0', id, result }
    case 'tools/call':
      result = callTool(params)
      return { jsonrpc: '2.0', id, result }
    case 'resources/list':
      result = {
        resources: [
          {
            uri: 'memo://welcome',
            name: 'Welcome',
            mimeType: 'text/plain',
            size: 13
          }
        ]
      }
      return { jsonrpc: '2.0', id, result }
    case 'resources/read':
      if (params.uri === 'memo://welcome') {
        result = {
          contents: [
            {
              uri: 'memo://welcome',
              mimeType: 'text/plain',
              text: 'Hello, MCP!'
            }
          ]
        }
        return { jsonrpc: '2.0', id, result }
      }
      // 资源不存在
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: 'Resource not found: ' + params.uri }
      }
    case 'notifications/initialized':
      initializeDone = true
      // 不返回响应（notification 没有 id，不应回包）
      return null
    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Method not found' }
      }
  }
}

// send
function encodeMessage(obj) {
  const body = JSON.stringify(obj)
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`
}

const parser = new MessageParser()

// 监听 stdin 输入
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => {
  try {
    const reqs = parser.push(chunk)
    for (const req of reqs) {
      try {
        const resp = handleRequest(req)
        if (resp) process.stdout.write(encodeMessage(resp))
      } catch (error) {
        process.stdout.write(
          encodeMessage({
            jsonrpc: '2.0',
            id: req.id ?? null,
            error: {
              code: error instanceof RpcError ? error.code : -32603,
              message: error.message || 'Internal error'
            }
          })
        )
      }
    }
  } catch (error) {
    process.stdout.write(
      encodeMessage({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error: ' + error.message }
      })
    )
  }
})
