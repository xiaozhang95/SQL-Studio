# 数据库品牌图标

[mysql-official.svg](mysql-official.svg) 从 [MySQL 官网原始 SVG Logo](https://www.mysql.com/common/logos/mysql-logo.svg) 提取海豚标记：保留两条原始路径、原始变换与 #00758F 色值，仅移除字标并收紧 viewBox，不重绘或改色。透明底矢量由 MySQL profile 经 engineIcon 展示，连接状态继续使用独立 success/灰色圆点。已移除蓝底 favicon，避免小尺寸模糊及方块底色。

对象类型及操作图标使用 `@ant-design/icons`，无需另存图片。新增资源应记录来源与实际调用者；移除最后一个调用者时同步清理资源和说明，避免保留无用途的历史品牌图片。应用 Logo 位于 `public/studio.svg`，为原创蓝底数据库圆柱与查询光标组合；由 `index.html` 用作 favicon，Electron 从同一 SVG 生成开屏、窗口及安装包图标。

postgresql.svg 使用 [PostgreSQL 官方单色白色大象图标](https://wiki.postgresql.org/wiki/File:PostgreSQL_logo.1color_white.svg)，移除了原文件中的背景矩形以保留透明背景。

实际调用者为 postgresql/profile，经 engineIcon 用于类型选择、表单头部、对象树和连接选择器。

当前展示统一为绿色圆角底板与白色图形，MySQL 和 PostgreSQL 均使用此样式；未连接的 icon 保留圆角方形底板和白色图形，底板与未打开数据库图标共用 --inactive-icon（text-tertiary）主题色。SVG 保留源文件，图形通过图片 filter 显示白色，悬停和选中不改变图形颜色。

engineIcon 将半透明灰色先合成到主题容器底色 --surface 上，避免亮暗主题的选中背景混入灰色底板；资源路径、SVG 源色和白色图形处理保持不变。

[mariadb.svg](mariadb.svg) 使用 [Simple Icons MariaDB 图标](https://github.com/simple-icons/simple-icons/blob/develop/icons/mariadb.svg)（Simple Icons，CC0），从 jsDelivr simple-icons v15 发布包取得，保留原始 24×24 路径。调用者为 mariadb/profile，经 engineIcon 用于类型选择、表单、对象树及连接选择；沿用现有绿色底板与白色图形。
