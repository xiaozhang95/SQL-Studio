# 会话列表

History受控items/activeId/busy/loading/open及onSelect/onRefresh/onDelete/onRename。桌面232px侧栏和手机Drawer共用Ant Design X Conversations，空列表初始化显示等待。长标题省略，编辑按钮打开横向名称表单，红色删除按钮需确认。操作按钮停止冒泡，防止同时切换会话。新建会话由页面顶栏处理。

历史列表上方提供可清空的搜索框，桌面侧栏与窄屏Drawer共用关键词。按已加载的会话标题即时过滤，忽略首尾空白和大小写。搜索为空时显示全部，无匹配时显示「没有匹配的会话」。过滤保留当前会话选择，关键词仅保存在当前页面。

桌面刷新按钮与历史标题同排，窄屏复用抽屉标题栏的操作位。

useSessionRename管理弹窗选中项、Form、busy/error。名称1–80字符，空白/控制字符禁止；取消不提交，失败保留输入，成功关闭，父hook更新列表和顶栏标题。初始化失败可保留空态与错误，不能伪装创建成功；恢复不重放SQL。

selecting表示当前会话内容加载中：暂停新建、删除和重命名，但允许继续选择其他会话；busy用于模型执行、初始化与管理操作，禁止选择。列表loading仅表示轻量索引刷新，不代替会话内容加载。

历史侧栏与会话主区域使用 colorBgContainer。侧栏右沿与顶栏下沿、问答分隔线共用 `1px solid var(--border)`。列表悬停和选中状态沿用 Ant Design 主题。

footer?:ReactNode提供底部固定插槽，桌面侧栏和窄屏Drawer都展示统一系统设置；历史列表独立滚动。设置内容不受会话列表忙状态影响。

侧栏/Drawer水平内边距统一--workspace-inset（12px），与PageHeader和底部设置按钮一致；footer只抵消父容器水平留白，再由SystemSettings统一施加一次，避免重复或缩减边距。
编辑/删除按钮默认透明并禁止鼠标命中，保留宽度防止标题跳动；对应会话行悬停或键盘焦点进入操作区时显示，选中会话不会常驻显示按钮。
layout接收公共useSidebarResize控制器；桌面侧栏右侧5px分隔条支持拖动、键盘左右/Home/End与双击恢复272px。宽度与SQL工作台连接栏共用并沿用工作台布局持久化，范围200–560px，实际宽度按主区至少520px约束，底部系统设置随宽度铺满；窄屏继续使用Drawer。

hook返回的DOM/list ref先单独解构为Ref变量，再传给ref属性；尺寸/导航状态与事件回调独立消费，渲染不读取ref.current。
