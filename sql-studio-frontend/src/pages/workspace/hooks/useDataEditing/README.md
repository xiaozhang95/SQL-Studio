# 表数据暂存与统一保存

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

单元格编辑、新增和保存失败通过 operationError 返回给页面顶部提示。删除失败通过 deletionError 返回给结果区域的删除弹框。错误绑定发起页，对应 clearOperationError 和 clearDeletionError 清理状态。

useDataEditing 接收固定 tab、connection、result、blocked、onBusyChange、onDirtyChange 和 onResult。返回当前编辑 cell、草稿展示方法 display/isDirty、修改数量 dirty 和 begin/change/save/cancel/finish。双击单元格进入输入，改动即时暂存且高亮，可以跨行、跨列、跨分页修改，顶部统一保存或放弃。保存前复核表结构。有主键时逐格提交，主键修改放在最后。无主键时校验原始整行，每行的所有修改在同一条语句中提交。每次成功即清除对应暂存，遇到失败停止并报告已保存的数量，保留剩余修改。全部成功时重读表。切换或关闭数据页时提示处理尚未保存的修改。

addRow 读取元数据后新增独立负 key 暂存行，不要求主键；newRows/removeNewRow 管理未提交新行。默认列值为 undefined，保存省略并由数据库生成。统一保存先处理已有修改、再逐行 INSERT；成功项移除暂存，失败保留剩余。新增支持无主键基础表，视图不支持。

新增行通过 newColumn/canInsert/changeNew 直接受控输入，无需双击或单元格编辑状态，内部默认值哨兵不会呈现为 undefined 文本。

异步 deleteRows(keys,onDeleted) 在结果工具栏的 DeleteDialog 中确认后调用。先重新读取基础表元数据，并验证所有选中行的删除条件，再依次执行单行删除。有主键时按完整主键定位，无主键时匹配原始整行。每次删除要求影响恰好一行，完全相同的记录按选择数量逐行处理。待删除的行必须来自基础表，有暂存修改时须先保存或放弃。删除并刷新成功时返回 true。提交前失败时展示具体校验或读取错误。发出删除请求后失败时停止后续删除，返回 false，并提供已确认删除的数量、失败原因以及刷新核对提示。选择跨分页保留，结果版本变化清空。

rows 返回 memo 化暂存预览，未编辑时复用原始行；有暂存时仅复制修改的行，不复制整张表的所有单元格。

最新新增草稿放在最前面；结果组件在新增及保存刷新后回到第一页顶部，不依赖原始返回行的排序改变数据库写入目标。

时间字段输入复用 temporalInput：DATE 使用日期选择，TIME 使用时分秒，DATETIME/TIMESTAMP 使用日期时间；保留原字符串手动编辑及 NULL/默认值语义，带时区和特殊时间值不强制转换。表设计仅常量默认值启用选择器，表达式仍按文本输入。

数据页 UPDATE 显式传 `matchRows=true`，MySQL 和 MariaDB 使用匹配行数，PostgreSQL 使用原生更新行数。要求恰好一行，零行时提示原值已变化或行已不存在。普通 SQL、插入和删除使用数据库默认的行数语义。
