# 数据库品牌图标

各引擎 profile 配置本地品牌资源，由 [EngineIcon](../../components/engineIcon/README.md) 用于类型选择、连接下拉、对象树、监控和同步。所有品牌图标使用圆角底板。已打开的连接显示原色，未打开的连接在灰色圆角底板上显示白色品牌图形。

| 引擎 | 品牌图标 |
| --- | --- |
| MySQL | [mysql-official.svg](mysql-official.svg) 保留官网 SVG 的海豚路径、变换和 `#00758F`，裁掉字标。[官网原图](https://www.mysql.com/common/logos/mysql-logo.svg) |
| MariaDB | [mariadb-brand.png](mariadb-brand.png) 使用 MariaDB.org 的 192px 透明底海狮图标，保留基金会原图及铜色 `#D1876C`。[基金会原图](https://mariadb.org/wp-content/uploads/2026/11/cropped-mariaDB_icon-192x192.png) |
| PostgreSQL | [postgresql-brand.svg](postgresql-brand.svg) 使用官方三色大象，保留原图形和颜色，移除文档类型声明。关闭态使用 [postgresql-white.svg](postgresql-white.svg)，沿用官方白色线稿路径并加粗主线，适配小尺寸图标。[官方三色版](https://wiki.postgresql.org/wiki/File:PostgreSQL_logo.3colors.svg) · [官方白色线稿](https://wiki.postgresql.org/wiki/File:PostgreSQL_logo.1color_white.svg) |
| Oracle | [oracle-brand.png](oracle-brand.png) 使用 Oracle 官网的红色 O 图标。[官网图标](https://www.oracle.com/asset/web/favicons/favicon-32.png) |
| GreptimeDB | [greptimedb.svg](greptimedb.svg) 保留官方原紫色。[官方文档仓库](https://github.com/GreptimeTeam/docs/blob/2e5e230f129fea81801907b7c4944a37c966a60b/static/img/logo-routine.svg) |
| Redis | [redis-brand.png](redis-brand.png) 取官网 favicon 的 64px 图层，使用官方红底白色 R。[官网图标](https://redis.io/favicon.ico) |

对象类型及操作图标使用 `@ant-design/icons`，无需另存图片。新增资源应记录来源与实际调用者，移除最后一个调用者时同步清理资源和说明。应用 Logo 位于 [public/studio.svg](../../../public/studio.svg)，由双层窗口、终端提示符和放大镜组成。画布裁切为 560 × 560 正方形并输出 1024 尺寸，用于统一 favicon、标题栏与 Electron 图标。Electron 从同一 SVG 生成开屏、窗口及安装包图标。
