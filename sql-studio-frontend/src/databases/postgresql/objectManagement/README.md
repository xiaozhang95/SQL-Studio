# PostgreSQL 对象操作

simpleObjects 提供建库、删库、删表或视图、清空表及重命名表或视图的单条 SQL。标识符严格转义，表操作保留完整 schema 身份；不使用 CASCADE。调用者负责确认、执行和刷新。表设计、库属性与数据转储尚未实现。
