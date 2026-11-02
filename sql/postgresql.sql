-- PostgreSQL 12+ / PolarDB PostgreSQL 完整 demo。
-- 执行（仓库根目录）：
-- psql -X --host=127.0.0.1 --port=5432 --username=postgres --dbname=postgres --file=sql/postgresql.sql
-- 密码由 psql 按需提示，不写入文件；需要 CREATEDB 权限。
-- 本文件由 psql 执行，含 \connect 客户端命令；不能整份作为普通 SQL 发给服务端。
-- 不要使用 --single-transaction：CREATE DATABASE 不能在事务中执行。
-- sql_studio_demo 已存在时立即停止，不删除或覆盖原库。
-- 执行完成后保留 4 张表、21,100 行；全部数据虚构，日期固定。
-- psql 文档：https://www.postgresql.org/docs/current/app-psql.html

\set ON_ERROR_STOP on

-- 1. 建库，然后由 psql 自动连接新库。
CREATE DATABASE sql_studio_demo WITH ENCODING 'UTF8' TEMPLATE template0;
\connect sql_studio_demo
\encoding UTF8

-- 2. 表结构和数据在同一个事务中创建。
BEGIN;

CREATE TABLE public.customers (
  id BIGINT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  city VARCHAR(40) NOT NULL,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL,
  notes TEXT NULL
);
CREATE INDEX idx_customers_city ON public.customers (city);

CREATE TABLE public.products (
  id BIGINT PRIMARY KEY,
  sku VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(40) NOT NULL,
  price NUMERIC(12,2) NOT NULL,
  stock INTEGER NOT NULL,
  attributes JSONB NOT NULL
);
CREATE INDEX idx_products_category_price ON public.products (category, price);

CREATE TABLE public.orders (
  id BIGINT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES public.customers (id),
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('pending', 'paid', 'shipped', 'completed', 'cancelled')),
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL,
  remark VARCHAR(255) NULL
);
CREATE INDEX idx_orders_customer_created ON public.orders (customer_id, created_at);
CREATE INDEX idx_orders_status_created ON public.orders (status, created_at);

CREATE TABLE public.order_items (
  id BIGINT PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES public.orders (id),
  product_id BIGINT NOT NULL REFERENCES public.products (id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);
CREATE INDEX idx_order_items_order ON public.order_items (order_id);
CREATE INDEX idx_order_items_product ON public.order_items (product_id);

-- 3. 多行 VALUES 示例，再用 generate_series 批量补足 1,000 个客户。
INSERT INTO public.customers (id, name, email, city, balance, created_at, notes)
VALUES
  (1, '演示客户 张三', 'customer00001@example.test', '杭州', 100.50, '2025-01-01 00:01:00', '普通 demo 客户'),
  (2, '演示客户 李四', 'customer00002@example.test', '上海', 200.00, '2025-01-01 00:02:00', NULL),
  (3, '演示客户 O''Reilly', 'customer00003@example.test', '北京', 0.00, '2025-01-01 00:03:00', '中文、emoji 😀、逗号,及分号;测试');

INSERT INTO public.customers (id, name, email, city, balance, created_at, notes)
SELECT n, '测试客户 ' || LPAD(n::TEXT, 5, '0'),
       'customer' || LPAD(n::TEXT, 5, '0') || '@example.test',
       (ARRAY['杭州', '上海', '北京', '深圳', '成都'])[1 + MOD(n-1, 5)],
       MOD(n*7919, 100000)/100.00,
       TIMESTAMP '2025-01-01 00:00:00' + n * INTERVAL '1 minute',
       CASE WHEN MOD(n, 3)=0 THEN NULL WHEN MOD(n, 3)=1 THEN '' ELSE '虚构 demo 数据' END
FROM generate_series(4, 1000) AS s(n);

-- 4. 批量插入 100 件商品，使用 PostgreSQL JSONB。
INSERT INTO public.products (id, sku, name, category, price, stock, attributes)
SELECT n, 'SKU-' || LPAD(n::TEXT, 5, '0'), '测试商品 ' || LPAD(n::TEXT, 3, '0'),
       (ARRAY['数码', '办公', '家居', '运动', '图书'])[1 + MOD(n-1, 5)],
       (990 + MOD(n*137, 100000))/100.00, MOD(n*31, 1000),
       jsonb_build_object('brand', 'Demo', 'featured', MOD(n, 10)=0,
                          'tags', jsonb_build_array('测试', '中文'))
FROM generate_series(1, 100) AS s(n);

-- 5. 批量插入 5,000 条订单，五种状态各 1,000 条。
INSERT INTO public.orders (id, order_no, customer_id, status, total_amount, created_at, remark)
SELECT n, 'DEMO-2026-' || LPAD(n::TEXT, 8, '0'), 1 + MOD(n-1, 1000),
       (ARRAY['pending', 'paid', 'shipped', 'completed', 'cancelled'])[1 + MOD(n + (n-1)/1000, 5)],
       0.00, TIMESTAMP '2026-01-01 08:00:00' + n * INTERVAL '1 minute',
       CASE WHEN MOD(n, 3)=0 THEN NULL WHEN MOD(n, 3)=1 THEN '' ELSE '演示订单，请勿发货 😀' END
FROM generate_series(1, 5000) AS s(n);

-- 6. 一条 INSERT ... SELECT 批量插入 15,000 条明细，每订单 3 条。
INSERT INTO public.order_items (id, order_id, product_id, quantity, unit_price)
SELECT s.n, 1 + (s.n-1)/3, p.id, 1 + MOD(s.n, 5), p.price
FROM generate_series(1, 15000) AS s(n)
JOIN public.products AS p ON p.id = 1 + MOD(s.n*7, 100);

-- 7. 让订单总额与明细金额严格一致。
UPDATE public.orders AS o
SET total_amount = i.amount
FROM (
  SELECT order_id, SUM(subtotal) AS amount
  FROM public.order_items GROUP BY order_id
) AS i
WHERE i.order_id = o.id;

COMMIT;

-- 8. 自动展示校验结果：passed 应全部为 true，problem_count 应为 0。
SELECT 'customers' AS table_name, 1000 AS expected_rows, COUNT(*) AS actual_rows, COUNT(*)=1000 AS passed
FROM public.customers
UNION ALL SELECT 'products', 100, COUNT(*), COUNT(*)=100 FROM public.products
UNION ALL SELECT 'orders', 5000, COUNT(*), COUNT(*)=5000 FROM public.orders
UNION ALL SELECT 'order_items', 15000, COUNT(*), COUNT(*)=15000 FROM public.order_items;

SELECT COUNT(*) AS problem_count
FROM public.orders AS o
LEFT JOIN (
  SELECT order_id, COUNT(*) AS line_count, SUM(subtotal) AS amount
  FROM public.order_items GROUP BY order_id
) AS i ON i.order_id = o.id
WHERE i.order_id IS NULL OR i.line_count <> 3 OR i.amount <> o.total_amount;

-- demo 查询：最近 10 条订单与客户信息。
SELECT o.order_no, c.name AS customer_name, o.status, o.total_amount, o.created_at
FROM public.orders AS o
JOIN public.customers AS c ON c.id = o.customer_id
ORDER BY o.id DESC LIMIT 10;
