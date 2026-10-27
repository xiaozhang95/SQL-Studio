# 执行历史

useQueryHistory(connectionId) 返回当前连接 history、appendHistory、clearHistory、ready/saving/error。首次读取 Go history 分区；缺失时迁移旧加密 IndexedDB/更早明文历史，按连接去重排序，最多50条，清理历史来源注释。只在后端提交成功后清理更早明文，旧加密记录保留。

恢复完成才允许执行，200ms防抖写入Go；同区请求串行，旧窗口CAS冲突不覆盖新数据。失败保留内存及旧文件并显示错误，不回落浏览器持久化。清空仅影响当前连接；记录实际发出的语句，取消不是回滚。最后200ms未提交变更在强制关闭时可能丢失。

当前缺失历史配置直接初始化空历史，不再读取浏览器旧历史。
