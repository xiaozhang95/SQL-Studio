# 开发约定

## 前端目录职责

参考本机 `C:\Users\Lenovo\Desktop\ghspace\ghspace-polardb-web` 的分层方向，保留 Vite + React 技术栈。

| 目录/文件 | 职责 |
| --- | --- |
| `sql-web/src/main.tsx` | React 挂载、全局基础样式 |
| `sql-web/src/App.tsx` | 页面组装、Ant Design 主题与语言配置 |
| `sql-web/src/pages/workspace/index.tsx` | SQL 工作区与交互编排 |
| `sql-web/src/pages/workspace/components/` | 工作区私有连接表单与库表浏览器 |
| `sql-web/src/pages/workspace/components/queryEditor/` | 查询标签、库/表/运行工具栏、CodeMirror 编辑器 |
| `sql-web/src/pages/workspace/components/queryResults/` | 结果表格、字段与 DDL、筛选和导出 |
| `sql-web/src/pages/workspace/components/queryHistory/` | 历史抽屉和载入，入口放侧栏底部 |
| `sql-web/src/pages/workspace/components/scopeSelects/index.tsx` | 运行工具栏的库/表选择器，修改当前标签范围 |
| `sql-web/src/pages/workspace/components/resultsDock/index.tsx` | 底部结果面板，拖动/键盘伸缩、折叠和高度保存 |
| `sql-web/src/pages/workspace/components/engineIcon/index.tsx` | 类型图标，连接选择器和弹窗复用 |
| `sql-web/src/pages/workspace/hooks/useDatabaseObjects/index.ts` | 库表请求、缓存、连接切换与请求取消；树和选择器共用状态 |
| `sql-web/src/pages/workspace/hooks/useWorkspace/` | 工作区业务编排；区域组件用 Pick 限定消费字段 |
| `sql-web/src/pages/workspace/hooks/useConnectionForm/` | 连接表单默认值、测试、保存和错误 |
| `sql-web/src/hooks/useThemePreference/` | 用户偏好、系统主题订阅、首帧配色 |
| `sql-web/src/constant/database/index.ts` | 六种连接类型、协议、默认端口及用户名 |
| `sql-web/src/typings/workspace/index.ts` | 查询标签、执行历史等页面内部状态类型 |
| `sql-web/src/app.scss` | 全局基础样式、Ant Design 覆盖、工作区布局与编辑器字体继承 |
| `sql-web/src/services/database/index.ts` | 连接管理、元数据和 SQL 执行 API；URL 与请求参数集中维护 |
| `sql-web/src/typings/database/index.ts` | 连接、字段、查询请求/结果等 API 契约 |
| `sql-web/src/utils/` | request、storage、sql、csv 等无页面依赖工具 |

共享契约与通用工具使用 `@/` 绝对别名，工作区内组件、样式和类型使用相对路径。别名同时配置在 Vite 与 TypeScript 中。

按实际使用者决定归属：只服务一个页面的组件、状态、常量和 hook 留在页面；多个页面共同使用后，再提取到共享层。不预先建立没有使用者的空目录。

入口 main.tsx 已引入 antd/dist/reset.css，随后引入全局 app.scss；全部原生组件样式覆盖集中于 app.scss，通过 Sass 编译。界面保留系统及 Ant Design 默认字体，不指定新的字体族、字号和字重；SQL/DDL CodeMirror 的 scroller 从页面继承字体，覆盖库内 monospace。保留 Ant Design 默认文字、placeholder 和图标颜色；主题使用 defaultAlgorithm / darkAlgorithm，主色、背景和边框直接引用 Ant Design CSS token，不手写蓝色调色板。主题偏好支持跟随系统并保存。

工作区固定为视口高度，左侧对象树保持固定，右侧 SQL 编辑区填充剩余空间，结果停靠底部并可伸缩、折叠，库表树和结果独立滚动。QueryTab 是连接、database、schema、table 的唯一状态来源，运行按钮旁的选择器和左侧树均修改当前标签；切标签恢复独立范围，新标签继承当前范围。切换连接或数据库时清理旧表选择，切标签恢复只读。PostgreSQL 表身份由 database、schema、name 组成，生成 SQL 使用对应协议的标识符转义。

界面结构参考 [前端 design 原图](../sql-web/design/数据库连接弹窗-重设计.png)。连接弹窗按类型侧栏、表单、独立操作栏分区，必填字段使用标准校验；常规中保留名称、主机/端口、初始库（PostgreSQL）、用户名与密码。只显示一处本地加密标签，证书说明放在 SSL 页签。

Tag 仅用于有辨识意义的状态、类型和结果来源，避免为数量重复加标签。普通文案保持黑/白，不添加灰色次级文字。顶栏使用新建连接/新建查询按钮，取消品牌区、连接管理标题、侧栏连接信息和对象/历史数量；只读状态合并进开关。结果行数和字段数用普通文字，保留耗时与实际结果来源；来源不能因为精简界面而丢失，长内容通过省略号和 Tooltip 展示。数据库树搜索按原始库名/表名匹配。

## 前端格式规则

组件与自定义 hook 各自独立目录，源码入口与 README 同放；constant、typings、services、utils 按实际模块维护同样结构。框架入口 App.tsx/main.tsx 保留。注释解释范围隔离、取消、凭据保留等边界，不重复描述每行语法。前端源码入口见 [源码索引](../sql-web/src/README.md)。

信息 Tag 使用蓝色 solid，语义状态使用对应 color；按钮保留默认变体，避免灰色或黑底信息标签。普通文字偏好仅限定文字/图标，不覆盖兼作背景的 colorTextQuaternary/Tertiary。库、表下拉位于运行按钮前，历史按钮固定在侧栏底部，抽屉记录使用默认收起的 Collapse 手风琴。新建连接为主按钮，数据库标识引用原有品牌资产，不改色。

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

Gin 只进入 HTTP 与应用装配层，MySQL / pgx 驱动只进入对应基础设施包。数据库支持、TLS 和 PolarDB 边界见 [数据库支持](DATABASES.md)。

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

结果使用 line 下划线 Tabs；数据库类型与树节点的普通 hover 使用 controlItemBgHover。前端不保留 limit/allowWrite 状态、控件、确认或请求参数；后端默认只读与默认 1000 行限制继续生效。导入 SQL 只在本地读取文件并创建新查询，不自动执行。连接内容区最高 600px、垂直 padding 20px，内容完整时不出现多余滚动条。
