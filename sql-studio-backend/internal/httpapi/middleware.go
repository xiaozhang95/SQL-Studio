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
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Invalid Host"})
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		parsed, e := url.Parse(origin)
		if e != nil || parsed.Host != r.Host || parsed.Scheme != "http" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Cross-origin request rejected"})
			return
		}
	}
	if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Cross-site request rejected"})
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.Next()
}
