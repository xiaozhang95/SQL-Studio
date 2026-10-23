---
name: sql-studio
description: 维护本仓库 SQL Studio 的 Vite React Ant Design 前端、Gin Go 后端、数据库访问与配套文档；用于该项目开发、UI 调整、重构及归档检查。
---

# SQL Studio 开发规范

按任务先读[源码入口](../../../sql-web/src/README.md)、[开发约定](../../../docs/DEVELOPMENT.md)或[后端架构](../../../docs/BACKEND_ARCHITECTURE.md)，再读实际模块 README。用户当前指令优先；本 skill 不适用于其他项目。

## 前端组织

- 保持 Vite + React + TypeScript + Ant Design，包管理只用 pnpm；App/main 是框架入口。
- 参考 ghspace 的归属原则：一个组件一个目录，入口 index.tsx + README.md；一个自定义 hook 一个目录，入口 index.ts(x) + README.md。仅页面使用的实现留在 pages/workspace，跨页面复用才进入公共层。
- constant、typings、services、utils 的实际模块同样使用独立目录及 README。导入止于目录名，不加 /index；不要保留旧路径转发壳。
- 页面入口只组合组件。查询状态、异步请求和表单生命周期进入相应 hook；展示组件用明确 props 或 Pick 限定消费契约。hook 的 README 记录参数、返回值、取消和缓存边界；组件文档记录回调、受控值和默认行为。
- 中文注释解释业务边界、竞态、凭据策略和非常规处理；不逐行复述代码。移动实现时同步调用者、目录索引、文档和本地链接。

## UI 与交互

- 保留系统及 Ant Design 默认字体、字号和标准控件尺寸。保留 Ant Design 默认文字、placeholder 和图标颜色；不要把“不喜欢灰色”扩大成强制覆盖组件默认颜色。必要覆盖仅集中在 src/app.scss；局部布局优先 style。检查箭头、搜索、关闭、菜单及空态图标的实际亮暗呈现，不用灰色图标充当普通操作。
- 全局及页面使用 SCSS，入口保留 antd/dist/reset.css。颜色使用 Ant Design 原生 CSS token；主色沿用 defaultAlgorithm/darkAlgorithm 的 colorPrimary，不手写亮暗蓝色。信息 Tag 使用带蓝色的 solid，状态 Tag 使用语义色，避免灰色或黑底信息标签；Button 和 Switch 保留默认样式，不把文字黑/白偏好套到背景 token。
- 数据库图标只引用 assets/databases 中原有品牌资源，记录来源，不重绘、不改色。PolarDB Oracle 兼容类型仍是 PolarDB，不使用原生 Oracle 图标冒充。
- 顶栏放新建连接/新建查询 Button，历史入口在侧栏底部；记录默认折叠，展开查看详情。工具栏顺序为库、表、运行，保留亮暗/跟随系统、独立对象滚动和可伸缩结果面板。对象树/连接类型以原生 primary 背景选中，连接类型无尾部勾选；SQL/DDL 编辑器继承页面系统字体，不另设等宽字体或字号。
- 精简宣传式空态和重复页脚，保留错误原因、写入确认、实际结果来源等影响操作的信息。

## 数据和后端

- 每个查询标签独立保存连接、数据库、Schema、表和 SQL。切换标签恢复范围并回到只读；结果归属发起时的标签。旧请求取消/失效后不能覆盖新范围。
- 密码只交后端加密，不进入 localStorage 或日志；编辑空密码保留旧值。前端仅使用后端默认只读，不保留写入模式和行数上限控件、状态或请求参数；取消不能被解释为事务已回滚。
- Go 采用 cmd/sql-studio 与 internal/app、config、httpapi、service、model、connection、mysql、postgres 分层。每个实际包有 README 与必要的包/业务注释，保留原生 Go 文件组织，不套前端 index 文件规则。
- Gin 限于 HTTP/装配，SQL 驱动限于对应协议包，service 通过自己声明的接口访问基础设施；环境变量由 config 读取，凭据由 connection 管理。新增包同步架构测试。
- 保留只读、单语句、超时、行数/字节、并发限制及精确数值文本。PolarDB PostgreSQL/Oracle 兼容版走 pgx，不将协议兼容测试写成云实例/专有功能实测。

## 修改与验证

每次改动同步对应 README 和目录索引；不存在复用需求时不建空模块。检查旧路径、公开契约、相对链接及资产归属，不擅自提交或清理用户数据。

前端运行 pnpm format、pnpm lint、pnpm build；整体运行 node scripts/check-structure.mjs。后端运行 sql-server/check.ps1；数据库行为变化再按环境启用集成参数。UI 改动按用户范围检查真实页面的亮暗主题、长名称、弹窗、按钮顺序与伸缩，保存可核验截图；没有执行的验证如实说明。遵守用户限制，不为满足检查而访问业务表或改写凭据。

表操作集中到对象树右键菜单（新建查询、查询数据、查询结构、DDL）；底部仅展示可切换和关闭的结果快照，分页位于滚动区外。新建连接只预填端口。新布局优先组件 style/语义样式参数，SCSS 留给跨区域布局和统一滚动条。

结果页签使用原生 line 下划线 Tabs。顶栏 SQL 导入仅本地读取 UTF-8/BOM .sql 并新建标签，不上传或自动执行；校验空文件、扩展名、编码和大小。连接内容完整时不得产生多余滚动条，普通 hover 背景统一引用 controlItemBgHover。
