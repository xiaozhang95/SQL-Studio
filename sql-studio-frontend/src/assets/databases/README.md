# 数据库品牌图标

[mysql-official.svg](mysql-official.svg) 从 [MySQL 官网原始 SVG Logo](https://www.mysql.com/common/logos/mysql-logo.svg) 提取海豚标记：保留两条原始路径、原始变换与 #00758F 色值，仅移除字标并收紧 viewBox，不重绘或改色。透明底矢量由 MySQL profile 经 engineIcon 展示，连接状态继续使用独立 success/灰色圆点。已移除蓝底 favicon，避免小尺寸模糊及方块底色。

对象类型及操作图标使用 `@ant-design/icons`，无需另存图片。新增资源应记录来源与实际调用者；移除最后一个调用者时同步清理资源和说明，避免保留无用途的历史品牌图片。网站图标位于 `public/studio.svg`，由 `index.html` 引用。

polardb.svg 使用阿里云 PolarDB 官方产品图标的原始 SVG，保留北极熊图形、viewBox 与 #FF6A00 原色，未经重绘或改色。来源：[阿里云图标库](https://github.com/alibaba-sa/cloud-icons)，文件为 fullset-orange/svg/polardb 云数据库 PolarDB.svg；固定上游版本 964d262f73760d61a38c83ede8a9380bcffdc48c，SVG blob 1f31863be62628a047d786d0e15e9842f203f255。上游说明该套图标与 [阿里云 Iconfont 图标集](https://www.iconfont.cn/collections/detail?cid=21408) 一致。

实际调用者为 postgresql/profile，经 engineIcon 用于类型选择、表单头部、对象树和连接选择器。profile 的 iconPresentation=brand 表示透明背景保留官方颜色，连接状态由原生主题色圆点单独表示；不在官方 SVG 中加入状态颜色。已移除自制 PG 字母资源。

当前展示按用户要求统一为绿色圆角底板与白色图形，MySQL 和 PolarDB 均使用此样式；未连接的 icon 使用灰色底板。SVG 保留源文件，通过图片 filter 显示白色，悬停和选中不改变图形颜色。此展示替代先前的品牌原色、白色衬底和状态小圆点方案。
