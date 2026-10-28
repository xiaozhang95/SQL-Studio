# PostgreSQL 对象操作

simpleObjects 提供建库、删库、Schema 新建/重命名/删除、删表或视图、清空表及重命名表或视图的单条 SQL。标识符严格转义，表操作保留完整 schema 身份；删除 Schema 使用 RESTRICT，仅删除空 Schema。调用者负责确认、执行和刷新。
