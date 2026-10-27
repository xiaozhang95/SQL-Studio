package httpapi

import _ "embed"

// 契约随二进制分发，不依赖启动目录；Swagger UI 和本地 API.md 都与它校验路由一致性。
//
//go:embed openapi.json
var openAPISpec []byte
