# 时间字段输入

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

TemporalInput 接收受控字符串 value/onChange、fieldType、disabled、placeholder、label、autoFocus 和 multiline（默认 false）。时间字段只展示一个输入框：可直接输入原文本，右侧日历/时钟按钮打开选择面板；DATE 选择日期、TIME 选择时分秒、DATETIME/TIMESTAMP 选择日期时间；识别精度声明及不带时区的标准类型名称。选择精度为秒，不隐式转换时区。

仅明确选择后替换字符串，不把零日期、负数或超过24小时的 TIME、微秒、特殊字面值强制解析为 JS Date。带时区时间字段、interval 以及未知类型保持文本编辑，避免丢失偏移或区间语义。NULL 和数据库默认值由上层管理。表设计仅常量模式启用；表达式如 CURRENT_TIMESTAMP 继续文本编辑。弹层挂载在组件内部，避免单元格外部点击监听提前关闭编辑。无异步请求，不自动保存或执行 SQL。
