process.stdin.setEncoding('utf8')

process.stdin.on('data', (data) => {
  data = data
    .replace(/[?？]/g, '')
    .replace(/我/g, '你')
    .replace(/你/g, '我')
    .replace(/吗/g, '')
  const resp = `AI: ${data}`
  process.stdout.write(resp)
})
