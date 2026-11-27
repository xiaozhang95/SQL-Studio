-- 使用 MySQL 协议执行，默认账号 sqlstudio。
CREATE DATABASE IF NOT EXISTS sql_studio_demo;
USE sql_studio_demo;

CREATE TABLE IF NOT EXISTS device_metrics (
  sampled_at TIMESTAMP(3) NOT NULL TIME INDEX,
  device_id STRING NOT NULL,
  site STRING NOT NULL,
  temperature DOUBLE,
  humidity DOUBLE,
  battery_percent INT,
  PRIMARY KEY (device_id, site)
) ENGINE=mito;

CREATE TABLE IF NOT EXISTS device_events (
  occurred_at TIMESTAMP(3) NOT NULL TIME INDEX,
  device_id STRING NOT NULL,
  severity STRING NOT NULL,
  event_message STRING,
  PRIMARY KEY (device_id, severity)
) ENGINE=mito;

INSERT INTO device_metrics (sampled_at, device_id, site, temperature, humidity, battery_percent) VALUES
  ('2026-01-01 08:00:00.000', 'alpha', '杭州', 21.5, 53.0, 98),
  ('2026-01-01 08:01:00.000', 'alpha', '杭州', 21.8, 53.3, 97),
  ('2026-01-01 08:02:00.000', 'alpha', '杭州', 22.1, NULL, 97),
  ('2026-01-01 08:03:00.000', 'alpha', '杭州', 22.4, 54.1, 96),
  ('2026-01-01 08:00:00.000', 'beta', '上海', 26.7, 60.0, 45),
  ('2026-01-01 08:01:00.000', 'beta', '上海', 27.1, 60.7, 44),
  ('2026-01-01 08:02:00.000', 'beta', '上海', 28.4, 61.0, 43),
  ('2026-01-01 08:03:00.000', 'beta', '上海', 28.0, 60.8, 43);

INSERT INTO device_events (occurred_at, device_id, severity, event_message) VALUES
  ('2026-01-01 08:00:00.100', 'alpha', 'info', '设备已启动'),
  ('2026-01-01 08:02:00.120', 'alpha', 'warning', '湿度采样缺失'),
  ('2026-01-01 08:00:00.200', 'beta', 'info', '设备已启动'),
  ('2026-01-01 08:02:00.300', 'beta', 'warning', '温度高于示例阈值');

CREATE VIEW IF NOT EXISTS v_device_summary AS
SELECT device_id, site, COUNT(*) AS samples, AVG(temperature) AS avg_temperature,
       MAX(sampled_at) AS last_sample
FROM device_metrics
GROUP BY device_id, site;

SELECT * FROM v_device_summary ORDER BY device_id;
