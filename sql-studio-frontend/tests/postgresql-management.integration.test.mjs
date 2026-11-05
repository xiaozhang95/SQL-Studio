import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { metadataSQL as databaseSQL, definition, sql as editSQL } from '../src/databases/postgresql/databaseProperties/index.ts'
import { dump, metadataSQL, querySQL } from '../src/databases/postgresql/dataDump/index.ts'
import { splitPostgreSQLStatements } from '../src/databases/postgresql/statements/index.ts'
import { step } from './integration-steps.mjs'

test('real PostgreSQL database edits and structure/data export restore into another database', { skip: process.env.SQLDESK_SQL_WINDOW_INTEGRATION !== '1', timeout: 120000 }, async (t) => {
  const base = process.env.SQLDESK_TEST_API || 'http://127.0.0.1:18080/api'
  const api = async (path, body, method = body ? 'POST' : 'GET') => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
    const d = await r.json()
    if (!r.ok) throw new Error(d.error)
    return d
  }
  const suffix = randomUUID().replaceAll('-', ''),
    source = 'sqldesk_feature_src_' + suffix,
    destination = 'sqldesk_feature_dst_' + suffix
  const connection = await api('/connections', {
    name: 'PostgreSQL feature regression ' + suffix,
    type: 'postgresql',
    host: '127.0.0.1',
    port: 5432,
    username: 'postgres',
    password: process.env.SQLDESK_PG_PASSWORD,
    database: 'postgres'
  })
  const query = (database, sql, allowWrite = false) => api(`/connections/${connection.id}/query`, { database, sql, allowWrite, limit: 5000 })
  const created = []
  try {
    for (const name of [source, destination]) {
      await query('postgres', `CREATE DATABASE "${name}"`, true)
      created.push(name)
    }
    await step(t, 'load/edit database connection limit and comments, reject stale preview', async () => {
      const original = definition(await query('postgres', databaseSQL(source)))
      assert.equal(original.name, source)
      const values = { name: source, charset: '', collation: '', fields: [], confirmation: '', owner: original.owner, connectionLimit: 37, comment: "回归';\\$sql_studio_database$" }
      const statement = editSQL(source, values, original)
      await query('postgres', statement, true)
      const updated = definition(await query('postgres', databaseSQL(source)))
      assert.equal(updated.connectionLimit, 37)
      assert.equal(updated.comment, values.comment)
      await assert.rejects(query('postgres', statement, true), /属性已变化/)
      await query('postgres', editSQL(source, { ...values, connectionLimit: -1, comment: '' }, updated), true)
      assert.equal(definition(await query('postgres', databaseSQL(source))).comment, '')
    })
    await step(t, 'invalid owner rolls back the other property changes in the same transaction', async () => {
      const original = definition(await query('postgres', databaseSQL(source)))
      const values = { name: source, charset: '', collation: '', fields: [], confirmation: '', owner: 'missing_role_' + suffix, connectionLimit: 7, comment: 'must roll back' }
      await assert.rejects(query('postgres', editSQL(source, values, original), true), /role|角色/i)
      assert.deepEqual(definition(await query('postgres', databaseSQL(source))), original)
    })
    const table = '"s.quote"."sample;data"'
    await query(source, 'CREATE SCHEMA "s.quote"', true)
    await query(
      source,
      `CREATE TABLE ${table} (id bigserial PRIMARY KEY, identity_id bigint GENERATED ALWAYS AS IDENTITY (START WITH 10 INCREMENT BY 3), big_value bigint, amount numeric(30,6), payload bytea, doc jsonb, tags text[], active boolean, occurred timestamptz, empty_text text, missing_text text, calc numeric GENERATED ALWAYS AS (amount*2) STORED)`,
      true
    )
    await query(
      source,
      `INSERT INTO ${table} (big_value,amount,payload,doc,tags,active,occurred,empty_text,missing_text) VALUES (9007199254740993,12345678901234567890.123456,decode('00ff','hex'),' {"a":"中文;quote''"}',ARRAY['a','中',NULL],true,'2026-10-28 01:02:03+08','',NULL),(2,-0.000001,decode('','hex'),'{}',ARRAY[]::text[],false,'2026-01-01 00:00:00+00','second',NULL)`,
      true
    )
    let output = ''
    await step(t, 'export SERIAL/IDENTITY/generated columns, precise values and restore elsewhere', async () => {
      const parameters = new URLSearchParams({ database: source, table })
      const ddl = await api(`/connections/${connection.id}/ddl?${parameters}`)
      const columns = await api(`/connections/${connection.id}/columns?${parameters}`)
      const data = await query(source, querySQL(source, table))
      const metadata = await query(source, metadataSQL(source, table))
      output = dump(source, table, ddl.ddl, data, columns, metadata)
      for (const statement of splitPostgreSQLStatements(output)) await query(destination, statement, true)
      const before = await query(source, `SELECT * FROM ${table} ORDER BY id`),
        after = await query(destination, `SELECT * FROM ${table} ORDER BY id`)
      assert.deepEqual(after.rows, before.rows)
      assert.deepEqual(after.columns, before.columns)
      const inserted = await query(destination, `INSERT INTO ${table}(amount) VALUES(2) RETURNING id,identity_id,calc`, true)
      assert.deepEqual(inserted.rows[0], ['3', '16', '4.000000'])
    })
    await step(t, 'zero-row and no-sequence tables remain restorable', async () => {
      await query(source, 'CREATE TABLE "s.quote".empty_table (v text)', true)
      const target = '"s.quote"."empty_table"',
        parameters = new URLSearchParams({ database: source, table: target })
      const ddl = await api(`/connections/${connection.id}/ddl?${parameters}`),
        columns = await api(`/connections/${connection.id}/columns?${parameters}`)
      const sql = dump(source, target, ddl.ddl, await query(source, querySQL(source, target)), columns, await query(source, metadataSQL(source, target)))
      for (const statement of splitPostgreSQLStatements(sql)) await query(destination, statement, true)
      assert.equal((await query(destination, 'SELECT * FROM "s.quote".empty_table')).rowCount, 0)
    })
    assert.ok(output)
  } finally {
    for (const name of created.reverse()) await query('postgres', `DROP DATABASE "${name}"`, true)
    await api(`/connections/${connection.id}`, undefined, 'DELETE')
  }
})
