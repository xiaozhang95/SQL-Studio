# 用户配置文件仓库

Open(directory) 创建私有配置目录；Read/Write 接收 context、分区名和 model.StateWrite。每区独立 JSON，schemaVersion/revision/updatedAt/data/extensions；版本不支持或内容损坏拒绝覆盖，extensions 原样保留。分区只允许受限字符，禁止路径穿越；限 33 MiB 文件，0600 临时文件同步后同目录重命名。进程内互斥及修订号 CAS 防止窗口间覆盖，冲突返回 model.ErrStateConflict；仅支持一个服务进程拥有目录。读写前与提交前检查取消，提交后取消不代表回滚。

保存前重新确保目录存在；缺失文件视为新分区，允许当前会话旧revision连续重建，现存文件仍严格CAS。
