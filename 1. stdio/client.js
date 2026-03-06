import { spawn } from 'child_process'

// 启动 server.js 子进程
const serverProcess = spawn('node', ['server.js'])

// 监听 server.js 的输出
serverProcess.stdout.on('data', (data) => {
  console.log(data.toString())
})

// 发送几条测试消息
const messages = ['你好吗？', '我喜欢编程。', '你觉得AI怎么样？']

messages.forEach((msg, index) => {
  setTimeout(() => {
    serverProcess.stdin.write(msg)
  }, index * 1000)
})
