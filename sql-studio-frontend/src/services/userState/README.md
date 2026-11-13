# 用户配置服务

readState<T>(section,defaults) 读取 Go 当前版本的配置分区。分区缺失时调用默认值工厂。同一分区合并在途读取并缓存最近成功的文档。读取失败可重试，旧格式不迁移。

writeState(section,value) 按分区串行执行带修订号的写入。成功返回 {saved:true}，409 后读取并返回 {saved:false,data}，已经排队的旧写入使用同一最新文档。调用者应用最新值。其他请求错误交给调用者，读到有效修订前不提交。
