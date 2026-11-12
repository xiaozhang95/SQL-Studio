# 外观选项卡片

AppearanceCards<T extends string> 提供主题与字号共用的受控单选卡片，接收 label、value、onChange(T)、disabled 和只读 options（value、label、preview）。整张卡片使用原生 Radio 标签，可点击预览或文字选择，保留单选组键盘操作；onChange 只更新宿主草稿，不保存。

预览放在上方，单选标记与名称位于下方。布局通过 Radio 公开 styles 与主题 token 设置，不设置卡片边框，圆角沿用 Card 对应 token。卡片按可用宽度自动换行，预览仅作装饰，不重复向辅助技术朗读。尺寸定义见 [settings](../../constant/settings/README.md)。

主题和字号选项均只通过原生 Radio 圆点表示选中，不增加选中边框或底色；禁用状态仍由原生 Radio 提供。

主题与字号选项均复用 ghspace 的轻微阴影，基础阴影始终保留，鼠标悬停或键盘焦点进入时上移 2px 并额外叠加悬停阴影，避免原有轮廓变淡或消失。基础阴影与过渡通过 Radio.styles 提供，hover/focus-within 交互在 app.scss 限定 appearance-option-card；禁用时不浮起，减弱动画偏好下取消位移和过渡。选中状态仅由 Radio 圆点标记。
