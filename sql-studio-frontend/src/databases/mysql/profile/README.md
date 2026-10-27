# MySQL 产品配置

[源码](index.ts)

mysqlProfile 为只读 DatabaseProfile：引擎值 mysql、标签 MySQL、默认端口 3306、engine-mysql 样式类及现有海豚图标资源。使用 satisfies 校验契约并保留字面量类型。

外层表单及图标组件只读取配置，不自行复制端口、标签或绑定 MySQL 资源。资源来源见 [资产说明](../../../assets/databases/README.md)；不修改图片及既有状态色。
