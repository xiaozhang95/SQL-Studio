# 验证记录

日期：2026-10-23。环境：Windows + WSL Ubuntu 24.04；真实 MySQL 8.4.10，通过 Windows `127.0.0.1:3306` 访问。

## 已完成

- 前端 TypeScript + Vite 生产构建、Oxlint 检查、Prettier 格式检查。
- Go 编译、单元测试、`go vet ./...`。
- 通过 HTTP API 连接已提供的本机 MySQL 账号，读取库列表和真实 SELECT 结果。
- 独立随机测试库的真实 MySQL 集成测试：INSERT、影响行数、只读模式拒绝 INSERT / 注释 UPDATE / CTE UPDATE、拒绝多条语句、超时取消、行数截断、重复列名、NULL、BIGINT 大整数、DECIMAL 原始精度。
- 真实元数据 API：库列表、表列表、字段定义、DDL。
- 密码加密落盘、更新时保留密码、重新打开配置、密文篡改检测、密钥缺失保护、跨源请求拦截、重复 JSON 输入拒绝。
- 浏览器打开开发版和 Go 提供的生产构建版、执行真实查询、展开库表、字段列表、DDL 切换、表数据预览、结果筛选、历史记录。
- 浏览器验证编辑连接时密码不回显、使用已保存密码测试连接、留空密码保存后继续正常访问数据库。
- `start.ps1 -Build -Background` 启动、`stop.ps1` 停止、再次启动、健康检查、网页 HTTP 200 和重启后的真实查询；服务保留在后台供直接使用。
- CTE UPDATE 的实际影响行数与二进制值的十六进制展示。
- 预览截图：`docs/preview.png`。CSV 导出按钮已操作，下载文件内容尚未单独核验。

## 边界

- 集成测试仅在自动生成的测试库中写数据并自动删除；没有修改已有业务表。
- Redis 6379 端口可达，但首版没有 Redis 数据操作功能。
- 默认仅本机单人使用；未验证远程 MySQL、TLS、SSH 隧道、多人访问和长时间负载。
- 前端大依赖会触发 Vite 的包体积提示，生产构建正常完成；后续可按编辑器和 Ant Design 模块继续拆包。
- 暂无独立前端自动化回归测试，当前交互以真实浏览器检查为依据。

## 格式与目录整理（2026-10-23）

- 已实读本机 `ghspace-polardb-web` 的 `.prettierrc`、`.prettierignore`、package 脚本及 src 目录，采用其引号、分号、行宽和 import 分组规则。
- 前端调整为页面工作区、services、typings、utils 分层，Vite / TypeScript 同步配置 `@/`；API 参数和路径集中到 services，页面私有组件和类型保留在工作区。
- 新增 `.editorconfig`、VS Code 保存格式化配置和推荐扩展、前后端格式脚本；后端继续使用 `gofmt`。
- 已通过：根目录 `format.ps1`、`format.ps1 -Check`、前端 `pnpm lint` / `pnpm build`、后端 `go test ./...` / `go vet ./...`。
- 本次后端默认测试未启用 MySQL 集成测试；数据库与界面的真实联调证据见上方首版记录。本次目录和格式整理未重新进行浏览器验证。

## 后端分层重构（2026-10-23）

- 将启动入口迁到 `cmd/sql-studio`，实现 `internal/app`、`config`、`httpapi`、`service`、`model`、`mysql`、`connection` 分层，移除根目录重复的旧实现。
- HTTP 层不直接调用 SQL 驱动或文件系统；业务层通过 `ConnectionRepository` / `Database` 接口编排，具体实现仅在应用装配层选择。
- 迁移原有密码存储、SQL 分类、安全请求和 MySQL 回归测试；补充配置校验、初始化不覆盖凭据、API 不返回密码、业务限额/超时、并发名额归还测试。
- 新增依赖方向测试，防止后续代码越层访问 HTTP、数据库或配置文件；新增 `check.ps1` 统一格式、测试、静态检查和编译。
- 已运行并通过：`check.ps1 -Integration`，包含所有包测试、架构测试、真实 MySQL 独立临时库回归、`go vet ./...` 和 `go build ./...`。
- 更新根目录 `start.ps1` 后实际构建、停止旧服务并后台启动新程序；网页 HTTP 200，MySQL 版本 8.4.10，在线验证数据库/表/字段/DDL 和 SELECT API 正常，大整数结果精确保留。
- 重启前后对现有 `connections.json` 和 `master.key` 比较 SHA-256，文件内容不变，默认连接 ID 不变；新程序可继续使用原有加密凭据。
- 本次完成了在线 HTTP 联调，未重新进行浏览器交互测试。新后端继续在 `http://127.0.0.1:8080/` 提供服务。

## Gin、多数据库与工作区改版（2026-10-23）

- 后端使用 Gin 1.12.0，保留原有分层和接口；新增 pgx/v5 5.11.0、PostgreSQL 驱动层及按协议分派的注册表。健康检查实际返回 framework=gin。
- 新增 MySQL、MariaDB、PolarDB MySQL、PostgreSQL、PolarDB PostgreSQL、PolarDB Oracle 兼容六种配置；存量连接默认 MySQL，原有加密凭据可继续使用。
- 前端新增数据库和表选择器，与左侧对象树共用状态；PostgreSQL 支持 Schema 限定、跨 Schema 同名表及对应 SQL 方言。移除字体族、字号和字重覆盖，保持系统/组件默认值。
- 调整为固定视口工作区：左侧对象、右侧 SQL 编辑器及工具栏固定，库表树和结果独立滚动。浏览器实际滚动结果 2,220px 后，编辑器和侧栏 top 坐标未变，页面 scrollY=0，document 高度保持 884px。
- 新建/编辑连接改为类型列表与常规/SSL 页签；测试结果持久显示。浏览器发现并修复动画结束重置测试提示的竞争问题，快速打开并立即测试后，MySQL 8.4.10 成功提示保持可见；编辑密码不回显、留空复用现有密码。
- 已通过前端 pnpm format / pnpm lint / pnpm build；后端 check.ps1 -Integration -PostgresIntegration，包括格式、单元/架构/双协议真实集成测试、go vet 和 go build。
- PostgreSQL 18.6 使用工作区独立临时集群、仅监听 127.0.0.1:15432；集成覆盖特殊 Schema/表名、字段与 DDL、视图、NULL、BIGINT、NUMERIC、BYTEA、重复列、只读/CTE 拦截、多语句拒绝、RETURNING 和超时。
- 浏览器真实查询 public.sample_rows 与 sample.sample_rows，分别显示正确 Schema 的内容；9007199254740993 保持精确。截图为 docs/postgres-preview.png。
- 最终生产构建浏览器验证 MySQL 数据库/表选择、CHARACTER_SETS 数据预览（41 行）、连接类型及 Oracle 兼容表单。截图更新为 docs/preview.png、docs/connection-dialog.png。
- 已删除仅供本次验证的 sqldesk_ui_check 数据库和临时连接，停止并移除独立 PostgreSQL 测试集群。SQL Studio 8080 服务与原有 MySQL 连接继续可用。
- 无云端 PolarDB 连接凭据；PolarDB PostgreSQL/Oracle 类型仅在普通 PostgreSQL 上验证路由和协议，未验证云实例或 Oracle 专有 PL/SQL。MariaDB 无独立实例联调记录。TLS 驱动配置经过测试，真实 TLS 握手未验证；PostgreSQL DDL 为基础结构重建，覆盖边界见 DATABASES.md。

## 主题、查询范围与底部伸缩面板（2026-10-23）

- 已实读 ghspace-polardb-web 的 constant/theme/index.ts、app.scss、SQL 窗口及 bottomDock，采用 Ant Design 主题算法、普通文字黑/白和底部拖动面板的方向；保留本项目已有分层和格式约定。
- 提供亮色、暗黑、跟随系统三种偏好，初始系统主题为暗色；浏览器实际切换并验证亮色文字 rgb(0,0,0)、暗色文字 rgb(255,255,255)。连接窗口、SQL 编辑器及历史抽屉跟随暗色，刷新可保留手动选择。系统运行时配色变化的订阅已实现，本次未更改操作系统设置做联调。
- 库表下拉移到运行 SQL 旁，QueryTab 独立保存连接、库、Schema、表和 limit；SQL、活动标签及范围存储到浏览器，旧草稿兼容补齐字段。浏览器实际验证新建继承 information_schema/CHARACTER_SETS，再将新查询改为 sys/version，分别返回 41 行和 1 行；切回恢复原库表、SQL 和结果。
- 新查询继承同一张表时保留有效元数据；切换不同范围重载并取消旧请求。刷新验证活动标签、sys/version 和 SQL 正确恢复；加载过程中表标签显示可读名称，不暴露内部编码。验证创建的额外查询标签已关闭，原查询草稿保留。
- ResultsDock 默认停靠底部 260px；浏览器实际鼠标拖动从 284px 调整到 394px，键盘调整/边界（180px、当前最大 442px）生效，折叠为 48px，展开恢复，双击拖动柄恢复 260px。刷新保留已调整高度，执行 SQL 自动展开。
- 在 1023×884 视口，默认 SQL 内容区高度 322px，工具栏左右区域 top 同为 173px，运行与库表选择保持同一行；页面 document 高度与视口同为 884px，无纵向页面滚动。
- 已通过 pnpm format、pnpm lint（TypeScript + Oxlint）、pnpm build；浏览器控制台无 error。此次修改仅涉及前端和文档，未重复运行后端集成测试。
- 截图：docs/preview.png（亮色）、docs/preview-dark.png（暗色）、docs/connection-dialog-dark.png（暗色连接窗口）。

## design 参考图与界面精简（2026-10-23）

- 已查看 sql-web/design/数据库连接弹窗-重设计.png，按其左右分区、表单顺序、必填校验和独立底部操作栏调整新建/编辑连接。采用现有 Ant Design 图标区分产品，未引入新的图标依赖。
- 类型标题显示默认端口 Tag；本地加密、连接成功和版本反馈集中呈现。SSL 说明留在 SSL 页签，移除重复的协议、远程连接提示及密码加密说明；编辑留空密码的提示仍保留。
- 工作区取消重复大标题、编辑器说明栏、页脚和空态教程。连接类型/地址、库表数量、结果状态/行数/耗时/来源、字段类型/主键、历史执行状态使用 Tag。结果来源保留完整 Tooltip，库名和类型仍可搜索，不通过展示节点文字反推原始库名。
- 浏览器验证本机 MySQL 8.4.10：编辑密码不回显，留空使用已保存凭据测试成功，版本与成功 Tag 正常；未保存或改写现有连接。
- 浏览器验证空主机字段就地报错、MySQL/PolarDB Oracle 兼容类型切换后的默认端口和用户名、PostgreSQL 初始数据库、常规/SSL 页签。暗黑 PolarDB 表单在 1023×884 视口内完整显示，底部操作栏位于 y=736–801。
- 浏览器验证信息库 CHARACTER_SETS 查询 41 行、字段列表 4 字段、搜索 CHARACTER_SETS、数据库节点名称/数量同排（24px 行高）、结果面板上下键调整；历史抽屉展示新的状态/耗时/范围 Tag。
- 最终亮暗模式普通文字分别为 rgb(0,0,0) / rgb(255,255,255)，默认 SQL 内容区 427px，页面高度与视口均为 884px；浏览器控制台无 error。
- 已通过 pnpm format、pnpm lint、pnpm build 与最终格式检查；本次仅修改前端与说明，没有重新执行后端集成测试。原有大包体积提示仍存在，构建成功。
- 更新 docs/preview.png、docs/preview-dark.png、docs/connection-dialog.png、docs/connection-dialog-dark.png，新增 docs/connection-validation.png。原始 design 图片保持原样。

## 深色标签、品牌图标与模块规范（2026-10-23）

- 参照本机 ghspace 前端的目录、模块说明、主题与格式规则；拆出工作区组件、业务 hook、连接表单 hook 和公共主题 hook。组件、自定义 hook、constant/typings/services/utils 模块各有独立目录、入口和 README，工作区入口仅组合区域；补充范围切换、取消、草稿迁移及凭据保留的中文注释。
- Tag 使用安装版本 Ant Design 支持的全局 `variant: solid`。新建连接改为文字主按钮；运行 SQL 排在数据库和表下拉之后，历史入口固定在侧栏底部。数据库标识使用 MySQL、MariaDB、PostgreSQL 和 PolarDB 品牌原图，来源见 assets/databases/README.md，不再绘制通用图标冒充产品标识。
- 亮色可见普通图标逐项检查无灰色；普通文字亮色黑、暗色白，语义图标与状态保留色彩，字体保持系统/Ant Design 默认。截图发现 Switch 将白色文字 token 复用为轨道导致标签不可见，已独立配置轨道；浏览器复测未选中背景 rgb(0,0,0)、标签 rgb(255,255,255)。
- 真实浏览器验证 MySQL 8.4.10 连接测试（编辑密码留空复用原凭据）、CHARACTER_SETS 查询 41 行和 4 字段结构、新查询继承库表、切回原查询恢复结果；未保存测试连接或修改已有凭据。最后刷新后原查询范围和 SQL 正确恢复，再执行仍返回 41 行。
- 检查亮色/暗色工作台和连接窗口、PolarDB Oracle 兼容默认 5432/postgres、SSL 页签、空主机就地校验和底部历史抽屉。1177×884 视口中选择器与运行按钮同排；历史按钮 y=840，固定在侧栏底部。
- 结果面板鼠标拖拽从 260px 增至 360px，Home 到 180px，方向键每次 24px；折叠/展开与双击恢复 260px 生效。最终保持默认高度，SQL 编辑区约 427px。桌面连接类型侧栏加宽至 280px，避免 Oracle 兼容标签末字单独换行。
- 后端保持 Gin 与原有分层，每个 internal 包新增 README 与 doc.go；入口和测试目录同步说明，新增包文档架构测试。项目 .agents/skills/sql-studio/SKILL.md 与根 AGENTS.md 记录目录、注释、主题、数据库协议边界和验证规则；skill-creator 官方 quick_validate 校验通过。
- 已通过 pnpm format、pnpm lint（类型、Oxlint、前端模块文档/链接）、pnpm build；后端 check.ps1 通过格式、单元/架构测试、go vet 和 go build；根目录结构/文档链接检查通过。本轮未重新启用数据库集成测试，云端 PolarDB 与 MariaDB 独立实例仍沿用之前记录的未验证边界。生产构建仍有现有大包提示，不影响完成。
- 最终截图更新为 preview.png、preview-dark.png、connection-dialog.png、connection-dialog-dark.png、connection-validation.png；原始 design 文件保留。实际浏览器控制台无 error。

## 标注 UI 精简与弹窗固定布局（2026-10-23）

- 按两张用户标注图移除顶栏品牌/本地标签、侧栏连接管理标题及新建按钮、连接类型/地址标签、对象树及历史数量标签。顶栏改为新建连接/新建查询按钮；查询标签栏仅切换/关闭，避免重复加号入口。只读 Tag 与开关合并，取消重复 LIMIT 标签；结果行数及字段数改普通文字，保留语义状态和实际结果来源。
- 连接类型激活项使用主题色背景及对比文字；弹窗内容固定 580px 并受视口高度限制，左侧类型与右侧设置独立滚动。切换数据库类型、常规/SSL 和校验状态不改变外框及底部操作栏。
- 1177×884 浏览器实测亮色及暗色：侧栏 Tag=0、查询标签栏 Tag=0、只读开关=1，页面高度=视口高度=884px。新建查询继承当前库表，SELECT 1 返回 1 行，切回原标签恢复只读；本次创建的查询已关闭。原信息库 CHARACTER_SETS SQL 执行成功返回 41 行，原有草稿保留。
- 弹窗 MySQL、PolarDB Oracle 兼容、SSL 页签及校验后内容高均 580px，底部操作栏 y=732；长表单 scrollHeight=588px，实际滚动右侧到 8px 后页脚位置及页面 scrollY=0 不变。亮色选中背景 rgb(22,119,255)，暗色 rgb(105,177,255)，文字与勾选图标保持可辨认。
- 验证顶栏新建连接、底部历史抽屉、空主机就地校验；没有保存测试连接或修改数据库/凭据。浏览器控制台无 error，已恢复原亮色主题，更新五张 UI 截图。
- pnpm format、pnpm lint、pnpm build 及全项目结构/文档链接检查通过；生产构建仍有现有大包提示。本轮只调整前端与说明，未重复运行后端或数据库集成测试。

## SCSS、原生主题与折叠历史（2026-10-23）

- 确认入口原本已引入 antd/dist/reset.css；本次将 src/index.css 与 pages/workspace/index.css 迁为 SCSS，保留 reset 在应用样式之前，更新 import、Sass 依赖、格式规则、编辑器配置和说明。Sass 1.106.1 使用 JavaScript 编译器，可选 @parcel/watcher 安装脚本明确关闭；依赖安装和生产构建通过。
- 移除手写亮暗颜色表、全局 Tag solid 和 Switch 背景覆盖。SCSS 通过 sql-studio-theme 作用域引用 Ant Design 原生 token；普通文字仍黑/白，不覆盖兼作背景的 colorTextQuaternary/Tertiary。Tag/按钮保持默认变体；类型 Tag 亮色背景实测 rgb(245,245,245)、文字黑色，不再是黑底。
- 数据库选中态仅用原生 primary 背景和白字，尾部勾选已删除；对象树选中态同样引用 primary。浏览器实测亮色 #1677ff、暗色 #1668dc，暗色选中背景与保存连接按钮同为 rgb(22,104,220)，选中项没有尾部图标。弹窗高度及固定操作栏保留。
- 修复连接选项 inline-flex 基线和过高装饰图标撑高 Select 的问题；选项使用 flex，图标容器 20px。浏览器选择器与菜单按钮均 y=72、高度 32px，不强行设置全局控件高度。
- SQL/DDL CodeMirror 编辑器与 scroller 使用字体继承，不指定新字体族/字号。浏览器 SQL 编辑器 fontFamily 与 Ant Design 页面系统字体完全一致，正文为页面默认 14px；原有高亮、补全与快捷键逻辑保留。
- 历史抽屉使用 Ant Design Collapse accordion，初始收起，仅展开一条详情；保留完整 SQL、来源、耗时、错误、载入和清空确认。浏览器验证展开第一条后切换第二条，aria-expanded 从 true/false 变 false/true；搜索 SELECT 1 得到正确记录，详情载入独立查询且未执行。临时查询已关闭，搜索和原查询已恢复。
- 长 SQL 摘要通过 min-width:0 和省略号约束；最终历史抽屉 clientWidth=scrollWidth=550px，无横向溢出。MySQL 信息库查询返回 41 行，结构为 4 字段；原有连接、凭据和 SQL 草稿未改写。
- pnpm format、pnpm format:check、pnpm lint、pnpm build、全项目结构/文档链接检查通过；同步修正项目 skill 的过时 solid 规则并通过官方 quick_validate。实际亮暗浏览器控制台无 error。本轮未改后端，未重新运行后端和数据库集成测试；现有大包构建提示保留。
- 更新 preview.png、preview-dark.png、connection-dialog.png、connection-dialog-dark.png、connection-validation.png；新增 history-collapse.png、structure-light.png。已恢复亮色、原查询及 260px 默认结果高度。

## 本轮进行中：solid 标签与分区（2026-10-23）
- 已将默认信息标签改为蓝色 solid，语义状态保留对应颜色；新建表单仅预填端口，切类型不再填入名称、账号或初始库。
- 增强连接左栏和历史 SQL 背景、压缩列表间距，统一原生滚动条，分页增加底部 sticky，树选中文字继承选中态颜色。
- pnpm format/lint/build 通过。尚未进行本轮浏览器验证；右键菜单、多结果以及结果区结构调整尚未完成。


## 完成：表右键、多结果与固定分页（2026-10-23）

- 已完成前轮尚未实现的表/视图右键菜单：新建查询、查询数据、查询结构、查看 DDL；菜单使用原始连接/库/Schema/表作为目标，不依赖当前选中表。新建查询仅生成限定表 SQL，不直接执行；查询数据沿用后端只读接口。
- 底部改为多个可关闭结果快照，不再放查看数据或固定的结构/DDL 切换按钮。SQL、数据、结构与 DDL 每次追加独立标签，切换保留旧结果；查询标签间隔离，关闭查询释放结果。结果只在内存，未改变后端单 SQL 请求契约。
- Table 自带分页关闭，Pagination 置于滚动区外；每页 50 行，筛选/导出针对当前结果。信息 Tag 为蓝色 solid，语义状态使用对应颜色，表树激活文字白色；连接类型与历史 SQL 背景增强，列表间距压缩。新建连接只预填端口，切换 PolarDB 后其他字段仍为空。
- 弹窗语义样式和新的结果布局使用组件 styles/style；SCSS 保留跨区域布局和全局滚动条，原生横纵滚动条统一 rgb(124,138,154)，取消原有 Table sticky 仿制滚动条。
- 实际浏览器验证本地 information_schema：SQL 返回 CHARACTER_SETS 41 行、右键 COLLATIONS 数据 286 行，第二页首行编号 51、第三页首行 101；分页 y=812 在内容滚动前后保持不变，稳定翻页后内容 scrollTop=0。
- 浏览器验证数据、结构、DDL 四个结果同时保留；切回原 SQL 后仍是 41 行，关闭单个结果不影响其他结果。右键新建查询生成正确限定表 SQL，验证创建的查询已关闭，原有查询草稿未改动。没有修改业务库或连接凭据。
- 实测亮暗信息 Tag 均为 solid；暗色连接选中背景 rgb(22,104,220)、文字白色；历史 SQL 背景为原生 fill-secondary，抽屉滚动条与结果一致。当前侧栏选中文字实测 rgb(255,255,255)，浏览器控制台无 error。当前窄浏览器窗口保留项目既有横向工作区滚动。
- pnpm format、pnpm lint、pnpm build 通过；模块文档、开发约定和项目 skill 同步更新。截图 connection-dialog.png、connection-dialog-dark.png、multi-results.png。本轮仅前端变化，未重新运行后端集成测试。

## 六项标注样式修正（2026-10-23）

- 实读 ghspace 的 app.scss、SQL 窗口 Tabs 和 executeSqlResultNode，参考其 tabBarStyle marginBottom=0、组件内布局与容器滚动边界，不迁入 Umi 或业务模块。
- 连接窗口左右统一 surface，以原有竖线分隔。亮色两侧均 rgb(255,255,255)，暗色均 rgb(20,20,20)。本地加密 Tag 放在表单标题区默认端口 Tag 旁，数据库类型切换后仍可见，左栏不再保留底部标签。补齐用户名、初始库与端口 placeholder，仍只预填端口。
- 无任何结果快照时 QueryResults 返回 null。浏览器验证初次加载和关闭最后一个结果后面板数均为 0，编辑器扩展至剩余 804px；执行后零行/错误仍可展示反馈，不误删实际结果。
- 实际 hover 检查发现原生 Tree 的 nodeHoverColor 规则优先级高于原局部选择器；将修正限定到选中树行层级。亮色数据库、表节点和暗色表节点实际 matches(:hover)=true 时文字均 rgb(255,255,255)，不再变黑。
- 查询与结果 Tabs 统一 tabBarGutter=4、页签实际高度 40px，顶部/水平留白一致；结果 nav margin=0，并移除原 46px 固定行高与默认下边距叠加，避免 Tab 挤压工具栏。
- 新增 useResultTableLayout 及 README，ResizeObserver 测量结果容器和表头，向 Table scroll.y 分配表体高度。横纵滚动只交给 Table body，外层不再嵌套滚动。实测拉伸后表体 bottom=810、分页 top=812；PageDown 后表体 scrollTop=246，滚动条完整保留在分页上方。默认 260px 与拉伸模式均检查，截图保存 result-scrollbar.png。
- 实际浏览器查询 information_schema.CHARACTER_SETS 返回 41 行，原查询和凭据保留；验证面板拉伸、最后结果关闭、再次查询、亮暗切换，已恢复亮色和默认面板高度。控制台无 error。
- pnpm format、pnpm lint、pnpm build 及全项目文档/链接检查通过。同步相关组件 README 和 hook 索引，更新 connection-dialog.png、connection-dialog-dark.png；本轮未修改后端或重跑后端集成测试。

## 默认样式、结果页签与 SQL 导入（2026-10-23）

- 移除 ConfigProvider 中自定义文字、placeholder 和 Tree token；保留 Ant Design 原生亮暗算法、默认 primary 及此前要求的 solid Tag。合并两处 SCSS 为 src/app.scss，入口先加载 antd/dist/reset.css，原生组件覆盖统一放在 app.scss。
- 结果改用原生 line Tabs，与连接常规/SSL 页签一致；多个结果切换、鼠标关闭及键盘 Enter 关闭均实际验证。修复关闭按钮焦点事件被父页签接管的问题。
- 删除前端行数上限选择、只读/写入开关、状态、查询参数与确认逻辑；服务端默认只读和返回上限保持不变。本轮没有修改后端。
- 添加导入 SQL：UTF-8（含 BOM）文件载入独立查询，使用文件名，不覆盖原查询、不自动执行。实际验证正常导入并手动运行 SELECT 1；空文件和超过 1 MiB 文件均正确提示，测试查询和临时文件已清理。
- 引擎列表与数据库对象树未选中项 hover 实测均为 rgba(0,0,0,0.04)。PostgreSQL 与 PolarDB Oracle 表单无额外纵向溢出；亮暗 PostgreSQL clientHeight=scrollHeight=600px，placeholder 分别为原生 rgba(0,0,0,0.25) 和 rgba(255,255,255,0.25)。截图更新 connection-dialog.png、connection-dialog-dark.png、query-tabs.png。
- pnpm format、pnpm lint、pnpm build 通过；浏览器控制台无 error。更新组件、hooks、开发文档及项目 skill；未重新运行后端集成测试。保留现有 Vite 大包提示和窄窗口横向工作区滚动。

## 辅助脚本与日志清理（2026-10-23）

- 删除根目录 start.ps1、stop.ps1、format.ps1，以及 sql-server/check.ps1、format.ps1；同步现行文档为 pnpm、gofmt、go test/vet/build/run 原生命令。结构检查脚本仍被 pnpm lint 使用，保留。
- 清除旧 .server.pid 标记。backend.log、backend-error.log 被进程占用，删除失败，暂时保留；未停止服务或修改连接数据。
- node scripts/check-structure.mjs 通过。本轮无业务源码变动，不重复 UI 或数据库集成测试。历史验证记录保留当时的脚本名称。

## 2026-10-23 查询工具栏与执行历史表格

- 导入 SQL 移至运行工具栏右侧，旁边增加导出当前标签完整 SQL；空白 SQL 禁用导出。浏览器实际下载“查询 1.sql”，读取文件确认内容为原始 SELECT 1;。
- 执行历史改为每页 10 条的 Table，支持状态筛选、时间/耗时排序和展开 SQL 详情。修正详情表头换行：列宽 72px，标题保持单行；展开区移除重复连接信息，完整 SQL 使用主题背景、细边框并提供复制入口，可选 Schema 和失败原因保留。
- 结果快照保存 query/data/structure/ddl 类型，页签显示对应图标。浏览器运行 SELECT 1 成功，确认 SQL 结果页签图标及工具栏按钮顺序；不访问业务表。
- 在默认窄视口和 1100×800 视口检查历史表头与展开详情，验证 SQL 搜索空态；亮暗主题均检查并截图，验证后恢复跟随系统及原视口。截图位于 [暗色历史](../artifacts/ui-20261023/history-dark.jpg)、[亮色历史](../artifacts/ui-20261023/history-light.jpg)、[工作区](../artifacts/ui-20261023/workspace-dark.jpg)。
- 验证：pnpm format、pnpm lint、pnpm build 与 node scripts/check-structure.mjs；构建仍提示前端主包超过 500 kB。本次仅修改前端与说明文档。

## 2026-10-23 简化结果面板

- 移除结果区右侧展开/折叠按钮、折叠状态和拖动/Enter 折叠逻辑；有结果直接显示，没有结果隐藏整个面板。
- 真实页面执行 SELECT 1，确认结果直接显示且无折叠按钮；拖动高度从 260px 到 330px，再拖至最小 180px，内容不折叠，双击恢复 260px。关闭最后一条结果后面板隐藏。未访问业务表。
- 亮暗主题均检查；截图：[暗色结果面板](../artifacts/ui-20261023/results-resizable-dark.jpg)、[亮色结果面板](../artifacts/ui-20261023/results-resizable-light.jpg)。验证后恢复跟随系统主题。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs 和 git diff --check 通过；构建保留主包体积提示。

## 2026-10-23 MySQL 收敛与工作区细节

- 上下查询页签激活文字统一引用 colorPrimary。浏览器读取最终计算色：暗色均 rgb(22,104,220)，亮色均 rgb(22,119,255)。
- 结果索引固定左侧，分页右对齐；使用常量查询生成宽表，横向滚动 scrollLeft=634 后索引仍保持 sticky、left=0、x=285。
- 库右键增加选择数据库、新建查询、查看表列表、刷新结构；表右键菜单增加图标。菜单事件停止冒泡，避免右键动作改变其他查询窗口范围。验证 sys 新建查询仅创建窗口、不执行；information_schema 的 CHARACTER_SETS 结构查询成功。未访问业务表。
- 新建连接仅展示 MySQL，前后端移除其他产品类型、专属 Schema/初始库字段、协议分派、驱动代码、pgx 依赖、对应集成测试及品牌图片。旧非 MySQL 连接不再返回可用列表，不删除磁盘记录。补充拒绝被移除类型和保留旧记录的服务回归测试。
- 后端已重启，health 返回 status=ok。pnpm format/lint/build、gofmt、go test -count=1 ./...、go vet ./...、go build ./...、目录与 diff 检查通过；未开启写入临时数据库的集成测试，构建仍有主包体积提示。
- 截图：[暗色结果](../artifacts/ui-20261023/mysql-results-dark.jpg)、[亮色结果](../artifacts/ui-20261023/mysql-results-light.jpg)、[库菜单](../artifacts/ui-20261023/database-menu-dark.jpg)、[表菜单](../artifacts/ui-20261023/table-menu-dark.jpg)、[MySQL 连接窗口](../artifacts/ui-20261023/mysql-only-connection-dark.jpg)。测试后恢复跟随系统主题及原 SQL 文本。

## 2026-10-23 结果文字与页签统一

- 字段类型改为表头第二行的普通文字，NULL 改为次级文字 `(NULL)`；结果工具栏移除连接/数据库标签，状态和耗时使用图标加文字。结果区实际 Tag 数量为 0。
- 查询与结果共用 workspace-tabs 和原生 editable-card：亮暗主题实测页签高度均 40px、padding 均 8px 16px、导航 padding 均 8px 12px 0px，背景与激活文字色一致。保留不同操作的结果图标与原生关闭按钮。
- 浏览器仅执行常量 SELECT/UNION ALL，验证数字、文字、NULL、多结果切换与关闭；关闭最后一个结果后面板隐藏。测试查询已关闭，恢复跟随系统主题；未访问业务表或改写连接。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs、git diff --check 通过。构建保留已有主包体积提示；本轮未修改后端。
- 截图：[暗色结果](../artifacts/ui-20261023/plain-results-dark.jpg)、[亮色结果](../artifacts/ui-20261023/plain-results-light.jpg)。

## 2026-10-23 按钮文案、历史固定区域与空白查询

- 工具栏按钮文案改为运行、导入、导出。顶部和数据库右键菜单新建查询的编辑器内容实测为空，未生成结果，空白查询禁用导出；原有草稿不改写，表菜单生成 SQL 的行为保留。
- 执行历史抽屉取消外层滚动，搜索、表头和分页固定，仅 Table body 滚动。表体保持分配高度，少量记录时分页仍位于底部。共用 useTableViewportLayout 测量表头、分页及其边距；结果分页在视口外时不重复扣除。
- 实际展开 5 条历史详情制造溢出，表体高度 438px、内容高度 900px，滚动前后搜索 top=94、表头 top=137、分页 top=646，抽屉 scrollTop=0；验证搜索无匹配、恢复搜索和收起详情。亮暗主题均检查，测试后关闭新增查询并恢复跟随系统。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs 与 git diff --check 通过；保留已有主包体积提示。本轮未修改后端或访问业务表。
- 截图：[固定历史暗色](../artifacts/ui-20261023/history-fixed-dark.jpg)、[固定历史亮色](../artifacts/ui-20261023/history-fixed-light.jpg)、[空白查询与按钮](../artifacts/ui-20261023/blank-query-toolbar.jpg)。

## 2026-10-23 SQL 补全与查询页签菜单

- 补全列表移除关键字 emoji 和匹配下划线，使用页面字体、主题背景/主色、圆角及阴影；条目 padding=6px 10px，长关键字完整显示。亮暗主题实测，上下键与 Enter 选择 SELECT 正常。
- 顶部查询页签整块支持右键关闭当前、其他、右侧。实际创建 5 页，关闭第 3 页右侧后保留 1/2/3 并激活 3；关闭后台第 2 页后仍激活 3；在第 1 页关闭其他后保留原 SQL。另用 localhost 独立草稿验证关闭最后一页后保留一个新空白编辑器，其他/右侧菜单禁用。
- 对象树初始均收起；点击 sys 文本后仍仅 4 个库节点，表选择器不持续加载。点击 sys 箭头后展示 105 个节点；再点击 information_schema 文本时 sys 展开状态保留、information_schema 不展开，打开表下拉才加载其列表。仅请求元数据，未执行 SQL 或访问业务表。
- 测试后关闭临时查询、恢复原草稿与跟随系统主题。pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs、git diff --check 通过；构建保留已有主包体积提示，本轮未改动后端。
- 截图：[补全暗色](../artifacts/ui-20261023/completion-dark.jpg)、[补全亮色](../artifacts/ui-20261023/completion-light.jpg)、[页签右键菜单](../artifacts/ui-20261023/query-context-menu-dark.jpg)。

## 2026-10-23 完整连接树与查询范围联动

- 侧栏改为连接 → 数据库 → 表/视图的一棵树；文本仅选择已打开范围，箭头按需加载。结构加载成功后连接图标恢复亮度、文字使用主色；连接菜单提供打开/关闭、刷新、编辑、删除。右侧连接/库/表三级选择，共享按连接隔离的缓存，仅提供结构加载成功的连接。
- 真实页面展开连接并加载库表元数据，选择 t_category 后右侧连接、库、表同步；未执行业务表查询。原 SQL 草稿保留，亮暗主题均检查，验证后恢复跟随系统。1280px 视口 documentWidth=1280，无额外页面横向溢出。
- 本机临时隔离服务使用虚拟连接验证：同名 shared/items 分别缓存；当前范围 alpha 时右键 beta 的查询，请求实际为 `/connections/beta/query`，结果为 beta。连接选择器仅包含已打开的 alpha/beta，切连接清空旧库表。
- 关闭连接后子项隐藏、图标及文字熄灭，选择器失效，SQL 草稿与已有结果保留；重新展开重新请求。模拟首次加载失败后重新打开恢复；12 秒延迟请求在加载中关闭，响应到达后仍保持关闭。编辑和删除弹窗均指向右键目标，测试均取消，未保存或删除真实连接。
- 长名称在树和连接选择器均实测 text-overflow=ellipsis，分别可用宽度 179/144px、内容宽度 216px；保留完整 title。截图：[暗色完整树](../artifacts/ui-20261023/connections-tree-dark.jpg)、[亮色完整树](../artifacts/ui-20261023/connections-tree-light.jpg)、[连接右键菜单](../artifacts/ui-20261023/connection-menu-dark.jpg)、[长名称](../artifacts/ui-20261023/connections-long-name.jpg)。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs 和 git diff --check 通过。构建保留既有主包体积提示；开发浏览器记录到既有 Ant Design Modal maskClosable 弃用提示。本轮未修改后端，关闭连接管理前端元数据生命周期，后端仍按请求释放数据库会话。

## 2026-10-24 精简选择器、树双击与连接历史

- 查询工具栏移除表下拉，仅保留连接、数据库、运行；表仍由树选择和右键操作。执行历史从侧栏底部移至导出之后，未选有效连接时入口禁用。真实页面检查按钮顺序为运行、导入、导出、执行历史，范围下拉仅连接/数据库两个。
- Tree 使用原生 expandAction=doubleClick，连接和数据库节点双击与箭头共用加载/展开/收起流程；单击文本仍只选范围，表叶节点不展开。实际验证连接和 qianguanguan 库双击加载、再次双击收起、箭头展开、根节点收起后再展开保留子树状态；只加载元数据，未查询业务表。
- 修复原生图标容器 inline-block 与品牌图标外层的基线偏移；统一 flex 对齐后实测连接、库、表的图标中心与选中背景中心差均为 0px。保留默认行高与字体，颜色覆盖和布局覆盖分开，选中图标继续继承选中态文字色。
- 隔离测试服务分别生成 A/shared、A/alpha_only、B/beta_only 三条模拟查询历史。B 只显示 1 条 B 记录；回到 A 后显示两个不同数据库的 2 条 A 记录，排除 B。历史使用连接 ID 匹配，搜索、分页和行详情继续有效；清空提示明确当前连接，确认回调仅筛除该连接记录。本轮测试取消清空，未删除真实历史或修改连接。
- 亮暗主题均检查，恢复跟随系统及原 SQL。截图：[暗色工具栏与树](../artifacts/ui-20261024/toolbar-tree-dark.jpg)、[亮色工具栏与树](../artifacts/ui-20261024/toolbar-tree-light.jpg)、[按连接筛选的历史](../artifacts/ui-20261024/connection-history-dark.jpg)。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs、git diff --check 通过。保留既有构建主包体积提示；本轮无后端修改。

## 2026-10-24 防止操作文字选中与重连恢复范围

- 树节点、查询/结果页签、顶栏、运行工具栏和菜单使用 user-select:none；工具栏搜索输入允许选择。编辑器、结果和历史 SQL 不受该规则影响。亮暗主题下实际双击连接、库及页签，window.getSelection() 均为空；编辑器全选仍返回原文 SELECT 1;，随后取消选择，草稿不变。
- 关闭连接改为只释放结构缓存、取消请求和清除当前字段缓存，保留全部查询标签的连接/库/表范围、SQL 及结果。关闭期间运行禁用、库选择暂时隐藏；实际关闭远程连接并重新双击打开后，qianguanguan 自动恢复选中，右侧同步恢复。
- 库列表加载成功且请求代仍有效时，通过 onDatabasesLoaded 调用稳定的 validateDatabases 回调；同时校验该连接的前台/后台查询，库已不存在才清空库/表。字段/DDL 加载也检查库仍存在，防止无效元数据请求；取消或旧代响应不触发范围校验。
- 本机隔离测试准备两页：前台 shared、后台 alpha_only。模拟断开后 alpha_only 不再返回；重连后 shared 保留并恢复，切到后台查询时数据库为空，原 SELECT preserved_draft; 完整保留。未执行真实业务 SQL、修改凭据或删除真实数据库。
- 截图：[暗色重连后选中](../artifacts/ui-20261024/reconnect-selected-dark.jpg)、[亮色防选中](../artifacts/ui-20261024/reconnect-selected-light.jpg)。测试后恢复跟随系统。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs、git diff --check 通过；保留既有主包体积提示。本轮仅改前端及文档。

## 2026-10-24 关闭重置、小号查询页签与亮色分隔

- 按最新要求，关闭连接再次清空所有引用该连接的查询的连接/库/表选择，保留 SQL 和结果。实际选中 qianguanguan 后关闭、重新双击加载，树选中列表为空，连接与库选择器均未恢复旧值；SQL 草稿保留。
- 查询 Tabs 使用原生 size=small，实测高度从标准 40px 变为 32px；多页签、激活与关闭按钮正常。结果页签保留标准尺寸。
- 亮色专用 token 映射改用 colorBorder 实色边框，surface-raised 使用 colorBgLayout。实际侧栏分隔线为 rgb(217,217,217)，布局背景 rgb(245,245,245)，内容区 rgb(255,255,255)，无透明色；暗色映射保持原值。
- 截图：[亮色小号页签与分区](../artifacts/ui-20261024/compact-tabs-light.jpg)、[暗色小号页签](../artifacts/ui-20261024/compact-tabs-dark.jpg)。测试后关闭临时查询，保留原 SQL，恢复跟随系统主题；仅请求结构元数据，未执行业务 SQL。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs 和 git diff --check 通过，构建保留既有主包体积提示。本轮无后端修改。

## 2026-10-24 取消默认选库与上下页签统一

- 修复持久化查询中旧库范围在双击打开连接后恢复的问题。树箭头、双击、右键打开统一调用工作区 openConnection：未打开连接先清空所有相关查询的库/表，SQL 和结果保留。点击已连接根节点名称同样回到连接范围，清空当前库/表；箭头仅控制已连接节点展开。
- 实际重新加载页面后双击连接，仅连接节点选中，qianguanguan 未选中，右侧数据库显示选择数据库。再手动选库、双击根节点，也会清除库选择。未访问业务表。
- 结果 Tabs 增加原生 size=small；上下两组实测高度均 32px、padding 均 4px 8px。亮色导航使用 colorFill 加深背景，非激活页签使用布局底色、激活页签使用白色内容底色；两组共享背景和边框规则，暗色保持主题 token。
- 仅执行 SELECT 1/2 AS preview_value 常量查询生成两个结果，实际切换快照内容正确。亮暗主题均检查，保存截图：[统一小号页签亮色](../artifacts/ui-20261024/unified-small-tabs-light.jpg)、[统一小号页签暗色](../artifacts/ui-20261024/unified-small-tabs-dark.jpg)。临时查询及其结果已关闭，原 SQL 草稿保留，主题恢复跟随系统。
- pnpm format、pnpm lint、pnpm build、node scripts/check-structure.mjs 和 git diff --check 通过；构建保留既有主包体积提示。本轮无后端修改。


## 2026-10-25 后端模块化单体与原生命令

- 将原 internal/service 拆为 internal/modules/connections、metadata、query；各模块声明最小消费接口、独立规则与测试，由 app 在一个进程内装配同一仓库和 MySQL 客户端。HTTP 分别调用公开入口，查询模块复用进程并发预算；API、凭据格式和数据目录保持兼容。
- 新增后端规范及 .agents/skills/sql-studio-backend/SKILL.md，AGENTS 和项目 skill 按前后端分派；后端启动统一为 go run ./cmd/sql-studio/main.go，不新增启停/检查包装脚本或部署配置。
- 移除根 scripts 目录，将结构/文档检查和 SQL 回归归入 sql-web/tests，更新 pnpm lint 与 test:sql。仓库根目录和后端未发现遗留日志/PID；清理此前虚构接口脚本、skill 草稿和本次验证临时文件。历史记录中的旧命令保留当时语境。
- 通过 gofmt、go test -count=1 ./...（真实集成关闭）、go vet ./...、go build ./...；模块作用域、凭据、超时、取消与并发回归通过。架构检查递归验证模块依赖及 README/doc.go，反向验证确认兄弟模块导入被拒绝，临时探针随后删除。
- 前端 format/format:check、lint、build、SQL/加密存储共 13 项回归与三个 skill 校验通过；构建保留既有大包提示。本轮无 UI 样式变动，未重复浏览器截图，也未访问真实数据库。
