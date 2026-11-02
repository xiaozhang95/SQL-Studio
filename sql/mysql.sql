-- MySQL 8.0 / 8.4 完整 demo：创建 sql_studio_demo 库、4 张业务表、插入 21,100 行数据。
-- 执行（仓库根目录）：
-- mysql --host=127.0.0.1 --port=3306 --user=root --password --default-character-set=utf8mb4 < sql/mysql.sql
-- 需要建库权限；库已存在时停止，避免覆盖已有内容；不要使用客户端 --force 参数。
-- 全部数据为虚构，所有日期固定；没有 DROP DATABASE、TRUNCATE 或覆盖已有数据的操作。
-- 批量插入包括多行 INSERT ... VALUES 和 INSERT ... SELECT。
-- 完成后 customers=1000、products=100、orders=5000、order_items=15000。

-- 1. 建库和建表。完整限定库名，不依赖 USE 或跨语句会话状态。
CREATE DATABASE `sql_studio_demo`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sql_studio_demo`.`customers` (
  `id` BIGINT NOT NULL PRIMARY KEY,
  `name` VARCHAR(80) NOT NULL,
  `email` VARCHAR(160) NOT NULL UNIQUE,
  `city` VARCHAR(40) NOT NULL,
  `balance` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `notes` TEXT NULL,
  KEY `idx_customers_city` (`city`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sql_studio_demo`.`products` (
  `id` BIGINT NOT NULL PRIMARY KEY,
  `sku` VARCHAR(32) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `category` VARCHAR(40) NOT NULL,
  `price` DECIMAL(12,2) NOT NULL,
  `stock` INT NOT NULL,
  `attributes` JSON NOT NULL,
  KEY `idx_products_category_price` (`category`, `price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sql_studio_demo`.`orders` (
  `id` BIGINT NOT NULL PRIMARY KEY,
  `order_no` VARCHAR(32) NOT NULL UNIQUE,
  `customer_id` BIGINT NOT NULL,
  `status` ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') NOT NULL,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL,
  `remark` VARCHAR(255) NULL,
  KEY `idx_orders_customer_created` (`customer_id`, `created_at`),
  KEY `idx_orders_status_created` (`status`, `created_at`),
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `sql_studio_demo`.`customers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sql_studio_demo`.`order_items` (
  `id` BIGINT NOT NULL PRIMARY KEY,
  `order_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_price` DECIMAL(12,2) NOT NULL,
  `subtotal` DECIMAL(14,2) GENERATED ALWAYS AS (`quantity` * `unit_price`) STORED,
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  CONSTRAINT `fk_items_order` FOREIGN KEY (`order_id`)
    REFERENCES `sql_studio_demo`.`orders` (`id`),
  CONSTRAINT `fk_items_product` FOREIGN KEY (`product_id`)
    REFERENCES `sql_studio_demo`.`products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 辅助数字表：无需递归 CTE、存储过程或 DELIMITER；数据生成后删除。
CREATE TABLE `sql_studio_demo`.`demo_digits` (`n` INT NOT NULL PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO `sql_studio_demo`.`demo_digits` (`n`) VALUES
  (0), (1), (2), (3), (4), (5), (6), (7), (8), (9);

CREATE TABLE `sql_studio_demo`.`demo_numbers` (`n` INT NOT NULL PRIMARY KEY) ENGINE=InnoDB;
INSERT INTO `sql_studio_demo`.`demo_numbers` (`n`)
SELECT 1 + a.`n` + 10*b.`n` + 100*c.`n` + 1000*d.`n` + 10000*e.`n`
FROM `sql_studio_demo`.`demo_digits` AS a
CROSS JOIN `sql_studio_demo`.`demo_digits` AS b
CROSS JOIN `sql_studio_demo`.`demo_digits` AS c
CROSS JOIN `sql_studio_demo`.`demo_digits` AS d
CROSS JOIN `sql_studio_demo`.`demo_digits` AS e
WHERE a.`n` + 10*b.`n` + 100*c.`n` + 1000*d.`n` + 10000*e.`n` < 15000;

-- 3. 多行 VALUES 示例，再批量补足 1,000 个客户。
INSERT INTO `sql_studio_demo`.`customers`
  (`id`, `name`, `email`, `city`, `balance`, `created_at`, `notes`)
VALUES
  (1, '演示客户 张三', 'customer00001@example.test', '杭州', 100.50, '2025-01-01 00:01:00', '普通 demo 客户'),
  (2, '演示客户 李四', 'customer00002@example.test', '上海', 200.00, '2025-01-01 00:02:00', NULL),
  (3, '演示客户 O''Reilly', 'customer00003@example.test', '北京', 0.00, '2025-01-01 00:03:00', '中文、emoji 😀、逗号,及分号;测试');

INSERT INTO `sql_studio_demo`.`customers`
  (`id`, `name`, `email`, `city`, `balance`, `created_at`, `notes`)
SELECT n, CONCAT('测试客户 ', LPAD(n, 5, '0')),
       CONCAT('customer', LPAD(n, 5, '0'), '@example.test'),
       ELT(1 + MOD(n-1, 5), '杭州', '上海', '北京', '深圳', '成都'),
       MOD(n*7919, 100000)/100.00,
       DATE_ADD('2025-01-01 00:00:00', INTERVAL n MINUTE),
       CASE WHEN MOD(n, 3)=0 THEN NULL WHEN MOD(n, 3)=1 THEN '' ELSE '虚构 demo 数据' END
FROM `sql_studio_demo`.`demo_numbers` WHERE n BETWEEN 4 AND 1000;

-- 4. 批量插入 100 件商品，包含 JSON 字段。
INSERT INTO `sql_studio_demo`.`products`
  (`id`, `sku`, `name`, `category`, `price`, `stock`, `attributes`)
SELECT n, CONCAT('SKU-', LPAD(n, 5, '0')), CONCAT('测试商品 ', LPAD(n, 3, '0')),
       ELT(1 + MOD(n-1, 5), '数码', '办公', '家居', '运动', '图书'),
       (990 + MOD(n*137, 100000))/100.00, MOD(n*31, 1000),
       JSON_OBJECT('brand', 'Demo', 'featured', MOD(n, 10)=0,
                   'tags', JSON_ARRAY('测试', '中文'))
FROM `sql_studio_demo`.`demo_numbers` WHERE n <= 100;

-- 5. 批量插入 5,000 条订单，五种状态各 1,000 条。
INSERT INTO `sql_studio_demo`.`orders`
  (`id`, `order_no`, `customer_id`, `status`, `total_amount`, `created_at`, `remark`)
SELECT n, CONCAT('DEMO-2026-', LPAD(n, 8, '0')), 1 + MOD(n-1, 1000),
       ELT(1 + MOD(n + FLOOR((n-1)/1000), 5), 'pending', 'paid', 'shipped', 'completed', 'cancelled'),
       0.00, DATE_ADD('2026-01-01 08:00:00', INTERVAL n MINUTE),
       CASE WHEN MOD(n, 3)=0 THEN NULL WHEN MOD(n, 3)=1 THEN '' ELSE '演示订单，请勿发货 😀' END
FROM `sql_studio_demo`.`demo_numbers` WHERE n <= 5000;

-- 6. 一条 INSERT ... SELECT 批量插入 15,000 条明细，每订单 3 条。
INSERT INTO `sql_studio_demo`.`order_items`
  (`id`, `order_id`, `product_id`, `quantity`, `unit_price`)
SELECT s.n, 1 + FLOOR((s.n-1)/3), p.`id`, 1 + MOD(s.n, 5), p.`price`
FROM `sql_studio_demo`.`demo_numbers` AS s
JOIN `sql_studio_demo`.`products` AS p ON p.`id` = 1 + MOD(s.n*7, 100)
WHERE s.n <= 15000;

-- 7. 让订单总额与明细金额严格一致；只操作新建 demo 库。
UPDATE `sql_studio_demo`.`orders` AS o
JOIN (
  SELECT `order_id`, SUM(`subtotal`) AS `amount`
  FROM `sql_studio_demo`.`order_items` GROUP BY `order_id`
) AS i ON i.`order_id` = o.`id`
SET o.`total_amount` = i.`amount`;

-- 删除本脚本创建的两个辅助表，最终只保留 4 张业务表。
DROP TABLE `sql_studio_demo`.`demo_numbers`;
DROP TABLE `sql_studio_demo`.`demo_digits`;

-- 8. 自动展示校验结果：passed 应全部为 1，problem_count 应为 0。
SELECT 'customers' AS `table_name`, 1000 AS `expected_rows`, COUNT(*) AS `actual_rows`, COUNT(*)=1000 AS `passed`
FROM `sql_studio_demo`.`customers`
UNION ALL SELECT 'products', 100, COUNT(*), COUNT(*)=100 FROM `sql_studio_demo`.`products`
UNION ALL SELECT 'orders', 5000, COUNT(*), COUNT(*)=5000 FROM `sql_studio_demo`.`orders`
UNION ALL SELECT 'order_items', 15000, COUNT(*), COUNT(*)=15000 FROM `sql_studio_demo`.`order_items`;

SELECT COUNT(*) AS `problem_count`
FROM `sql_studio_demo`.`orders` AS o
LEFT JOIN (
  SELECT `order_id`, COUNT(*) AS `line_count`, SUM(`subtotal`) AS `amount`
  FROM `sql_studio_demo`.`order_items` GROUP BY `order_id`
) AS i ON i.`order_id` = o.`id`
WHERE i.`order_id` IS NULL OR i.`line_count` <> 3 OR i.`amount` <> o.`total_amount`;

-- demo 查询：最近 10 条订单与客户信息。
SELECT o.`order_no`, c.`name` AS `customer_name`, o.`status`, o.`total_amount`, o.`created_at`
FROM `sql_studio_demo`.`orders` AS o
JOIN `sql_studio_demo`.`customers` AS c ON c.`id` = o.`customer_id`
ORDER BY o.`id` DESC LIMIT 10;
