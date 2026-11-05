# SQL 补全候选展示

`useSQLCompletionPopup()` 返回 extensions、update(ViewUpdate)、popup、choose(index)、close。CodeMirror 继续维护补全来源、筛选、排序、上下键、Enter、Escape 及插入范围；extension 标记原生候选 UI，由 Ant Design Select 替代展示。光标布局在 requestMeasure 的读取阶段计算，避免在编辑器更新期间读取布局。

鼠标通过 setSelectedCompletion/acceptCompletion 应用候选并保留编辑焦点；滚动和窗口变化重新定位。失焦、关闭或无候选时隐藏，卸载后的测量不再更新 React 状态。

补全候选沿用 Ant Design Select 的默认字体、字号、字重和行高。测量仅用于弹层位置和尺寸，候选列表与键盘交互仍由 CodeMirror 状态驱动。
