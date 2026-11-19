---
name: sql-studio-frontend
description: 开发和维护 SQL Studio 的 Vite React TypeScript Ant Design 前端；用于 UI、组件与 hooks、样式、数据库前端适配、图标资产清理及相关重构，不用于纯后端任务。
---

# SQL Studio 前端开发

README 和规范按 [项目通用文档维护规则](../sql-studio/SKILL.md#文档维护) 更新。

适用于本仓库 `sql-studio-frontend`。先读[前端开发规范](../../../docs/FRONTEND_STANDARDS.md)、[源码索引](../../../sql-studio-frontend/src/README.md)，再读实际模块 README。用户最新要求优先；保留 Vite + React + TypeScript + Ant Design，包管理使用 pnpm。

## 五项约定

1. **保留 Ant Design 默认样式。** 局部布局先用组件参数、`style` 或语义化 `styles`，用公开类型约束样式对象。确实需要原生选择器覆盖时，仅放 [app.scss](../../../sql-studio-frontend/src/app.scss)，限定业务作用域并说明原因；不在组件或其他样式文件散落 `.ant-*` 覆盖。
2. **统一外观。** 同类控件的尺寸、边框和弧度使用 [appearance](../../../sql-studio-frontend/src/constant/appearance/README.md) 与 Ant Design token，页面尺寸进入页面 constant。圆角沿用 Ant Design 默认 token，不设置全局 borderRadius 覆盖；紧凑表格和成功/失败语义色集中复用，不随意新增局部外观。
3. **按功能独立模块。** 组件、hooks、常量/枚举、类型/接口、服务方法和工具各按功能建立目录，以 `index.ts(x)` 和同级 `README.md` 为入口；App/main 为框架例外。README 说明职责、导出、参数与默认值、返回值、调用方式及边界；异步模块补充错误、取消、缓存和状态归属，UI 补充受控值与回调。相关私有 helper 可留在同一功能，不为每个局部变量拆文件。迁移同步调用方、父级索引和文档，不保留旧路径转发壳。
4. **共享只读定义与类型契约。** 复用状态、枚举值及配置集中定义，避免可变全局状态。项目启用 `erasableSyntaxOnly`，枚举优先使用 `as const` 对象和推导联合类型；使用接口、判别联合、泛型及 `satisfies` 约束契约，不用 `any` 或双重断言掩盖错误。网络及存储输入仍需运行时校验。
5. **数据库按引擎封装。** MySQL 专属配置、SQL、补全、类型以及实际需要的组件/hooks/样式放 [databases/mysql](../../../sql-studio-frontend/src/databases/mysql/README.md) 的对应功能目录。外部通过 [DatabaseAdapter](../../../sql-studio-frontend/src/databases/typings/README.md) 和 [getDatabaseAdapter](../../../sql-studio-frontend/src/databases/README.md) 组合调用，不在通用 UI 硬编码方言、端口和图标；HTTP、分组、通用结果 UI 等保留共享层，不建立未支持引擎的空实现。

页面入口和外层组件只组合与调用；表单生命周期、异步请求及业务状态进入所属 hook。页面私有实现放页面内，有多个实际使用者再上提公共层。

## SQL 窗口执行

MySQL/PostgreSQL SQL 窗口运行及结果刷新均允许执行查询、DDL 和 DML，沿用工作台的显式写入路径。表数据和元数据读取继续使用只读请求。用户要求真实执行回归时，在隔离库核对真实写入及失败停止。

## 字体与文本

**普通界面文字统一继承系统默认字体或 Ant Design 默认字体。** 登录页、标题、正文、按钮、表单、表格、提示和说明均遵守此规则。全局 CSS、Ant Design 主题 token 和局部样式均不得自定义字体族，也不得引入额外字体资源。字号、字重、行高和字间距沿用组件默认语义层级。

多行说明使用普通文本容器配合 whiteSpace 和 overflowWrap 保留换行，避免 `pre` 或 `code` 的默认等宽字体。SQL 编辑器和代码预览沿用项目已有的统一字体配置。

## 表单布局

所有业务表单必须“左侧文本标签、右侧输入控件”，使用 Ant Design Form horizontal、labelCol/wrapperCol 和右对齐标签。错误及帮助说明位于右侧输入下方。连接、AI、库/Schema/表管理及引擎专属属性表单统一遵守。长对象名说明放右侧内容区，表格内无标签单元格不添加空标签列。

新增或调整业务表单时，在源码中核对可编辑控件的标签和可翻译 placeholder，包括有默认值或预填值的字段。图标操作提供悬停提示和可访问名称。用户要求界面实测时，再实际清空字段核对表现。

同一引擎的新建/编辑数据库表单保持相同字段顺序、标签宽度和控件列位置。编辑时保留库名行并禁用；PostgreSQL 不可修改属性直接 disabled，不使用可聚焦的 readOnly。新建尚不支持设置的属性显示默认值提示并禁用，不注册校验或提交这些字段。

## 图标与资产

- 图标先复用已有资源和 `@ant-design/icons`。引擎图标经 profile 分派，由 EngineIcon 展示。MySQL 海豚图形取自官方 SVG，状态底板由 EngineIcon 渲染。资源来源和使用范围记录在 [资产说明](../../../sql-studio-frontend/src/assets/databases/README.md)。
- 清理前核对源码 import、HTML/favicon、CSS URL、SVG sprite/use、动态路径及构建配置；仅文件名搜索无命中不足以证明动态资源未使用。区分运行资源与设计参考、文档截图，不按“未被 TS 导入”直接删除 public 或参考文件。
- 只删除确认无调用者的文件或图标导入，同步资产说明；保留仍在使用的图标包，不清理依赖目录或用户数据。

## 交付前检查

遵循 [项目交付前检查](../sql-studio/SKILL.md#交付前检查)。格式化仅处理改动文件。用户明确要求执行检查时，在 `sql-studio-frontend` 按所需范围运行 `pnpm lint`、`pnpm build` 或对应测试。`pnpm lint` 已包含结构和文档链接检查。

用户要求浏览器或桌面界面实测时，按改动核对亮暗主题、字体、长名称、控件一致性和伸缩布局。使用隔离数据并报告实际覆盖情况。此 skill 不要求额外审批，也不授权提交、部署、发送消息或修改业务数据。
