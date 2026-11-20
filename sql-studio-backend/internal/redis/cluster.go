package redis

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"

	driver "github.com/redis/go-redis/v9"
)

// clusterNodes keeps node order deterministic across independent requests.
func clusterNodes(ctx context.Context, client *driver.ClusterClient, includeReplicas bool) ([]*driver.Client, error) {
	visit := client.ForEachMaster
	if includeReplicas {
		visit = client.ForEachShard
	}
	byAddr := make(map[string]*driver.Client)
	var mu sync.Mutex
	err := visit(ctx, func(_ context.Context, node *driver.Client) error {
		mu.Lock()
		byAddr[node.Options().Addr] = node
		mu.Unlock()
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(byAddr) == 0 {
		return nil, errors.New("未找到 Redis 集群节点")
	}
	addrs := make([]string, 0, len(byAddr))
	for addr := range byAddr {
		addrs = append(addrs, addr)
	}
	sort.Strings(addrs)
	nodes := make([]*driver.Client, 0, len(addrs))
	for _, addr := range addrs {
		nodes = append(nodes, byAddr[addr])
	}
	return nodes, nil
}

type clusterScanCursor struct {
	fingerprint string
	index       int
	position    uint64
}

func (c clusterScanCursor) encode() string {
	return fmt.Sprintf("%s:%d:%d", c.fingerprint, c.index, c.position)
}

func decodeClusterScanCursor(cursor, fingerprint string, nodes int) (clusterScanCursor, error) {
	page := clusterScanCursor{fingerprint: fingerprint}
	if cursor == "0" {
		return page, nil
	}
	parts := strings.Split(cursor, ":")
	if len(parts) != 3 || parts[0] != fingerprint {
		return page, errors.New("Redis 集群扫描范围已变化，请重新扫描")
	}
	index, indexErr := strconv.Atoi(parts[1])
	position, positionErr := strconv.ParseUint(parts[2], 10, 64)
	if indexErr != nil || positionErr != nil || index < 0 || index >= nodes {
		return page, errors.New("Redis 游标或筛选条件无效")
	}
	page.index, page.position = index, position
	return page, nil
}

func (c clusterScanCursor) advance(position uint64, nodes int) string {
	c.position = position
	if position == 0 {
		c.index++
		if c.index == nodes {
			return "0"
		}
	}
	return c.encode()
}

func scanCluster(ctx context.Context, client *driver.ClusterClient, cursor, pattern string) ([]string, string, error) {
	nodes, err := clusterNodes(ctx, client, false)
	if err != nil {
		return nil, "", err
	}
	addrs := make([]string, 0, len(nodes))
	for _, node := range nodes {
		addrs = append(addrs, node.Options().Addr)
	}
	fingerprint := fmt.Sprintf("%x", sha256.Sum256([]byte(strings.Join(addrs, "\n")+"\n\n"+pattern)))
	page, err := decodeClusterScanCursor(cursor, fingerprint, len(nodes))
	if err != nil {
		return nil, "", err
	}
	names, position, err := nodes[page.index].Scan(ctx, page.position, pattern, 100).Result()
	if err != nil {
		return nil, "", err
	}
	return names, page.advance(position, len(nodes)), nil
}
