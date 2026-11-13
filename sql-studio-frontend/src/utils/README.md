# utils

- [HTTP 请求](request/README.md)，工作台和 AI 助手共用的 JSON、网络及流式请求入口。
- [SQL 文件导出](sqlExport/README.md)
- [查询结果 CSV](csv/README.md)
- [界面翻译](translate/README.md)：按语言读取词典和替换命名占位符，不持有全局可变状态。
- [请求语言](language/README.md)：读取已应用语言，供 HTTP 与非 React 工具使用。

每个实际模块单独目录并保留源码入口与 README。

- [关闭前保存 SQL](sqlSave/README.md)。

- [exportWriter](exportWriter/README.md)：原生文件流及有界下载兼容。

- [latestWriter](latestWriter/README.md)：同一工作区单在途、只保留最新等待保存。
