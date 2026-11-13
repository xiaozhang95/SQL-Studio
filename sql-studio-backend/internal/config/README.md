# 运行配置

Load() (Config,error) 读取当前环境变量并解析目录。StateDir 默认取 `os.UserHomeDir()` 下的 `.sql-studio/state`，DataDir 默认等于 StateDir。`SQLDESK_STATE_DIR` 与 `SQLDESK_DATA_DIR` 可显式指定目录，相对路径从启动工作目录解析。无法获取用户主目录且未指定状态目录时返回错误。Load 仅读取环境和解析路径。

WebDir 默认空，webui 从 `../sql-studio-frontend/dist` 读取网页；SQLDESK_WEB_DIR 显式指定网页目录，Electron 打包版用它加载随包网页。Address 默认127.0.0.1:18080，可用 SQLDESK_ADDR 覆盖。首次连接参数来自 SQLDESK_MYSQL_*，空密码不创建初始连接，无效端口返回错误。Config 不含旧目录或迁移字段；app.New 必须取得明确的 StateDir/DataDir。
