# 用户配置文件仓库

Open(directory) 创建当前配置目录；Read/Write 接收 context、分区名和 model.StateWrite，读取唯一当前路径。每区使用 schemaVersion/revision/updatedAt/data/extensions，JSON 损坏或版本无效返回错误，不回落其他文件或浏览器存储。文件最多33MiB，0600临时文件 Sync 后同目录替换，目录0700；同进程锁和 CAS 防止并发覆盖，继承取消，不承诺已提交操作可回滚。

connections 与 workspace-index 由专用接口管理，不允许绕过仓库边界。目录首次缺失按当前默认值初始化，写入可重建目录；现存文件严格按当前格式校验。

ReadWorkspace/CommitWorkspace/ReadWorkspacePart 只使用 v2 workspace-index.json 与 workspace-parts/<SHA256>.json。首次缺失创建当前空索引，不读取其他工作区文件。索引仅有页面、引用和布局；每份草稿/结果最多32MiB，先发布不可变内容，再 CAS 提交索引。读取校验散列，失败保留当前文件，不转换其他格式。

CollectWorkspaceParts 仅清理未引用的受管内容，按24小时/128MiB孤立内容目标回收；锁外枚举，删除前锁内核对最新引用，每批最多128个候选，不删除当前引用。调用方最多每5秒安排一次独立回收，不延迟保存成功。
