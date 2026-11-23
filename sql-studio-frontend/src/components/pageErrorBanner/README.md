# 页面错误通栏

`PageErrorBanner` 在工作台、AI 助手、监控和同步的内容上方使用 [ErrorNotice](../errorNotice/README.md) 展示错误。没有错误时不占高度。有错误时提示最多占视口高度的四分之一，长内容可滚动阅读。

`errors` 默认为空数组，与 [PageErrorsProvider](../pageErrors/README.md) 登记的原因合并去重。`errorAction` 可传入重试按钮，`onErrorClose` 可清理调用方的错误，`errorScope` 用于切换页签或会话时重置提示。关闭提示会清理上下文登记的展示状态。组件不负责导航或业务操作。
