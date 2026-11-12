# 工作区页面范围校正

reconcileWorkspacePages(pages,{validateSchemas,snapshots}) 仅在已加载的当前 schema 元数据确认范围失效时清空对应查询页 schema/table。未加载元数据不代表失效；未发生变化时保留原数组与页面引用，重复调用稳定。没有旧标题或字段转换回调，不读取文件、不执行 SQL。
