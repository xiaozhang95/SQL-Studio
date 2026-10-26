# 输出标签导航

[组件索引](../README.md) · [源码](index.tsx)

ResultTabs 接收 run:RunState、running:boolean、activeKey:string、onChange(key:string)，参数均必传。消息 key=messages，摘要 key=summary，结果 key 为语句索引字符串。由 queryResults 控制选中视图，工作区保存结果索引，无内部业务状态。

消息、摘要、结果 1、结果 2 等全部并列在同一层 Ant Design card Tabs；不再嵌套结果/SQL 标签。执行期间消息显示 loading，仍可查看消息和摘要，逐条结果暂时禁用。仅有一条输出也展示结果 1；没有已完成输出时只有消息与摘要。旧快照/对象结果以单条兼容。

标签连续排列，结果项保留成功/失败图标及语义色，当前结果使用语义色顶线；消息和摘要使用主题主色。样式仅限直属导航，长列表经原生溢出菜单访问。切换不请求数据库。
