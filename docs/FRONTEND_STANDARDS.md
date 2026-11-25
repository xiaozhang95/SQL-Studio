# 前端开发规范

本文件记录用户确认的前端规范，适用于新增功能和维护现有模块。前端任务使用 [sql-studio-frontend skill](../.agents/skills/sql-studio-frontend/SKILL.md)，开发前与 [源码索引](../sql-studio-frontend/src/README.md) 和目标模块 README 一起阅读；用户最新明确要求优先。

## Ant Design 与样式

Electron 标题栏、全局导航、工作区与 AI 助手侧栏的布局边界共用 `--layout-divider`。暗色使用 `colorBorderSecondary`，亮色取 `colorBorderSecondary` 与 `colorBorder` 的中间色。弹窗内部分隔线使用 `--border`（`colorBorderSecondary`）。同一边界由一处绘制，工作区 Tabs 的原生栏底分隔线共用布局边界颜色。

1. 以 Ant Design 组件为底座，使用 [主题 token](../sql-studio-frontend/src/constant/theme/README.md) 和项目设计令牌统一颜色、字号、间距与状态。主色使用 Logo 放大镜的蓝色 `#2569DF` 作为种子，由主题算法派生亮暗与交互色。信息色沿用 Ant Design 默认令牌。全局页面切换、主题切换和系统设置由 AppRail 承载，业务操作放入对应工具栏、页签栏或侧栏。
2. 能通过组件参数、`style`、语义化 `styles` 表达的布局和受控状态样式，放回所属组件，不集中堆进全局文件；组件内的颜色、圆角、间距和尺寸优先读取 `theme.useToken()`，简单排版优先使用 Flex、Space 等原生组件；样式对象用 `CSSProperties` 或组件公开类型约束。Ant Design 原生覆盖仅放 [app.scss](../sql-studio-frontend/src/app.scss)。基础全局规则、媒体查询及确需 CSS 的 hover/焦点/伪元素可保留于该文件，限定作用域并说明原因；第三方控件有原生样式 API 时优先使用，例如 CodeMirror 的 EditorView.theme。
3. 同类组件使用相同尺寸和外观配置，不零散写死高度、边框、弧度或颜色。全局约定放 [appearance](../sql-studio-frontend/src/constant/appearance/README.md)，页面专用尺寸放对应页面 constant；优先使用 Ant Design token，不另造颜色体系。
4. 成功/失败语义色、Alert 的状态底色和描边、紧凑数据表等已确认要求集中配置后复用；圆角沿用 Ant Design 默认 token，不设置全局 borderRadius 覆盖。不能把单处要求扩大为所有原生组件的覆盖。修改共享配置时同时核对亮暗主题和所有使用者。
5. **每个操作面只设置一个 primary 主操作。** 工作台「运行」、AI「发送」、同步「同步检查/开始同步」、设置与连接「保存」使用 primary；其余操作使用 default、text 或图标按钮。Modal/AntApp 确认按钮继续使用 default，写入确认可使用 warning。
6. **业务表单统一左侧文本标签、右侧输入控件。** 使用 Ant Design Form 的 horizontal 布局、labelCol/wrapperCol 和合适的固定标签宽度，标签右对齐；校验错误、帮助说明跟随右侧输入。输入控件的边框和焦点样式沿用 Ant Design 令牌，按钮聚焦时仅显示按钮自身样式。新建/编辑连接、AI 配置、数据库/Schema/表管理及引擎专属属性表单均遵守，不新增 vertical 或上下排列；长名称说明放右侧内容区，表格内无标签单元格不加空白标签列。
7. **普通界面文本沿用系统和 Ant Design 默认字体。** 提示、错误详情、消息、摘要、表单及表格不单独指定字体族、字号、字重或字间距；使用组件默认层级和语义样式，不引入自定义字体。多行说明用普通文本容器配合 whiteSpace/overflowWrap，不能为了保留换行使用自带等宽字体的 pre/code。SQL 编辑与预览沿用现有统一配置，不因局部提示调整字体。

同一引擎的新建/编辑数据库表单保持相同字段顺序、标签宽度和控件列位置。编辑时库名行保留并禁用；PostgreSQL 不可修改字段使用 disabled，不能只用 readOnly。新建尚不支持设置的属性显示默认值提示并禁用，不注册校验或提交这些字段。

## 单一功能模块

删除数据行、Redis 键、AI 会话及清空执行历史使用 [DeleteDialog](../sql-studio-frontend/src/components/deleteDialog/README.md) 展示目标和影响范围。涉及库表对象的删除与清空使用所属业务弹框，保留完整名称校验。移除模型或表设计草稿字段使用 [DeleteConfirmation](../sql-studio-frontend/src/components/deleteConfirmation/README.md) 气泡。模型和字段草稿在对应设置或表结构保存后生效。确认按钮使用 default 类型，提交期间避免重复操作，失败原因在所属弹框或气泡中展示。

独立内容区的加载提示统一复用 [ContentLoading](../sql-studio-frontend/src/components/contentLoading/README.md)，沿用 Ant Design 的默认指示器、颜色、尺寸和字体。共用布局和必要的样式覆盖集中在 `app.scss`。

页面操作错误由 [PageErrorBanner](../sql-studio-frontend/src/components/pageErrorBanner/README.md) 在内容顶部通栏展示，重复原因合并。弹框和抽屉在所属区域展示。打开已保存的数据库连接失败时，对象树在该连接下方展示具体原因和重试入口。查询输出、对象树及聊天记录保留对应状态。HTTP 请求由共享 request 处理，413 展示请求体超限原因，网络或响应读取失败使用服务连接提示。

组件、hooks、常量/枚举、类型/接口、服务方法和工具按功能独立组织。每个实际功能使用一个目录，`index.ts` 或 `index.tsx` 为实现入口，旁边必须有 `README.md`，而非把多个无关功能堆进一个文件。

README 至少说明职责、导出接口、参数类型/可选值/默认值、返回值、调用方式及有影响的边界；异步模块补充错误、取消、缓存和状态归属，UI 模块补充受控值及回调。变更实现时同步文档和父级索引。App/main 为框架入口例外，不保留旧路径转发壳。

页面入口和外层组件只组合组件、传递 props、调用明确接口。请求、表单生命周期、业务状态和补全组织进入独立 hook；纯方法进入所属功能模块；展示组件不直接拼协议 SQL 或读取其他连接的可变状态。

仅页面使用的实现放该页面的 components/hooks/constant/typings 等目录；已有多个使用者的通用能力再进入共享层。模块内的相关私有 helper 保留在本功能内，避免为每个局部变量建立文件或创建无使用者的空模块。

## TypeScript 与共享定义

有业务含义且会复用的状态、枚举、默认值、尺寸、类型和配置应有明确名称并集中维护，使用只读常量，避免在组件中重复字符串和数值，也避免扩大为可变全局状态。

项目启用 `erasableSyntaxOnly`，使用 `as const` 常量对象加值联合类型表达枚举；使用 `interface`/`type`、泛型、判别联合、`Record`、`Pick`、`Omit`、`Readonly` 和 `satisfies` 描述契约及做穷尽校验。不用 `any`、双重断言或强行类型转换掩盖边界错误；网络和存储输入仍需运行时校验。

共享 API 契约维护在 [typings/database](../sql-studio-frontend/src/typings/database/README.md)，引擎枚举及能力契约在 [databases/typings](../sql-studio-frontend/src/databases/typings/README.md)。组件只消费需要的字段，不把整个业务层任意传递。

## 数据库按引擎拆分

[databases](../sql-studio-frontend/src/databases/README.md) 是统一分派入口；[MySQL](../sql-studio-frontend/src/databases/mysql/README.md)、[MariaDB](../sql-studio-frontend/src/databases/mariadb/README.md) 和 [PostgreSQL](../sql-studio-frontend/src/databases/postgresql/README.md) 分别维护各自的适配能力，每个实际模块都有独立 README。

数据库专属的配置、类型、接口、SQL 方法、补全、组件或 hooks 放到对应引擎内；存在实际专属样式对象时也归该功能。外部只通过 DatabaseAdapter 调用，不在通用组件中硬编码 MySQL 标签、3306、图标资源、方言或引号规则。新增引擎按同一契约注册，注册表做类型穷尽检查，不提前创建未支持引擎的空实现。

连接分组、HTTP 传输、SQL 文件下载和通用结果 UI 不依赖数据库方言，保留在通用层。只有确实存在引擎差异的行为才下沉到数据库目录，避免复制同一套请求接口和公共组件。数据库模块不能自行绕过后端的只读、权限、超时与数据限制。

## 验证

交付遵循 [项目交付前检查](../.agents/skills/sql-studio/SKILL.md#交付前检查)。格式化仅处理改动文件。功能迁移同步调用方、README、目录索引和回归入口。用户要求自动化检查时按范围运行 `pnpm lint`、`pnpm build` 或对应测试，`pnpm lint` 包含模块结构和本地文档链接检查。用户要求界面实测时，使用隔离数据核对亮暗主题、字体、长名称、换行、尺寸和伸缩布局。

新增连接、数据库和表只更新对应列表，不自动切换查询范围、选中或展开节点；对象变更仅刷新目标缓存，其他连接的展开/折叠保留。对象树使用虚拟滚动，滚动位置延迟保存，避免逐帧更新整个工作区。
