# ProcessCard

受控 title、expanded、onExpand、children、icon。默认图标为蓝鲸，执行过程传入 CodeOutlined，两者使用同一图标尺寸。Think 保留标题折叠，并由 root 样式提供 surface-subtle 底、1px 边框、8px 圆角和 shadow-xs 外框；展开内容内联显示，不再嵌套第二层卡片。收起时保留内容参与 Think 原生退场动画，退场后的生命周期由 Think 管理。
