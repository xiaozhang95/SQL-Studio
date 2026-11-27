# 本地测试数据库

每个数据库目录均有独立的 Docker Compose 文件和初始化脚本，端口绑定 `127.0.0.1`，各项目和版本使用独立的数据卷。在仓库根目录可指定配置文件启动所需数据库，例如 MySQL。

```powershell
docker compose -f sql/mysql/docker-compose.yml up -d
docker compose -f sql/mysql/docker-compose.yml ps -a
```

MySQL、MariaDB、PostgreSQL 和 Oracle 由各自镜像的初始化入口加载数据。GreptimeDB 与 Redis 的 `*-init` 是一次性任务，初始化完成后显示 `Exited (0)`。Oracle 首次启动需要展开数据库文件，等待容器状态变为 `healthy`。

## 默认连接

在 SQL Studio 中新建对应类型的连接。主机都填 `127.0.0.1`，Redis 用户名和密码留空，其余账号的测试密码为 `00000000`。

| 引擎 | Compose 文件 | 默认镜像 | 宿主端口 | 用户名 | 数据库或服务名 |
| --- | --- | --- | ---: | --- | --- |
| MySQL | [mysql/docker-compose.yml](mysql/docker-compose.yml) | `mysql:8.4.10` | 13306 | `root` | `sql_studio_demo` |
| MariaDB | [mariadb/docker-compose.yml](mariadb/docker-compose.yml) | `mariadb:11.4` | 13307 | `root` | `sql_studio_demo` |
| PostgreSQL | [postgresql/docker-compose.yml](postgresql/docker-compose.yml) | `postgres:17-alpine` | 15432 | `postgres` | `sql_studio_demo` |
| Oracle Free | [oracle/docker-compose.yml](oracle/docker-compose.yml) | `gvenzl/oracle-free:23-slim` | 11521 | `SQL_STUDIO_DEMO` | 服务 `FREEPDB1`，Schema `SQL_STUDIO_DEMO` |
| GreptimeDB | [greptimedb/docker-compose.yml](greptimedb/docker-compose.yml) | `greptime/greptimedb:v1.3.0` | 14002 | `sqlstudio` | `sql_studio_demo` |
| Redis | [redis/docker-compose.yml](redis/docker-compose.yml) | `redis:7.4-alpine` | 16379 | 留空 | 逻辑库 0 和 1 |

MySQL 和 MariaDB 在工作台打开连接后选择 `sql_studio_demo`。PostgreSQL 可填写 `postgres` 作为维护库，打开后再选择测试库。Oracle 的 `SYSTEM` 测试账号也使用 `00000000`，工作台日常使用上表中的 Schema 账号。

## 兼容版本

这些服务与默认版本使用独立端口及数据卷。连接账号和测试密码沿用同引擎的默认版本。

| 版本 | 镜像 | 服务 | 宿主端口 | 数据库或服务名 |
| --- | --- | --- | ---: | --- |
| MySQL 8.0 | `mysql:8.0` | `mysql-80` | 23306 | `sql_studio_demo` |
| MariaDB 10.11 | `mariadb:10.11` | `mariadb-1011` | 23307 | `sql_studio_demo` |
| PostgreSQL 16 | `postgres:16-alpine` | `postgresql-16` | 25432 | `sql_studio_demo` |
| Redis 6.2 | `redis:6.2` | `redis-62` | 26379 | 逻辑库 0 和 1 |
| Oracle XE 21c | `gvenzl/oracle-xe:21-slim` | `oracle-xe` | 21521 | 服务 `XEPDB1`，Schema `SQL_STUDIO_DEMO` |

在对应的 Compose 文件中指定服务名，就能按需启动兼容版本。Redis 6.2 请选择 `redis-62-init`，它会同时启动 `redis-62` 并加载数据。

```powershell
docker compose -f sql/mysql/docker-compose.yml up -d mysql-80
docker compose -f sql/redis/docker-compose.yml up -d redis-62-init
docker compose -f sql/oracle/docker-compose.yml up -d oracle-xe
```

指定同一文件的 `--profile compat up -d` 可同时启动该数据库的默认版本和兼容版本。端口可通过文件中的 `SQLSTUDIO_*_PORT` 环境变量调整。

## 初始化脚本与数据

| 目录 | 初始化入口 | 样例 |
| --- | --- | --- |
| MySQL | [mysql/init.sql](mysql/init.sql) | 订单、客户、商品与订单明细 |
| MariaDB | [mariadb/init.sql](mariadb/init.sql) | 同结构的订单数据 |
| PostgreSQL | [postgresql/init.sql](postgresql/init.sql) | 同结构的订单数据，含 JSONB |
| Oracle | [oracle/init.sql](oracle/init.sql) | 在预置 PDB 创建测试 Schema，含 JSON CLOB 和 RAW |
| GreptimeDB | [greptimedb/init.sql](greptimedb/init.sql) | 8 条设备指标、4 条事件和汇总视图 |
| Redis | [redis/init.lua](redis/init.lua) | 字符串、TTL、哈希、列表、集合、有序集合与流 |

四种关系型数据库脚本各包含 1,000 个客户、100 件商品、5,000 张订单、15,000 条明细和一张订单视图。脚本使用外键、索引、生成列、精确金额、NULL 和中英文样例，并输出行数及金额校验结果。

MySQL 和 MariaDB 脚本用相应命令行客户端在同一会话执行。PostgreSQL 脚本由 `psql` 执行，包含创建数据库和切库命令。Oracle 脚本由 SQL*Plus 管理员会话从容器根数据库运行，目标为 Oracle Free 或 XE 的预置应用 PDB。GreptimeDB 使用 MySQL 客户端。Redis 使用 `redis-cli -n 0 --eval sql/redis/init.lua`，可用 `-n 1` 初始化逻辑库 1。

基础镜像的初始化脚本在数据卷为空时执行。使用同一文件运行 `--profile '*' stop` 可停止该数据库的各个版本，重启后继续使用已有数据。先前的合并项目若仍在运行，可在 Docker Desktop 停止 `sql-studio-test` 项目后使用原映射端口。

镜像与初始化行为参考 [MySQL](https://hub.docker.com/_/mysql)、[MariaDB](https://hub.docker.com/_/mariadb)、[PostgreSQL](https://hub.docker.com/_/postgres)、[Oracle Free](https://github.com/gvenzl/oci-oracle-free)、[Oracle XE](https://github.com/gvenzl/oci-oracle-xe)、[GreptimeDB](https://docs.greptime.com/getting-started/installation/greptimedb-standalone/) 和 [Redis](https://hub.docker.com/_/redis)。
