# MySQL 补全扩展

[源码](index.ts)

mysqlCompletion(context) 接收 SQLCompletionContext 的 database、table、schema，返回 CodeMirror LanguageSupport；固定 MySQL 方言和大写关键字，按当前库表设置 defaultSchema/defaultTable。

schema 由工作区 hook 按当前连接缓存生成；本模块不读取页面状态、不请求元数据、不维护异步缓存，不注入自定义字体或补全样式。外部通过适配器 completion 调用。
