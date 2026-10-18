package job

import (
	"context"
	"sync"
	"time"

	"github.com/WeIbSchatten/We1ssBoard/v3/internal/web/service"
)

// TgWebProxyBackendsJob keeps every relay profile served by an MTProxy.
type TgWebProxyBackendsJob struct {
	mu sync.Mutex
}

func NewTgWebProxyBackendsJob() *TgWebProxyBackendsJob { return new(TgWebProxyBackendsJob) }

func (j *TgWebProxyBackendsJob) Run() {
	if !j.mu.TryLock() {
		return
	}
	defer j.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	(&service.TgWebProxyService{}).MaintainBackends(ctx)
}
