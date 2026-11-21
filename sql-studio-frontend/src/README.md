# 前端源码

开发前阅读并遵守 [前端开发规范](../../docs/FRONTEND_STANDARDS.md)。全局控件约定统一使用 appearance；数据库能力通过 databases 入口分派，页面和公共组件不承载引擎专属实现。

进入后恢复本机工作区配置，没有记录时默认无查询标签；无查询标签时隐藏编辑器与执行工具栏，空白区展示操作提示，对象浏览结果独立展示；对象树双击数据库只展开/折叠，数据库右键可查看结构，双击表加载数据。连接表单的 label 与输入框左右排列。未选中树节点使用主题正文色，只有连接根节点按是否打开区分正常/灰色，折叠不置灰；库表图标始终正常。树高亮与查询下拉范围相互独立，连接根节点、选择器和弹窗统一使用引擎图形，连接根节点的绿色或灰色底板表示打开状态，选中行保留上下留白。

- [页面](pages/README.md)：工作区与页面私有组件/hooks。
- [公共 hooks](hooks/README.md)：主题、语言、分页与共享状态。
- [上下文](contexts/README.md)：当前已应用语言。
- [配置](constant/README.md)、[契约](typings/README.md)、[服务](services/README.md)、[工具](utils/README.md)。
- [数据库图标资产](assets/databases/README.md)。
- [数据库实现与适配器](databases/README.md)。

App.tsx/main.tsx 为框架入口；App 组合全局 [DesktopTitleBar](components/desktopTitleBar/README.md)、[AppRail](components/appRail/README.md) 和页面内容。页面及组件布局使用 style/styles，app.scss 保留基础全局、Ant Design 覆盖和确需选择器的交互/媒体查询；颜色引用 Ant Design 原生 token，不手写主题主色。入口加载 antd/dist/reset.css 和 app.scss，SQL 编辑器通过 EditorView.theme 继承系统字体。每个操作面只设置一个 primary 主操作，其余使用 default/text/icon；普通标签使用中性色，信息提示跟随主题绿色。表操作位于对象树右键菜单，主区域统一按页面标签切换。

工作台、AI 助手、监控和同步的页面错误集中显示在共享 PageHeader 下方，重复原因合并。打开已保存的数据库连接失败时，左侧对象树在对应连接下方显示原因和重试入口。弹框及抽屉在内容区使用 [ErrorNotice](components/errorNotice/README.md)。[request](utils/request/README.md) 提供请求体超限和服务连接错误的统一文案。

App 先读取界面偏好再挂载业务页面，确保业务请求携带已恢复的语言；偏好读取失败时使用当前默认值。JSON 与 SSE 请求统一发送 Accept-Language，后端按请求语言返回系统提示，响应 Content-Language 标明所选语言。SQL、数据库返回内容和用户命名不参与翻译。

Modal（连接、AI 配置、优化建议、库表管理及 AntApp 确认弹窗）使用 Ant Design 容器外观，暗色下通过 app.scss 添加统一的 1px 主题细边框。确认按钮使用统一的普通按钮配置。

删除数据行、Redis 键、AI 会话及清空执行历史使用 [DeleteDialog](components/deleteDialog/README.md) 确认目标与范围。库表对象使用业务弹框，单条查询收藏及模型和字段草稿使用 [DeleteConfirmation](components/deleteConfirmation/README.md) 气泡。

全部原生组件覆盖集中在 app.scss；App 不覆盖 placeholder、文字和图标原色。运行工具栏右侧通过 useSQLImport 导入本地 SQL 文件，并可导出当前标签完整 SQL。查询页和对象页共用一层带图标的主页面页签。App 不覆盖全局圆角，沿用 Ant Design 默认 token；主工作区贴边铺满，编辑器和结果面板不使用卡片外框或阴影。结果字段类型和 NULL 使用普通文字，状态/耗时不使用 Tag，不展示连接来源标签。

上下文 Header、侧栏搜索与工作区工具栏左右统一使用 workspace-inset=12px；对象栏顶部为标题、连接数与新建入口，底部显示连接状态。树使用 28px 内容行与 2px 行间距；结果表使用 30px 紧凑行高、吸顶表头和水平分隔线，执行历史沿用 small Table。

查询结果与执行历史统一使用 tablePagination 的底栏样式，页码 24px、右对齐且固定在表体滚动区外。左侧对象栏与Agent历史栏共用可拖动宽度（200–560px，默认272px），双击恢复默认，在任一页调整后切换页面保持一致，宽度随工作台轻量布局索引保存并恢复。

连接 Select 使用原生默认尺寸、220px 标准宽度；连接图标为 20px，避免撑高控件。输出区由 resultTabs 展示数据结果标签，无列执行回执归入消息/摘要，超过 8 个结果集时用下拉切换，SQL 在消息/摘要中高亮并支持复制。连接表单支持输入或选择分组，新建预选“默认分组”，留空时使用默认分组；分组随连接配置保存，左侧树以文件夹整理，组内连接可右键编辑更换分组。

没有保存记录时主页面为空；从数据库右键打开结构页，双击表创建独立数据页，查询页的 SQL 与最新结果共用一个标签。历史入口只在 SQL 页面，加载该页面连接的记录；载入追加到当前编辑器并标注历史来源。右键可执行选中 SQL，补全弹层沿用系统 Select 的视觉，树折叠按钮无背景。

完整草稿和选区支持多条 SQL。前端在引号和注释之外识别语句分隔符，MySQL 和 MariaDB 也识别 `DELIMITER`。MySQL、MariaDB 和 PostgreSQL 多语句在同一会话执行，其他 SQL 引擎顺序调用单语句接口。数据结果在同页标签或下拉选择器查看，执行记录保留在消息与分页摘要中。失败或取消停止后续语句，保留已完成结果。

页面/范围/布局由 Go 保存为配置目录下的轻量索引，草稿和结果按页独立保存并按需读取，已保存的非活动内容释放内存。历史和界面偏好（主题、字号、语言）使用独立配置分区。工作区存储不使用 IndexedDB，也不保存连接密码。恢复不自动执行 SQL，后台保存不在顶部展示 loading，后台配置保存冲突后重新读取服务端最新快照。执行成功或失败在当前页面的结果和消息中展示。

- [AI 服务商适配器](ai/README.md)：品牌配置、模型发现和调用入口。

MySQL 和 MariaDB 对象树按“数据库 → 表 → 表名 → 字段/索引”组织；PostgreSQL 在数据库下增加 schema 层，再展示表/视图分类和对象名，展开表按需读取元数据，主键用钥匙图标。索引悬停显示唯一性、类型和组成字段；视图维持既有功能，独立分组。

- [数据库Agent](agent/README.md)：Ant Design X 聊天、工具调用及逐次写入确认。
- [公共组件](components/README.md)：工作区和Agent共用的展示能力。

公共 [PageHeader](components/pageHeader/README.md) 统一工作区、AI 助手、监控和同步的上下文 Header 布局；全局 [AppRail](components/appRail/README.md) 提供页面切换、主题切换与系统设置入口。监控、同步和 AI 页的会话加载/执行通过 [navigationLock](contexts/navigationLock/README.md) 暂停 Rail 页面切换。

Electron 退出由工作区的 useDesktopExit 接入原生关闭事件，从任一功能页回到工作区，按当前标签逐项处理。非空查询分别提示“取消 / 不保存 / 保存”，空白查询直接关闭，每次仅保存该页内容，关闭后切到下一页；未提交对象修改按页确认。准备阶段暂停自动保存并通过 inert 锁定工作区交互，标签保持可见；全部标签处理完后，App 使用统一 ContentLoading 挂起页面并释放全部连接，提交空工作区。取消或失败保留当前和未处理标签，已关闭项不恢复。默认及自定义连接分组保留原展开/收起状态，只收起连接、数据库及后代。普通 Web 不增加退出确认或清理逻辑。

上下文 Header 下沿、SQL 工作区和 AI 助手侧栏及弹窗内部分隔线共用 Ant Design 默认 colorBorderSecondary（`--border`），不单独加深布局边框；页签使用中性底、细边框和绿色活动线。

页面导航由 useAppSection 通过 History API 管理，工作区使用 `/`，AI 助手使用 `/agent`，监控指标使用 `/monitor`，同步数据库使用 `/sync`。pushState 切换不刷新整页，popstate 同步前进、后退，工作区保持挂载。开发时由 Vite SPA 入口提供页面，发布时 Go 显式注册这些页面路径，资源缺失及未知 API 仍返回各自的 404。

系统设置入口固定在全局 Rail 底部，弹框采用左侧图文导航（208px），包含「模型配置」「外观设置」「语言设置」「关于软件」，宽 920px、内容高度上限 532px。右侧模型配置展示模型卡片、默认模型单选项和整宽添加按钮。添加/编辑子弹框依次选择供应商、输入 Key 自动加载模型，未选择时默认选中列表第一项，用户可另选；编辑和刷新保留已有选择。同供应商可添加不同模型，相同供应商与模型不得重复。外观页在同一菜单下展示主题和字号卡片；语言页展示简体中文与 English 卡片。关于页显示当前版本，检查更新仅在 Electron 中显示。设置草稿由底部统一保存，取消或关闭放弃未提交修改。偏好保存成功后才应用全局主题、字号和语言。App 使用 LanguageContext 与 XProvider 同步业务文案、Ant Design 和 Ant Design X 控件语言，日期语言同步 dayjs；SQL、数据库内容和模型回答保留原文。英文案集中在 constant/translations，组件与 hooks 经 useTranslation 订阅已应用语言，未知错误原因保留原文。

所有业务Modal与确认框使用Ant Design默认位置，不设置centered或自定义位置偏移。

主题集中由 constant/theme 的 createThemeConfig 提供：亮色使用近黑 `#161a16`、`#f4f6f2` 画布和 `#15803d` 主色；暗色使用近白 `#f2f5f1`、`#0a0c0a` 画布和 `#42d47c` 主色。字号 small/standard/large 为 12/13/15px；普通布局及重复卡片/图标分别归组件 style/styles 与公共组件，app.scss 只保留基础、原生结构与交互覆盖。

滚动条沿用 ghspace：横纵统一 6px、圆角滑块、透明轨道；亮色灰色滑块、暗色半透明白色滑块，悬停加深。原生滚动条及虚拟表格、对象树的模拟滚动条在 app.scss 统一适配。

内容卡片（Agent 的代码、过程、确认、回执，以及 SQL 预览面板）和 Agent 结果表格复用 ghspace 的亮暗轻微阴影，分别通过 ContentCard.style 和 Table.styles.section 应用；不添加悬停上移，主工作区编辑器与结果面板继续保持平面布局。

连接类型、设置分类、对象树、AI 会话、下拉选项和表格选中行共用中性选中底。工作区页签使用 28px 芯片，选中页签使用内容区底色、细边框和 2px 绿色活动线。消息、摘要与结果使用独立的线形导航，左右边距与工具栏对齐。主题和字号卡片使用主题色边框、浅色底和右上角勾选标记。

全局主色由 constant/theme 的 colorPrimary 统一配置（亮色 `#15803d`、暗色 `#42d47c`），Radio、Switch 等主色元素自动跟随亮暗算法。每个操作面只使用一个 primary 主操作：工作台「运行」、AI「发送」、同步「同步检查/开始同步」、设置与连接「保存」；其余使用 default/text/icon。

原生 Modal/AntApp 确认按钮由 appearance.modalDefaults 配置为 default；写入确认可使用 warning 按钮。主按钮颜色由主题算法派生，不再通过 Button token 或 primary CSS 重写悬停、按下和默认颜色。工具栏 text/link 类型及危险/禁用语义保留。
