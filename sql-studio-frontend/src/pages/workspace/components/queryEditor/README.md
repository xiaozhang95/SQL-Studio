# SQL 页面编辑器

补全配置由 useSQLCompletion 按当前连接组织元数据，并调用数据库适配器 completion 构造；组件不导入具体 MySQL 方言。局部 contextSQL 只保留本区域右键菜单的选区快照。

编辑器 basicSetup 与 onUpdate 桥接保持稳定身份，桥接在布局 effect 更新最新回调；避免每次输入、loading 更新或树状态变化都触发 UIW 全量 reconfigure，同时保持当前页面的 SQL 和布局回调正确归属。

[组件索引](../README.md) · [源码](index.tsx)

仅在 kind=query 的主页面内展示，页面导航与关闭行为由 workspaceTabs 管理。本组件负责连接/库选择器、运行/取消、导入/导出、历史工具栏和 CodeMirror。

每页范围由 model 管理，SQL 由当前 CodeMirror 实例持有并批量同步至 model；切页恢复草稿。左侧树与选择器独立，仅共用元数据缓存。连接必须成功加载结构才允许运行，切连接清库表，切库清表；没有表下拉。补全保留系统字体和主题，支持 Ctrl+Enter，结果页快捷键不会执行旧 SQL。

查询结果在同一页面编辑器下方展示，重复执行替换该页最新结果，不创建额外标签。当前页执行时显示取消，其他页面执行时只应用全局操作锁。请求不传行数；MySQL/PostgreSQL SQL 窗口均显式传 allowWrite=true，支持 DDL/DML；PostgreSQL 支持 RETURNING。

工具栏右侧顺序为导入、导出、执行历史。导入本地 UTF-8/BOM SQL 并新建查询页，不上传、不自动执行；导出当前页完整 SQL，空白时禁用。历史读取当前查询页连接，打开时重置搜索。

工具栏运行、优化、取消、导入、导出和执行历史统一使用 [ToolbarButton](../toolbarButton/README.md) 仅图标按钮，默认无边框；功能名称通过 Tooltip 和 aria-label 提供，保留原生悬停、键盘焦点、禁用、加载和危险语义；连接、数据库与 Schema 选择器保持原生边框。

编辑区右键菜单使用“运行 / 优化”两个简短文案，操作仍仅针对捕获的选区。contextSQL 是打开菜单时的选区快照，避免菜单焦点变化导致误执行整页；空选区、未连接或执行中时禁用。执行逻辑与工具栏共用工作区只读接口和当前页面范围。

SQL 补全浮层使用原生 Ant Design Select 的主题、弧度及状态背景；字体、字号、字重和行高与当前编辑区一致，选中不单独加粗。关键字与数据库对象等类型使用 Ant Design SVG 图标，不使用 emoji 或斜体详情。

外层容器与工具栏布局使用组件 style；编辑器、行号和 AI 建议外观由 [editorAppearance](../../utils/editorAppearance/README.md) 的 EditorView.theme 扩展提供。补全展示由 sqlCompletionSelect 提供，app.scss 仅隐藏被替代的原生候选列表。

运行按钮、Ctrl+Enter 与右键选区执行共用多语句流程：只切分选中的 SQL（未选中则为完整草稿），依次执行，在本页结果选择器查看每条输出；失败或取消后停止后续语句。

执行快捷键由 useWorkspace 在捕获阶段接管，不触发 CodeMirror 的插入空行命令；原选区和 SQL 文本保持不变。

页面重新挂载时通过 getEditorHistory(activeTab) 初始化该页撤销/重做字段，当前主题和补全仍采用新页面配置。切页不丢撤销；关闭页释放历史，浏览器刷新不恢复撤销。

补全 schema 仅使用当前连接的数据库命名空间；选库自动加载表/视图，以 defaultSchema 提供无前缀表名补全，并复用缓存字段。扩展通过 useMemo 稳定配置，输入 SQL 不反复重建语言扩展。编辑器选区与滚动通过 onEditorReady/onEditorUpdate/rememberEditor 加密保存，恢复不执行 SQL。

只有保存了 Key 并选中模型后，导入左侧才显示 AI 工具组：代码图标、代码补全开关和 SQL 美化图标；组末用竖线与导入/导出/历史分隔。美化沿用原整页优化及预览/应用逻辑，选区优化仍在右键菜单。补全开关即时保存到共享 ai 分区，加载时禁用，失败在编辑器顶部显示错误。请求中在编辑器右下角显示 loading，续写 Tab 接受/Esc 关闭；不自动执行 SQL。

Schema 选择通过 selectObject 的第四参数传入显式连接/库范围；AI 接收实际连接类型，补全和执行共用该页面 schema。

编辑器挂载身份仅绑定页面，不绑定全局 running。关闭无关库/连接、打开对象弹框及执行状态切换只更新控件状态，保留 CodeMirror 实例、选区、滚动与撤销。

编辑器value仅提供挂载初始SQL，后续输入由CodeMirror持有；不注册逐字onChange全文序列化，onUpdate提交不可变文档和布局到useWorkspaceEditor缓冲。hasSQL只在空/非空之间变化，按钮使用当前实例执行/导出。历史和AI应用继续走事务；失焦、卸载及切页同步草稿。组件仅按页面ID重挂载，连接/库变化只更新补全扩展，保留当前文本和撤销。

SQL 语法候选使用 sqlCompletionSelect 的 Ant Design Select；useSQLCompletionPopup 将 CodeMirror 候选、当前项及光标位置同步给下拉，保留 Ctrl+Space、上下键、Enter、Escape 和鼠标选择；不会替换补全来源或编辑器焦点。
