# 聊天输入

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

实际使用Ant Design X Sender，直接作为Form.Item的受控字段，通过onValuesChange保存最多256 KiB的UTF-8草稿到Go布局。超过上限时保留编辑框原文并提示分段，发送入口禁用。不使用隐藏input加useWatch回填Sender的中转链，避免输入过程中旧值回写；useWatch仅用于发送按钮读取文本。Enter发送、Shift+Enter换行，onKeyDown与Sender共同保护IME候选确认。onSubmit校验配置、忙状态和非空输入；busy显示停止。底部自定义footer保留模式Dropdown、带蓝鲸模型Dropdown与发送按钮；模型菜单只列出已经添加的模型；添加/编辑统一从右上角系统设置进入。onModelChange交给设置hook保存共享配置，组件无网络请求。usage悬浮区分真实输入token与保守估算。

输入区默认 4 行、最多 10 行（CHAT.composerRows），字体、背景及外层边框沿用 Sender 默认样式。内部文本区去掉重复边框、轮廓和阴影，焦点反馈由 Sender 外层提供。内容和底部操作区通过 Sender 的 styles 设置内边距。拖拽产生的动态高度通过 Sender 的语义 styles 传入。实心停止符号通过 style 和主题 token 设置外观，继承按钮颜色。

底部模型 Dropdown 使用默认尺寸文本按钮。选中可用模型时显示模型名称和蓝鲸图标，空状态显示「请选择模型」。菜单只展示已添加模型及其图标。菜单和入口图标分别使用 CHAT.modelMenuIconSize（18px）与 CHAT.modelTriggerIconSize（20px），沿用 Ant Design 默认图文间距与字体。

模式和模型的 Dropdown 浮层沿用 Ant Design 默认边框、圆角及背景。模式和模型入口共用公共 DropdownChevron，显式同步按钮禁用态。

回车通过onKeyDown直接读取当前Form字段并调用submit，不依赖隐藏的Sender内置发送按钮状态；阻止Sender重复提交。Shift+Enter和修饰键保留默认行为，IME组合输入和229键码不发送。

底部模式使用 Ant Design 默认文本按钮加 Dropdown，与文本模型按钮及发送按钮对齐；只读使用默认中性色，完全访问使用主题警示文字色，样式集中在 app.scss。模式菜单使用单行选项和固定勾选占位，不使用整块选中底色；权限说明集中在旁边的信息提示，完整内容撑宽，保留原有切换风险确认。模式说明独立InfoCircle悬浮按钮，始终展示权限、逐次确认及删除禁令，usage存在时追加上下文用量；不包裹模式菜单。图标尺寸：模型入口20px、菜单18px。切换风险确认保持原行为；未选择可用模型时禁用发送，有已添加模型时允许从模型菜单明确选择；无记录时提示前往右上角系统设置添加，不使用默认模型。
输入框顶部8px横向手柄支持拖动调整整个输入区高度，向上扩大、向下缩小；手动调整后关闭自动行高，文本区内部滚动，底部操作区保留。双击恢复原4–10行自动高度，键盘上下/Home/End调整。高度受会话区域和160–560px边界限制，窄矮窗口可降低最小值；不改变草稿和发送逻辑。

发送使用 Ant Design 的 ArrowUpOutlined 向上箭头，图标颜色继承按钮。发送、终止生成和回到底部共用 Ant Design 小号圆形普通按钮配置。终止生成使用 danger 样式和小实心方块，方块宽高使用 token.sizeXS（默认 8px），保留停止回调，悬停提示「终止生成」。

hook返回的DOM/list ref先单独解构为Ref变量，再传给ref属性；尺寸/导航状态与事件回调独立消费，渲染不读取ref.current。
