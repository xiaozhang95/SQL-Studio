# 外观选项卡片

AppearanceCards<T extends string> 提供主题、字号与语言共用的受控单选卡片，接收 label、value、onChange(T)、disabled 和只读 options（value、label、preview）。标签和预览由宿主提供，语言选项保留各自原生名称。整张卡片使用原生 Radio 标签，可点击预览或文字选择，保留单选组键盘操作；onChange 只更新宿主草稿，不保存。

预览放在上方占满整行，底行左侧为原生 Radio 圆点、右侧为选项名称。布局通过 Radio 公开 styles 与主题 token 设置，圆角使用 `borderRadiusLG`。卡片按可用宽度自动换行，预览仅作装饰，不重复向辅助技术朗读。尺寸定义见 [settings](../../constant/settings/README.md)。

卡片统一使用中性边框。当前选项使用 `--surface-selected` 底色并显示原生 Radio 圆点，普通选项沿用弹窗底色。卡片保留原生键盘、表单及禁用状态，标签字号继承全局界面字号。
