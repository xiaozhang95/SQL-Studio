# AnswerContent

text为助手回答，通过answerTables解析有效JSON二维表格及Markdown管道表格，渲染为QueryResult；showHeader=false隐藏标题栏（标题、行列数、耗时），保留表格正文、分页与截断提示。每个表格下方提供导出Excel，导出该表格已返回的全部行，不受当前分页影响，不额外查询数据库。表格仅保留Table自身边框，不外包Card。其他文本安全显示，不执行HTML。损坏JSON和代码示例保留原文。模型表格不作为SQL执行。

文字、表格、代码块由满宽Flex统一使用CHAT.spacing.block（原生middle，16px）间隔，不依赖内容自己的外边距。文本仅修整块边界空白，保留块内换行；纯空白片段不渲染，防止模型空行叠加出不对称留白。
