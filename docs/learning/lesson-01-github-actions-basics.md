# Lesson 01 - GitHub Actions 从 0 到 1（基于 MCP Core）

## 本节目标
1. 明白 GitHub Actions 的最小运行模型（workflow / job / step / runner）。
2. 能为当前项目写出一个最小 CI：安装依赖 + 运行 `node test.js`。
3. 能看懂一次 Actions 失败日志并定位到哪一步错了。

## 先建立心智模型
把 GitHub Actions 想成“GitHub 提供的一台临时机器”，每次触发都新开一台，跑完销毁。

最小结构是：
- `workflow`：一次自动化流程（一个 yml 文件）。
- `job`：流程里的一个任务（可并行）。
- `step`：任务内的步骤（串行）。
- `runner`：执行环境（例如 `ubuntu-latest`）。

## 你项目里的可复用命令
当前 `package.json` 里已经有：
- `npm test` -> `node test.js`
- `npm run smoke` -> `node client.js`

第一课我们只跑 `test`，先让 CI 稳定绿灯。

## 文件放哪里
固定路径：
- `.github/workflows/ci.yml`

## 最小骨架（示意）
```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```

## 你最容易踩的 4 个坑
1. `npm ci` 失败：因为没有 `package-lock.json`。
2. Node 版本不一致：本地能跑，CI 失败。
3. workflow 文件路径不对：不是 `.github/workflows/*.yml`。
4. 以为本地文件会保留：runner 每次是全新环境。

## 本节练习（你来做）
1. 新建 `.github/workflows/ci.yml`，按上面骨架填完整。
2. 提交并 push 到 GitHub。
3. 在仓库 Actions 页查看执行日志。
4. 把结果分成三类记录：
   - 成功（截图/日志关键行）
   - 失败点（哪一个 step）
   - 你的修复动作

## 验收标准
1. `push` 和 `pull_request` 都会触发。
2. 日志里能看到 `npm test` 执行并通过。
3. 你能口述：workflow / job / step 各自是什么。

## Next Lesson Preview
下一节做两件升级：
1. CI 做 Node 版本矩阵（18 / 20）。
2. 只在 `main` 保护分支上要求检查通过（结合 PR 流程）。
