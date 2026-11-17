# 删除气泡确认

`DeleteConfirmation(props)` 统一直接点击按钮发起的删除或清空确认，沿用会话列表的 Ant Design Popconfirm。参数透传 PopconfirmProps，确认按钮固定使用 default；okText 默认“删除”，cancelText 默认“取消”，均随界面语言切换，可按清空等语义覆盖。children 为可接收事件及 ref 的按钮或锚点。

title/description 由业务提供对象范围及风险说明；disabled、open/onOpenChange、按钮 loading 和异步 onConfirm 由调用者管理。组件不执行删除、不保存业务状态。右键菜单中的删除使用所属业务 Modal，保留完整名称校验等原有规则。
