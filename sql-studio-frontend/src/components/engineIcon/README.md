# 数据库状态图标

[组件索引](../README.md) · [源码](index.tsx)

`EngineIcon` 从 `getDatabaseProfile(type)` 读取引擎图标。`type` 默认 MySQL，`variant` 默认 `icon`，`size` 在 `icon` 和 `logo` 模式下分别默认为 32px 和 40px。对象树用 18px，连接下拉用 20px，类型列表用 24px。组件没有回调。

`EngineIcon` 统一使用圆角底板和 profile 中的官方图标，图形占容器的 80%。`connected` 默认为 `true`，图标保持品牌原色。对象树、查询连接下拉和执行历史标题使用实际打开状态。`connected: false` 时在灰色底板上显示白色图标。PostgreSQL 提供适合小尺寸的白色线稿。Redis 通过 `closedIconMaskFilter` 让原图红底透出灰底。其余引擎将图形填成白色，保留透明区域。悬停、选中和折叠沿用当前连接状态。

已打开状态的 `--engine-icon-background` 在亮暗主题均使用主题白色 `colorTextLightSolid`，以无描边的圆角底板呈现。未打开状态的 `--inactive-icon` 叠在 `--surface` 上，合成当前亮暗主题下的灰色底板。

图标为装饰，名称由相邻文字提供。资源来源见 [资产说明](../../assets/databases/README.md)。
