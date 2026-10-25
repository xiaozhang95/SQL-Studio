# 浏览器存储

[源码](index.ts)

readLocal<T>(key, fallback)、saveLocal(key, value)：JSON 读取失败回退，写入受限时忽略。仅用于主题等非敏感偏好与读取旧数据迁移，不存数据库明文密码；新的 SQL、结果、布局和历史使用 encryptedStorage。

导入使用 `@/utils/storage`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
