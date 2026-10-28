# 输出标签导航

[组件索引](../README.md) · [源码](index.tsx)

ResultTabs 接收 run:RunState、running:boolean、activeKey:string、onChange(key:string)，参数均必传。消息 key=messages，摘要 key=summary，结果 key 为语句索引字符串。由 queryResults 控制选中视图，工作区保存结果索引，无内部业务状态。

消息、摘要与数据结果置于同一层 Ant Design card Tabs。只有返回数据列的语句产生结果标签，SELECT 零行与 RETURNING 仍保留；SET/DDL/无列 DML 回执和错误进入消息/摘要，不占结果标签。结果按数据集连续编号，key 保留原始语句索引，悬停可查看语句序号和 SQL。旧快照/对象数据以单条兼容。

最多并排显示 8 个结果标签；更多时保留当前结果标签，右侧 Select（aria-label=选择结果集）提供全部结果，使用 Ant Design 原生虚拟选项列表。选择器及结果标签在执行期间禁用，消息和摘要仍可访问。无数据结果时只有消息、摘要，不限制实际执行数量或丢弃结果。

标签连续排列，每项只绘制右侧 1px 主题分隔线，不绘制左边框，避免相邻双线及首项冗余边界；亮暗主题一致。结果项保留成功/失败图标及语义色，当前结果使用语义色顶线；消息和摘要使用主题主色。必要覆盖只在 app.scss，限直属导航，长列表经原生溢出菜单访问。切换不请求数据库。
