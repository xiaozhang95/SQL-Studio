# 开发约定

## 前端目录职责

参考本机 `C:\Users\Lenovo\Desktop\ghspace\ghspace-polardb-web` 的分层方向，保留 Vite + React 技术栈。

| 目录/文件 | 职责 |
| --- | --- |
| `sql-web/src/main.tsx` | React 挂载、全局基础样式 |
| `sql-web/src/App.tsx` | 页面组装、Ant Design 主题与语言配置 |
| `sql-web/src/pages/workspace/index.tsx` | SQL 工作区与交互编排 |
| `sql-web/src/pages/workspace/components/` | 工作区私有连接表单与库表浏览器 |
| `sql-web/src/pages/workspace/components/queryEditor/` | 查询标签、连接/库/运行工具栏、CodeMirror 编辑器 |
| `sql-web/src/pages/workspace/components/queryResults/` | 结果表格、字段与 DDL、筛选和导出 |
| `sql-web/src/pages/workspace/components/queryHistory/` | 历史抽屉和载入，入口在导出之后 |
| `sql-web/src/pages/workspace/components/scopeSelects/index.tsx` | 运行工具栏的连接/库选择器，修改当前标签范围 |
| `sql-web/src/pages/workspace/components/resultsDock/index.tsx` | 底部结果面板，拖动/键盘伸缩和高度保存 |
| `sql-web/src/pages/workspace/components/engineIcon/index.tsx` | 类型图标，连接选择器和弹窗复用 |
| `sql-web/src/pages/workspace/hooks/useDatabaseObjects/index.ts` | 按连接隔离的库表缓存、打开/关闭与请求取消；树和选择器共用状态 |
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

工作区固定为视口高度，左侧对象树保持固定，右侧 SQL 编辑区填充剩余空间，有结果时直接展示底部可伸缩面板，不提供折叠按钮，库表树和结果独立滚动。QueryTab 是连接、database、table 的唯一状态来源，运行按钮旁的选择器和左侧树均修改当前标签；切标签恢复独立范围，新标签继承当前范围。切换连接或数据库时清理旧表选择，切标签恢复只读。MySQL 表身份由数据库和表名组成，生成 SQL 使用反引号转义。

界面结构参考 [前端 design 原图](../sql-web/design/数据库连接弹窗-重设计.png)。连接弹窗按类型侧栏、表单、独立操作栏分区，必填字段使用标准校验；常规中保留名称、主机/端口、用户名与密码。只显示一处本地加密标签，证书说明放在 SSL 页签。

Tag 仅用于有辨识意义的状态，避免为数量重复加标签。顶栏使用新建连接/新建查询按钮，取消品牌区、连接管理标题、侧栏连接信息和对象/历史数量。结果行数和字段数用普通文字；结果工具栏仅展示状态图标、耗时文字、筛选与导出，连接来源保留在快照数据中，不显示标签。字段类型使用表头第二行普通文字，NULL 使用次级文字 `(NULL)`，均不使用 Tag。数据库树搜索按原始库名/表名匹配。

## 前端格式规则

组件与自定义 hook 各自独立目录，源码入口与 README 同放；constant、typings、services、utils 按实际模块维护同样结构。框架入口 App.tsx/main.tsx 保留。注释解释范围隔离、取消、凭据保留等边界，不重复描述每行语法。前端源码入口见 [源码索引](../sql-web/src/README.md)。

信息 Tag 使用蓝色 solid，语义状态使用对应 color；按钮保留默认变体，避免灰色或黑底信息标签。普通文字偏好仅限定文字/图标，不覆盖兼作背景的 colorTextQuaternary/Tertiary。连接、库下拉位于运行按钮前，表由左侧树选择，历史按钮位于查询工具栏导出之后，抽屉使用分页 Table，支持状态筛选、时间/耗时排序与默认收起的行详情。新建连接为主按钮，数据库标识引用原有品牌资产，不改色。

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

## 多结果工作区

表操作统一在对象树右键菜单；底部仅展示 SQL、表数据、结构和 DDL 的独立结果快照。分页置于滚动区外。新布局尽量使用 style/组件参数；SCSS 保留跨组件布局及全局滚动条。信息 Tag 使用带蓝色的 solid，状态使用语义色，避免默认 solid 变成黑底。新建连接只预填端口。

## 结果与连接布局边界

连接窗口左右使用相同 surface，以竖线分隔；加密标签放右侧端口标签旁，输入框保留 placeholder。无结果隐藏整个底部面板。查询与结果页签统一间隔和留白，取消结果 nav 默认下边距。表体使用 ResizeObserver 分配可用高度，横纵滚动仅由 Table body 承担，分页作为独立固定区域；避免外层滚动再裁切表体。选中树节点的 hover 必须检查原生 hover 选择器优先级，而非只检查静止颜色。

## 当前界面调整

查询页签支持关闭当前、关闭其他、关闭右侧的右键菜单，按目标页签计算，执行中禁用；关闭最后一页后保留空白编辑器。SQL 补全沿用页面字体与主题，去掉 emoji 和匹配下划线，长关键字和键盘选择保持可用。对象树初始收起，单击文本只选择范围，双击连接/库节点或点击箭头才加载、展开和收起子列表；切库不重挂载树。工具栏取消表下拉，库表列表仅由树按需加载并去重缓存。

查询与结果使用同一套 workspace-tabs 卡片 Tabs，统一背景、边框、间距、激活色和原生关闭按钮；结果保留操作类型图标；数据库类型与树节点的普通 hover 使用 controlItemBgHover。前端不保留 limit/allowWrite 状态、控件、确认或请求参数；后端默认只读与默认 1000 行限制继续生效。工具栏按钮文案为运行、导入、导出；导入只在本地读取文件并创建新查询，不自动执行，导出当前标签的完整 SQL 为 UTF-8 .sql 文件。顶部和数据库菜单的新建查询默认留空，已有草稿保持原文；表菜单新建查询仍生成目标表 SQL。执行历史固定搜索、表头和底部分页，仅表体滚动。连接内容区最高 600px、垂直 padding 20px，内容完整时不出现多余滚动条。

左侧以连接作为树根，展开依次加载数据库和表/视图；加载成功后点亮连接图标及名称。右键提供打开/关闭、刷新、编辑、删除。右侧连接选择器仅提供已加载成功的连接，连接/库选择与树共享缓存，表操作在树上完成；关闭清空该连接的查询范围，保留 SQL 与结果快照，重连不恢复旧选择，取消旧代请求，迟到响应不得恢复连接。编辑、删除和库表右键操作必须携带显式目标连接 ID。

执行历史入口位于导出之后，仅按当前查询的连接 ID 显示记录；同连接的所有数据库均可查看，清空只移除当前连接历史。不同连接的分页、筛选和展开状态隔离，打开时清空搜索；未选择有效连接时入口禁用。树图标和文字保持原生行高并与选中背景居中。

树节点、页签、顶栏、运行工具栏和菜单等操作文字使用 user-select:none，避免双击展开产生浏览器选区；搜索输入、SQL 编辑器、结果和历史 SQL 保持可选择/复制。连接关闭释放结构缓存和请求，并清空相关查询的连接/库/表选择；重连成功事件校验该连接全部查询标签，库已不存在时清空对应库/表，且不自动执行 SQL。

查询页签使用原生 small 尺寸（32px），结果页签使用相同 small 尺寸。亮色主题的布局分隔线引用 colorBorder 实色，页签导航等抬升区域使用 colorBgLayout，与白色内容区区分；暗色仍使用原有 token 映射。

首次打开未连接节点时，统一经过工作区 openConnection 清空相关草稿旧库/表，禁止按保存的库范围默认选库；已连接节点通过箭头折叠/展开不重置当前选择，点击或双击连接名称则清空当前库/表并选择连接。查询和结果页签统一小号，亮色导航使用原生 colorFill，非激活项使用布局底色，激活项使用内容底色。
