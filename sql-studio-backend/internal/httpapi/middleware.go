package httpapi

import (
	"net"
	"net/http"
	"net/url"

	"github.com/gin-gonic/gin"
)

// 本地 SQL 工具拒绝跨站请求；开发代理保留浏览器 Host，以便同源校验保持一致。
func localOnly(c *gin.Context) {
	r := c.Request
	host, _, err := net.SplitHostPort(r.Host)
	if err != nil {
		host = r.Host
	}
	if host != "localhost" && host != "127.0.0.1" && host != "::1" {
		respond(c, http.StatusForbidden, gin.H{"error": "无效的 Host"})
		c.Abort()
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		parsed, e := url.Parse(origin)
		if e != nil || parsed.Host != r.Host || parsed.Scheme != "http" {
			respond(c, http.StatusForbidden, gin.H{"error": "拒绝跨源请求"})
			c.Abort()
			return
		}
	}
	if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
		respond(c, http.StatusForbidden, gin.H{"error": "拒绝跨站请求"})
		c.Abort()
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Next()
}
