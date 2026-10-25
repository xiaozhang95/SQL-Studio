# 前端开发规范

本文件记录用户确认的前端规范，适用于新增功能和维护现有模块。前端任务使用 [sql-studio-frontend skill](../.agents/skills/sql-studio-frontend/SKILL.md)，开发前与 [源码索引](../sql-web/src/README.md) 和目标模块 README 一起阅读；用户最新明确要求优先。

## Ant Design 与样式

1. 默认使用 Ant Design 提供的尺寸、边框、弧度、字体、颜色及交互，不在业务组件里随意覆盖原生样式。
2. 局部布局优先使用组件参数、`style`、语义化 `styles`；样式对象用 `CSSProperties` 或组件公开类型约束。需要 hover/选中/伪元素等选择器或确实必须覆盖 Ant Design 时，统一放在 [app.scss](../sql-web/src/app.scss)，限定业务作用域并说明原因。
3. 同类组件使用相同尺寸和外观配置，不零散写死高度、边框、弧度或颜色。全局约定放 [appearance](../sql-web/src/constant/appearance/README.md)，页面专用尺寸放对应页面 constant；优先使用 Ant Design token，不另造颜色体系。
4. 用户已确认的方角、成功/失败语义色、紧凑数据表等属于明确产品要求，集中配置后复用；不能把单处要求扩大为所有原生组件的覆盖。修改共享配置时同时核对亮暗主题和所有使用者。

## 单一功能模块

组件、hooks、常量/枚举、类型/接口、服务方法和工具按功能独立组织。每个实际功能使用一个目录，`index.ts` 或 `index.tsx` 为实现入口，旁边必须有 `README.md`，而非把多个无关功能堆进一个文件。

README 至少说明职责、导出接口、参数类型/可选值/默认值、返回值、调用方式及有影响的边界；异步模块补充错误、取消、缓存和状态归属，UI 模块补充受控值及回调。变更实现时同步文档和父级索引。App/main 为框架入口例外，不保留旧路径转发壳。

页面入口和外层组件只组合组件、传递 props、调用明确接口。请求、表单生命周期、业务状态和补全组织进入独立 hook；纯方法进入所属功能模块；展示组件不直接拼协议 SQL 或读取其他连接的可变状态。

仅页面使用的实现放该页面的 components/hooks/constant/typings 等目录；已有多个使用者的通用能力再进入共享层。模块内的相关私有 helper 保留在本功能内，避免为每个局部变量建立文件或创建无使用者的空模块。

## TypeScript 与共享定义

有业务含义且会复用的状态、枚举、默认值、尺寸、类型和配置应有明确名称并集中维护，使用只读常量，避免在组件中重复字符串和数值，也避免扩大为可变全局状态。

项目启用 `erasableSyntaxOnly`，使用 `as const` 常量对象加值联合类型表达枚举；使用 `interface`/`type`、泛型、判别联合、`Record`、`Pick`、`Omit`、`Readonly` 和 `satisfies` 描述契约及做穷尽校验。不用 `any`、双重断言或强行类型转换掩盖边界错误；网络和存储输入仍需运行时校验。

共享 API 契约维护在 [typings/database](../sql-web/src/typings/database/README.md)，引擎枚举及能力契约在 [databases/typings](../sql-web/src/databases/typings/README.md)。组件只消费需要的字段，不把整个业务层任意传递。

## 数据库按引擎拆分

[databases](../sql-web/src/databases/README.md) 是统一分派入口；[mysql](../sql-web/src/databases/mysql/README.md) 单独维护 MySQL 实现，按功能拆分 profile、query、statements、history、completion，每个模块都有独立 README。

数据库专属的配置、类型、接口、SQL 方法、补全、组件或 hooks 放到对应引擎内；存在实际专属样式对象时也归该功能。外部只通过 DatabaseAdapter 调用，不在通用组件中硬编码 MySQL 标签、3306、图标资源、方言或引号规则。新增引擎按同一契约注册，注册表做类型穷尽检查，不提前创建未支持引擎的空实现。

连接分组、HTTP 传输、SQL 文件下载和通用结果 UI 不依赖数据库方言，保留在通用层。只有确实存在引擎差异的行为才下沉到数据库目录，避免复制同一套请求接口和公共组件。数据库模块不能自行绕过后端的只读、权限、超时与数据限制。

## 验证

修改后运行 `pnpm format`、`pnpm lint`、`pnpm build` 和根目录 `cd sql-web && node --test tests/structure.test.mjs`。功能迁移同步全部调用方、README、目录索引及回归入口；针对行为变化做必要验证。涉及 UI 时核对亮暗主题、长名称、尺寸一致性与伸缩布局，使用隔离数据，不读取业务表满足检查。
