# 开发约定

## 前端目录职责

参考本机 `C:\Users\Lenovo\Desktop\ghspace\ghspace-polardb-web` 的分层方向，保留 Vite + React 技术栈。

| 目录/文件 | 职责 |
| --- | --- |
| `sql-web/src/main.tsx` | React 挂载、全局基础样式 |
| `sql-web/src/App.tsx` | 页面组装、Ant Design 主题与语言配置 |
| `sql-web/src/pages/workspace/index.tsx` | SQL 工作区与交互编排 |
| `sql-web/src/pages/workspace/components/` | 工作区私有连接表单与库表浏览器 |
| `sql-web/src/pages/workspace/components/workspaceTabs/` | 统一页面导航、状态色和关闭菜单 |
| `sql-web/src/pages/workspace/components/queryEditor/` | 连接/库/运行工具栏、CodeMirror 编辑器 |
| `sql-web/src/pages/workspace/components/queryResults/` | 结果表格、字段与 DDL、筛选和导出 |
| `sql-web/src/pages/workspace/components/queryHistory/` | 历史抽屉和载入，入口在导出之后 |
| `sql-web/src/pages/workspace/components/scopeSelects/index.tsx` | 运行工具栏的连接/库选择器，修改当前标签范围 |
| `sql-web/src/pages/workspace/components/resultsDock/index.tsx` | 底部结果面板，拖动/键盘伸缩和高度保存 |
| `sql-web/src/pages/workspace/components/engineIcon/index.tsx` | 类型图标，连接选择器和弹窗复用 |
| `sql-web/src/pages/workspace/hooks/useDatabaseObjects/index.ts` | 按连接隔离的库表缓存、打开/关闭与请求取消；树和选择器共用状态 |
| `sql-web/src/pages/workspace/hooks/useQueryHistory/` | 按连接读取、写入与清空历史，兼容旧历史只读迁移 |
| `sql-web/src/pages/workspace/hooks/useWorkspace/` | 工作区业务编排；区域组件用 Pick 限定消费字段 |
| `sql-web/src/pages/workspace/hooks/useConnectionForm/` | 连接表单默认值、测试、保存和错误 |
| `sql-web/src/hooks/useThemePreference/` | 用户偏好、系统主题订阅、首帧配色 |
| `sql-web/src/constant/database/index.ts` | MySQL 类型、标签与默认端口 |
| `sql-web/src/typings/workspace/index.ts` | 查询标签、执行历史等页面内部状态类型 |
| `sql-web/src/app.scss` | 全局基础样式、Ant Design 覆盖、工作区布局与编辑器字体继承 |
| `sql-web/src/services/database/index.ts` | 连接管理、元数据和 SQL 执行 API；URL 与请求参数集中维护 |
| `sql-web/src/typings/database/index.ts` | 连接、字段、查询请求/结果等 API 契约 |
| `sql-web/src/utils/` | request、storage、sql、csv 等无页面依赖工具 |

共享契约与通用工具使用 `@/` 绝对别名，工作区内组件、样式和类型使用相对路径。别名同时配置在 Vite 与 TypeScript 中。

按实际使用者决定归属：只服务一个页面的组件、状态、常量和 hook 留在页面；多个页面共同使用后，再提取到共享层。不预先建立没有使用者的空目录。

入口 main.tsx 已引入 antd/dist/reset.css，随后引入全局 app.scss；全部原生组件样式覆盖集中于 app.scss，通过 Sass 编译。界面保留系统及 Ant Design 默认字体，不指定新的字体族、字号和字重；SQL/DDL CodeMirror 的 scroller 从页面继承字体，覆盖库内 monospace。保留 Ant Design 默认文字、placeholder 和图标颜色；主题使用 defaultAlgorithm / darkAlgorithm，主色、背景和边框直接引用 Ant Design CSS token，不手写蓝色调色板。主题偏好支持跟随系统并保存。

工作区固定为视口高度，左侧对象树保持固定，右侧 SQL 编辑区填充剩余空间，有结果时直接展示底部可伸缩面板，不提供折叠按钮，库表树和结果独立滚动。WorkspaceTab 独立保存查询的连接、database、table；运行按钮旁的选择器只修改当前标签，左侧树单独管理选中高亮，二者互不联动。切标签恢复独立查询范围，新标签继承当前查询范围。切换连接或数据库时清理旧表选择，切标签恢复只读。MySQL 表身份由数据库和表名组成，生成 SQL 使用反引号转义。

界面结构参考 [前端 design 原图](../sql-web/design/数据库连接弹窗-重设计.png)。连接弹窗按类型侧栏、表单、独立操作栏分区，必填字段使用标准校验；常规中保留名称、主机/端口、用户名与密码。只显示一处本地加密标签，证书说明放在 SSL 页签。

Tag 仅用于有辨识意义的状态，避免为数量重复加标签。顶栏使用新建连接/新建查询按钮，取消品牌区、连接管理标题、侧栏连接信息和对象/历史数量。结果行数和字段数用普通文字；结果工具栏仅展示状态图标、耗时文字、筛选与导出，连接来源保留在快照数据中，不显示标签。字段类型使用表头第二行普通文字，NULL 使用次级文字 `(NULL)`，均不使用 Tag。数据库树搜索按原始库名/表名匹配。

## 前端格式规则

组件与自定义 hook 各自独立目录，源码入口与 README 同放；constant、typings、services、utils 按实际模块维护同样结构。框架入口 App.tsx/main.tsx 保留。注释解释范围隔离、取消、凭据保留等边界，不重复描述每行语法。前端源码入口见 [源码索引](../sql-web/src/README.md)。

信息 Tag 使用蓝色 solid，语义状态使用对应 color；按钮保留默认变体，避免灰色或黑底信息标签。普通文字偏好仅限定文字/图标，不覆盖兼作背景的 colorTextQuaternary/Tertiary。连接、库下拉位于运行按钮前，左侧表操作携带显式目标、不修改查询下拉，历史按钮位于查询工具栏导出之后，抽屉使用分页 Table，支持状态筛选、时间/耗时排序与默认收起的行详情。新建连接为主按钮，数据库标识引用原有品牌资产，不改色。

连接类型选中态仅使用 colorPrimary 背景和 colorTextLightSolid 文字，无尾部勾选；对象树选中节点同样引用原生 primary token，避免浅色背景。内容区固定高度并受视口约束，右侧表单独立滚动，页签和数据库类型切换时保持外框与操作栏位置。

Switch 轨道与按钮背景沿用组件算法，信息 Tag 采用蓝色 solid，不把文字颜色强行套到背景。项目边界与同步要求见 [项目 skill](../.agents/skills/sql-studio/SKILL.md)；归档规则与本地文档链接由 `node scripts/check-structure.mjs` 检查。

`.prettierrc` 对齐参考项目的核心设置：

- `printWidth: 200`。
- 单引号、不加分号、无尾逗号。
- 两个空格缩进，UTF-8、LF、文件末尾换行。
- 使用 `@ianvs/prettier-plugin-sort-imports`：Node 内置模块、第三方、`@/`、相对路径依次分组；组间空行。
- CSS/SCSS 副作用导入允许参与排序；reset 保持在应用样式之前，其他副作用导入不主动跨越排序。

```powershell
cd C:\Users\Lenovo\Desktop\sql\sql-web
pnpm format
pnpm format:check
pnpm lint
pnpm build
```

`format` 覆盖整个前端项目中 Prettier 支持的文件；`.prettierignore` 排除依赖、构建产物、锁文件、静态资源、日志和编辑器配置。`lint` 包含 TypeScript 类型检查、Oxlint 和模块文档/链接检查。

## 后端格式规则

后端已完成包分层，入口为 `cmd/sql-studio`，职责和依赖方向见 [后端架构与维护规范](BACKEND_ARCHITECTURE.md)。新增代码须进入所属层，并由架构测试约束导入方向。

Gin 只进入 HTTP 与应用装配层，MySQL 驱动只进入 mysql 基础设施包。数据库支持与 TLS 边界见 [数据库支持](DATABASES.md)。

Go 使用 `gofmt`，包括源码、测试文件和 import 基础排序。保持标准 Go 格式，不将前端的分号、引号和行宽规则应用到 Go。

```powershell
cd C:\Users\Lenovo\Desktop\sql\sql-server
gofmt -w .
gofmt -l .
go test -count=1 ./...
go vet ./...
go build ./...
```

## 编辑器与统一入口

根目录 `.editorconfig` 统一换行、缩进和编码；Go 使用 Tab，TS/TSX/CSS/JSON 使用两个空格，PowerShell 使用四个空格。Markdown 保留有语义的行尾空格。

根目录与各子项目的 `.vscode/settings.json` 支持整体打开仓库或单独打开前/后端时的保存格式化。推荐扩展列表位于根目录 `.vscode/extensions.json`；配置已写入，扩展安装由本机编辑器管理。

格式化分别在 sql-web 执行 pnpm format，在 sql-server 执行 gofmt -w .；检查分别使用 pnpm format:check 和 gofmt -l .（后者输出应为空）。不再提供统一 PowerShell 包装脚本。

## 页面工作区

表操作统一在对象树右键菜单；主区域仅保留一层 query/data/structure/ddl 页面标签，查询页共用 SQL 与最新结果，表数据、结构和 DDL 为独立页面。分页置于滚动区外。新布局尽量使用 style/组件参数；SCSS 保留跨组件布局及全局滚动条。信息 Tag 使用带蓝色的 solid，状态使用语义色，避免默认 solid 变成黑底。新建连接只预填端口。

## 结果与连接布局边界

连接窗口左右使用相同 surface，以竖线分隔；加密标签放右侧端口标签旁，输入框保留 placeholder。无结果隐藏整个底部面板。主页面页签统一间隔和留白，取消结果 nav 默认下边距。表体使用 ResizeObserver 分配可用高度，横纵滚动仅由 Table body 承担，分页作为独立固定区域；避免外层滚动再裁切表体。选中树节点的 hover 必须检查原生 hover 选择器优先级，而非只检查静止颜色。

## 当前界面调整

查询页签支持关闭当前、关闭其他、关闭右侧的右键菜单，按目标页签计算，执行中禁用；关闭最后一页后隐藏编辑器，不创建替代查询。进入或刷新恢复加密本地快照，没有保存记录时为空；空白区提示新建查询或双击对象。旧版草稿仅在加密迁移提交成功后移除明文。对象浏览拥有独立范围和结果，双击库展开并展示结构列表，双击表查询数据，不隐式新建 SQL 草稿；无编辑器时结果铺满主区域并隐藏伸缩条。SQL 补全沿用页面字体与主题，去掉 emoji 和匹配下划线，长关键字和键盘选择保持可用。对象树无保存记录时收起，否则恢复展开状态，单击文本只选择范围，双击连接/库节点或点击箭头才加载、展开和收起子列表；切库不重挂载树。工具栏取消表下拉，库表列表由树和查询范围选择按需加载并共用去重缓存。

查询与结果使用同一套 workspace-tabs 方形 Tabs，统一背景、细分隔线、顶部主色标识和原生关闭按钮；结果保留操作类型图标；数据库类型与树节点的普通 hover 使用 controlItemBgHover。前端不保留 limit/allowWrite 状态、控件、确认或请求参数；后端默认只读与默认 1000 行限制继续生效。工具栏按钮文案为运行、导入、导出；导入只在本地读取文件并创建新查询，不自动执行，导出当前标签的完整 SQL 为 UTF-8 .sql 文件。顶部和数据库菜单的新建查询默认留空，已有草稿保持原文；表菜单新建查询仍生成目标表 SQL。执行历史固定搜索、表头和底部分页，仅表体滚动。连接内容区最高 600px、垂直 padding 20px，内容完整时不出现多余滚动条。

左侧以连接作为树根，展开依次加载数据库和表/视图；连接根节点使用白色海豚状态图标，未选中名称统一使用主题正文色。右键提供打开/关闭、刷新、编辑、删除。右侧连接选择器仅提供已加载成功的连接，连接/库选择与树共享缓存，表操作在树上完成；关闭清空该连接的查询范围，保留 SQL 与结果快照，重连不恢复旧选择，取消旧代请求，迟到响应不得恢复连接。编辑、删除和库表右键操作必须携带显式目标连接 ID。

执行历史入口位于导出之后，仅在 SQL 页工具栏展示，加载当前 SQL 页所属连接的记录；同连接的所有数据库均可查看，清空只移除当前连接历史。不同连接的分页、筛选和展开状态隔离，打开时清空搜索；未选择有效连接时入口禁用。树图标和文字保持原生行高并与选中背景居中。

树节点、页签、顶栏、运行工具栏和菜单等操作文字使用 user-select:none，避免双击展开产生浏览器选区；搜索输入、SQL 编辑器、结果和历史 SQL 保持可选择/复制。连接关闭释放结构缓存和请求，并清空相关查询的连接/库/表选择；重连成功事件校验该连接全部查询标签，库已不存在时清空对应库/表，且不自动执行 SQL。

统一页面页签使用原生 small 尺寸（32px）。亮色主题的布局分隔线引用 colorBorder 实色，页签导航等抬升区域使用 colorBgLayout，与白色内容区区分；暗色仍使用原有 token 映射。

打开连接统一经过工作区 openConnection，只管理元数据生命周期，不修改右侧查询范围。树的单击、双击、展开和折叠不与查询下拉联动，下拉和查询标签切换也不改变树高亮。结构加载成功后仅校验已保存查询范围的有效性；显式新建查询的对象菜单可以指定新标签范围。所有主页面页签统一小号，亮色导航使用原生 colorBgLayout，非激活项使用布局底色，激活项使用内容底色与顶部主色线；标签无间隙、导航无额外留白。

工作区主区域取消外边距，编辑器与结果面板贴边铺满，去掉卡片圆角、外框和阴影；结果顶部保留独立拖动区与分隔线。App 使用 borderRadius=0 统一 Ant Design 方角，自定义连接类型、品牌承载、历史 SQL 与补全弹层同样使用方角。左侧连接根节点使用 20px 海豚状态图标，选择器为 24px；成功加载连接结构后使用 success 底板，仅未打开、已关闭或连接失败的根节点使用灰色底板；已成功打开的连接折叠后仍保持正常，库和表图标始终使用正文色。状态图标按最新参考图使用白色剪影与圆角底板。未选中节点文字使用正文色，暗色下为白色；图文间距 8px；选中行最小 28px，上下内部留白各 2px，覆盖原生 margin-bottom 为 2px，移除额外节点 padding。

连接常规与 SSL 表单采用 horizontal 布局，label 固定 96px 右对齐，输入自适应，各字段独占一行。双击库展开与结构列表共用一次缓存请求；字段/DDL 按连接及库表缓存，关闭或刷新连接取消请求并使缓存失效。范围切换只废弃旧消费结果，共享请求可完成并供后续选择复用。

树折叠按钮与节点内容统一最小 28px，图标垂直居中，按钮及其 hover 始终透明，不渲染背景伪元素。连接类型和表单头部使用 40px 白色海豚状态图标，来源见资产 README。主页面页签按各自选中结果显示成功绿/失败红及同色激活线；拖动条缩至 5px、抓手 2px，亮暗主题的 hover、焦点、拖动均为中性色。

顶栏、侧栏搜索与编辑/结果工具栏统一左右 12px（workspace-inset），窄屏不再单独增加顶栏留白。结果与历史 Table 使用原生 small 尺寸、8px 单元格内边距，保留原字号；历史载入按钮采用 small。数据库下拉和结构列表显式展示库、表、视图图标。

统一页面导航由 workspaceTabs 管理，编辑器与结果组件不再各自创建 Tabs。每页保留 SQL、范围、最新结果、筛选和分页，异步结果固定归属发起页；执行中可切换已有页面。执行历史由 useQueryHistory 按连接 ID 独立存储，每连接最多 50 条，旧全局历史仅在该连接尚无新存储时过滤读取，清空不影响其他连接。

执行历史载入不新建标签，在当前 SQL 页草稿末尾追加空行、`-- 历史记录` 注释与完整历史 SQL，不改变连接/库、不自动执行。编辑器右键提供“运行选中 SQL”，固定菜单打开时的选区快照；无选区、未连接或执行中禁用。补全浮层沿用系统 Select 的背景、边框、阴影、选中态和 32px 行高，保留系统字号与键盘操作。

多语句由 utils/sql 按 MySQL 引号、转义及注释边界切分，useWorkspace 持有批次运行锁、取消信号和固定目标顺序执行；接口和驱动保持单语句、默认只读及单请求限制。每条独立保存结果和历史，失败/取消停止后续请求；结果工具栏用 Select 切换该批结果，重复运行替换整批。回归检查从根目录运行 `node --test scripts/test-sql-statements.mjs`（Node 24）。

工作区本地保存使用 utils/encryptedStorage 的 AES-GCM + IndexedDB，密钥 extractable=false，不硬编码、不导出。useWorkspacePersistence 先恢复再允许保存，白名单包含页签/SQL/结果/布局，不含连接密码；历史也加密，并在迁移提交后清理旧明文。恢复只重连元数据，不自动执行 SQL；运行中刷新显示中断提示。顶部 Tab 和结果 Select 依据各页选中结果同步成功/失败颜色；成功和失败选项的选中/hover 背景使用各自语义 token。

前端 `pnpm test:storage`（Node 24）验证密文、随机 IV、不可导出密钥、跨客户端解密、顺序落盘和篡改拒绝；fake-indexeddb 仅为开发测试依赖。页面恢复/补全/主题另用虚构 API 浏览器验证。
