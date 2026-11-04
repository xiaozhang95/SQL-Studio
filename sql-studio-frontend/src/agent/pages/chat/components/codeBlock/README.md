# CodeBlock

text/language受控的只读代码预览。复用CodeMirror，支持SQL、JSON、JS/TS/JSX/TSX、Python，其他语言显示安全纯代码；不执行代码。标题显示语言及Ant Design复制按钮，复制不含围栏标记；支持亮暗主题、自动换行、超高滚动，流式未闭合围栏也展示已收到内容。extensions按语言和主题缓存。

代码区域字体、字号、行高均使用当前Ant Design token，不采用CodeMirror默认等宽字体；语法高亮与复制保留。

代码卡片、查询结果表格和工作区的 SQL 预览面板共用 app.scss 的外框规则。代码内容裁切在圆角内，长代码仍可在编辑器内滚动。与相邻内容的间隔由 AnswerContent 或 WriteConfirmation 控制。

编辑器背景与文字颜色通过 CodeMirror 的原生主题扩展跟随 Ant Design，选择器复用工作区预览的优先级。内容边距取 paddingSM，最大高度与 Agent 结果预览共用 APPEARANCE.resultPreviewHeight。
