# PostgreSQL 表设计

tableDesign 使用 schema 限定表，支持常见内置类型、字段增删改名、类型、非空、主键、identity、简单默认值和字段注释。原有复杂默认表达式原样展示并保留；新增或修改表达式仅支持 CURRENT_TIMESTAMP。生成列只读；类型转换和依赖由数据库校验，不使用 CASCADE。多个变更生成一个 DO 块，在一个事务中执行；调用方负责加载、预览、提交和刷新。
