# SQL Studio 前端

Vite + React + TypeScript + Ant Design + SCSS，SQL 编辑使用 CodeMirror。包管理使用 pnpm。

从仓库根目录进入 sql-studio-frontend：

```sh
cd sql-studio-frontend
pnpm install
pnpm dev
```

开发地址 `http://127.0.0.1:15173`，/api 同源代理到 Go 18080。构建使用 `pnpm build`，Go 提供 dist 网页；`pnpm preview` 仅预览静态资源，没有 API 代理。

本目录 `package.json` 的 `version` 是网页和 Electron 共用的产品版本。Vite 将它写入前端构建，显示在「系统设置 → 关于」。Electron 打包也读取该版本，检查更新由桌面应用提供。

前端使用历史路由，`/` 为 SQL 工作区，`/agent` 为 AI 助手。Vite 配置为 SPA 模式，支持直接访问和刷新；构建后的网页由 Go 显式提供这两个页面入口。页面内切换使用 History API，支持浏览器前进、后退。

[源码索引](src/README.md) · [前端规范](../docs/FRONTEND_STANDARDS.md) · [项目框架](../docs/ARCHITECTURE.md) · [测试](tests/README.md)

页面只组合组件，状态、请求与取消归所属 hook。MySQL、MariaDB 和 PostgreSQL 的 SQL、补全和对象操作经 databases 适配器调用，AI 服务商经 ai 适配器调用。查询与结果始终归属发起页面及连接，恢复本机配置不执行 SQL。

Ant Design 默认优先；圆角沿用原生 token，紧凑表格等统一配置见 appearance，必要覆盖全部位于 app.scss。主题使用 defaultAlgorithm/darkAlgorithm，保持系统字体。工作区、历史、主题通过 Go 保存，格式见 [用户状态](../docs/USER_STATE.md)。

检查：`pnpm format`、`pnpm lint`、`node --test tests/*.test.mjs`、`pnpm build`。结构测试包含模块 README、样式归属和本地文档链接。

Swagger 为独立入口 swagger.html，UI 依赖 swagger-ui-dist，资源随构建提供，不使用 CDN；契约从 /api/openapi.json 获取。访问路径与接口列表见 [API](../docs/API.md)。pnpm-workspace.yaml 禁用非必需的 watcher/Scarf 安装脚本。
