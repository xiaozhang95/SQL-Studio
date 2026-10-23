# SQL Studio 前端

技术栈：Vite、React、TypeScript、Ant Design、SCSS、CodeMirror SQL 编辑器。入口引入 Ant Design 默认 reset，全局与页面使用 SCSS；SQL 编辑器继承页面的系统字体，不指定新字体族、字号或字重。

完整启动步骤、密码保存方式、功能边界与验证说明见 [项目 README](../README.md)。

```powershell
cd C:\Users\Lenovo\Desktop\sql\sql-web
pnpm install
pnpm dev
```

开发地址：`http://127.0.0.1:5173`，需同时启动 Go 后端 `127.0.0.1:8080`。

检查命令：`pnpm lint`（类型检查 + Oxlint + 模块文档检查）、`pnpm format:check`、`pnpm build`。修改后运行 `pnpm format` 统一格式，import 会自动分组排序。具体规则在 `.prettierrc`，构建产物、依赖、锁文件和静态资源在 `.prettierignore` 排除。

目录参照 `ghspace-polardb-web` 的职责组织：`pages/workspace` 放 SQL 工作区及私有组件，`services` 放数据库 API，`typings` 放共享契约，`utils` 放通用工具。`App.tsx` 通过主题 hook 组装页面，`@/` 指向 `src/`。查询标签与执行记录类型位于 `typings/workspace/index.ts`。

构建版建议从根目录运行 `pnpm build 后在 sql-server 执行 go run ./cmd/sql-studio`，由 Go 同时提供网页和 API；单独 `pnpm preview` 仅用于静态页面预览，没有 API 代理。

库表选择由 `pages/workspace/hooks/useDatabaseObjects/index.ts` 统一加载和缓存，供运行工具栏的 `scopeSelects/index.tsx` 和左侧树共享；请求按连接/刷新范围隔离，并取消过期范围的请求。连接、数据库、表、Schema 属于 QueryTab，切换标签同步选择器、树、编辑器方言及结果；新标签继承当前范围。历史载入创建独立标签，旧草稿补齐新增字段。切库清空表/Schema，PostgreSQL 表使用 `schema.table` 标签与独立 Schema 参数，避免同名表混淆。

亮暗主题使用 defaultAlgorithm / darkAlgorithm，SCSS 从 sql-studio-theme 作用域中的 Ant Design 原生 CSS token 读取主色、背景、边框，不另设蓝色。普通文字使用黑/白，信息 Tag 使用蓝色 solid，按钮/Switch 保持默认变体。右上角可选择亮色、暗黑或跟随系统，偏好保存在 sqldesk.theme。

底部 `resultsDock/index.tsx` 独立管理结果高度：默认 260px，上边缘支持鼠标/触控拖动、双击恢复、上下键每次调整 24px、Home/End 最小/最大、Enter 折叠/展开。折叠后保留 48px 导航，执行 SQL 或选择表时自动展开。ResizeObserver 根据可用空间约束最大高度，为编辑器保留空间；展开高度保存在 sqldesk.resultHeight。结果数据只留在内存，SQL 草稿、标签范围和活动标签保存在浏览器。

连接产品配置集中在 `constant/database/index.ts`，MySQL 与 PostgreSQL 两个协议分别使用 3306/5432 默认端口；切换类型只替换仍是默认值的端口和用户名。连接弹窗含常规、SSL 设置和可保留的测试结果。页面外框固定，左侧对象树、右侧结果内部滚动，SQL 编辑器保持可见。支持范围见 [数据库连接说明](../docs/DATABASES.md)。

界面参考 [design 中的连接弹窗](design/数据库连接弹窗-重设计.png)：左侧数据库类型仅使用原生 primary 背景选中，无勾选图标；固定高度内容区左右独立滚动，头部与底部操作栏保持位置。`engineIcon/index.tsx` 仅引用数据库原有品牌资源，来源见 src/assets/databases/README.md，不重绘或改色。顶栏集中新建连接/新建查询，取消品牌区、连接管理标题、侧栏地址及对象/历史数量标签，只读状态合并进开关。结果数量为普通文字，Tag 使用蓝色 solid 与语义色；实际结果来源保留完整 Tooltip，表单错误保留具体原因。历史抽屉记录默认折叠，展开查看完整 SQL 和载入操作。

Sass 使用 JavaScript 编译器；pnpm-workspace.yaml 关闭可选 @parcel/watcher 的安装脚本，前端安装/生产构建不依赖该脚本。

当前工作区表右键支持新建查询、查询数据、查询结构和查看 DDL；底部仅展示多个独立结果，可切换和关闭，分页固定在滚动区外。信息 Tag 使用蓝色 solid。新建连接仅预填端口；表单和结果布局优先通过组件 style/语义样式配置。

顶栏提供本地 SQL 文件导入，独立查询标签不会覆盖原 SQL；空文件、错误编码或超限内容会提示。行数选择和写入开关及前端参数已移除，查询走后端默认只读/默认返回上限。所有样式集中 src/app.scss，App 不再覆盖 placeholder 等原生颜色，结果页签使用原生下划线 Tabs。
