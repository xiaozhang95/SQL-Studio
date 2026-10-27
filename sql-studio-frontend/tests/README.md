# 前端回归

使用 Node 原生测试运行器，不保留根目录 scripts 包装入口。

- `pnpm test:sql`：MySQL 标识符、表预览、语句拆分、引号/注释边界、历史标记去重，以及结果 SQL 定义/语句列识别和普通元数据列排除。
- `node --test tests/structure.test.mjs`：模块入口、README、原生样式归属及本地文档链接，已纳入 `pnpm lint`。不读取 data、凭据、依赖或构建目录；后端依赖边界由原生 Go 架构测试独立检查。

`pnpm test:storage` 使用 Node 24 原生测试运行器与仅测试依赖 fake-indexeddb，验证真实 Web Crypto：不可导出密钥、密文与随机 IV、跨客户端密钥恢复、并发写入顺序、密文及认证数据篡改检测。不读取真实浏览器资料或数据库业务数据。

页面恢复、主题、树布局、SQL 补全与结果状态联动另用虚构接口做浏览器验证。

- `pnpm test:objects`：库表操作 SQL 目标转义、默认值/SQL mode、类型与表达式注入拒绝、特殊字段保护及差异 ALTER；无数据库访问。

数据编辑回归：`node --test tests/data-editing.test.mjs`，覆盖精确主键、联合主键、NULL/空字符串、标识符/值注入边界及生成列限制，不访问真实数据库。

用户配置回归：node --test tests/user-state.test.mjs，覆盖服务端优先、旧记录迁移、串行修订及冲突，不访问真实用户文件。

对象树回归：node --test tests/object-tree.test.mjs，验证多连接及特殊名称节点身份、复合索引顺序、前缀、降序和表达式说明；浏览器使用独立端口和虚构数据检查，不连接真实数据库。

scope-close.test.mjs 覆盖同名库跨连接隔离、所有关联查询汇总、库级取消及新请求代、保存 SQL 成功等待、取消与写入失败。浏览器用虚构接口检查保存/取消/关闭及关闭失败保留窗口。

workspace-transitions.test.mjs 验证新增对象不修改布局、删库按连接及数据库隔离；explorer-tree.test.mjs 验证万表数据的折叠分支不生成后代、字段/索引按自身展开生成、首次滚动恢复等待元数据。浏览器用独立虚构接口验证新增连接保留当前下拉值、删库保留另一连接展开/缓存、万表实际 DOM 仅为视口行数及末尾滚动。

对象树收起动画回归需在动画仍挂载旧节点时读取可见行：反复收起/展开字段、索引、表和数据库，标题应始终保留名称与图标，不能出现 JSON 内部 key；同时检查亮暗主题及操作后的最终展开状态。

history-completion.test.mjs 覆盖旧历史每连接截取最新 50 条、删除归属隔离、AI 万表上下文选择与限长，以及原生 SQL 库前缀/别名字段补全。浏览器使用虚构连接和模拟 AI，检查历史追加/删除落盘、输入防抖、Tab 优先本地补全、AI 接受/取消和继续输入中止请求，不调用真实模型。

切库回归：`node --test tests/use-database.test.mjs` 执行实际 executeSQL 编排、替换请求和状态，验证多次 USE 的后续请求/历史/结果范围、页面隔离、失败停止和取消不切库；不连接业务数据库。

PostgreSQL 回归：`node --test tests/postgresql.test.mjs` 检查美元引号/E 字符串/嵌套注释、历史保护、schema 同名表身份、SQL 注入边界、精确主键与 NULL 数据编辑；不访问网络。

explorer-tree.test.mjs 额外验证 PostgreSQL 空 schema、schema 分类隔离、同名表的短标题/完整操作目标和搜索，MySQL 万表按展开构建的行为保持不变。

Schema 回归覆盖结构列表拆列、旧记录迁移、同名/特殊标识符、指定 schema 下补全、AI 引用与历史/刷新请求范围；后端用同一物理连接的替身检查 search_path 参数化及只读边界。
