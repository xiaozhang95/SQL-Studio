-- 用 redis-cli --eval init.lua 在目标逻辑库中创建虚构样例。
local prefix = "sqlstudio:demo:"
local marker = prefix .. "initialized"

if redis.call("EXISTS", marker) == 1 then
  return "already-initialized"
end

redis.call("SET", prefix .. "greeting", "你好，SQL Studio 😀", "NX")
redis.call("SET", prefix .. "visits", "42", "NX")
redis.call("SET", prefix .. "temporary", "这条样例带有 TTL", "EX", 86400, "NX")

local profile = prefix .. "customer:1001"
redis.call("HSETNX", profile, "name", "演示客户 张三")
redis.call("HSETNX", profile, "city", "杭州")
redis.call("HSETNX", profile, "status", "active")

local queue = prefix .. "order-queue"
if redis.call("EXISTS", queue) == 0 then
  redis.call("RPUSH", queue, "DEMO-2026-0001", "DEMO-2026-0002", "DEMO-2026-0003")
end

redis.call("SADD", prefix .. "cities", "杭州", "上海", "北京")
redis.call("ZADD", prefix .. "ranking", "NX", 98.5, "alpha", 84.0, "beta", 76.5, "gamma")

local events = prefix .. "order-events"
if redis.call("EXISTS", events) == 0 then
  redis.call("XADD", events, "1767225600000-0", "order", "DEMO-2026-0001", "status", "created")
  redis.call("XADD", events, "1767225601000-0", "order", "DEMO-2026-0001", "status", "paid")
end

redis.call("SET", marker, "1")
return "seeded"
