# 对象管理表单

[源码](index.tsx) · [组件索引](../README.md)

ObjectManagementForm 接收 manager（对象管理 hook 的表单展示子集）和 themeMode。复用库/表名、字符集/排序规则、危险名称确认、字段表格、错误与高亮 SQL 预览；不请求数据库、不生成协议 SQL。

由 objectManagementModal 承载库和危险操作，由 tableDesigner 承载新建表/设计表。表设计器隐藏重复范围文案，字段编辑、主键/NULL/自增联动和特殊定义保护与原弹窗一致。表单变化调用 invalidatePreview 清理旧预览并标记草稿；所有受控值、加载和保存状态归对应 hook。正文由宿主负责滚动。

可见库表名称、字符集、排序规则及字段名/类型/默认值类型/默认值/注释均提供用途明确的placeholder；隐藏originalName/extra不显示占位文字。

库表管理表单统一不展示固定连接/库/表的只读范围下拉框，与重命名表保持一致；目标仍由 manager.dialog 绑定。编辑已有库/表时隐藏重复名称输入（仍注册于 Form 保留原始值及校验）；新建、重命名和危险操作确认输入保留。
