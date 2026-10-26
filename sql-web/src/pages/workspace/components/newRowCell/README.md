# 新增行单元格表单

NewRowCell 接收受控 value、column 元数据、editable、disabled 和 onChange。新增行始终显示输入框和值类型下拉；默认值不向 INSERT 传值，指定值允许显式空字符串，可空字段支持 NULL。生成或暂不支持字段禁用。输入不自动提交数据库，业务暂存由 useDataEditing 持有。
