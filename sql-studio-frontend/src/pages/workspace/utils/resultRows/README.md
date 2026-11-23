# 结果行与筛选

matchResultRows(rows,search) 返回原始行下标，大小写不敏感并保留NULL文本匹配；空搜索返回null，不为全结果分配索引或包装对象。resultTableRows(rows,added,matches) 为虚拟表生成全部加载行的展示对象，复用原始单元格数组。key 始终是原始结果下标，新增负数 key 置前并保留。isNumericResultType 共用数值列排序与对齐判断。

exportResultRows 返回全部匹配行与暂存新增行，保留NULL、重复列和精确数值文本；无搜索/新增时直接复用原数组。函数不改变原结果、暂存单元格或行顺序。搜索由调用者useMemo缓存；消息/摘要不构建结果行。

sortResultRows(rows,matches,sort?,type?) 对当前已加载的全部匹配行下标排序，再分页，取消排序恢复原序；不修改原始数组或行 key。数值使用十进制有效数字和数量级比较，避免 BIGINT/DECIMAL 的 Number 精度损失；NULL 升序在前、降序在后，同值保持原序。selectedResultRows(rows,keys,sort?,type?) 返回跨页勾选的全部有效现有行，去重并排除负数/过期 key，包含暂存值并遵循排序。

selectedResultRows 的可选 orderingRows 用于按原始返回值决定排序，输出仍采用暂存值，避免编辑排序列时行跳动及 CSV 顺序不一致。
