---
name: sql-studio-frontend
description: 开发和维护 SQL Studio 的 Vite React TypeScript Ant Design 前端；用于 UI、组件与 hooks、样式、数据库前端适配、图标资产清理及相关重构，不用于纯后端任务。
---

# SQL Studio 前端开发

适用于本仓库 `sql-web`。先读[前端开发规范](../../../docs/FRONTEND_STANDARDS.md)、[源码索引](../../../sql-web/src/README.md)，再读实际模块 README。用户最新要求优先；保留 Vite + React + TypeScript + Ant Design，包管理使用 pnpm。

## 五项约定

1. **保留 Ant Design 默认样式。** 局部布局先用组件参数、`style` 或语义化 `styles`，用公开类型约束样式对象。确实需要原生选择器覆盖时，仅放 [app.scss](../../../sql-web/src/app.scss)，限定业务作用域并说明原因；不在组件或其他样式文件散落 `.ant-*` 覆盖。
2. **统一外观。** 同类控件的尺寸、边框和弧度使用 [appearance](../../../sql-web/src/constant/appearance/README.md) 与 Ant Design token，页面尺寸进入页面 constant。已确认的全局方角、紧凑表格和成功/失败语义色集中复用，不随意新增局部外观。
3. **按功能独立模块。** 组件、hooks、常量/枚举、类型/接口、服务方法和工具各按功能建立目录，以 `index.ts(x)` 和同级 `README.md` 为入口；App/main 为框架例外。README 说明职责、导出、参数与默认值、返回值、调用方式及边界；异步模块补充错误、取消、缓存和状态归属，UI 补充受控值与回调。相关私有 helper 可留在同一功能，不为每个局部变量拆文件。迁移同步调用方、父级索引和文档，不保留旧路径转发壳。
4. **共享只读定义与类型契约。** 复用状态、枚举值及配置集中定义，避免可变全局状态。项目启用 `erasableSyntaxOnly`，枚举优先使用 `as const` 对象和推导联合类型；使用接口、判别联合、泛型及 `satisfies` 约束契约，不用 `any` 或双重断言掩盖错误。网络及存储输入仍需运行时校验。
5. **数据库按引擎封装。** MySQL 专属配置、SQL、补全、类型以及实际需要的组件/hooks/样式放 [databases/mysql](../../../sql-web/src/databases/mysql/README.md) 的对应功能目录。外部通过 [DatabaseAdapter](../../../sql-web/src/databases/typings/README.md) 和 [getDatabaseAdapter](../../../sql-web/src/databases/README.md) 组合调用，不在通用 UI 硬编码方言、端口和图标；HTTP、分组、通用结果 UI 等保留共享层，不建立未支持引擎的空实现。

页面入口和外层组件只组合与调用；表单生命周期、异步请求及业务状态进入所属 hook。页面私有实现放页面内，有多个实际使用者再上提公共层。

## 图标与资产

- 图标先复用已有资源和 `@ant-design/icons`。引擎图标经 profile 分派，由 engineIcon 展示；来源和使用范围记录在 [资产说明](../../../sql-web/src/assets/databases/README.md)。当前海豚是用户参考图对应的状态图标，不宣称为官方 Logo。
- 清理前核对源码 import、HTML/favicon、CSS URL、SVG sprite/use、动态路径及构建配置；仅文件名搜索无命中不足以证明动态资源未使用。区分运行资源与设计参考、文档截图，不按“未被 TS 导入”直接删除 public 或参考文件。
- 只删除确认无调用者的文件或图标导入，同步资产说明；保留仍在使用的图标包，不清理依赖目录或用户数据。

## 验证与交付

在 `sql-web` 运行 `pnpm format`、`pnpm lint`、`pnpm build`；`pnpm lint` 已包含 `node --test tests/structure.test.mjs` 的结构与文档检查。根据改动验证实际行为，不为单纯删除未使用资源增加重复测试。

UI 行为或样式变更检查亮暗主题、长名称、控件一致性和伸缩布局，保存可核验截图；使用隔离数据，恢复工作区不自动执行 SQL，遵守当前连接归属和请求取消边界。未执行的检查如实说明。此 skill 不要求额外审批，也不授权提交、部署、发送消息或修改业务数据。
