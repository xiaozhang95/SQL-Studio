# 外观选项卡片

AppearanceCards<T extends string> 提供主题、字号与语言共用的受控单选卡片，接收 label、value、onChange(T)、disabled 和只读 options（value、label、preview）。标签和预览由宿主提供，语言选项保留各自原生名称。整张卡片使用原生 Radio 标签，可点击预览或文字选择，保留单选组键盘操作；onChange 只更新宿主草稿，不保存。

预览放在上方，名称在下方居中。布局通过 Radio 公开 styles 与主题 token 设置，圆角使用 `borderRadiusLG`。卡片按可用宽度自动换行，预览仅作装饰，不重复向辅助技术朗读。尺寸定义见 [settings](../../constant/settings/README.md)。

选中卡使用主题色边框、`colorPrimaryBg` 浅色底和 3px 聚焦环，右上角显示 15px 绿色勾；未选中卡使用默认边框。原生 Radio 圆点视觉隐藏，但输入仍保留在 DOM 中，支持键盘和表单语义。禁用状态沿用原生 Radio。悬停只加深边框并上移 1px，不使用 ghspace 阴影；`prefers-reduced-motion` 下关闭位移。