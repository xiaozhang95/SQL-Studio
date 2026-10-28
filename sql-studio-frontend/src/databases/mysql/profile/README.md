# MySQL 产品配置

[源码](index.ts)

mysqlProfile 为只读 DatabaseProfile：引擎值 mysql、标签 MySQL、默认端口 3306、engine-mysql 样式类及 从 MySQL 官网原始 SVG 保留路径提取的海豚图标（iconPresentation=brand）。使用 satisfies 校验契约并保留字面量类型。

外层表单及图标组件只读取配置，不自行复制端口、标签或绑定 MySQL 资源。资源来源见 [资产说明](../../../assets/databases/README.md)；保留原始图片颜色，连接状态由公共组件的圆点展示。

当前展示按用户要求统一为绿色圆角底板与白色图形，MySQL 和 PostgreSQL 均使用此样式；未连接的 icon 使用灰色底板。SVG 保留源文件，通过图片 filter 显示白色，悬停和选中不改变图形颜色。此展示替代先前的品牌原色、白色衬底和状态小圆点方案。
