# ProcessCard

受控 title、expanded、onExpand、children、icon。默认图标为蓝鲸，执行过程传入 CodeOutlined，两者使用同一图标尺寸。Think 保留标题折叠。展开的内容复用公共 ContentCard 的主题外框，标题与卡片间距为 marginXS，区块间距由 TurnContent 控制。收起时保留内容参与 Think 原生退场动画，退场后的生命周期由 Think 管理。
