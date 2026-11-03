# Agent 合并验证

2026-11-03。使用隔离目录和标明预置测试的会话，不访问业务数据库。本轮按用户要求删除旧独立Agent数据与迁移兼容，SQL Studio现有配置保留。

## 自动验证

Agent查询复用原query四并发预算、固定只读及100行限制、精确数值保持。原Agent的上下文压缩、取消、文件恢复、修订冲突和SSE解码测试合入现有测试树。

HTTP真实本机替身验证reasoning_delta在模型结束前到达、断开请求传递取消并等待检查点完成、本机同源保护、严格JSON和路由命名空间；OpenAPI/Markdown与Gin注册表检查同步新增路由。前端事件还原、二维结果、UTF8分包及IME快捷键测试归入pnpm lint。

## 浏览器

完整SQL Studio服务以隔离配置启动，从顶部Agent进入并返回；SQL草稿SELECT 42 AS merged_fixture跨功能切换保留。Ant Design X会话/消息/输入/思考组件实际渲染，预置25行结果展示精确大整数和NULL。底部模型菜单修改模型后保存到共享ai分区，Key弹窗不回填。亮暗主题、折叠/隐藏恢复、删除测试会话、草稿刷新、390px窄屏分别检查；截图在screenshots目录。

## 边界

本轮没有使用真实Key调用模型，也没有运行真实数据库SQL。SQL工作台原设置弹窗会触发官方模型发现，本次用虚构测试Key打开后关闭；这不代表真实账号连通或额度验证。构建保留大包提示。浏览器流式模型调用以Go的本机替身HTTP测试验证，页面结果为预置数据。

## 本轮检查结果

- Go：go test -count=1 ./...、go vet ./...、go build ./...通过；真实数据库集成按默认配置跳过，不能算真实联调。
- 前端：变更文件Prettier、pnpm lint、pnpm build通过；lint包含5项事件/结果/输入/结构检查。现有useWorkspace有2条effect警告，未扩大范围修改；Vite保留现有大包提示，Agent页面懒加载约141KB（gzip约48KB）。
- 浏览器：实际组件类名确认为ant-conversations和ant-sender；回复字体14px；Shift+Enter保留换行；隐藏两项过程刷新后仍隐藏，表格仍可见，显示过程恢复；删除预置会话正常。390px页面scrollWidth=390，历史Drawer和长标题省略正常。原SQL草稿跨功能返回仍为SELECT 42 AS merged_fixture。
- 截图：[亮色](screenshots/agent-x-light.png)、[暗色](screenshots/agent-x-dark.png)、[窄屏](screenshots/agent-x-narrow.png)、[历史](screenshots/agent-x-history.png)。

正式main.go使用同一隔离目录重启复核通过：Agent草稿两行、Pro模型、暗色主题、当前会话与删除状态保持，原SQL草稿也恢复。进程适配器另验证驱动错误不会将主机、用户名或密码送入模型，连接/库列表与结果均保留256KiB上限。

按用户要求，全新版本已删除sql-chat-agent旧目录（含旧会话/Key）、迁移实现/测试/环境变量及Agent私有主题兼容字段；Agent布局仅保存activeId/draft/expanded，主题复用SQL Studio。重新执行完整Go测试、vet/build和前端lint/build通过；此轮未重跑浏览器，前一轮界面验收记录保留。
