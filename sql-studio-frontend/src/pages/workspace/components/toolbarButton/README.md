# 工具栏图标按钮

ToolbarButton 是工作区查询、结果、表设计、字段编辑、历史记录、SQL 预览和树加载重试共用的 Ant Design text Button，仅显示图标，使用默认尺寸和原生悬停、焦点、禁用、加载及危险反馈；紧凑表格单元格与 SQL 复制可传 size="small"。

必传 icon 和 label，label 作为 aria-label 及默认 Tooltip；可选 hint 覆盖悬停说明，例如重新执行的写入风险或暂存修改导致禁用的原因。其余参数沿用 ButtonProps，但不接收 children/type/title/aria-label，避免文字按钮和重复说明。默认无业务状态，onClick 等回调直接透传。

Tooltip 外层 span 保证禁用按钮仍能显示说明，forwardRef 将 Button 引用透传，兼容 Dropdown 触发器；Upload 包裹时沿用父层的文件选择行为。不修改任何执行、导入导出或确认逻辑。
