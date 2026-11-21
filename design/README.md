# SQL Studio 新 UI 设计稿

> 基于当前 SQL Studio（v1.1.7）源码的“精致进化”方案：保留 Vite + React + Ant Design、亮暗双主题与绿色主色，重做全局框架、页面层级、信息密度和状态表达。**本目录只包含设计稿与原型，未修改前端或后端业务代码。**

## 快速查看

- **交互原型**：[index.html](index.html)
  - 直接双击打开，或在当前目录运行 `python3 -m http.server 4173` 后访问 `http://127.0.0.1:4173/`。
  - 原型按 1440 × 900 设计，可直接缩放浏览。
- **完整设计规范**：[DESIGN.md](DESIGN.md)
- **高保真截图**：[screens/](screens/)
- **设计令牌与样式参考**：[styles.css](styles.css) 顶部 `Tokens` 区段。
- **原型资源**：[assets/](assets/)（引擎图标与应用 Logo 均复用项目现有 SVG）。

## 覆盖范围

| 页面 | 截图 |
| --- | --- |
| SQL 工作区（亮/暗） | [workspace-light](screens/workspace-light.png) · [workspace-dark](screens/workspace-dark.png) |
| AI 助手（会话） | [agent-light](screens/agent-light.png) |
| AI 助手（首次进入） | [agent-empty-light](screens/agent-empty-light.png) |
| AI 助手（写入确认，暗色） | [agent-write-dark](screens/agent-write-dark.png) |
| 监控指标（活动状态，亮/暗） | [monitor-light](screens/monitor-light.png) · [monitor-dark](screens/monitor-dark.png) |
| 监控指标（状态信息） | [monitor-status-light](screens/monitor-status-light.png) |
| 同步数据库（配置） | [sync-light](screens/sync-light.png) |
| 同步数据库（检查通过） | [sync-plan-light](screens/sync-plan-light.png) |
| 同步数据库（执行完成，暗色） | [sync-progress-dark](screens/sync-progress-dark.png) |
| 系统设置 · 模型配置 | [settings-model-light](screens/settings-model-light.png) |
| 系统设置 · 外观设置（亮/暗） | [settings-appearance-light](screens/settings-appearance-light.png) · [settings-appearance-dark](screens/settings-appearance-dark.png) |
| 系统设置 · 语言 / 关于 | [settings-language-light](screens/settings-language-light.png) · [settings-about-light](screens/settings-about-light.png) |
| 新建连接（亮/暗） | [connection-light](screens/connection-light.png) · [connection-dark](screens/connection-dark.png) |

## 原型操作

- 底部悬浮工具条切换页面、亮暗主题，并打开系统设置。
- 左侧 Rail 可切换工作台 / AI 助手 / 监控 / 同步；底部为亮暗切换与系统设置。
- 工作台：点击树节点展开/收起，点击叶子节点选中；切换、关闭、新建页面标签；切换消息 / 摘要 / 结果。
- AI 助手：查看完整对话、执行过程、SQL、结果和写入确认；输入框为视觉演示。
- 同步数据库：点击「同步检查」查看检查结果，再点击「开始同步」查看执行完成态；「返回配置」可回到初始状态。
- 系统设置：切换模型 / 外观 / 语言 / 关于；主题卡片可即时预览，取消会恢复进入设置前的主题，保存后保留。
- 新建连接：点击顶栏或侧栏的数据库图标打开，左侧可切换数据库类型。
- 快捷键：`1`–`4` 切换页面，`H` 隐藏/显示工具条，`Esc` 关闭弹窗。

## 截图参数

原型支持通过 URL 参数直接进入指定状态，便于截图和评审：

```text
?clean=1&theme=dark&screen=monitor
?clean=1&screen=agent&agent=empty
?clean=1&screen=agent&agent=write
?clean=1&screen=sync&sync=plan
?clean=1&screen=sync&sync=progress
?clean=1&screen=workspace&open=settings&settings=appearance
?clean=1&screen=workspace&open=connection
```

`clean=1` 会隐藏评审工具条；`theme` 为 `light` / `dark`；`screen` 为 `workspace` / `agent` / `monitor` / `sync`。

## 文件说明

```text
design/
├── README.md          本文件：交付索引与查看方式
├── DESIGN.md          完整设计规范
├── index.html         可交互高保真原型
├── styles.css         设计令牌、框架与组件样式参考
├── app.js             页面/主题/弹窗/状态切换
├── assets/            应用 Logo、数据库与 AI 品牌图标
└── screens/           1440 × 900 高保真截图
```

## 说明

- 原型中的引擎图标与应用 Logo 复用项目现有资源，仅用于设计展示。
- 原型样式是设计参考，不是可直接上线的生产 CSS；实现时应优先映射到 Ant Design token、组件参数与项目现有模块结构。
- 详细尺寸、颜色、组件状态和实现建议见 [DESIGN.md](DESIGN.md)。