# 加密本地存储

[源码](index.ts)

readEncrypted(name,fallback)、writeEncrypted(name,value) 异步读写 IndexedDB `sqloom-encrypted`。内容使用 AES-GCM 256 位密钥、每次随机 12 字节 IV，并以记录名称作为认证数据；只存密文、版本与 IV。同名写入串行，避免旧任务覆盖新快照。

密钥由 Web Crypto 首次生成，extractable=false，通过 IndexedDB 结构化克隆保存，不硬编码、不导出、不存入 localStorage。加密针对本地静态数据；同源代码仍可使用本浏览器密钥，不能替代系统账户和浏览器安全。清除站点数据会同时失去记录和密钥，无云端备份。

需要 HTTPS 或 localhost 的 Web Crypto 支持。损坏、解密失败、配额不足均向调用方抛错，不默默覆盖旧记录或降级为明文；不接受数据库连接凭据。
