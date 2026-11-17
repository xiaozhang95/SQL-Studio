# Redis 键分组树

`KeyTree({keys,selected?,expandedKeys,onExpand,onSelect,onDelete,onCreate,onRefresh,disabled,saving,error,clearError})` 将扫描到的键按冒号命名空间分组，叶节点用完整原始引用回调。keys、selected 和 expandedKeys 由父级控制；onExpand 返回新的分组展开数组，onSelect 的可选 refresh 标记用于强制重读。分组不改真实键名、不发请求。

默认折叠，箭头或双击分组切换展开；单击叶节点读取详情。键右键提供查看、刷新详情、删除、新增和刷新列表；分组右键提供展开/收起、新增和刷新。右键删除使用 Ant Design Modal 确认弹框，绑定该键，无需先切换详情；onDelete 返回成功标记，失败显示 error 并保留确认。disabled 阻止菜单和详情操作，saving 锁定确认，clearError 清除旧操作错误。没有分组批量删除。

文件夹显示已加载的去重键数，按名称自然排序，文件夹优先。沿用 object-tree 与 objectTreeLayout 的行距、20px 箭头占位和图文对齐，虚拟滚动最高 450px。base64 展示不拆命名空间。数量仅覆盖已加载扫描页；展开状态由 [useKeyBrowser](../../hooks/useKeyBrowser/README.md) 保存，删除、刷新及空列表都不重置其他分组。
