# SQL Studio · Card + Dock UI

卡片 + 左侧 Dock 的 UI 概念稿。本轮只做设计，不改现有应用代码。

## 查看

- 直接打开 [index.html](index.html)。
- 或在当前目录运行 `python3 -m http.server 4174`，访问 `http://127.0.0.1:4174/`。
- 页面参数：`?screen=workspace|agent|monitor|sync&theme=light|dark&modal=connection|settings&settings=model|appearance|language|about&clean=1`。

## 设计变化

- **左侧菜单去掉 Logo**：Dock 从页面顶部直接开始，不再放应用 Logo。
- **去掉顶部工作台区域**：没有全局标题/面包屑 Header；每页第一张卡片承载自己的模块信息。
- **主题色切换为当前代码主题蓝 `#2569df`**：主按钮、活动页签状态点、Dock 激活点、图表主线、同步检查等统一使用主题蓝。
- **颜色对齐当前代码**：
  - 亮色：画布 `#eeeeee`、容器 `#f2f2f2`、边框 `#e2e2e2`、选中 `#e6e6e6`、纯黑正文。
  - 暗色：画布 `#000000`、容器 `#141414`、边框 `#242424`、选中 `#303030`。
  - 控件高度 30px；普通界面沿用系统和 Ant Design 默认字体。
- **每一块都是卡片**：Dock、对象栏、SQL 编辑、结果区、AI 会话、监控指标、同步步骤都使用独立圆角卡片和背景间隙，不再用连续边框切块。
- **Dock 使用单色线性图标**：四个入口统一使用中性色线性图标；选中项切换为主题蓝实心底板 + 白色图标，并保留蓝色状态点，悬停使用中性灰。

## 页面

| 页面 | 亮色 | 暗色 |
| --- | --- | --- |
| 工作台 | [preview-workspace-light.png](preview-workspace-light.png) | [preview-workspace-dark.png](preview-workspace-dark.png) |
| AI 助手 | [preview-agent-light.png](preview-agent-light.png) | [preview-agent-dark.png](preview-agent-dark.png) |
| 监控指标 | [preview-monitor-light.png](preview-monitor-light.png) | [preview-monitor-dark.png](preview-monitor-dark.png) |
| 同步数据库 | [preview-sync-light.png](preview-sync-light.png) | [preview-sync-dark.png](preview-sync-dark.png) |
| 新建连接 | [preview-connection-light.png](preview-connection-light.png) | [preview-connection-dark.png](preview-connection-dark.png) |
| 系统设置 · 模型配置 | [preview-settings-model-light.png](preview-settings-model-light.png) | [preview-settings-model-dark.png](preview-settings-model-dark.png) |
| 系统设置 · 外观设置 | [preview-settings-appearance-light.png](preview-settings-appearance-light.png) | [preview-settings-appearance-dark.png](preview-settings-appearance-dark.png) |

### 工作台

对象树、SQL 编辑器和结果区各自独立成卡片；查询页签为白色胶囊，运行按钮为主题蓝；结果区保留表格状态、筛选、分页。

### AI 助手

左侧为会话列表卡片，右侧为对话卡片；执行过程、SQL、结果表和写入确认都是对话卡片内的二级卡片；输入区固定在对话卡片底部。

### 监控指标

监控工具栏、四张指标卡、2 × 2 趋势图卡和底部活动指标卡全部独立；主趋势使用主题蓝，延迟和慢查询使用警示色。

### 同步数据库

步骤卡、源端/目标端卡、同步选项与检查结果卡、同步对象列表卡、底部操作卡依次排列；主操作为主题蓝。

## 交互

- 左侧 Dock 切换四个页面。
- 亮/暗主题切换（Dock 底部和预览工具条）。
- 工作台页签、结果页签、树节点展开/选中、AI 补全开关均可交互。
- 对象栏顶部 `+` 打开新建连接；Dock 底部设置图标打开系统设置；Esc 或点击遮罩关闭。
- 新建连接弹窗可切换数据库类型；系统设置左侧导航可切换模型配置、外观设置、语言设置和关于软件，主题卡片可预览亮暗。
- `H` 隐藏预览工具条。

## 未包含

- 不包含真实连接、SQL 执行、AI 回复、监控采样或同步执行。
- 未修改 `sql-studio-frontend`、后端或 Electron 代码。
- 字体为系统字体；数据库图标使用项目当前品牌资源，界面图标为原型内联 SVG。