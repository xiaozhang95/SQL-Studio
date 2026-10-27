# 用户配置模块

New(Repository) 注入 Read/Write 仓库；公开 Read/Write(context,name,input)。分区名为小写字母起始、最多48字符的字母数字横线，数据必须为 JSON 对象、最多32MiB。消费接口只依赖 model，不访问文件。支持新增分区而无需修改旧配置；ErrConflict 代表旧修订号写入。缺失分区返回 revision=0,data=null；不支持版本和磁盘错误原样上报，不自动重置。

AI 分区使用 provider=deepseek、apiKey。读取和写入响应仅返回 provider/configured，绝不返回 Key；更新空 Key 保留旧值，首次保存必须提供 Key。密钥保存于 statefile 的本机 0600 文件，不写入工作区。仍使用 revision 冲突保护。

AI配置增加model和completionEnabled，旧记录未设置续写开关默认true；旧客户端省略字段保留旧模型/开关，空模型由服务商客户端处理默认值。模型标识最长128字符，Key最长512字符，Key仍只保存在后端。

RemoveAI(ctx,revision)通过CAS清空Key、模型并关闭续写，保留配置修订号以阻止旧窗口回写；可随后重新配置新Key。

connections 为保留分区，ValidSection/Read/Write 均拒绝，由连接仓库单独管理；与 statefile 的防护保持一致。
