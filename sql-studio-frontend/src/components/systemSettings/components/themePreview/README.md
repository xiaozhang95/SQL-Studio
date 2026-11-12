# 主题缩略预览

ThemePreview({preference: ThemePreference}) 为主题卡片绘制 SQL 工作区缩略图，light/dark 展示对应主题，system 并列展示亮暗缩略图。内部 WorkspacePreview 使用 Ant Design 对应算法的原生颜色 token 绘制顶栏、对象栏、编辑器和结果网格，不依赖图片资源或真实数据，也不改变全局主题。

组件无状态和回调，仅用于 [appearanceCards](../appearanceCards/README.md) 的装饰预览，固定高度来自 [settings](../../constant/settings/README.md)。普通界面文字与字体不受预览影响。
