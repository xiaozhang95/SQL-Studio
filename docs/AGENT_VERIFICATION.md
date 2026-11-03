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

## 输入区与保存状态调整

输入区默认4行、最大10行，使用Sender语义styles去除外框/输入边线/阴影/聚焦描边，增加内边距并保留默认14px字体。SaveStatus提取为公共组件，Agent在右上角展示动态保存状态，workspace默认文案和行为保持；窄屏保留状态图标、Tooltip与aria名称。

前端格式、lint/build通过。隔离空目录浏览器核对亮暗与390px：Sender实测184px高，输入98px高，根/输入border均0、shadow none、outline none；侧栏保存文案已移除；窄屏scrollWidth=390，Shift+Enter换行正常，workspace仍显示已保存到本机。截图：[暗色输入区](screenshots/agent-composer-dark.png)、[亮色输入区](screenshots/agent-composer-light.png)、[窄屏输入区](screenshots/agent-composer-narrow.png)。未调用模型或数据库。

共享Key修正：Agent独立Key表单已移除，与workspace复用公共AISettings/useAISettings。前端6项检查及构建通过；Go配置测试新增workspace保存后Agent直接读取、模型修改不覆盖Key/补全开关及移除同步。observer测试覆盖共享事件、focus/visibility、旧响应丢弃与卸载取消。隔离8098浏览器确认两个入口显示相同配置弹窗；通过workspace API写入虚构Key后Agent模型/发送可用，原API移除后Agent禁用发送；没有调用真实模型或修改用户Key。截图：[共用配置](screenshots/agent-shared-key-dialog.png)、[复用后状态](screenshots/agent-shared-key-ready.png)。

## 默认会话与重命名

空列表初始化时创建并选中一条“新建会话”；点击新建立即保存并加入历史，不需要先发送消息。后端Ensure串行处理空列表检查与创建，避免同进程并发初始化产生重复默认会话。删除最后一条后补建默认会话。历史项编辑按钮打开横向重命名表单，名称去除首尾空白，限制1–80字符并拒绝控制字符；手动命名不会被首条问题覆盖。

完整Go测试、vet/build通过，包含并发Ensure、重启恢复、非法名称、执行中拒绝重命名和保存冲突回滚。前端格式、lint（7项检查）及build通过，保留原有2条effect警告和大包提示。

以隔离空状态目录启动正式main.go（8100），浏览器确认自动生成一条、新建立即生成第二条、空白名称校验、中文名称保存和刷新恢复；重命名非当前会话不影响当前选择和草稿。检查亮暗主题及390px历史抽屉，重命名表单保持左右布局，页面scrollWidth为390。截图：[改名后的列表](screenshots/agent-session-renamed.png)、[亮色表单](screenshots/agent-rename-dialog.png)、[窄屏表单](screenshots/agent-rename-narrow.png)。本轮未调用真实模型或数据库，未修改用户会话数据；删除后补建由服务与接口测试覆盖，未做本轮浏览器删除操作。

## 模型选择器排版

模型入口改用filled与主题淡色背景，菜单所有模型项补齐蓝鲸图标；配置项使用同宽图标列并左对齐。格式、lint（7项检查）和build通过，保留现有警告。隔离8101服务核对亮暗与390px，默认14px字体、页面scrollWidth为390，菜单和配置入口完整可见。未配置Key，模型项禁用是正常状态；未调用模型或数据库。截图：[暗色菜单](screenshots/agent-model-menu-dark.png)、[亮色菜单](screenshots/agent-model-menu-light.png)、[窄屏菜单](screenshots/agent-model-menu-narrow.png)。

## 输入绑定修正

Sender改为直接绑定Form.Item，移除隐藏字段与useWatch回填输入值的中转。格式、lint（7项）和build通过。隔离8102浏览器连续键入ceshi、输入中文、Shift+Enter换行与刷新草稿恢复均正常。截图：[输入与草稿](screenshots/agent-input-draft.png)。浏览器自动化直接输入中文不等同于Windows微软拼音composition，尚未复现和验证用户的系统输入法候选确认流程，不能据此认定IME故障已完全消除。

## 顶部错误与模型外观恢复

非弹窗错误移至标题栏下方独立区域，去重展示布局、会话、AI设置、SSE及工具结果错误；流式错误保留未完成片段，错误不再充当助手回答或结果卡片。模型恢复borderless与透明背景，菜单图标保留。格式、lint（8项）和build通过；旧后端ensure拒绝提示重启且无自动重试的测试通过。

只读核对8080的OpenAPI，当前运行版本不包含ensure和重命名接口；需用户停止旧Go进程并在后端目录go run main.go，未替用户中断其服务或更改启动配置。隔离8103浏览器核对无背景模型入口及亮色断连错误位于头部，390px下错误区域top=56、页面宽度390。截图：[透明模型入口](screenshots/agent-model-plain.png)、[顶部错误](screenshots/agent-errors-header.png)。未调用模型或业务数据库。

## 过程去边框与结果标题调整

ProcessCard移除Card外框及Think展开正文左侧装饰线，思考保留蓝鲸，执行过程使用CodeOutlined；查询结果卡片标题背景使用colorFillAlter中性色，蓝色仅保留图标和行悬停点缀。格式、lint（8项）和build通过，保留现有警告。临时展示页加载真实组件，检查亮暗标题背景、展开/折叠及390px宽度；使用预置数据，不调用业务接口。该展示页不替代完整Agent运行回归，已清理。截图：[亮色组件](screenshots/agent-process-neutral-light.png)、[暗色组件](screenshots/agent-process-neutral-dark.png)。

## 回车发送修正

Sender内置发送状态在自定义footer且suffix=false时可能停留为空输入时的禁用值。回车改为直接读取Form当前值并调用同一submit，返回false阻止内置重复发送。检查和构建通过，8项测试通过。临时真实Composer展示页使用本机计数回调：ceshi+Enter计数1，Shift+Enter换行仍为1，多行Enter为2，空输入Enter仍为2，按钮发送为3；未调用模型。截图：[回车与按钮验证](screenshots/agent-enter-submit.png)。IME保护有单元测试，未新增Windows原生输入法实测。临时展示文件和服务已清理。

对话错误位置调整：SSE及查询执行错误移到输入框正上方，使用独立的对话错误region，与输入区同宽；页面加载、布局和模型配置错误仍在头部。前端格式、lint（8项）和build通过；本次未重跑浏览器，不把静态检查作为位置实测。

## 消息末尾错误、过程内结果与取消次数上限

对话错误移至Transcript末尾，随消息滚动；结果表格放入对应执行步骤，收起和隐藏过程时一并隐藏。前端lint（8项）和build通过；临时真实Transcript浏览器验证默认不显示表格，展开显示，隐藏后表格消失，错误保持在消息末尾，未访问模型和数据库。截图：[过程内结果](screenshots/agent-results-inside-process.png)。展示文件与服务已清理。

移除单次4工具、累计16工具和10轮主模型调用限制，保留取消、180秒及数据大小约束；后端模块测试和vet、全后端build通过。新增8工具单次流与20次工具/21轮模型回归，均超过原限制。

## 虚拟滚动及统一顶栏

react-virtuoso动态高度按轮次虚拟化；600轮隔离组件浏览器实际挂载2–6轮，验证首轮/第300轮跳转、搜索摘要、表格展开及卸载返回折叠保持、阅读历史时追加不拉回、末尾追加bottomGap=0、新问题回到末尾。纯分组与刻度测试新增，前端9项检查和build通过。数据仍完整保留内存，单轮内部不再细分虚拟化；本次未做真实模型长时间性能基准。后续按用户要求去除总数及激活样式，正文左侧增加导航留白。

Workspace与Agent共用PageHeader，56px、workspace-inset、surface背景和右侧16px间距一致，Agent顶栏铺满并有返回工作区按钮。隔离8108正式服务浏览器验证返回后workspace新建连接/查询/DeepSeek/Agent均保留。截图：[统一顶栏](screenshots/agent-shared-header.png)。测试未访问业务数据库或调用模型。保留已有effect警告，虚拟列表引用传递有oxlint react(refs)提示。

居中复核：隔离8109浏览器1280px视口，主区域left=232/right=1280，输入框left=308/right=1204，左右留白均76px。统一960px容器、对称32px内距；虚拟列表取消额外stable滚动槽占位。构建通过，截图screenshots/agent-centered-layout.png。本次空会话位置实测，不作为有消息列表位置实测。
