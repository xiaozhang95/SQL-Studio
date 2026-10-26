# 用户配置模块

New(Repository) 注入 Read/Write 仓库；公开 Read/Write(context,name,input)。分区名为小写字母起始、最多48字符的字母数字横线，数据必须为 JSON 对象、最多32MiB。消费接口只依赖 model，不访问文件。支持新增分区而无需修改旧配置；ErrConflict 代表旧修订号写入。缺失分区返回 revision=0,data=null；不支持版本和磁盘错误原样上报，不自动重置。
