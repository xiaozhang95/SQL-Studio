# SQL 补全候选展示

`useSQLCompletionPopup()` 返回 extensions、update(ViewUpdate)、popup、choose(index)、close。CodeMirror 继续维护补全来源、筛选、排序、上下键、Enter、Escape 及插入范围；extension 标记原生候选 UI，由 Ant Design Select 替代展示。光标布局在 requestMeasure 的读取阶段计算，避免在编辑器更新期间读取布局。

鼠标通过 setSelectedCompletion/acceptCompletion 应用候选并保留编辑焦点；滚动和窗口变化重新定位。失焦、关闭或无候选时隐藏，卸载后的测量不再更新 React 状态。

popup.typography 在测量阶段读取当前 CodeMirror contentDOM 的实际 fontFamily/fontSize/fontWeight/lineHeight。字体变化参与状态比较，由候选组件应用到弹层和每项，避免选中项默认加粗与编辑区不一致；不修改编辑区及其他 Select 的字体。
