# 连接分组弹窗

`manager: ReturnType<typeof useConnectionGroups>` 提供表单、模式、错误和保存回调。新建/重命名共用 Ant Design Modal 和 horizontal Form，字段为“分组名称”，标签固定 88px。名称去除首尾空格并验证重名，保存中禁用输入和关闭；失败保留输入并展示错误。
