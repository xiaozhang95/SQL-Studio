# 单元格输入

DataCellEditor 接收 useDataEditing 返回值 editor 和 disabled。只展示受控多行输入和可空列 NULL 开关，不包含单元格保存按钮。修改即时进入页面暂存；Esc 结束输入但保留暂存，Ctrl/Command+Enter 调用顶部同一个统一保存。切换编辑对象不自动提交数据库。

点击编辑容器外部（包括不可聚焦的表格空白）通过 document pointerdown 结束输入并恢复文本；NULL 开关属于容器内部，不会误收起。结束输入保留暂存，不发送保存请求，卸载移除监听。

空内容占位符明确可留空，NULL模式显示NULL，不将空字符串视为未填写。

时间字段输入复用 temporalInput：DATE 使用日期选择，TIME 使用时分秒，DATETIME/TIMESTAMP 使用日期时间；保留原字符串手动编辑及 NULL/默认值语义，带时区和特殊时间值不强制转换。表设计仅常量默认值启用选择器，表达式仍按文本输入。
