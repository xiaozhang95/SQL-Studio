# useWorkspace

初始化读取Go布局，失败时不开始自动保存。state/ready/error/saving和update(patch)由App持有。400ms防抖，单请求串行、合并后续变更，用服务端修订号保存；冲突或写入错误暂停保存并显示原因。pagehide/卸载尽力flush，正在写入或被强制终止时不保证最后草稿到达，刷新前应给自动保存时间。状态只在Go文件和内存中。
