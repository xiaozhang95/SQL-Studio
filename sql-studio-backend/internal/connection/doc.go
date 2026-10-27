// Package connection Open/List/Get/Save/Delete 管理连接，AES-GCM 加密密码并原子落盘。
//
// List 必须移除密码；编辑空密码保留原值；密钥丢失拒绝覆盖已有配置；不记录明文密码。
package connection
