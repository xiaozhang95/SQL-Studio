# 运行配置

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

Load() (Config,error) 统一读取环境变量，解析目录并校验首次连接参数；自身不创建文件或访问数据库。下层只消费 Config，不重复读取系统配置。

StateDir 默认为服务**启动工作目录**下的 `./.sql-studio/state/`，由 filepath.Abs 解析成绝对路径。与可执行文件所在目录、系统用户主目录无关；从哪个目录启动就保存到哪个目录。不会自动选择主目录或旧 `.sqloom/state`。

SQLDESK_STATE_DIR 可覆盖状态目录，SQLDESK_DATA_DIR 可覆盖连接/密钥目录；相对覆盖值同样相对于启动工作目录。DataDir 默认等于 StateDir。LegacyDataDir 只在未设置 SQLDESK_DATA_DIR 时指向启动目录 data/，由 app 使用原有校验迁移；显式连接目录不触发迁移。Load 不读取、移动或覆盖旧用户目录配置。

WebDir 默认空，由 webui 按构建方式选择内嵌 dist 或开发磁盘目录；SQLDESK_WEB_DIR 显式覆盖后解析为绝对路径。打包网页来源不影响配置目录。Address/SQLDESK_ADDR 默认 127.0.0.1:18080，可显式改为独立测试端口；main.go 输出实际 PID、exe、监听地址与已解析配置目录。

首次连接环境变量保留原 SQLDESK_MYSQL_* 语义；空密码不创建初始连接，无效端口返回错误。测试覆盖不同启动工作目录、相对与绝对覆盖、无文件写入及地址/端口规则；验证使用 go test/vet/build。
