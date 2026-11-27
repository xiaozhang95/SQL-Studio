# 键浏览状态

`useKeyBrowser(id,database,active)` 管理当前连接及逻辑库的 SCAN 分页、详情、每秒 TTL 读取、新增表单、写入互斥、错误及展开状态，供 [KeyBrowser](../../components/keyBrowser/README.md) 组合调用。返回受控状态、表单 setter、scan/read/promptAction/save/commit；初始筛选为空、游标为 0、分组默认折叠、新增 TTL 默认 0。[自动筛选](../useRedisSearch/README.md)在工具可见且无写入请求时应用最新输入，从第一页扫描。active 为 false 时暂停 TTL 轮询，供切换页签或工具后保留键浏览状态。

`scan(pattern, cursor='0', continuous?)` 从第一页刷新或按游标追加。无筛选时从头读取一页，带筛选条件时默认从头连续扫描，读取后续批次时默认最多读 10 页。普通关键词在请求前转换为子串匹配，显式 Redis 通配符保持原样。连续扫描串行读取直到游标归零，每 10 页更新列表，按键引用去重。停止或遇到普通请求错误时保留已完成的页面及最后游标，便于继续。集群游标失效时保留已完成的页面，将 `page.cursor` 设为 `null`，调用 `scan(pattern, '0', true)` 可从第一页开始连续扫描。同一筛选从头扫描时，第一批新结果替换旧树，之后继续追加。切换筛选终止旧请求并重置列表与游标，`expandedKeys` 独立于列表。read 默认复用当前详情，refresh=true 强制重读并丢弃旧草稿。过期键自动从当前列表移除。

commit(change,item=selected) 返回 Promise<boolean>，删除按显式 item 的原始引用执行，无需先选中或读取详情；成功只移除目标键，保留其他键的详情、扫描游标和分组展开状态。新增或改名时先结束旧扫描，再重新扫描并读取返回键，改值和 TTL 重新读取当前键。请求期间阻止其他写入，失败保存错误和草稿，返回 false。旧请求通过 AbortController 取消，卸载清理详情和写入请求；调用方按连接与逻辑库挂载，不跨范围复用。
