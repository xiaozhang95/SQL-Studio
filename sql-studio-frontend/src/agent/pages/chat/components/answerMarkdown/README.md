# AnswerMarkdown

AnswerMarkdown({text:string}) 将回答中的说明文字渲染为 React 元素。使用 marked 的独立 Lexer，支持段落、加粗、斜体、行内代码、列表、引用、标题、分隔线与链接，保留普通换行；代码块复用 CodeBlock，表格复用 QueryResult。布局使用 CHAT.spacing 和 Ant Design token，不覆盖全局字体或原生组件样式。

只使用默认词法规则，不安装全局扩展。HTML 按文字显示，图片只显示替代文字；链接仅允许 HTTP、HTTPS、mailto，其他协议只保留标签。没有 HTML 注入、远程图片加载、SQL 执行、请求、缓存或持久化。解析结果随 text 更新，亮暗主题由 Ant Design 提供。
