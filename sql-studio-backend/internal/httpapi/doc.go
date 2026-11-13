// Package httpapi 注册路由、解析参数、限制 JSON、同源及本机保护，并按请求语言统一系统提示与错误响应。
//
// 只调用业务模块，不直接开数据库或读文件；OpenAPI 随二进制内嵌，接口列表见 docs/API.md。
package httpapi
