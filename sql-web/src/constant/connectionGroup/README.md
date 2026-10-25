# 连接分组

[源码](index.ts)

defaultConnectionGroup 为“默认分组”；connectionGroupName(group?) 去除首尾空白，空值和旧连接缺少分组时返回默认名称。用于对象树、表单和保存后的展开键。

只处理分组名称，不改变连接 ID、查询范围或数据库元数据；分组不属于某个数据库引擎。
