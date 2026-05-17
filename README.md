# code-platform-demo

精简版代码助手演示：展示如何用 **Claude Agent SDK** 调用 Claude、注册自定义 MCP 工具，并用 **Hono + React** 提供 Web UI。**Drizzle ORM + SQLite**（`@libsql/client` 本地文件）持久化会话与消息。

## 功能

- 流式对话（SSE）
- 自定义工具：`read_file`、`list_directory`、`search_code`
- 内置工具子集：`Read`、`Grep`（Claude Code preset）
- 会话列表、历史消息、工具调用记录
- 工作区通过 `WORKSPACE_ROOT` 配置

## 要求

- Node.js 20+
- pnpm 9+
- [Anthropic API Key](https://console.anthropic.com/)

安装依赖时**不要**跳过 optional dependencies（SDK 需要原生 Claude Code 二进制）。

数据库使用 **Drizzle ORM** + **SQLite 本地文件**（`@libsql/client`，无需编译 `better-sqlite3`）。

## 快速开始

```bash
cd code-platform-demo
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_API_KEY

export WORKSPACE_ROOT="$(pwd)/samples"   # 可选，默认即 samples/

pnpm install
pnpm db:migrate
pnpm dev
```

- 前端: http://localhost:5173
- API: http://localhost:8787

## 环境变量

| 变量 | 说明 |
|------|------|
| `AGENT_PROVIDER` | `deepseek`（默认）或 `claude` |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（OpenAI 兼容） |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 默认 `deepseek-chat` |
| `ANTHROPIC_API_KEY` | Claude Agent SDK 用（`AGENT_PROVIDER=claude` 时） |
| `WORKSPACE_ROOT` | Agent 工作目录（绝对或相对项目根） |
| `DATABASE_URL` | 默认 `file:./data/app.db` |
| `PORT` | 默认 `8787` |
| `CLAUDE_MODEL` | 默认 `claude-sonnet-4-20250514` |
| `ALLOW_DANGEROUS_PERMISSIONS` | `true` 时自动批准工具（仅 Claude 模式） |

### 使用 DeepSeek 测试

在 `.env` 中设置：

```bash
AGENT_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
```

DeepSeek 模式通过 OpenAI SDK 调用，并启用演示用自定义工具（`read_file` / `list_directory` / `search_code`）。切换回 Claude Agent SDK 时设 `AGENT_PROVIDER=claude` 并配置 `ANTHROPIC_API_KEY`。

## 工具名对照

| 类型 | 名称 |
|------|------|
| 内置 | `Read`, `Grep` |
| 自定义 MCP | `mcp__demo__read_file`, `mcp__demo__list_directory`, `mcp__demo__search_code` |

自定义工具定义见 [`packages/server/src/tools/`](packages/server/src/tools/)。

## 示例提示词

针对内置 `samples/` 仓库：

1. 「列出项目结构并解释 `src/utils.ts`」
2. 「搜索 TODO 并说明 `last` 函数有什么问题」

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/sessions` | 会话列表 |
| POST | `/api/sessions` | 新建会话 |
| GET | `/api/sessions/:id` | 会话详情 + 消息 + 工具调用 |
| DELETE | `/api/sessions/:id` | 删除会话 |
| POST | `/api/chat` | SSE 流式聊天 |

## 安全说明

- API Key 只存在于服务端环境变量
- 不要将 `WORKSPACE_ROOT` 指向含敏感数据的目录
- `ALLOW_DANGEROUS_PERMISSIONS=true` 仅用于本地演示，勿用于生产

## 许可

MIT — 见 [LICENSE](LICENSE)
