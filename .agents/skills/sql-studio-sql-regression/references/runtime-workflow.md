# 环境、命令与清理

用户明确要求运行回归时，从 [skill 入口](../SKILL.md) 进入。目录和连接参数以当前代码与本轮隔离环境为准。

## 环境核对

1. 查看 `git status --short`，保留用户已有改动；读取当前测试和README，确认真实测试默认跳过。
2. 检查Node/pnpm/Go；项目使用pnpm，不为回归更换包管理器或重装健康依赖。
3. Docker CLI可用时可查 `docker ps` 的端口映射；CLI不存在不等于数据库没启动，已知端口时直接用授权的集成测试验证。
4. 前端真实窗口测试使用 `127.0.0.1`。MySQL 默认 `3306/root`，PostgreSQL 默认 `5432/postgres`，维护库为 `postgres`。容器映射端口分别设 `SQLDESK_MYSQL_PORT` 和 `SQLDESK_PG_PORT`，`SQLDESK_TEST_API` 指向隔离后端。Go 的 MySQL 基础集成还支持 `SQLDESK_MYSQL_HOST`，Go 的 PostgreSQL 基础集成目前使用固定端口 `5432`。
5. 后端默认地址为 `127.0.0.1:18080`。通过 `SQLDESK_ADDR` 指定已核对空闲的本机端口。复用环境前核对实例归属与测试范围，独立服务无法建立时记录具体阻塞。

## 隔离后端

在本任务可写产物根下生成唯一子目录。下面的 PowerShell 从仓库根执行，示例端口 `18089` 需先确认空闲。任务有专用产物目录时优先使用它。

```powershell
$taskRegressionRoot = Join-Path (Get-Location) ('.tmp-sql-regression-' + [guid]::NewGuid().ToString('N'))
$env:SQLDESK_STATE_DIR = Join-Path $taskRegressionRoot 'state'
$env:SQLDESK_DATA_DIR = $env:SQLDESK_STATE_DIR
$env:SQLDESK_ADDR = '127.0.0.1:18089'
$env:SQLDESK_WEB_DIR = Join-Path (Get-Location) 'sql-studio-frontend/dist'
Remove-Item Env:SQLDESK_MYSQL_PASSWORD -ErrorAction SilentlyContinue
Set-Location sql-studio-backend
go run main.go
```

- 同时设置 DATA_DIR 与 STATE_DIR，隔离用户默认连接和状态目录。
- 仅后端终端清除初始化密码，防止自动创建额外连接；测试终端另行注入凭据。环境变量不跨工具进程自动持久化，保留并恢复原有值，不覆盖 HOME 及工具专用配置目录。
- 保留前台go run的会话句柄，用Ctrl+C结束，不新增启停/PID/部署包装脚本。
- 用户要求浏览器实测时，先在前端目录运行 `pnpm build`，再由独立后端提供 `SQLDESK_WEB_DIR` 指定的产物。浏览器打开 `SQLDESK_ADDR` 对应的地址。复测新源码使用新构建。
- 查 `/api/health` 确认就绪，再查 `/api/connections`。新目录应为空；非空时核对来源，不批量删除未知记录。

## 自动化命令

为本轮所测数据库在测试进程设置 `SQLDESK_MYSQL_PASSWORD` 或 `SQLDESK_PG_PASSWORD`。按请求选择需要的验证层和命令。

### 无数据库基线

在sql-studio-frontend：

```powershell
pnpm format:check
pnpm lint
node --test tests/*.test.mjs
pnpm build
```

真实矩阵未启用时会跳过，这不计作真实SQL执行通过。修改后按项目规范格式化相关文件，不无差别重写无关源码。

### 真实SQL窗口编排

确认隔离后端运行，并在 `sql-studio-frontend` 的测试终端执行。单引擎回归将 `SQLDESK_SQL_WINDOW_ENGINE` 设为 `mysql` 或 `postgresql`，分别使用实际映射端口。

```powershell
$env:SQLDESK_SQL_WINDOW_INTEGRATION = '1'
$env:SQLDESK_TEST_API = 'http://127.0.0.1:18089/api'
node --test tests/sql-window.integration.test.mjs
```

测试提取当前executeSQL真实实现，使用实际引擎切分器，替换React状态，经HTTP执行到数据库。断言calls、histories、statements、页范围、结束时间和取消后锁释放；创建随机sqldesk_window_库/schema和临时连接，finally清理。

改动executeSQL结构时核对源码提取边界仍正确。无法加载测试不等于行为通过。该测试未渲染CodeMirror，不覆盖鼠标/选区/快捷键事件顺序。

相关改动完成后可保留开关执行 `node --test tests/*.test.mjs`，获得包含真实矩阵的全套结果；保存输出但不输出密码/Key。

### 后端真实集成与全套

在sql-studio-backend的测试终端：

```powershell
if (-not $env:SQLDESK_MYSQL_PASSWORD -or -not $env:SQLDESK_PG_PASSWORD) { throw '请先提供本次测试凭据' }
$env:SQLDESK_INTEGRATION = '1'
$env:SQLDESK_PG_INTEGRATION = '1'
go test -count=1 -v ./tests/integration
go test -count=1 ./...
go vet ./...
go build ./...
```

逐项检查退出码。PowerShell分号串行不自动遇错停止，最后build成功不能掩盖前面test失败。改动Go源码后按范围gofmt，`gofmt -l`应无输出。

集成使用随机sqldesk_test_临时库/schema。必须看到对应测试PASS且非SKIP，才能报告该引擎真实集成通过。只创建/修改skill文档时不需要再次访问数据库，验证skill结构及链接即可。

## 浏览器夹具

自动化测试会立即清理，不能复用其连接ID/库名。另建本轮专属 `sqldesk_ui_` 加随机十六进制后缀，登记名称、连接ID、引擎、库/schema，不记录密码。

- 用隔离后端连接API创建两种引擎测试连接，放入可辨认的临时分组。密码仅后端加密存储，截图避开密码表单。
- MySQL：根范围显式allowWrite=true创建随机库，再以该库建sample表。
- PostgreSQL：在授权维护库创建随机schema，再以database和schema显式范围建sample表，不依赖跨请求SET search_path。
- sample只写入 [SQL示例](sql-and-browser.md) 的虚构三行数据。直接API每次一条SQL；临时夹具准备不能替代 MySQL 普通窗口写入验证，须通过窗口执行 SET、DDL、DML 并核对实际结果。
- 用临时连接新建查询，MySQL可从空库范围经USE切入测试库，PostgreSQL选物理库与schema。不要使用业务连接。

用已授权API或最小会话脚本准备和清理，不把临时脚本升级为项目服务包装。

## 失败与复测

- 保存实际SQL、明确范围、错误、已发送数量及页面可见结果；先区分断言错误、环境问题和产品缺陷。
- Windows沙箱可能拒绝pnpm目录解析、Go临时文件rename或localhost请求；按工具权限流程重跑，不据此修改业务代码。审批服务故障也不计作产品缺陷，不能绕过审批。
- 用户要求修复后复测时加载新构建，覆盖最小复现、同引擎相邻正常路径和范围内受影响的其他引擎。浏览器问题以浏览器结果为准。
- 清理失败时记录精确对象名称并处理本轮对象，不扩大为删除所有相似前缀的库/schema。

## 清理和交付

1. 保存截图与输出，再关闭本轮浏览器页，避免它访问已清理对象或继续保存状态。
2. 按登记精确DROP本轮MySQL库/PostgreSQL schema（CASCADE仅用于本轮schema）；中断遗留也须有本轮归属证据。
3. 再查库列表或pg_namespace，确认目标不存在；删除本轮临时连接，独立后端列表应恢复初始状态。
4. 停止自己启动的go run，再清理独立状态目录。递归删除前解析绝对路径，确认就是本次产物根下state子目录；不删除用户目录、data/或共享配置。
5. 清除本轮注入的密码、开关、API地址，或恢复原值；测试进程退出时说明其环境已随进程结束。保留证据，删除含密钥的临时运行目录。
6. 检查diff，仅保留有意维护的测试、修复、文档，不提交凭据、运行状态、构建产物或临时脚本。

报告分别填写各层通过/失败/跳过、两种引擎SQL类别与断言、问题与复测、清理核验、警告和未覆盖项。父/子测试数量不是SQL条数。
