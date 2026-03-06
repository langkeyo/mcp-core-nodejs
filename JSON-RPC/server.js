import utils from './utils.js'

// 监听 stdin 输入
process.stdin.setEncoding('utf8')
process.stdin.on('data', (req) => {
  const { id, method, params } = JSON.parse(req)
  const result = utils[method](params)
  const resp = JSON.stringify({ jsonrpc: '2.0', id, result })
  process.stdout.write(resp)
})
