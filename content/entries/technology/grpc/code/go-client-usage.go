package inventoryclient

import (
	"context"
	"crypto/tls"
	"fmt"
	"time"

	inventoryv1 "example.com/inventory/gen/inventory/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/status"
)

const retrySafeReads = `{
  "methodConfig": [{
    "name": [{
      "service": "inventory.v1.InventoryService",
      "method": "GetItem"
    }],
    "retryPolicy": {
      "maxAttempts": 3,
      "initialBackoff": "0.050s",
      "maxBackoff": "0.200s",
      "backoffMultiplier": 2,
      "retryableStatusCodes": ["UNAVAILABLE"]
    }
  }]
}`

type Client struct {
	conn *grpc.ClientConn
	rpc  inventoryv1.InventoryServiceClient
}

func New() (*Client, error) {
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
		ServerName: "inventory.internal",
	}
	conn, err := grpc.NewClient(
		"dns:///inventory.internal:443",
		grpc.WithTransportCredentials(credentials.NewTLS(tlsConfig)),
		grpc.WithDefaultServiceConfig(retrySafeReads),
	)
	if err != nil {
		return nil, fmt.Errorf("create inventory channel: %w", err)
	}
	return &Client{conn: conn, rpc: inventoryv1.NewInventoryServiceClient(conn)}, nil
}

func (c *Client) Close() error { return c.conn.Close() }

func (c *Client) GetItem(ctx context.Context, sku string) (*inventoryv1.Item, error) {
	// One context deadline covers every configured retry attempt and backoff.
	callCtx, cancel := context.WithTimeout(ctx, 800*time.Millisecond)
	defer cancel()

	response, err := c.rpc.GetItem(callCtx, &inventoryv1.GetItemRequest{Sku: sku})
	if err != nil {
		return nil, fmt.Errorf("get item (%s): %w", status.Code(err), err)
	}
	return response.Item, nil
}
