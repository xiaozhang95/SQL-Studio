# 运行配置

Load() (Config,error) 读取当前环境变量，解析并校验目录，不创建文件或访问数据库。StateDir 默认服务启动工作目录下 .sql-studio/state，DataDir 默认等于 StateDir；SQLDESK_STATE_DIR 与 SQLDESK_DATA_DIR 可显式指定当前目录，相对路径也从启动目录解析。只使用解析后的当前目录，不探测其他目录、不迁移连接或密钥。

WebDir 默认空，由构建方式决定内嵌/磁盘网页；SQLDESK_WEB_DIR 显式覆盖。Address 默认127.0.0.1:18080，可用 SQLDESK_ADDR 覆盖。首次连接参数来自 SQLDESK_MYSQL_*，空密码不创建初始连接，无效端口返回错误。Config 不含旧目录或迁移字段；app.New 必须取得明确的 StateDir/DataDir。
