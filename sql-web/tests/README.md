# 前端回归

使用 Node 原生测试运行器，不保留根目录 scripts 包装入口。

- `pnpm test:sql`：MySQL 标识符、表预览、语句拆分、引号/注释边界和历史标记去重。
- `node --test tests/structure.test.mjs`：模块入口、README、原生样式归属及本地文档链接，已纳入 `pnpm lint`。不读取 data、凭据、依赖或构建目录；后端依赖边界由原生 Go 架构测试独立检查。

`pnpm test:storage` 使用 Node 24 原生测试运行器与仅测试依赖 fake-indexeddb，验证真实 Web Crypto：不可导出密钥、密文与随机 IV、跨客户端密钥恢复、并发写入顺序、密文及认证数据篡改检测。不读取真实浏览器资料或数据库业务数据。

页面恢复、主题、树布局、SQL 补全与结果状态联动另用虚构接口做浏览器验证。

- `pnpm test:objects`：库表操作 SQL 目标转义、默认值/SQL mode、类型与表达式注入拒绝、特殊字段保护及差异 ALTER；无数据库访问。

数据编辑回归：`node --test tests/data-editing.test.mjs`，覆盖精确主键、联合主键、NULL/空字符串、标识符/值注入边界及生成列限制，不访问真实数据库。
