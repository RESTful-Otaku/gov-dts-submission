package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/j-m-harrison/dts-submission/internal/config"
	httpapi "github.com/j-m-harrison/dts-submission/internal/http"
	"github.com/j-m-harrison/dts-submission/internal/logger"
)

func main() {
	ctx := context.Background()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load configuration: %v", err)
	}

	dataDir := "./data"
	if v := os.Getenv("DATA_DIR"); v != "" {
		dataDir = v
	}

	db, err := httpapi.InitDatabase(ctx, dataDir, cfg)
	if err != nil {
		log.Fatalf("failed to initialise database: %v", err)
	}
	defer db.Close()

	apiServer := httpapi.NewServerWithDriver(db, cfg.DBDriver)
	if err := apiServer.BootstrapSQLAuthArtifacts(ctx); err != nil {
		log.Fatalf("bootstrap auth schema: %v", err)
	}
	mux := http.NewServeMux()
	apiServer.RegisterRoutes(mux)

	addr := fmt.Sprintf(":%s", cfg.HTTPPort)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	idleConnsClosed := make(chan struct{})
	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM)
		<-c
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("HTTP server Shutdown: %v", err)
		}
		close(idleConnsClosed)
	}()

	logger.Info("🚀 API server listening on %s (env=%s db=%s)", addr, cfg.Env, cfg.DBDriver)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	<-idleConnsClosed
}

