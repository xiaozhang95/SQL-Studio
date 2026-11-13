# 错误提示

`ErrorNotice` 统一工作台、AI 助手、弹窗和操作结果的错误展示。沿用 Ant Design 默认的 error 颜色、图标、边框和圆角，并提供关闭按钮。

`error?: string` 和 `errors?: readonly (string | undefined)[]` 提供错误原因，自动去重并保留换行。没有错误时返回 null。`title?: string` 用于补充具体操作标题，`action?: ReactNode` 放置重试等操作，`onClose?: () => void` 可清理调用方错误，`style?: CSSProperties` 用于所属区域的布局。

关闭只隐藏当前提示。原因变化后重新展示。页面级错误通过 PageHeader 放在顶栏下方，弹窗和结果内的错误放在所属区域。
