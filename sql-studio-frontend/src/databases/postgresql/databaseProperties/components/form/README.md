# 数据库属性表单

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

默认导出 DatabasePropertiesForm({creating:boolean,definition?:DatabaseDefinition})，新建/编辑复用编码、排序规则、字符分类、所有者、连接数上限、注释六行；名称由共享表单首行注册，标签宽度和对齐继承同一宿主 Form。

编辑时编码、排序规则、字符分类直接 disabled，名称由宿主 disabled；在 Form 内注册 owner、connectionLimit、comment，所有者输入角色原名，连接数范围 -1 至 2147483647，注释允许清空。初值、变更回调、预览和提交由 useObjectManagement 控制。

新建目前只支持名称，其余六行禁用并显示数据库默认值/创建后编辑提示；不注册或校验这些禁用字段，也不向创建 SQL 提交未支持的属性。保持当前建库行为。使用 Ant Design 默认控件与布局，无请求、缓存或写入。
