# 错误提示

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

`ErrorNotice` 统一页面顶栏、弹框和抽屉的错误展示。沿用 Ant Design 默认的 error 颜色、图标、边框和圆角，并提供关闭按钮。

`error?: string` 和 `errors?: readonly (string | undefined)[]` 提供错误原因，自动去重并保留换行。没有错误时返回 null。`title?: string` 用于补充具体操作标题，`action?: ReactNode` 放置重试等操作，`onClose?: () => void` 可清理调用方错误，`style?: CSSProperties` 用于所属区域的布局。

关闭只隐藏当前提示。原因变化后重新展示。`banner?: boolean` 启用 Ant Design 通栏外观，供 PageHeader 在顶栏下方使用。弹框和抽屉在内容区使用默认外观。
