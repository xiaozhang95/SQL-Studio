# Redis 键分组树

`KeyTree({keys,selected?,onSelect})` 将已扫描到的 Redis 键按冒号分隔的命名空间组织为文件夹。文件夹显示已加载的去重键数量，叶节点显示末段名称；文件夹只展开/折叠，叶节点通过 `onSelect(RedisKey)` 返回完整名称和原始引用，`selected` 为当前键引用。分组不修改真实键名、不发请求。

分组默认折叠，点击箭头或双击分组行展开/收起，单击叶节点读取详情。按名称自然排序并优先显示文件夹；复用左侧连接对象树的 object-tree 样式与 objectTreeLayout.rowHeight（28px 内容和 2px 行距）。通过 Tree 的 styles.itemSwitcher 将分组箭头与叶节点占位统一为 objectTreeLayout.switcherWidth（20px），同层文件夹和键的图标、文字起点一致。使用虚拟滚动，高度随可见节点数量变化，最高 450px。二进制键的 base64 展示不参与命名空间分割。数量仅覆盖当前已加载的扫描页，不代表实例全部键数；父级继续扫描时追加键、保留已有展开状态并对重复引用去重。
