# 用户目录配置接口

readState(section,legacy) 读取 Go 分区配置；schemaVersion/revision 校验后，只有 data=null 才调用旧浏览器迁移读取。writeState(section,value) 以读取修订号 CAS 顺序提交，不再写 IndexedDB；冲突、损坏或不支持版本向调用方报错，不盲目重读后覆盖。分区各自独立队列，失败允许后续同版本重试；多窗口冲突需要刷新。无凭据入参。
