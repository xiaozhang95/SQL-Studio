// Package config 统一读取环境变量、区分开发/发行数据目录并解析网页目录，校验首次连接参数。
//
// 下层通过参数接收配置，不在 handler/service 中重复读取环境变量。
package config
