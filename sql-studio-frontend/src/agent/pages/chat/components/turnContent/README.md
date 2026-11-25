# TurnContent

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

轮次页脚保留执行状态，当前轮次的错误由 Transcript 登记到顶部。

助手回答将text与streaming传给AnswerContent，实时生成与历史恢复使用相同格式解析；未完成表格不会补造行或执行SQL。

waiting为true时由轮次页脚显示等待确认状态，确认卡片由Transcript提供。

相邻思考和工具条目合并为一个折叠区，展开后按原始顺序显示，工具步骤在组内连续编号。正文将过程分成独立的组。折叠组使用首条记录 ID 生成稳定的 `process-ID` 键，并读取旧的 `thinking-ID`、`tools-ID` 展开记录。

展开后直接展示详情，展开和收起使用 Think 自带折叠动画，由组件管理内容退场。

助手生成中使用行内旋转图标和状态文字，等待写入确认时由确认卡片接管。

展开详情中的相邻思考片段和执行步骤之间使用 Ant Design Divider 分隔。分隔线外边距通过组件 style 清零，间距继续由 CHAT.spacing.block 统一控制。

思考片段显示「思考过程」标题，每个工具步骤显示「执行过程」标题，下方保留连续步骤编号、工具名称、参数和结果。

有内容的工具请求参数使用 CodeBlock 按 JSON 结构换行、缩进并高亮。SQL 字段仍以 JSON 字符串显示，复制按钮返回原始参数文本。

渲染单轮 entries、回答底部复制和状态。`busy/status` 为本轮生成状态，`locked` 禁用所有用户问题编辑，`expanded/onExpanded` 管理折叠，`onEdit` 回填问题。执行过程内展示工具参数、调用说明和结果。切换轮次卸载后由外部 `expanded` 恢复折叠。

每轮助手内容前显示 22px 助手图标、「SQL Studio AI」和模型 Tag，图标底色使用 `colorPrimaryBg`，正文缩进 30px；用户气泡靠右、最大宽 78%，沿用 Ant Design X Bubble 的 outlined 外观，编辑与复制操作只在悬停/聚焦时出现。轮次之间由 Transcript 使用 26px 间距和 1px 分隔线隔开。

助手Bubble的root/body/content均满宽，避免表格按内容宽度收缩；用户气泡继续靠右并自适应。

执行过程内的QueryResult传showHeader=false，隐藏结果上方的图标、标题、条目数及行列/耗时栏；保留操作说明、表格列头、滚动、截断提示、SQL展开和Excel导出。title仍传入用于导出文件名。

统一使用CHAT.spacing：问题/过程/回答/错误/底部状态等内容块之间为block（16px），问题气泡与操作、工具名称/调用说明/参数等同组详情之间为detail（8px）。执行步骤改用满宽Flex，步骤元数据与结果、相邻步骤统一16px；用户问题分隔线不再叠加默认margin。正文与卡片均保持满宽和相同左边线。
