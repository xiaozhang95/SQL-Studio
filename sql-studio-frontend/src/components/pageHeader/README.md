# PageHeader

工作区、AI 助手、监控和同步共用的上下文 Header，只承载页面标题、面包屑、页面操作和错误提示。全局页面切换、主题切换和系统设置入口由 [AppRail](../appRail/README.md) 负责；Electron 最上方的标题栏由 [DesktopTitleBar](../desktopTitleBar/README.md) 在 App 层统一渲染。

## 布局

- 高度为 `token.controlHeight + token.paddingMD`，左右使用 `token.paddingSM`，下沿 1px `--border`，背景 `--surface`。
- 左侧 `title` 为页面标题，单行省略；`breadcrumb` 为次级面包屑，窄于 1280px 时隐藏。
- `children` 可用于标题后的页面级补充操作；常规页面操作放在 `actions`，由调用方决定按钮类型和顺序。
- 右侧操作区保持右对齐，窄屏允许换行；工作台、AI 助手和数据库页均在这里展示连接/模型/同步状态与当前页操作。
- 不再提供居中标题、`titleOffset` 或 `desktopTitle` 等标题栏参数。

## 错误

`errors` 接收页面级错误原因，子区域通过 [PageErrors](../pageErrors/README.md) 登记错误。PageHeader 在 Header 下方使用左右贴边的通栏合并并去重展示。`errorAction` 放置重试操作，`onErrorClose` 清理调用方的操作错误，`errorScope` 用于切换工作区标签或会话时重置提示关闭状态。提示区最多占视口高度的四分之一，长错误可滚动阅读。

## 边界

仅负责布局和错误展示，不读取业务状态，不负责全局导航、桌面标题或页面切换锁。调用方容器应使用纵向 flex 布局，Header 固定在内容区顶部。