-- 以 SQL*Plus 管理员会话执行。Oracle Free / XE 镜像预置应用 PDB。
-- 为该 PDB 新建 SQL_STUDIO_DEMO 用户和同名 Schema，填充订单样例。
WHENEVER OSERROR EXIT FAILURE ROLLBACK
WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
SET SQLBLANKLINES ON

COLUMN fixture_pdb NEW_VALUE fixture_pdb NOPRINT
SELECT MAX(name) AS fixture_pdb FROM v$pdbs WHERE name IN ('FREEPDB1', 'XEPDB1');
ALTER SESSION SET CONTAINER = &fixture_pdb;
SET DEFINE OFF

CREATE USER sql_studio_demo IDENTIFIED BY "00000000"
  DEFAULT TABLESPACE users QUOTA UNLIMITED ON users;
GRANT CREATE SESSION, CREATE TABLE, CREATE VIEW, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO sql_studio_demo;
ALTER SESSION SET CURRENT_SCHEMA = sql_studio_demo;

CREATE TABLE customers (
  id NUMBER(38,0) PRIMARY KEY,
  name VARCHAR2(80 CHAR) NOT NULL,
  email VARCHAR2(160 CHAR) NOT NULL UNIQUE,
  city VARCHAR2(40 CHAR) NOT NULL,
  balance NUMBER(14,2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP NOT NULL,
  notes CLOB
);
CREATE INDEX idx_customers_city ON customers (city);

CREATE TABLE products (
  id NUMBER(38,0) PRIMARY KEY,
  sku VARCHAR2(32 CHAR) NOT NULL UNIQUE,
  name VARCHAR2(100 CHAR) NOT NULL,
  category VARCHAR2(40 CHAR) NOT NULL,
  price NUMBER(12,2) NOT NULL,
  stock NUMBER(10,0) NOT NULL,
  attributes CLOB NOT NULL CHECK (attributes IS JSON),
  product_token RAW(16)
);
CREATE INDEX idx_products_category_price ON products (category, price);

CREATE TABLE orders (
  id NUMBER(38,0) PRIMARY KEY,
  order_no VARCHAR2(32 CHAR) NOT NULL UNIQUE,
  customer_id NUMBER(38,0) NOT NULL CONSTRAINT fk_orders_customer REFERENCES customers (id),
  status VARCHAR2(20 CHAR) NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'completed', 'cancelled')),
  total_amount NUMBER(14,2) DEFAULT 0 NOT NULL,
  created_at TIMESTAMP NOT NULL,
  remark VARCHAR2(255 CHAR)
);
CREATE INDEX idx_orders_customer_created ON orders (customer_id, created_at);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

CREATE TABLE order_items (
  id NUMBER(38,0) PRIMARY KEY,
  order_id NUMBER(38,0) NOT NULL CONSTRAINT fk_items_order REFERENCES orders (id),
  product_id NUMBER(38,0) NOT NULL CONSTRAINT fk_items_product REFERENCES products (id),
  quantity NUMBER(10,0) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  subtotal NUMBER(14,2) GENERATED ALWAYS AS (quantity * unit_price) VIRTUAL
);
CREATE INDEX idx_order_items_order ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);

INSERT INTO customers (id, name, email, city, balance, created_at, notes)
SELECT n,
       CASE n WHEN 1 THEN '演示客户 张三' WHEN 2 THEN '演示客户 李四'
         WHEN 3 THEN '演示客户 O''Reilly' ELSE '测试客户 ' || LPAD(n, 5, '0') END,
       'customer' || LPAD(n, 5, '0') || '@example.test',
       DECODE(MOD(n - 1, 5), 0, '杭州', 1, '上海', 2, '北京', 3, '深圳', '成都'),
       MOD(n * 7919, 100000) / 100,
       TIMESTAMP '2025-01-01 00:00:00' + NUMTODSINTERVAL(n, 'MINUTE'),
       CASE WHEN n = 3 THEN '中文、emoji 😀、逗号,及分号;测试'
         WHEN MOD(n, 3) = 0 THEN NULL ELSE '虚构 demo 数据' END
FROM (SELECT LEVEL AS n FROM dual CONNECT BY LEVEL <= 1000);

INSERT INTO products (id, sku, name, category, price, stock, attributes, product_token)
SELECT n, 'SKU-' || LPAD(n, 5, '0'), '测试商品 ' || LPAD(n, 3, '0'),
       DECODE(MOD(n - 1, 5), 0, '数码', 1, '办公', 2, '家居', 3, '运动', '图书'),
       (990 + MOD(n * 137, 100000)) / 100, MOD(n * 31, 1000),
       JSON_OBJECT('brand' VALUE 'Demo', 'featured' VALUE MOD(n, 10), 'category' VALUE '测试' RETURNING CLOB),
       CASE WHEN MOD(n, 5) = 0 THEN NULL ELSE HEXTORAW('00FF' || LPAD(n, 4, '0')) END
FROM (SELECT LEVEL AS n FROM dual CONNECT BY LEVEL <= 100);

INSERT INTO orders (id, order_no, customer_id, status, created_at, remark)
SELECT n, 'DEMO-2026-' || LPAD(n, 8, '0'), 1 + MOD(n - 1, 1000),
       DECODE(MOD(n + FLOOR((n - 1) / 1000), 5),
         0, 'pending', 1, 'paid', 2, 'shipped', 3, 'completed', 'cancelled'),
       TIMESTAMP '2026-01-01 08:00:00' + NUMTODSINTERVAL(n, 'MINUTE'),
       CASE WHEN MOD(n, 3) = 0 THEN NULL ELSE '演示订单，请勿发货 😀' END
FROM (SELECT LEVEL AS n FROM dual CONNECT BY LEVEL <= 5000);

INSERT INTO order_items (id, order_id, product_id, quantity, unit_price)
SELECT s.n, 1 + FLOOR((s.n - 1) / 3), p.id, 1 + MOD(s.n, 5), p.price
FROM (SELECT LEVEL AS n FROM dual CONNECT BY LEVEL <= 15000) s
JOIN products p ON p.id = 1 + MOD(s.n * 7, 100);

MERGE INTO orders o
USING (SELECT order_id, SUM(subtotal) AS amount FROM order_items GROUP BY order_id) i
ON (i.order_id = o.id)
WHEN MATCHED THEN UPDATE SET o.total_amount = i.amount;
COMMIT;

CREATE VIEW v_order_summary AS
SELECT o.order_no, c.name AS customer_name, o.status, o.total_amount, o.created_at
FROM orders o JOIN customers c ON c.id = o.customer_id;

SELECT 'CUSTOMERS' AS table_name, 1000 AS expected_rows, COUNT(*) AS actual_rows FROM customers
UNION ALL SELECT 'PRODUCTS', 100, COUNT(*) FROM products
UNION ALL SELECT 'ORDERS', 5000, COUNT(*) FROM orders
UNION ALL SELECT 'ORDER_ITEMS', 15000, COUNT(*) FROM order_items;

SELECT COUNT(*) AS problem_count
FROM orders o
LEFT JOIN (SELECT order_id, COUNT(*) AS line_count, SUM(subtotal) AS amount FROM order_items GROUP BY order_id) i
  ON i.order_id = o.id
WHERE i.order_id IS NULL OR i.line_count <> 3 OR i.amount <> o.total_amount;
