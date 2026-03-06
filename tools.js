import fs from 'fs'

export default {
  sum: {
    name: 'sum',
    description: 'Calculate the sum of two numbers',
    inputSchema: {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['a', 'b']
    },
    call({ a, b }) {
      return a + b
    }
  },
  createFile: {
    name: 'createFile',
    description: 'Create a file with specified content',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['filename', 'content']
    },
    call({ filename, content }) {
      fs.writeFileSync(filename, content)
      return `File ${filename} created`
    }
  }
}
