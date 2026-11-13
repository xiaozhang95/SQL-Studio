# AnswerContent

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

AnswerContent({text:string,streaming?:boolean})展示助手回答，streaming默认false，由TurnContent传入实际增量状态。通过answerTables解析带围栏或裸JSON二维表格及Markdown管道表格，渲染为QueryResult；showHeader=false隐藏标题栏（标题、行列数、耗时），保留表格正文、分页与截断提示。每个表格下方提供导出Excel，导出该表格已返回的全部行，不受当前分页影响，不额外查询数据库。表格仅保留Table自身边框，不外包Card。

说明文字由AnswerMarkdown渲染加粗、行内代码、列表及链接，HTML只作文字；代码复用CodeBlock。未闭合结果对象在streaming时显示整理提示，结束/取消后显示未完成说明和可展开原文，不在正文刷出大段残缺JSON，也不补造数据。损坏的完整JSON和代码示例保留原文。历史恢复与实时输出共用此组件，不自动重新请求。模型表格不作为SQL执行。

文字、表格、代码块由满宽 Flex 统一使用 CHAT.spacing.block（原生 middle，16px）间隔。表格和代码块共用满宽外框，左右贴齐正文。文本仅修整块边界空白，保留块内换行；纯空白片段不渲染，防止模型空行叠加出不对称留白。
