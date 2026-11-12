# 输出标签导航

[组件索引](../README.md) · [源码](index.tsx)

ResultTabs 接收 run:RunState、running:boolean、activeKey:string、onChange(key:string)，参数均必传。消息 key=messages，摘要 key=summary，结果 key 为语句索引字符串。由 queryResults 控制选中视图，工作区保存结果索引，无内部业务状态。

消息、摘要与数据结果使用同一层 Ant Design 线形 Tabs。导航使用结果面板底色，两侧留白与工具栏对齐，沿用原生页签间距、主题指示线、键盘焦点和溢出菜单。结果标签按数据集连续编号，key 保留原始语句索引，悬停可查看语句序号和 SQL。

返回数据列的语句生成结果标签，包括零行 SELECT 和带返回列的 RETURNING。无列回执与错误在消息和摘要中展示。对象数据使用单结果标签。

最多并排显示 8 个结果标签。更多时保留当前结果标签，右侧小号 Select（aria-label=选择结果集）提供全部结果。执行期间禁用结果选择，消息标签显示加载图标，消息和摘要仍可访问。切换视图读取当前批次的本地结果。
