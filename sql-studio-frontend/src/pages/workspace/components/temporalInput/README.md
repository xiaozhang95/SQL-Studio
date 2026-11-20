# 时间字段输入

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

TemporalInput 接收受控字符串 value/onChange、fieldType、disabled、placeholder、label、autoFocus、multiline（默认 false）和可选 popupRef。时间字段使用一个可直接输入的文本框，右侧日历或时钟按钮打开面板。DATE 选择日期，TIME 选择时分秒，DATETIME/TIMESTAMP 选择日期时间。识别精度声明及不带时区的标准类型名称，选择精度为秒。

仅明确选择后替换字符串。零日期、负数或超过 24 小时的 TIME、微秒和特殊字面值保留手动输入语义。带时区时间字段、interval 以及未知类型保持文本编辑。NULL 和数据库默认值由上层管理。表设计在常量模式启用选择器，表达式继续文本编辑。选择面板使用 Ant Design 的默认弹层容器，避免受表体或表单滚动区域裁切。popupRef 供单元格编辑器判断弹层内点击。
