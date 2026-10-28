import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

import { splitSQLStatements, useDatabaseSQL } from '../src/databases/mysql/statements/index.ts'
import { splitPostgreSQLStatements } from '../src/databases/postgresql/statements/index.ts'

// Opt in against an isolated SQL Studio backend. Credentials only come from the environment.
const enabled = process.env.SQLDESK_SQL_WINDOW_INTEGRATION === '1'
const base = process.env.SQLDESK_TEST_API || 'http://127.0.0.1:8080/api'
const source = readFileSync(new URL('../src/pages/workspace/hooks/useWorkspace/index.tsx', import.meta.url), 'utf8')
const implementation = stripTypeScriptTypes(source.slice(source.indexOf('  async function executeSQL('), source.indexOf('  const refreshScope =')))

async function api(path, body, signal, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`)
  return result
}

function windowRunner(connection, scope) {
  const adapter = connection.type === 'mysql' ? { splitStatements: splitSQLStatements, useDatabase: useDatabaseSQL } : { splitStatements: splitPostgreSQLStatements, useDatabase: () => undefined }
  return async (script, cancelAfter) => {
    const calls = [],
      histories = [],
      results = [],
      messages = []
    let pages = [
      { ...scope, id: 'origin', kind: 'query' },
      { ...scope, id: 'other', kind: 'query', database: 'unchanged' }
    ]
    const request = { current: null }
    let timer,
      finished = false
    const dependencies = {
      connections: [connection],
      objects: { snapshots: { [connection.id]: { status: 'connected' } } },
      running: false,
      request,
      getDatabaseAdapter: () => adapter,
      message: Object.fromEntries(['error', 'info', 'success'].map((name) => [name, (value) => messages.push({ name, value })])),
      startRun: (id, initial) => {
        assert.equal(id, 'origin')
        results.push(initial)
        request.current = new AbortController()
        if (cancelAfter) timer = setTimeout(() => request.current?.abort(), cancelAfter)
        return request.current
      },
      finishRun: () => {
        finished = true
        request.current = null
        clearTimeout(timer)
      },
      executeQuery: async (id, input, signal) => {
        calls.push({ id, ...input })
        return api(`/connections/${id}/query`, input, signal)
      },
      setTabs: (update) => {
        pages = update(pages)
      },
      appendHistory: (item) => histories.push(item),
      publishResult: (id, result) => {
        assert.equal(id, 'origin')
        results.push(result)
      },
      setResultViews() {}
    }
    const execute = new Function(...Object.keys(dependencies), implementation + ';return executeSQL')(...Object.values(dependencies))
    await execute(script, scope, 'origin')
    assert.equal(pages[1].database, 'unchanged')
    if (calls.length) assert.ok(finished, 'execution must release its running state')
    return { calls, histories, results, messages, pages, batch: results.at(-1) }
  }
}

for (const type of ['mysql', 'postgresql']) {
  test(`${type}: real SQL window orchestration and HTTP execution`, { skip: !enabled, timeout: 90000 }, async (t) => {
    const name = 'sqldesk_window_' + randomUUID().replaceAll('-', '')
    const connection = await api('/connections', {
      name,
      group: 'SQL window integration',
      type,
      host: '127.0.0.1',
      port: type === 'mysql' ? 3306 : 5432,
      username: type === 'mysql' ? 'root' : 'postgres',
      password: process.env[type === 'mysql' ? 'SQLDESK_MYSQL_PASSWORD' : 'SQLDESK_PG_PASSWORD'],
      ...(type === 'postgresql' ? { database: 'postgres' } : {})
    })
    const quote = (value) => (type === 'mysql' ? '`' + value + '`' : '"' + value + '"')
    const root = { database: type === 'mysql' ? '' : 'postgres' }
    const scope = { connectionId: connection.id, database: type === 'mysql' ? name : 'postgres', schema: type === 'mysql' ? '' : name, table: '' }
    const query = (sql, extra = {}) => api(`/connections/${connection.id}/query`, { ...scope, connectionId: undefined, table: undefined, sql, ...extra })
    let created = false
    try {
      await api(`/connections/${connection.id}/query`, { ...root, sql: `CREATE ${type === 'mysql' ? 'DATABASE' : 'SCHEMA'} ${quote(name)}`, allowWrite: true })
      created = true
      await query('CREATE TABLE sample (id BIGINT PRIMARY KEY, label VARCHAR(100), amount DECIMAL(20,4))', { allowWrite: true })
      await query("INSERT INTO sample VALUES (1, '中文;one', 12.3400), (2, '', 0), (9007199254740993, NULL, -99.0001)", { allowWrite: true })
      await query(`CREATE TABLE ${quote('odd;table')} (id INT)`, { allowWrite: true })
      const run = windowRunner(connection, scope)
      const success = async (script, count = 1) => {
        const output = await run(script)
        assert.equal(output.calls.length, count)
        assert.equal(output.histories.length, count)
        assert.equal(output.batch.statements.length, count)
        assert.ok(
          output.histories.every((item) => item.ok),
          JSON.stringify(output.batch.statements.map(({ error }) => error))
        )
        assert.ok(output.calls.every((call) => call.id === connection.id && call.schema === (scope.schema || undefined)))
        assert.ok(output.batch.endedAt)
        return output.batch.statements.map((entry) => entry.result)
      }
      const cases = [
        ['constant', 'SELECT 1 AS n', (r) => assert.equal(r.rows[0][0], '1')],
        ['NULL and empty text', "SELECT NULL AS n, '' AS e, '中文😀;分号' AS text_value", (r) => assert.deepEqual(r.rows[0], [null, '', '中文😀;分号'])],
        ['exact BIGINT and decimal', 'SELECT id, amount FROM sample WHERE id=9007199254740993', (r) => assert.deepEqual(r.rows[0], ['9007199254740993', '-99.0001'])],
        [
          'duplicate column names',
          'SELECT id AS duplicate, amount AS duplicate FROM sample WHERE id=1',
          (r) => {
            assert.deepEqual(
              r.columns.map((c) => c.name),
              ['duplicate', 'duplicate']
            )
            assert.deepEqual(r.rows[0], ['1', '12.3400'])
          }
        ],
        [
          'empty result retains columns',
          'SELECT id, label FROM sample WHERE 1=0',
          (r) => {
            assert.equal(r.isQuery, true)
            assert.equal(r.rowCount, 0)
            assert.equal(r.columns.length, 2)
          }
        ],
        ['CTE', 'WITH chosen AS (SELECT id FROM sample WHERE id < 3) SELECT COUNT(*) AS n FROM chosen', (r) => assert.equal(r.rows[0][0], '2')],
        [
          'join and ordering',
          'SELECT a.id,b.label FROM sample a JOIN sample b ON a.id=b.id WHERE a.id<3 ORDER BY a.id DESC',
          (r) =>
            assert.deepEqual(r.rows, [
              ['2', ''],
              ['1', '中文;one']
            ])
        ],
        ['window function', 'SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS position FROM sample ORDER BY id', (r) => assert.equal(r.rows[2][1], '3')],
        ['aggregate', 'SELECT COUNT(*), MIN(amount), MAX(amount) FROM sample', (r) => assert.deepEqual(r.rows[0], ['3', '-99.0001', '12.3400'])],
        ['quoted identifier contains semicolon', `SELECT * FROM ${quote('odd;table')}`, (r) => assert.equal(r.rowCount, 0)],
        ['escaped quote', "SELECT 'it''s;SQL' AS value", (r) => assert.equal(r.rows[0][0], "it's;SQL")]
      ]
      for (const [label, sql, verify] of cases) await t.test(label, async () => verify((await success(sql))[0]))
      await t.test('multi-statement script preserves semicolons and comments', async () => {
        const results = await success("/* ; ignored */ SELECT 'a;b' AS v; -- ; ignored\nSELECT 2 AS n; SELECT 3 AS n;", 3)
        assert.deepEqual(
          results.map((r) => r.rows[0][0]),
          ['a;b', '2', '3']
        )
      })
      await t.test('SQL error stops later statements and retains the completed result', async () => {
        const output = await run('SELECT 11 AS kept; SELECT * FROM missing_window_table; SELECT 33 AS never_sent;')
        assert.equal(output.calls.length, 2)
        assert.equal(output.batch.statements[0].result.rows[0][0], '11')
        assert.match(output.batch.statements[1].error, /后续 1 条语句未执行/)
        assert.deepEqual(
          output.histories.map((h) => h.ok),
          [true, false]
        )
        assert.equal((await success('SELECT 44'))[0].rows[0][0], '44')
      })
      await t.test('incomplete script rejects the entire batch before sending SQL', async () => {
        const output = await run("SELECT 1; SELECT 'unclosed")
        assert.equal(output.calls.length, 0)
        assert.equal(output.histories.length, 0)
        assert.equal(output.messages[0].name, 'error')
      })
      await t.test('comments and whitespace send no requests', async () => {
        const output = await run(' ; -- comment\n /* empty */ ; ')
        assert.equal(output.calls.length, 0)
      })
      await t.test('cancellation stops the batch and permits the next run', async () => {
        const output = await run(type === 'mysql' ? 'SELECT SLEEP(3); SELECT 2;' : 'SELECT pg_sleep(3); SELECT 2;', 120)
        assert.equal(output.calls.length, 1)
        assert.match(output.batch.error, /请求已取消/)
        assert.match(output.batch.error, /后续 1 条语句未执行/)
        assert.equal(output.histories[0].ok, false)
        assert.equal((await success('SELECT 55'))[0].rows[0][0], '55')
      })
      await t.test('default and explicit row limits', async () => {
        const sql =
          type === 'postgresql'
            ? 'SELECT generate_series(1,1500) AS n'
            : 'WITH d AS (SELECT 0 AS n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) SELECT a.n FROM d a CROSS JOIN d b CROSS JOIN d c CROSS JOIN d e LIMIT 1500'
        const [result] = await success(sql)
        assert.equal(result.rowCount, 1000)
        assert.equal(result.truncated, true)
        const small = await query(sql, { limit: 5 })
        assert.equal(small.rowCount, 5)
        assert.equal(small.truncated, true)
      })
      if (type === 'mysql') {
        await t.test('USE changes only the originating page and subsequent request scope', async () => {
          const output = await run(`USE ${quote(name)}; SELECT DATABASE(); SELECT COUNT(*) FROM sample;`)
          assert.equal(output.calls.length, 3)
          assert.ok(
            output.histories.every((h) => h.ok),
            output.batch.error
          )
          assert.equal(output.pages[0].database, name)
          assert.equal(output.batch.statements[1].result.rows[0][0], name)
          assert.equal(output.batch.statements[2].result.rows[0][0], '3')
        })
        await t.test('Navicat-style setup, table recreation, inserts, updates and deletes execute in the window', async () => {
          const r = await success(
            "/* Navicat-style dump */ SET NAMES utf8mb4; SET FOREIGN_KEY_CHECKS=0; DROP TABLE IF EXISTS flow; CREATE TABLE flow(id BIGINT PRIMARY KEY,label VARCHAR(100),amount DECIMAL(20,4)); INSERT INTO flow VALUES(9007199254740993,'中文;one',12.3400),(2,'',0); SELECT * FROM flow ORDER BY id; UPDATE flow SET label='changed' WHERE id=2; DELETE FROM flow WHERE id=2; UPDATE flow SET label='none' WHERE id=2; SET FOREIGN_KEY_CHECKS=1; SELECT * FROM flow;",
            11
          )
          assert.equal(r[3].isQuery, false)
          assert.equal(r[4].affectedRows, 2)
          assert.deepEqual(r[5].rows, [
            ['2', '', '0.0000'],
            ['9007199254740993', '中文;one', '12.3400']
          ])
          assert.equal(r[6].affectedRows, 1)
          assert.equal(r[7].affectedRows, 1)
          assert.equal(r[8].affectedRows, 0)
          assert.deepEqual(r[10].rows, [['9007199254740993', '中文;one', '12.3400']])
        })
        await t.test('ALTER, RENAME, TRUNCATE, DROP and executable comments are not blocked', async () => {
          const r = await success(
            'ALTER TABLE flow ADD note TEXT; RENAME TABLE flow TO flow_renamed; TRUNCATE TABLE flow_renamed; SELECT COUNT(*) FROM flow_renamed; DROP TABLE flow_renamed; /*!80000 CREATE TABLE flow (id INT PRIMARY KEY,label VARCHAR(100)) */; SELECT COUNT(*) FROM flow;',
            7
          )
          assert.equal(r[3].rows[0][0], '0')
          assert.equal(r[6].rows[0][0], '0')
        })
        await t.test('committed writes before an error stay committed and later writes are not sent', async () => {
          const output = await run("INSERT INTO flow VALUES(10,'kept'); INSERT INTO flow VALUES(10,'duplicate'); INSERT INTO flow VALUES(11,'never');")
          assert.equal(output.calls.length, 2)
          assert.match(output.batch.error, /后续 1 条语句未执行/)
          assert.deepEqual((await success('SELECT * FROM flow'))[0].rows, [['10', 'kept']])
        })
        await t.test('default API read requests stay separate from explicit window runs', async () => {
          for (const sql of ['CREATE TABLE blocked(id INT)', 'DROP TABLE sample', "INSERT INTO sample VALUES(3,'blocked',1)", 'SET autocommit=1']) await assert.rejects(query(sql), /只读/)
          assert.equal((await success('SHOW COLUMNS FROM sample'))[0].rowCount, 3)
          assert.equal((await success('SELECT COUNT(*) FROM sample'))[0].rows[0][0], '3')
          assert.equal((await success("SELECT '/*! literal */' AS text_value"))[0].rows[0][0], '/*! literal */')
        })
        await t.test('binary and JSON', async () => {
          const [result] = await success("SELECT X'00FF' AS b, JSON_EXTRACT('{\"a\":2}', '$.a') AS j")
          assert.deepEqual(result.rows[0], ['0x00ff', '2'])
        })
      } else {
        await t.test('DDL, DML, RETURNING and zero-row write feedback', async () => {
          const r = await success(
            "CREATE TABLE flow (id INT PRIMARY KEY, label TEXT); INSERT INTO flow VALUES (1,'first') RETURNING id,label; UPDATE flow SET label='second' WHERE id=1 RETURNING label; DELETE FROM flow WHERE id=1 RETURNING id; UPDATE flow SET label='none'; SELECT COUNT(*) FROM flow;",
            6
          )
          assert.equal(r[0].isQuery, false)
          assert.deepEqual(r[1].rows[0], ['1', 'first'])
          assert.deepEqual(r[2].rows[0], ['second'])
          assert.deepEqual(r[3].rows[0], ['1'])
          assert.equal(r[4].isQuery, false)
          assert.equal(r[4].affectedRows, 0)
          assert.equal(r[5].rows[0][0], '0')
        })
        await t.test('committed writes before an error remain committed; later writes do not run', async () => {
          const output = await run("INSERT INTO flow VALUES (10,'kept'); INSERT INTO flow VALUES (10,'duplicate'); INSERT INTO flow VALUES (11,'never');")
          assert.equal(output.calls.length, 2)
          assert.match(output.batch.error, /后续 1 条语句未执行/)
          assert.deepEqual((await success('SELECT id,label FROM flow ORDER BY id'))[0].rows, [['10', 'kept']])
        })
        await t.test('dollar bodies, nested comments and E strings', async () => {
          const r = await success("DO $body$ BEGIN RAISE NOTICE 'inside;body'; END $body$; /* outer /* inner ; */ still */ SELECT $tag$a;b$tag$ AS v; SELECT E'line\\nnext;end' AS v;", 3)
          assert.equal(r[0].isQuery, false)
          assert.equal(r[1].rows[0][0], 'a;b')
          assert.equal(r[2].rows[0][0], 'line\nnext;end')
        })
        await t.test('BYTEA, JSONB, booleans and schema search path', async () => {
          const [result] = await success("SELECT decode('00ff','hex'), '{\"a\":2}'::jsonb ->> 'a', true, current_schema()")
          assert.deepEqual(result.rows[0], ['\\x00ff', '2', true, name])
        })
        await t.test('API remains read-only unless explicitly enabled', async () => {
          await assert.rejects(query("INSERT INTO flow VALUES (12,'blocked')"), /read.only|只读/i)
        })
      }
      await t.test('API rejects multiple statements in one request', async () => {
        await assert.rejects(query('SELECT 1; SELECT 2', { allowWrite: true }))
      })
    } finally {
      if (created)
        await api(`/connections/${connection.id}/query`, {
          ...root,
          sql: `DROP ${type === 'mysql' ? 'DATABASE' : 'SCHEMA'} ${quote(name)}${type === 'postgresql' ? ' CASCADE' : ''}`,
          allowWrite: true
        })
      await api(`/connections/${connection.id}`, undefined, undefined, 'DELETE')
    }
  })
}
