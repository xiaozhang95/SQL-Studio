# 结果分页与筛选

matchResultRows(rows,search) 返回原始行下标，大小写不敏感并保留NULL文本匹配；空搜索返回null，不为全结果分配索引或包装对象。pageResultRows(rows,added,matches,page,size=50) 只为可见页创建key/cells展示对象，key始终是原始结果下标，新增负数key置前，不参与搜索过滤，与原行为一致。

exportResultRows 返回全部匹配行与暂存新增行，不受当前页限制，保留NULL、重复列和精确数值文本；无搜索/新增时直接复用原数组。函数不改变原结果、暂存单元格或行顺序。搜索由调用者useMemo缓存，翻页不重搜；消息/摘要不构建结果行。
