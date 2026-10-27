# 表数据暂存与统一保存

useDataEditing 接收固定 tab、connection、result、blocked、onBusyChange、onDirtyChange 和 onResult。返回当前编辑 cell、drafts 展示方法 display/isDirty、修改数量 dirty、begin/change/save/cancel/finish。双击任意单元格切换输入，改动即时暂存且高亮，可以跨行、跨列、跨分页修改，顶部统一保存或放弃。保存按单元格顺序提交，主键修改在最后；每项成功即清除对应暂存，失败停止并明确已成功数量，保留剩余修改，不承诺事务原子性。最后重读表。主键、原值和结构检查仍有效。无修改不提交，普通查询仍只读。切换或关闭数据页有未保存提示；刷新浏览器不恢复未提交修改。取消请求不等于回滚。

addRow 读取元数据后新增独立负 key 暂存行，不要求主键；newRows/removeNewRow 管理未提交新行。默认列值为 undefined，保存省略并由数据库生成。统一保存先处理已有修改、再逐行 INSERT；成功项移除暂存，失败保留剩余。新增支持无主键基础表，视图不支持。

新增行通过 newColumn/canInsert/changeNew 直接受控输入，无需双击或单元格编辑状态，内部默认值哨兵不会呈现为 undefined 文本。
