# SQL Studio 前端

技术栈：Vite、React、TypeScript、Ant Design、SCSS、CodeMirror SQL 编辑器。入口引入 Ant Design 默认 reset，全局与页面使用 SCSS；SQL 编辑器继承页面的系统字体，不指定新字体族、字号或字重。

完整启动步骤、密码保存方式、功能边界与验证说明见 [项目 README](../README.md)。

前端规范以 [前端开发规范](../docs/FRONTEND_STANDARDS.md) 为准：默认沿用 Ant Design；局部布局优先 style/styles，必要原生覆盖只放 app.scss；按功能独立实现和 README，数据库按引擎封装。

```powershell
cd C:\Users\Lenovo\Desktop\sql\sql-web
pnpm install
pnpm dev
```

开发地址：`http://127.0.0.1:5173`，需同时启动 Go 后端 `127.0.0.1:8080`。

检查命令：`pnpm lint`（类型检查 + Oxlint + 模块文档检查）、`pnpm format:check`、`pnpm build`。修改后运行 `pnpm format` 统一格式，import 会自动分组排序。具体规则在 `.prettierrc`，构建产物、依赖、锁文件和静态资源在 `.prettierignore` 排除。

目录按职责组织：`pages/workspace` 放 SQL 工作区及私有组件，`services` 放数据库 API，`typings` 放共享契约，`utils` 放通用工具。`App.tsx` 通过主题 hook 组装页面，`@/` 指向 `src/`。查询标签与执行记录类型位于 `typings/workspace/index.ts`。

构建版建议从根目录运行 `pnpm build 后在 sql-server 执行 go run ./cmd/sql-studio`，由 Go 同时提供网页和 API；单独 `pnpm preview` 仅用于静态页面预览，没有 API 代理。

左侧统一为连接 → 数据库 → 表/视图树；没有保存布局时收起，刷新恢复展开状态；箭头或双击节点显式加载/收起，单击文本仅选择。`useDatabaseObjects` 按连接 ID 独立维护结构缓存、请求去重与取消；成功加载库列表后点亮根节点。关闭会取消并清空目标缓存，迟到响应不能回填；根节点右键提供打开/关闭、刷新、编辑、删除。

右侧 `scopeSelects` 只展示已加载连接和数据库，表选择由树负责，与树共享元数据和 WorkspaceTab 范围。切连接清库表，切库清表；切标签恢复独立范围，新标签继承范围但 SQL 留空。树箭头或双击节点时按需加载。关闭连接清空相关标签的连接/库/表范围，保留 SQL 和结果，重连不恢复旧选择；编辑目标连接后须重新展开。所有库表右键操作携带目标连接 ID，避免错用当前查询连接。

亮暗主题使用 defaultAlgorithm / darkAlgorithm，SCSS 从 sql-studio-theme 作用域中的 Ant Design 原生 CSS token 读取主色、背景、边框，不另设蓝色。普通文字使用黑/白，信息 Tag 使用蓝色 solid，按钮/Switch 保持默认变体。右上角可选择亮色、暗黑或跟随系统，偏好保存在 sqldesk.theme。

底部 `resultsDock/index.tsx` 独立管理结果高度：默认 260px，拖动/双击和键盘上下键、Home/End 调整；有结果直接展示，无结果隐藏，不提供折叠按钮。ResizeObserver 约束最大高度，为编辑器保留空间，高度由工作区受控，与 SQL、查询范围、结果及视图状态一起通过 Go 保存到用户目录配置。

连接产品配置位于 `databases/mysql/profile/index.ts`，MySQL 的 SQL、补全等专属实现分属同一引擎目录，外部通过 getDatabaseAdapter 调用。仅保留 MySQL，默认端口 3306；分组默认选中“默认分组”，名称/主机/账号不预填。连接弹窗含常规、SSL 设置和可保留的测试结果。页面外框固定，左侧对象树、右侧结果内部滚动，SQL 编辑器保持可见。支持范围见 [数据库连接说明](../docs/DATABASES.md)。

界面参考 [design 中的连接弹窗](design/数据库连接弹窗-重设计.png)：左侧数据库类型仅使用原生 primary 背景选中，无勾选图标；固定高度内容区左右独立滚动，头部与底部操作栏保持位置。`engineIcon/index.tsx` 经数据库 profile 引用海豚状态图标，白色剪影保持不变，底色按连接状态使用成功色或灰色；来源与调用关系见 [资产说明](src/assets/databases/README.md)。顶栏集中新建连接/新建查询，取消品牌区、连接管理标题、侧栏地址及对象/历史数量标签，结果数量、状态和耗时使用文字，字段类型及 NULL 不用 Tag，移除来源标签；表单错误保留具体原因。历史抽屉为分页 Table，固定搜索/表头/分页，仅表体滚动，行详情默认折叠。

Sass 使用 JavaScript 编译器；pnpm-workspace.yaml 关闭可选 @parcel/watcher 的安装脚本，前端安装/生产构建不依赖该脚本。

当前工作区表右键支持新建查询、查询数据、查询结构和查看 DDL；主区域只有一层页面 Tab，SQL 与本批结果共用页面，批内结果用下拉框切换，分页固定在滚动区外。信息 Tag 使用蓝色 solid。新建连接仅预填端口；表单和结果布局优先通过组件 style/语义样式配置。

运行工具栏右侧提供本地 SQL 文件导入和当前草稿导出，独立查询标签不会覆盖原 SQL；空文件、错误编码或超限内容会提示。行数选择和写入开关及前端参数已移除，查询走后端默认只读/默认返回上限。局部布局优先组件 style/styles，跨区域及必要原生覆盖集中 src/app.scss；App 不覆盖 placeholder 等原生颜色，查询和结果共用带图标的卡片 Tabs；查询页签右键支持关闭当前、其他、右侧。

执行历史位于查询工具栏导出之后，只显示当前查询连接的记录；清空只影响该连接，同连接跨库记录可见。连接 ID 切换后重置分页/筛选/展开，打开时清空搜索。

界面状态由 Go 用户目录分区 JSON 保存，带版本号与 CAS 修订；缺失配置直接初始化默认值。刷新恢复页签、SQL、结果、历史和布局，不自动执行 SQL。补全按当前 SQL 页连接提供库名，选库自动加载表/视图；结果 Select 和顶部 Tab 随所选结果同步成功/失败颜色。存储回归运行 `pnpm test:storage`，说明见 [测试](tests/README.md)。
