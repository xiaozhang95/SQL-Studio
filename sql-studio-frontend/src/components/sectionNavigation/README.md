# 页面切换

[源码](index.tsx)

`SectionNavigation({destination,onSwitch,switchDisabled?,separated?})` 提供工作区、AI 助手、监控及同步的图标与翻译文案。destination 为 workspace、agent、monitor 或 sync，点击调用 `onSwitch`。可用 `switchDisabled` 禁用，默认启用；`separated` 默认提供前置分隔线，可按顶栏分组关闭。
