# MySQL 状态图标

本目录仅保留正在使用的 [mysql-dolphin.svg](mysql-dolphin.svg)：根据用户提供的绿底白色海豚示意制作的矢量剪影，不作为 MySQL 官方 Logo 原件声明。

资源由 [MySQL profile](../../databases/mysql/profile/README.md) 引用，通过 [engineIcon](../../pages/workspace/components/engineIcon/README.md) 统一展示在连接表单、对象树连接节点及查询连接选择器中。白色剪影保持不变，组件底色使用 success/灰色 token 表示连接打开/关闭；圆角为此状态图标的既有产品要求。

对象类型及操作图标使用 `@ant-design/icons`，无需另存图片。新增资源应记录来源与实际调用者；移除最后一个调用者时同步清理资源和说明，避免保留无用途的历史品牌图片。网站图标位于 `public/studio.svg`，由 `index.html` 引用；`design` 为界面参考，不属于运行图标。
