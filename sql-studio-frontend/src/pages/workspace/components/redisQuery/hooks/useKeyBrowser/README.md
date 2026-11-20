# 键浏览状态

`useKeyBrowser(id,database)` 管理当前连接及逻辑库的 SCAN 分页、详情、每秒 TTL 读取、新增表单、写入互斥、错误及展开状态，供 [KeyBrowser](../../components/keyBrowser/README.md) 组合调用。返回受控状态、表单 setter、scan/read/promptAction/save/commit；初始筛选为空、游标为 0、分组默认折叠、新增 TTL 默认 0。

`scan(pattern, cursor='0', continuous=false)` 从第一页刷新或按游标追加。首次刷新取一页，后续每批最多读 10 页。连续扫描串行读取直到游标归零，每 10 页更新列表，按键引用去重。停止或失败时保留已完成的页面及最后游标，便于继续。同一筛选刷新时保留旧树直到结果返回，切换筛选终止旧请求并重置列表与游标，`expandedKeys` 独立于列表。read 默认复用当前详情，refresh=true 强制重读并丢弃旧草稿。过期键自动从当前列表移除。

commit(change,item=selected) 返回 Promise<boolean>，删除按显式 item 的原始引用执行，无需先选中或读取详情；成功只移除目标键，保留其他键的详情、扫描游标和分组展开状态。新增/改名重新扫描并读取返回键，改值和 TTL 重新读取当前键。请求期间阻止其他写入，失败保存错误和草稿，返回 false。旧请求通过 AbortController 取消，卸载清理详情和写入请求；调用方按连接与逻辑库挂载，不跨范围复用。
