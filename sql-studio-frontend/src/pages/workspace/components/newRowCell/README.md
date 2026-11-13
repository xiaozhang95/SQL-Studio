# 新增行单元格表单

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

NewRowCell 接收受控 value、column 元数据、editable、disabled 和 onChange。新增行始终显示输入框和值类型下拉；默认值不向 INSERT 传值，指定值允许显式空字符串，可空字段支持 NULL。生成或暂不支持字段禁用。输入不自动提交数据库，业务暂存由 useDataEditing 持有。

值类型选择器提供请选择值类型的placeholder，输入内容仍复用默认值/指定值状态对应占位符。

时间字段输入复用 temporalInput：DATE 使用日期选择，TIME 使用时分秒，DATETIME/TIMESTAMP 使用日期时间；保留原字符串手动编辑及 NULL/默认值语义，带时区和特殊时间值不强制转换。表设计仅常量默认值启用选择器，表达式仍按文本输入。
