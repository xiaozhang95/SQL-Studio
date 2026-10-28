# 编辑内容同步缓冲

createEditorBuffer(commit,pending,delay=250) 合并当前页面 SQL 文档读取器与选区/滚动布局。push 只保留最新不可变文档引用，不立即生成完整字符串；固定截止时间让连续输入/滚动也每250ms提交一次。flush 用于运行、导出、切页、失焦和卸载，返回实际提交的 EditorChange；仅位置变化不读取 SQL。切换 id 先提交旧页。discard(ids) 取消已关闭页待提交内容，不重新生成页面；不持有已提交草稿或结果。
