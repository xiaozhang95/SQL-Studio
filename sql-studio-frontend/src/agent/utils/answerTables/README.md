# answerTables

answerTables(text)安全分割回答文本、合法JSON二维表格及Markdown管道表格。Markdown需要表头与至少三横杠分隔行，保留列位置、精确数值字符串及重复列；支持转义管道和行内代码，代码块内不误识别。损坏JSON保留原文，不执行HTML。返回AnswerPart判别联合，供表格渲染与Excel导出复用。

非表格围栏代码返回code片段，保留语言和原始内容（不含围栏）；流式未闭合代码也显示为代码，合法JSON二维表格优先显示表格。
