# 外观选项卡片

AppearanceCards<T extends string> 提供主题与字号共用的受控单选卡片，接收 label、value、onChange(T)、disabled 和只读 options（value、label、preview）。整张卡片使用原生 Radio 标签，可点击预览或文字选择，保留单选组键盘操作；onChange 只更新宿主草稿，不保存。

预览放在上方，单选标记与名称位于下方。布局通过 Radio 公开 styles 与主题 token 设置，选中边框使用主题主色，其余边框和圆角沿用 Card 对应 token。卡片按可用宽度自动换行，预览仅作装饰，不重复向辅助技术朗读。尺寸定义见 [settings](../../constant/settings/README.md)。
