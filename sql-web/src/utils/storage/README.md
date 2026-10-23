# 浏览器存储

[源码](index.ts)

readLocal<T>(key, fallback)、saveLocal(key, value)：JSON 读取失败回退，写入受限时忽略。只用于草稿、主题与历史，不存数据库明文密码。

导入使用 `@/utils/storage`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
