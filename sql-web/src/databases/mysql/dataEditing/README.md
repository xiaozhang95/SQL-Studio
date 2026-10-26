# 表数据编辑

updateCellSQL(database, table, columns, result, row, columnIndex, value) 生成单单元格 UPDATE；必须有完整主键。主键及原单元格采用二进制 NULL 安全比较，最多更新一行。标识符转义，值编码为 UTF-8 十六进制表达式，不受 SQL mode 引号规则影响。数值文本不经过 JavaScript Number。二进制/空间类型、生成列不可编辑；视图在调用前拒绝。SQL 仍经现有显式 allowWrite 接口提交，普通查询保持只读。

insertRowSQL 生成显式列名 INSERT，未填写列省略以使用默认值/自增；必填字段校验，NULL 与空串区分，生成/特殊列禁止手填。canInsertColumn 判断新增可编辑字段。
