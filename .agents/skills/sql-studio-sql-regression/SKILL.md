---
name: sql-studio-sql-regression
description: 对本仓库 SQL Studio 的 MySQL 和 PostgreSQL/PolarDB SQL 窗口做回归，覆盖真实执行、多语句、选区快捷键、结果、历史、范围和取消；用于执行流程验证及相关缺陷修复后的复测。
---

# SQL 窗口执行回归

适用于本仓库，先读 [项目 skill](../sql-studio/SKILL.md)。改前端或后端代码时继续使用对应专项 skill。本 skill 记录可复用流程，不把以前一次通过结果作为当前验证证据。

## 范围与约束

- 用户要求“主要 SQL 执行流程”时覆盖本文件核心路径及两种引擎；明确只测一种引擎时按用户范围执行。全面项目回归另需格式、类型、lint、单元测试、vet、构建。
- 真实数据库写入须有当前任务或会话授权，只使用新建随机临时库/schema和虚构数据。不重复索取已有授权/凭据；环境缺失时先完成独立检查并记录缺口。本 skill 不授予访问业务数据或其他服务的权限。
- 凭据由本次会话或环境提供，不写入 skill、源码、提交、截图或报告，不沿用历史密码。SQL 回归不需要 DeepSeek Key，AI 验证仅在相应任务范围内执行。
- MySQL/PostgreSQL SQL 窗口均显式允许 DDL/DML，不设置只读开关或额外确认；回归必须验证窗口真实写入成功，不能把拦截写入当作正常结果。API 省略 allowWrite 仍默认只读，与窗口行为分别验证。取消不等于回滚，恢复页面不自动执行 SQL。

## 阅读和执行

1. 读取下表当前入口，确认引擎策略、测试连接参数及 API。
2. 按 [环境、命令与清理](references/runtime-workflow.md) 建立独立状态目录并运行自动化。
3. 按 [SQL 示例与浏览器断言](references/sql-and-browser.md) 准备另一套浏览器夹具，实际验证编辑、运行、结果、历史、选区、失败和取消。
4. 保存问题的最小复现，按前后端 skill 修复，补充行为测试与契约说明；加载新构建后复测原路径和相邻正常路径。
5. 核验本轮对象、连接、进程和状态目录清理，交付结果与未覆盖项。

| 当前入口 | 核对内容 |
| --- | --- |
| [数据库说明](../../../docs/DATABASES.md)、[API](../../../docs/API.md) | 引擎能力、只读、独立请求、限制、schema |
| [工作区](../../../sql-studio-frontend/src/pages/workspace/hooks/useWorkspace/README.md) | executeSQL、getSelectedSQL/runSQL、范围、结果、历史与取消 |
| [编辑器](../../../sql-studio-frontend/src/pages/workspace/components/queryEditor/README.md) | 按钮、Ctrl/Command+Enter、右键、CodeMirror |
| [前端测试](../../../sql-studio-frontend/tests/README.md) | 开关、端口和环境变量 |
| [真实窗口矩阵](../../../sql-studio-frontend/tests/sql-window.integration.test.mjs) | 实际编排 + HTTP/数据库，替换 React 状态 |
| [MySQL 集成](../../../sql-studio-backend/tests/integration/mysql_test.go)、[PostgreSQL 集成](../../../sql-studio-backend/tests/integration/postgresql_test.go) | 真实驱动/协议和保护边界 |
| [MySQL](../../../sql-studio-backend/internal/mysql/README.md)、[PostgreSQL](../../../sql-studio-backend/internal/postgresql/README.md) | 语句识别、只读事务、精确值、限制、资源释放 |

## 核心通过标准

| 路径 | 必须观察到的结果 |
| --- | --- |
| 普通查询 | 列、行、精确值、NULL/空串、成功状态正确 |
| 多语句 | 按引擎规则切分、顺序发送单语句请求，逐条结果及历史归属正确 |
| 选区执行 | 按钮/快捷键仅执行选中范围，无选区执行完整草稿；快捷键不改文本 |
| 失败停止 | 保留已完成结果，记录失败，后续未发送；随后可重跑 |
| 取消 | 停止后续发送、显示取消、释放运行锁，随后可重跑 |
| 范围 | 请求/历史/刷新使用发起页连接、库/schema；切页不串结果 |
| MySQL | 成功 USE 更新该页后续默认库；SET、DDL、DML 成功及写入失败停止 |
| PostgreSQL | 窗口 DDL/DML/RETURNING 正常；API 省略 allowWrite 仍只读 |
| 恢复 | 页签、草稿和已有结果恢复，不自动重新执行 |

## 两个必须保留的回归点

**MySQL 窗口写入与 API 边界。** 在随机临时库使用窗口执行 SET、DROP IF EXISTS、CREATE、INSERT、UPDATE、DELETE、ALTER、RENAME、TRUNCATE、DROP，核对真实数据、结构、影响行数与历史；写入成功后故意触发 SQL 错误，验证已提交内容保留、后续未发送。另通过省略 allowWrite 的直接 API 验证默认读取保护仍有效；MySQL DDL 会隐式提交，取消不能声称回滚。

**CodeMirror 快捷键顺序。** 通过真实键盘建立并确认选区，按 Ctrl/Command+Enter 后核对实际执行数量、SQL和草稿全文。先插入空行/清空选区、随后整页执行属于失败。只测按钮或编排测试替身不能证明快捷键正确。

## 交付

分别报告静态/单元、真实驱动/API、执行编排、浏览器四层证据；跳过项单列。Node统计可能包含父测试和子测试，数量随代码变化，不能将历史的56/127当固定目标或SQL条数。

报告包括环境/引擎、命令结果、SQL类别与断言、问题复现/修复/复测、截图、清理核验和未覆盖项。没有实测的 TLS/权限、完整超时、大字节结果、macOS快捷键或AI如实说明；不笼统宣称“全部检查完成”。
