# 连接表单生命周期

[源码](index.ts)

## 调用与返回

`({ open, connection?, connections, onSaved })`

返回 form、groups、engine、busy/saving/testing、section、status、测试/保存回调及面板状态设置器。groups 固定包含首项“默认分组”，其他项从 connections 提取，去除首尾空白、去重并排序。

## 生命周期与边界

仅 MySQL，无初始库或切换类型分支。空密码保留交给服务端按 ID 处理；不回显凭据。测试状态在关闭后清理，避免动画结束覆盖成功反馈。

engine 读取 getDatabaseAdapter(...).profile，类型、标签和端口的唯一来源为所属数据库配置；表单不重复写死 MySQL 或 3306。

请求错误、取消和持久化失败沿用实现中的边界，组件不重复维护同一份业务状态。

## 当前交互

新建表单预填数据库类型对应端口及“默认分组”；不自动填入名称、主机或账号。编辑已有连接继续回显脱敏信息，缺少分组的旧连接回显默认分组，空密码保留旧凭据。

group 可自由输入或选择已有值，提交前去除首尾空白；清空后保存仍归入默认分组。不因仅输入或取消表单而创建分组。

selectEngine(type:DatabaseType) 仅允许新建且非 busy 时切换，引擎 profile 提供默认端口及维护库，保留名称/主机/用户名。初始化不依赖当前所选 engine，避免切换时重置整张表。PostgreSQL 维护库默认 postgres，保存与测试传给后端。
