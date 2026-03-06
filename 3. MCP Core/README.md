# MCP Core (Node.js)

Minimal MCP Core server implementation over `stdio`, focused on protocol fundamentals and engineering robustness.

## Features
- `Content-Length` framing parser with sticky packet and half packet handling
- JSON-RPC 2.0 request/response flow
- Lifecycle flow:
  - `initialize`
  - `notifications/initialized`
- Tool capability:
  - `tools/list`
  - `tools/call`
- Resource capability:
  - `resources/list`
  - `resources/read`
- Error handling and safety:
  - request-level error mapping (`-32700`, `-32601`, `-32602`, `-32603`)
  - `MAX_BUFFER_SIZE` and `MAX_CONTENT_LENGTH` guards

## Project Structure
- `server.js`: MCP server, parser, routing, lifecycle gate, error mapping
- `tools.js`: tool registry and tool handlers
- `client.js`: smoke client for manual end-to-end check
- `test.js`: assertion-based automated test runner

## Run
```bash
node server.js
```

## Smoke Test
```bash
node client.js
```

## Automated Test
```bash
node test.js
```
or
```bash
npm test
```

## Protocol Flow
1. Client sends `initialize`.
2. Server responds with capabilities.
3. Client sends `notifications/initialized` (notification, no response expected).
4. Client can call `tools/*` and `resources/*`.

## Engineering Notes
- Notification must not be sent through request-await flow.
- Tool/resource methods are blocked before lifecycle is completed.
- Parser is stream-based and stateful; it never assumes one chunk equals one message.
