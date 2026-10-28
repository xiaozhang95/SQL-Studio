# SQL示例与浏览器断言

从 [skill入口](../SKILL.md) 进入，先按 [运行流程](runtime-workflow.md) 建立隔离环境。所有写入仅指向本轮临时对象。

## 样本与通用矩阵

用显式写入API在临时库/schema逐条执行：

```sql
CREATE TABLE sample (id BIGINT PRIMARY KEY,label VARCHAR(100),amount DECIMAL(20,4));
INSERT INTO sample VALUES
  (1,'中文;one',12.3400),
  (2,'',0),
  (9007199254740993,NULL,-99.0001);
```

前端多语句是多次独立请求，直接API也须每请求一条，不把整段发给单语句接口。

| 类别 | SQL/输入 | 断言 |
| --- | --- | --- |
| 精确值/重复列 | `SELECT id,label,amount,id AS id FROM sample ORDER BY id DESC;` | 大整数9007199254740993、DECIMAL尾零、NULL及两个id列保留 |
| NULL/空串/文本 | `SELECT NULL AS n,'' AS e,'中文😀;分号' AS v;` | 三值不同，文本分号不切分 |
| 引号 | `SELECT 'it''s;SQL' AS v;` | 一条请求，返回it's;SQL |
| 空结果 | `SELECT id,label FROM sample WHERE 1=0;` | 有列、0行，仍为查询 |
| CTE | `WITH chosen AS (SELECT id FROM sample WHERE id<3) SELECT COUNT(*) FROM chosen;` | 返回2 |
| JOIN/排序 | `SELECT a.id,b.label FROM sample a JOIN sample b ON a.id=b.id WHERE a.id<3 ORDER BY a.id DESC;` | 2/1，空串与中文保留 |
| 窗口函数 | `SELECT id,ROW_NUMBER() OVER(ORDER BY id) AS n FROM sample ORDER BY id;` | 排名1/2/3 |
| 聚合 | `SELECT COUNT(*),MIN(amount),MAX(amount) FROM sample;` | 3、-99.0001、12.3400 |
| 注释/分号 | 普通注释含分号，`SELECT 'a;b';` 后另两条SELECT | 恰好三条结果，顺序正确 |
| 未闭合 | `SELECT 1; SELECT 'unclosed` | 整批发送前拒绝，SELECT 1也不执行 |
| 空输入 | 空白、分号、普通注释 | 无请求和历史新增 |
| 行数上限 | 真实矩阵1500行生成查询 | 默认1000、truncated=true；显式limit=5时仅5行 |
| 单API多语句 | 一个请求携带 `SELECT 1; SELECT 2` | 拒绝；UI应先切分 |

复用真实矩阵的精确断言，不在skill复制整份实现。行数上限不能证明8MiB字节上限；完整超时和大结果按本次任务另做。

## MySQL

把sqldesk_ui_RUN替换为登记的本轮随机库，粘贴前确认替换完成。从空库范围执行：

```sql
USE `sqldesk_ui_RUN`;
SELECT DATABASE();
SELECT id,label,amount,id AS id FROM sample ORDER BY id DESC;
SELECT '中文;分号' AS text_value,NULL AS null_value,'' AS empty_value;
WITH chosen AS (SELECT id FROM sample WHERE id<3) SELECT COUNT(*) AS n FROM chosen;
```

应全部成功；USE更新该页下拉值，SELECT DATABASE为本次库。USE历史记录初始库，其后记录新库；其他页范围不变。

普通 SQL 窗口允许写入。先验证 CREATE/INSERT/UPDATE/DELETE 成功，再故意触发 SQL 错误：

```sql
SELECT 101 AS completed;
SELECT * FROM missing_window_table;
SELECT 999 AS never_run;
```

第一条保留，第二条失败且提示后续1条未执行，第三条不发送。另验证 ALTER、DROP、TRUNCATE、RENAME、SET、可执行版本注释可在临时库执行，不按只读拒绝。Navicat 风格的 SET NAMES、DROP IF EXISTS、CREATE、INSERT 脚本需验证真实执行；跨请求 SET/事务状态不继承，不能由此宣称支持完整会话导入。

普通字面值 `SELECT '/*! literal */';` 应成功；含分号的表名使用反引号，不能按内部字符切分。二进制/JSON：

```sql
SELECT X'00FF' AS b,JSON_EXTRACT('{"a":2}','$.a') AS j;
```

返回0x00ff与JSON数值文本2。SQL 窗口和准备/清理夹具的 API 均显式允许写入；省略 allowWrite 的 API 默认读取保护另行验证。

## PostgreSQL / PolarDB

选择授权物理库和本轮schema，不依赖跨请求SET。执行：

```sql
SELECT current_schema(),id,label,amount FROM sample ORDER BY id DESC;
CREATE TABLE browser_flow (id INT PRIMARY KEY,label TEXT);
INSERT INTO browser_flow VALUES (1,'中文;内容') RETURNING id,label;
UPDATE browser_flow SET label='已更新' WHERE id=1 RETURNING id,label;
DELETE FROM browser_flow WHERE id=1 RETURNING id;
SELECT COUNT(*) AS remaining FROM browser_flow;
```

六条成功；schema为本次名称，CREATE为成功回执，RETURNING为结果集，UPDATE返回“已更新”，COUNT=0。重复CREATE预期失败，后续停止；不无限新建无登记对象绕开错误。

扩展语法：

```sql
DO $body$ BEGIN RAISE NOTICE 'inside;body'; END $body$;
/* outer /* inner ; */ still */ SELECT $tag$a;b$tag$ AS v;
SELECT E'line\nnext;end' AS v;
SELECT decode('00ff','hex'),'{"a":2}'::jsonb ->> 'a',true,current_schema();
```

前三条不被内部半角分号切碎；DO为回执，美元字符串a;b、E字符串含实际换行。最后为BYTEA十六进制、文本2、布尔true与目标schema。

在browser_flow运行INSERT id=10 → 重复INSERT id=10 → INSERT id=11，再SELECT。只有第一条10已提交；第二条主键冲突，11不存在。失败/取消不代表整批回滚。

省略allowWrite的直接API INSERT仍应拒绝；窗口显式写入成功不表示API默认放开写入。

## 浏览器操作

使用当前可用的浏览器/电脑控制skill与工具，不依赖旧元素编号。操作后读新状态；粘贴完整SQL后先核对编辑器全文，再运行，避免输入未完成就执行。

### 选区、按钮与快捷键：两种引擎都测

1. 粘贴三行：`SELECT 11 AS first;`、`SELECT 22 AS second;`、`SELECT 33 AS third;`。
2. 在焦点内用Ctrl+Home、Shift+End等真实按键选第一条，核对所选文本。仅设置DOM Range不一定同步CodeMirror内部选区，不能据此判断产品错误。
3. 保持当前焦点按Ctrl+Enter，对应设备用Command+Enter。不额外点击编辑器或重新聚焦破坏选区。应只有一个结果11及一条对应历史，草稿全文不变。
4. 重新按键选择前两行，确认实际选区再运行：仅两个结果11/22，无33。
5. 取消选区跑完整草稿：三个结果；再测选中第一条后点运行按钮。右键运行使用菜单打开前的选区快照，失焦不能退回整页。
6. 不出现新增空行、删字、执行旧页、重复发送。运行中重复快捷键不另起批次，取消仍控制原批次。

已知回归：window冒泡监听晚于CodeMirror插入空行，导致选区丢失并执行整页；修复基线是捕获阶段读取选区。以实际行为断言，不只搜索代码里存在capture/stopPropagation。

### 错误、取消、范围与恢复

- 两引擎分别运行 `SELECT 11; SELECT * FROM missing_window_table; SELECT 33;`：仅两条已尝试，第一条结果保留，失败有历史与耗时，33未发送。随后SELECT 44成功。
- MySQL用 `SELECT SLEEP(20); SELECT 777;`，PostgreSQL用 `SELECT pg_sleep(20); SELECT 777;`。看到运行中再点取消，后续未执行、控件解锁，随后SELECT 88成功；留足UI操作时间，不在查询完成后才点击。
- 运行时切到已有另一页，结果仍属发起页；刷新旧结果使用该条执行时的范围与SQL，不使用后来选择器或草稿。
- 保存后刷新：恢复草稿、范围与旧结果，不自动重跑；若刷新打断运行，应标记中断并等手动执行。

### 截图和结果

至少保存MySQL精确值/重复列、失败停止提示、PostgreSQL RETURNING、选区仅执行相应结果的截图。历史核对成功/失败、连接、库/schema、SQL及每条耗时；标签切换不丢前序结果，筛选/分页/刷新针对当前结果。

按改动补充亮暗主题与伸缩布局；未做的视觉路径不勾选。控制台无错误仅作辅助证据，不能代替结果和数据库状态断言。
