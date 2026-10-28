# 数据库品牌图标

[mysql-official.svg](mysql-official.svg) 从 [MySQL 官网原始 SVG Logo](https://www.mysql.com/common/logos/mysql-logo.svg) 提取海豚标记：保留两条原始路径、原始变换与 #00758F 色值，仅移除字标并收紧 viewBox，不重绘或改色。透明底矢量由 MySQL profile 经 engineIcon 展示，连接状态继续使用独立 success/灰色圆点。已移除蓝底 favicon，避免小尺寸模糊及方块底色。

对象类型及操作图标使用 `@ant-design/icons`，无需另存图片。新增资源应记录来源与实际调用者；移除最后一个调用者时同步清理资源和说明，避免保留无用途的历史品牌图片。网站图标位于 `public/studio.svg`，由 `index.html` 引用。

postgresql.svg 使用 [PostgreSQL 官方单色白色大象图标](https://wiki.postgresql.org/wiki/File:PostgreSQL_logo.1color_white.svg)，移除了原文件中的背景矩形以保留透明背景。

实际调用者为 postgresql/profile，经 engineIcon 用于类型选择、表单头部、对象树和连接选择器。

当前展示统一为绿色圆角底板与白色图形，MySQL 和 PostgreSQL 均使用此样式；未连接的 icon 使用灰色底板。SVG 保留源文件，通过图片 filter 显示白色，悬停和选中不改变图形颜色。
