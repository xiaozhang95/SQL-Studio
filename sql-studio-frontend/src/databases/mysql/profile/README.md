# MySQL 产品配置

[源码](index.ts)

mysqlProfile 为只读 DatabaseProfile：引擎值 mysql、标签 MySQL、默认端口 3306、engine-mysql 样式类及 从 MySQL 官网原始 SVG 保留路径提取的海豚图标（iconPresentation=brand）。使用 satisfies 校验契约并保留字面量类型。

外层表单及图标组件只读取配置，不自行复制端口、标签或绑定 MySQL 资源。资源来源见 [资产说明](../../../assets/databases/README.md)；保留原始图片颜色，连接状态由公共组件的圆点展示。
