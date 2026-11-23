# 应用线性图标

[源码](index.tsx)

`StudioIcon` 提供与应用视觉稿一致的 24 × 24 线性 SVG 图标，使用 `currentColor`，避免 Ant Design 图标在 15–20px 下粗细和形状不一致。

## 用法

```tsx
<StudioIcon name="database" size={20} />
<StudioIcon name="play" size={14} />
```

## 名称

`database`、`bot`、`activity`、`swap`、`play`、`folder`、`table`、`eye`、`key`、`sun`、`moon`、`sparkle`、`zap`。

普通图标使用 1.7px 圆角描边；`play` 为实心三角形。图标默认 `aria-hidden`，按钮和状态容器负责提供可访问名称。

## 使用范围

- 全局 Rail 页面入口与主题图标。
- 工作台 Header 的新建连接、对象树分类与表图标。
- 编辑器主「运行」按钮。

品牌 Logo、数据库引擎图标和 AI 服务商图标继续使用各自资源，不使用本组件。
