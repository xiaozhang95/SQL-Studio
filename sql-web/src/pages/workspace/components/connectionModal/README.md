# 连接弹窗

[组件索引](../README.md) · [源码](index.tsx)

## 参数与回调

open、connection?、connections、onClose、onSaved。open 受控；connection 表示编辑；connections 提供已有连接分组；保存成功回传脱敏连接。

## 行为与边界

调用 useConnectionForm 管理常规/SSL 与校验；左侧使用数据库原有 Logo，右侧显示默认端口。编辑不回显密码，留空保留；保存/测试期间禁止关闭和切类型。

桌面类型侧栏宽 280px，仅展示 MySQL，保留类型和表单分区；窄视口通过媒体查询收缩。

选中类型仅使用 Ant Design colorPrimary 背景和 colorTextLightSolid 文字，不显示尾部勾选图标，不手写亮暗蓝色。Tag/按钮沿用组件默认样式。弹窗内容区固定为 580px 并受视口高度约束；左右区域独立滚动，类型、常规/SSL 页签和测试反馈变化不推动外框及底部操作栏。

页面私有组件从 `./components/connectionModal` 导入；只服务工作区，不通过聚合出口扩散依赖。

## 当前交互

类型列表缩小垂直间距，左侧使用原生填充 token 与右侧形成区分。信息 Tag 使用蓝色 solid，语义状态使用对应颜色；不使用灰色信息标签。

## 布局修正

本轮统一左右底色，通过原有竖线分隔；本地加密 Tag 移到右侧默认端口 Tag 旁，各数据库/SSL 页签均可看到。所有显示字段均有 placeholder，连接参数只预填端口，分组预选“默认分组”。

## 表单高度

常规与 SSL 表单采用 horizontal 布局：label 固定 96px、右对齐，输入区域自适应。名称、分组、主机、端口、用户名和密码各占一行。分组为 AutoComplete，可输入新名称或选择已有分组，支持搜索和清空；新建预选“默认分组”，留空也归入默认分组。已有连接可通过右键“编辑连接”更换分组，保存后由左侧树按组展示。

内容区为 min(600px, 100dvh - 180px)，右侧上下内边距 20px，仅展示 MySQL 常规和 SSL 配置。正常视口内容完整时不出现滚动条；窄小窗口、校验错误或较长反馈需要时仍可滚动。hover 使用原生 controlItemBgHover，与对象树一致。placeholder 使用 Ant Design 默认颜色，不做局部覆盖。

数据库类型项与表单头部均使用 engine.value 显式传入的 logo 变体；按用户最新参考图统一为 40px 成功色底板与白色海豚剪影。
