# 数据库状态图标

[组件索引](../README.md) · [源码](index.tsx)

`EngineIcon` 从 `getDatabaseProfile(type)` 读取引擎图标。`type` 默认 MySQL，`size` 默认 18px。新建和编辑连接弹窗的类型列表使用 24px，表单标题使用 40px。组件没有回调。

`EngineIcon` 统一使用圆角底板和 profile 中的官方图标。18px 底板内使用 14px 图形容器，四边各留 2px；较大底板的图形容器占 80%。`connected` 默认为 `true`，图标保持品牌原色。对象树、查询连接下拉和执行历史标题使用实际打开状态。`connected: false` 时在灰色底板上显示白色图标。PostgreSQL 和 Oracle 提供适合小尺寸的白色矢量图。Redis 通过 `closedIconMaskFilter` 让原图红底透出灰底。其余引擎将图形填成白色，保留透明区域。悬停、选中和折叠沿用当前连接状态。

已打开状态的 `--engine-icon-background` 在亮暗主题均使用主题白色 `colorTextLightSolid`。亮色主题为白色底板加双层外阴影，近层较深、远层较浅，均从底板四周向外淡出。未打开状态的 `--inactive-icon` 叠在 `--surface` 上，合成当前亮暗主题下的无阴影灰色底板。连接状态切换时，底板与图形容器尺寸一致。

图标为装饰，名称由相邻文字提供。带引擎图标的选择器使用 [engineSelectStyles](../../constant/appearance/README.md)，让底板阴影延伸到控件内边距。资源来源见 [资产说明](../../assets/databases/README.md)。
