# SQL Studio AI 助手源码导读

AI 助手通过 Go 后端把 DeepSeek 的工具调用接入 SQL Studio 的数据库能力。模型可以直接回答，也可以提出一个或多个工具调用。Go 决定每个调用是否可以执行，执行后把结果交回模型。浏览器负责发送问题、呈现过程，以及让用户确认或停止。

先区分模型的两种输出。结构化的 `tool_calls` 会进入后端工具校验流程。回复正文中的 SQL、Markdown 和 JSON 进入展示流程，可供阅读、复制或导出。在正文看到一条 `INSERT` 或 `DROP TABLE` 时，可以打开「执行过程」核对实际调用和数据库结果。

## 1. 页面入口和技术栈

从 SQL 工作区顶栏点击「AI 助手」进入。在助手顶栏点击「工作区」返回。右上角「系统设置」提供 DeepSeek 配置和外观。工作区和助手共用前端应用、Go 进程、连接配置和全局主题。

| 层 | 技术和职责 |
| --- | --- |
| 聊天页面 | Vite、React、TypeScript、Ant Design。React hooks 管理会话、输入、流式事件和确认状态 |
| 聊天组件 | Ant Design X 2.5.0。Conversations 管理历史列表，Sender 提供输入，Bubble 显示消息，Think 展示可折叠的思考和执行过程 |
| 内容渲染 | marked 解析 Markdown，CodeMirror 显示只读高亮代码，Ant Design Table 展示表格，ExcelJS 导出当前已加载的结果 |
| HTTP 和模型 | Gin 接收浏览器请求并写 SSE，Go 的 HTTP 客户端调用 DeepSeek 并读取模型流 |
| 数据库 | Go 业务服务处理连接、元数据和查询，适配 MySQL、MariaDB 和 PostgreSQL |
| 持久化 | Go 文件仓库保存会话版本、索引和布局 |

源码入口见[聊天页面](../sql-studio-frontend/src/agent/pages/chat/index.tsx)、[前端依赖](../sql-studio-frontend/package.json)和[应用装配](../sql-studio-backend/internal/app/app.go)。

## 2. 一条消息的完整链路

~~~mermaid
sequenceDiagram
    participant U as 用户和 React 页面
    participant G as Gin 和 Agent 服务
    participant M as DeepSeek
    participant D as 数据库服务
    U->>G: POST /api/agent/chat
    Note over G: 保存用户消息，准备上下文和工具定义
    loop 本轮仍有工具调用
        G->>M: 提交上下文和工具定义
        M-->>G: 思考、正文增量和工具调用
        G-->>U: 转发增量和工具执行状态
        Note over G: 校验工具参数、模式和 SQL
        opt 合法的写入申请
            G-->>U: SSE 写入确认卡片
            U->>G: POST /api/agent/write-confirmation
        end
        opt 工具通过校验且已获得所需确认
            G->>D: 读取元数据或执行 SQL
            D-->>G: 返回结果
            G-->>U: 保存并发送工具结果
            Note over G: 将工具结果加入下一次模型请求
        end
    end
    M-->>G: 最终回答
    G-->>U: 最终正文和结束事件
~~~

前端在 `POST /api/agent/chat` 的 JSON 请求体中发送 `{ sessionId, message, mode }`。这是 POST 请求加 SSE 响应。浏览器用 `fetch` 发送，用 `ReadableStream` 和 `TextDecoder` 读取分段数据。Gin 将事件写成 `data: <JSON>`，每条事件后刷新响应。连接存续时，每 10 秒发送一次心跳。

后端有两条独立的流。第一条从 DeepSeek 到 Go，包含模型正文、思考增量和工具调用片段。第二条从 Go 到浏览器，除了模型增量，还包含 Go 生成的工具状态、确认、错误和结束事件。浏览器看到的「正在执行」来自 Go，模型的思考文本属于另外一类事件。

源码见[前端聊天请求](../sql-studio-frontend/src/agent/services/chat/index.ts)、[Gin 流式入口](../sql-studio-backend/internal/httpapi/agent_stream.go)和[对话循环](../sql-studio-backend/internal/modules/agent/service.go)。

## 3. DeepSeek 请求和上下文

Go 读取共享 AI 配置，用 Bearer Key 请求 `https://api.deepseek.com/chat/completions`。当前代码内置 DeepSeek Flash（`deepseek-flash`，默认）和 DeepSeek V4 Pro（`deepseek-v4-pro`）。正式聊天发送 `stream: true`、`thinking: enabled`、`reasoning_effort: low`，单次输出上限为 16,384 tokens。

每次模型请求包含系统提示、当前数据库目标、可用工具定义、用户消息及保留的历史上下文。如果上一轮模型输出了工具调用，Go 按调用 ID 把结果配成工具消息，再和原调用一起送回模型。一个用户问题可以经历多次模型请求。例如第一次调用发现连接，第二次选择目标，之后再查表并形成最终回答。

上下文按 100 万窗口设定 70 万的保守输入估算，估算依据是序列化后的字节数和预留空间。需要压缩时，先征求用户同意，再发起非思考请求摘要较早的完整轮次。最近两轮及其工具配对保留，原始会话仍可在本机恢复。

助手与 SQL 补全、优化共用一份 Key。模型菜单通过 `/api/agent/settings` 获取脱敏配置。系统设置里的连接状态在本机已配置时还会调用模型列表接口验证连通性。菜单实例复用正在进行的检查，已连接和未配置结果缓存 60 秒，失败结果缓存 10 秒。保存或移除配置后，旧检查结果失效。

源码见[模型传输](../sql-studio-backend/internal/deepseek/agent/stream.go)、[上下文管理](../sql-studio-backend/internal/modules/agent/context.go)、[共享配置](../sql-studio-backend/internal/modules/settings/agent.go)和[菜单连接状态](../sql-studio-frontend/src/components/systemSettings/hooks/useConnectionStatus/README.md)。

## 4. 模型输出如何受约束

1. **系统提示规定工作方式。** 模型使用中文，先核实连接、库、表和字段，目标有歧义时追问，按引擎选择方言。查询结果优先输出二维 JSON，保留 `NULL`、数值精度和截断标记。连接名、字段备注、数据和工具结果按不可信内容对待。
2. **工具定义规定可以申请的操作。** Go 按模式提供工具名称和参数结构。DeepSeek 流中的工具片段先按索引拼接，后端检查工具 ID、结束标记和 `finish_reason`，确认调用完整后才进入分派。
3. **Go 决定是否执行。** 工具分派检查白名单、JSON 参数和未知字段，再根据本轮模式、数据库目标、SQL 类型和允许的函数作判断。写入额外经过一次性确认，数据库适配器在调用查询服务前还会复查策略。
4. **前端验证展示结构。** 表格解析器检查列、二维行和列数。核对数字是否来自数据库时，应查看「执行过程」里的工具结果。最终回复是模型根据结果组织的内容。

源码见[系统提示](../sql-studio-backend/internal/modules/agent/prompt.go)、[工具分派](../sql-studio-backend/internal/modules/agent/tools.go)和[SQL 策略](../sql-studio-backend/internal/modules/agent/sqlpolicy.go)。

## 5. 从工具调用到数据库

| 工具 | 后端行为 |
| --- | --- |
| `list_connections` | 返回已保存连接的 ID、名称和引擎类型 |
| `list_databases` | 使用已发现的连接 ID 读取可访问的数据库 |
| `use_database` | 复查连接和数据库仍可访问，再设置当前目标 |
| `list_tables` | 列出当前数据库的表和视图 |
| `describe_table` | 获取指定表的字段和备注 |
| `query_readonly` | 在当前目标执行一条受限的只读 SQL，最多返回 100 行 |
| `execute_write` | 校验写入语句和范围，获得逐次确认后执行 |

界面执行步骤中显示的 `POST /api/connections/:id/query` 等地址，代表工作区里对应的 HTTP 能力。Agent 在同一个 Go 进程内直接调用元数据和查询服务，`use_database` 只更新会话目标。Agent 使用独立的引擎实例，与工作区共用 4 个查询并发槽位。每次数据库操作结束就释放本次连接，用户确认和等待模型的阶段无需占用数据库连接。

首次问「这个库有哪些表」时，可以跟踪 `list_connections` → `list_databases` → `use_database` → `list_tables`。同一会话里目标明确时可以复用。一般知识问题可以由模型直接回答。

源码见[工具定义与执行](../sql-studio-backend/internal/modules/agent/tools.go)和[进程内数据库适配](../sql-studio-backend/internal/app/agent.go)。

## 6. 只读模式、完全访问模式和写入确认

| 行为 | 只读模式 `readonly` | 完全访问模式 `write` |
| --- | --- | --- |
| 启用 | 默认模式 | 用户确认切换，选择随布局保存 |
| 读取 | 发现元数据，执行受限只读 SQL | 读取能力相同 |
| 写入 | 后端拒绝写入申请 | 支持通过策略检查的单条 `INSERT`、`UPDATE`、`CREATE`、`ALTER`、`COMMENT` 等操作，每次单独确认 |
| 删除及清空 | 禁止 | 禁止 |

读工具以 `AllowWrite: false` 进入驱动的只读事务。Agent SQL 策略还限制跨库引用、副作用函数、锁、文件操作等。两种模式均拦截 `DELETE`、`DROP`、`TRUNCATE`、`REPLACE` 以及通过多语句、存储程序、动态 SQL 绕过限制的尝试。用户问如何删除时，回复可以给出供人工审阅的 SQL 和风险说明。普通 SQL 工作区有自己的执行入口。

合法写入先生成 `write_confirmation` 事件。回复下方的卡片显示连接、库、涉及对象和完整 SQL。前端向 `POST /api/agent/write-confirmation` 提交 `{ approvalId, allow }`，等待中的 Go 调用持有 SQL 和目标。确认 ID 一次有效，等待最多 5 分钟。拒绝、过期或等待期间断开时，待确认 SQL 不执行。

这套校验覆盖应用支持的 SQL 子集。数据库账号权限仍决定最终可执行范围，触发器、级联规则、视图或函数重载等数据库内部行为也可能影响写入结果。

源码见[模式切换](../sql-studio-frontend/src/agent/pages/chat/hooks/operationMode/index.tsx)、[写入策略](../sql-studio-backend/internal/modules/agent/write.go)和[一次性确认](../sql-studio-backend/internal/modules/agent/approval.go)。

## 7. 回复为什么会显示表格、代码块或 JSON

| 内容 | 事件或来源 | 前端展示 |
| --- | --- | --- |
| 思考 | DeepSeek 的 `reasoning_content` 转为 `reasoning_delta` | 可折叠的思考卡片 |
| 执行 | Go 产生的 `tool_start`、`tool_result` | 工具、参数、SQL 和数据库结果 |
| 回答 | `answer_delta` 和最终 `answer` | Markdown 正文、代码块、表格 |
| 确认 | `write_confirmation`、`continue_confirmation` | 回复下方的操作卡片 |
| 结束 | `error`、`stopped`、`done` | 错误、停止提示或结束状态 |

模型返回形如 `{"columns":[{"name":"id","type":"text"}],"rows":[["9007199254740993"]],"truncated":false}` 的结果时，前端验证结构后生成表格。数字字符串保持原样，`null` 和空字符串分别展示，重复列按位置保留。识别支持 JSON 代码围栏、正文中的裸对象和合法 Markdown 表格。表格可以分页并导出当前已加载的结果。

流式表格尚未拼完整时，页面显示「正在整理查询结果」。结束后仍缺字段或行数据时，可以查看未完成提示和原文。普通 JSON、损坏的完整 JSON 或代码示例会保留原格式。SQL 围栏使用 CodeMirror 只读高亮和复制，Markdown 由安全的 React 节点呈现。

源码见[事件合并](../sql-studio-frontend/src/agent/utils/chatEvents/index.ts)、[回答内容](../sql-studio-frontend/src/agent/pages/chat/components/answerContent/index.tsx)、[表格识别](../sql-studio-frontend/src/agent/utils/answerTables/README.md)和[查询结果组件](../sql-studio-frontend/src/agent/pages/chat/components/queryResult/README.md)。

## 8. 停止、超时和重新规划

点击停止时，前端用 `AbortController` 取消聊天请求。Go 将请求的取消信号传给模型 HTTP 请求、确认等待和数据库驱动，并尝试保存已经收到的片段和工具记录。已经执行的数据库变更需要按数据库实际状态处理，停止后续步骤本身无法撤销它们。

| 边界 | 当前行为 |
| --- | --- |
| 一轮执行预算 | 180 秒，等待确认期间暂停计时 |
| 单次 DeepSeek 流 | 最多 150 秒，单次输出上限 16,384 tokens |
| 查询服务的单次 SQL | 最多 30 秒 |
| 确认等待 | 最多 5 分钟 |
| 输入大小 | 超过 64 KiB 至 256 KiB 先确认，超过 256 KiB 拒绝发送 |
| 工具结果大小 | 超过 32 KiB 先询问是否发送给模型，单个工具结果通常受 256 KiB 上限约束 |

超过大小提示、需要摘要历史或部分读取失败时，Go 可以发出 `continue_confirmation`。前端向 `POST /api/agent/continue-confirmation` 提交一次性决定。这项确认只决定是否继续本轮。只读查询结果过大时，编排允许在原目标内自动缩小范围一次。可恢复读取失败通常需要用户同意后重新规划，已提交的写入不会由该机制自动重试。

上游流断开、缺少结束标记、输出达到上限、SQL 被拦截、数据库失败或本地保存失败，都可能使一轮提前结束。`done` 表示 SSE 结束，判断本轮结果要同时看前面的错误、停止事件和最终会话状态。

源码见[前端发送和取消](../sql-studio-frontend/src/agent/pages/chat/hooks/chat/index.ts)、[本轮预算](../sql-studio-backend/internal/modules/agent/turn_budget.go)和[继续确认](../sql-studio-backend/internal/modules/agent/approval.go)。

## 9. 会话文件、历史恢复和数据范围

默认状态根目录是 Go 服务启动目录下的 `.sql-studio/state/`，可由 `SQLDESK_STATE_DIR` 覆盖。

| 相对于状态根目录的路径 | 内容 |
| --- | --- |
| `agent/conversations/index.json` | 会话 ID、标题、状态、更新时间和当前版本 |
| `agent/conversations/<id>-<revision>.json` | 用户问题、思考和回答事件、SQL、工具结果、成功轮次的模型历史、数据库目标和摘要 |
| `agent/layout.json` | 当前会话 ID、草稿、展开项和操作模式 |
| `ai.json` | 共享 DeepSeek 配置及 API Key |

Go 先保存用户问题，工具结果立即做检查点，流式片段约每秒检查一次，结束时再做最终保存。会话仓库先写新版本，再原子更新索引，布局使用 `revision` 处理窗口之间的写入冲突。失败轮次可以保留在界面历史里，成功轮次的模型消息和新目标才进入后续上下文。重启发现会话仍标为 `running` 时，加载阶段将这一轮标记为中断。

打开历史会话时，浏览器从本机 Go 服务读取事件并重建展示。会话支持新建、重命名和删除。空列表通过后端的 `ensure` 路径原子创建默认会话，刷新索引时前端保留当前选中项。切换历史和恢复草稿都属于本机状态读写。

本机历史文件与模型请求是两个数据范围。实际提问、所用上下文、相关元数据和有界查询结果会发给 DeepSeek。共享 Key 由浏览器提交给后端保存，设置读取接口仅返回脱敏配置。仓库部分说明提到 Key 另行加密，现行 `settings` 和 `statefile` 实现直接把 `apiKey` 写入 `ai.json` 的 JSON 数据，应按含明文 Key 的配置文件处理。

源码见[会话持久化](../sql-studio-backend/internal/modules/agent/persistence.go)、[会话文件仓库](../sql-studio-backend/internal/agentstate/store.go)、[设置服务](../sql-studio-backend/internal/modules/settings/service.go)和[配置文件仓库](../sql-studio-backend/internal/statefile/store.go)。

## 10. 源码阅读顺序

1. 从 `send` 看一条问题如何进入页面、发给 Go，以及流式事件如何更新界面。[前端聊天 Hook](../sql-studio-frontend/src/agent/pages/chat/hooks/chat/index.ts)
2. 跟进 `ChatMode`，找出组装提示词、请求模型、分派工具、把结果送回模型和结束一轮的位置。[后端编排](../sql-studio-backend/internal/modules/agent/service.go)
3. 用「列出有哪些表」走一次读取链路，再用「添加一条记录」对照写入的模式校验和逐次确认。[工具执行](../sql-studio-backend/internal/modules/agent/tools.go) · [写入确认](../sql-studio-backend/internal/modules/agent/approval.go)
4. 对照同一条数据在执行过程和最终回答中的表现，再跟踪刷新后的历史恢复。[回复渲染](../sql-studio-frontend/src/agent/pages/chat/components/answerContent/index.tsx) · [会话仓库](../sql-studio-backend/internal/agentstate/store.go)

路由与数据结构见[接口文档](API.md)，模块概览见[数据库 Agent](AGENT.md)。
