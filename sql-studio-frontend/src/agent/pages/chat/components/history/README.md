# 会话列表

History受控items/activeId/busy/loading/open及onSelect/onRefresh/onDelete/onRename。桌面侧栏宽度由共享 layout 提供，和手机Drawer共用Ant Design X Conversations，空列表初始化显示等待。长标题省略，编辑按钮打开横向名称表单，红色删除按钮需确认。操作按钮停止冒泡，防止同时切换会话。新建会话由页面顶栏处理。

历史列表上方提供可清空的搜索框，桌面侧栏与窄屏Drawer共用关键词。按已加载的会话标题即时过滤，忽略首尾空白和大小写。搜索为空时显示全部，无匹配时显示「没有匹配的会话」。过滤保留当前会话选择，关键词仅保存在当前页面。

桌面刷新按钮与历史标题同排，窄屏复用抽屉标题栏的操作位。

useSessionRename管理弹窗选中项、Form、busy/error。名称1–80字符，空白/控制字符禁止；取消不提交，失败保留输入，成功关闭，父hook更新列表和顶栏标题。初始化失败可保留空态与错误，不能伪装创建成功；恢复不重放SQL。

selecting表示当前会话内容加载中：暂停新建、删除和重命名，但允许继续选择其他会话；busy用于模型执行、初始化与管理操作，禁止选择。列表loading仅表示轻量索引刷新，不代替会话内容加载。

历史侧栏与会话主区域使用 colorBgContainer。侧栏右沿与顶栏下沿、问答分隔线共用 `1px solid var(--border)`。列表悬停和选中状态沿用 Ant Design 主题。

历史列表独立滚动。侧栏和抽屉水平内边距统一为 --workspace-inset（12px），与 PageHeader 一致。

当前会话与 SQL 窗口左侧选中项一致，使用主题主色实底和浅色标题，行内操作按钮同步使用浅色，悬停保持激活样式。规则通过 chat-history-list 限定在 app.scss，桌面侧栏与抽屉共用。
编辑/删除按钮默认透明并禁止鼠标命中，保留宽度防止标题跳动；对应会话行悬停或键盘焦点进入操作区时显示，选中会话不会常驻显示按钮。
layout 接收公共 useSidebarResize 控制器。桌面侧栏右侧 5px 分隔条支持拖动、键盘左右/Home/End 与双击恢复 272px。宽度与 SQL 工作台连接栏共用并沿用工作台布局持久化，范围 200–560px，实际宽度按主区至少 520px 约束。窄屏继续使用 Drawer。

hook返回的DOM/list ref先单独解构为Ref变量，再传给ref属性；尺寸/导航状态与事件回调独立消费，渲染不读取ref.current。

当前选中项统一使用 controlItemBgHover 灰阶背景与主题正文色，悬停和聚焦保持一致，不使用蓝底白字。
