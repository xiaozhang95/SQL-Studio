# 执行消息自动滚动

useQueryMessageScroll({identity:string|undefined,progress:number,page:number,latest:boolean,running:boolean,onFollowChange:(following:boolean)=>void})返回content与pause()。content绑定QueryMessages根节点，直接父元素必须是实际结果滚动视口。identity使用批次startedAt/id，progress是完成语句数；新执行默认跟随底部，静态历史初次打开从顶部阅读。

完成消息增加、自动进入最新分页、执行结束及内容/视口尺寸变化时，仅在跟随状态下定位到底部。ResizeObserver覆盖折叠动画和SQL预览的延迟高度变化。滚轮向上、向上阅读快捷键或拖动滚动条向上时暂停，onFollowChange(false)让调用方固定当前分页；滚动回最新页底部时恢复并通知true。pause用于手动翻页，翻页后从页首阅读；新批次重置跟随，旧批次的手动选择不影响新批次。

只操作当前结果视口，不滚动编辑器、页面或数据表格；无SQL/API请求及持久化。卸载断开两个尺寸观察目标并移除事件监听，切换消息页后不会继续操作旧DOM。小于等于2px的底部误差用于兼容浏览器小数滚动位置。
