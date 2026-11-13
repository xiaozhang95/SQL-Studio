# 当前请求语言

`getLanguage(): Language` 读取 App 已应用到 document.lang 的语言，支持 zh-CN/en-US。没有浏览器文档或未应用语言时默认 zh-CN，不读写配置，也不维护第二份可变全局状态。供 HTTP 请求和非 React 文件工具在操作开始时读取。
