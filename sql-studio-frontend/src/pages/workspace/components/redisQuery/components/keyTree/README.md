# Redis 键分组树

`KeyTree({ keys, selected?, expandedKeys, onExpand, onSelect, onRequestDelete, onCreate, onRefresh, disabled })` 将扫描到的键按冒号命名空间分组，叶节点用完整原始引用回调。keys、selected 和 expandedKeys 由父级控制。onExpand 返回新的分组展开数组，onSelect 的可选 refresh 标记用于强制重读。

默认折叠，箭头或双击分组切换展开，单击叶节点读取详情。键右键提供查看、刷新详情、删除、新增和刷新列表。分组右键提供展开、收起、新增和刷新。右键删除通过 `onRequestDelete` 把该键交给父级打开确认弹框，无需切换详情。`disabled` 阻止菜单和详情操作。

文件夹显示已加载的去重键数，按名称自然排序，文件夹优先。沿用 object-tree 与 objectTreeLayout 的行距、20px 箭头占位和图文对齐，列表左右铺满，选中和悬停背景延伸到面板边缘；虚拟滚动高度跟随键浏览区域；键名使用等宽字体。base64 展示不拆命名空间。数量仅覆盖已加载扫描页；展开状态由 [useKeyBrowser](../../hooks/useKeyBrowser/README.md) 保存，删除、刷新及空列表都不重置其他分组。
