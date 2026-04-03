package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"time"

	httpapi "github.com/j-m-harrison/dts-submission/internal/http"
	"github.com/j-m-harrison/dts-submission/internal/config"
	"github.com/j-m-harrison/dts-submission/internal/logger"
	"github.com/j-m-harrison/dts-submission/internal/seed"
	"github.com/j-m-harrison/dts-submission/internal/storage"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/sync/errgroup"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	// ✅ Load config (single source of truth)
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	mongoDB := os.Getenv("MONGO_DATABASE")
	if mongoDB == "" {
		mongoDB = "tasks"
	}

	clientOpts := options.Client().ApplyURI(mongoURI)
	client, err := mongo.Connect(clientOpts)
	if err != nil {
		log.Fatalf("failed to connect to MongoDB: %v", err)
	}
	defer func() {
		_ = client.Disconnect(context.Background())
	}()

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("failed to ping MongoDB: %v", err)
	}

	store := storage.NewMongoStore(client, storage.MongoConfig{
		DatabaseName:   mongoDB,
		CollectionName: "tasks",
	})

	if err := storage.EnsureMongoIndexes(ctx, store); err != nil {
		log.Fatalf("failed to ensure MongoDB indexes: %v", err)
	}

	// ✅ Config-driven seeding (fixed)
	if shouldSeedDemoDataWithConfig(cfg) {
		logger.Info("🌱 seeding MongoDB database")

		if err := seed.DemoTasksStore(ctx, store); err != nil {
			log.Fatalf("failed to seed demo tasks: %v", err)
		}
	}

	apiServer := httpapi.NewServerWithStore(store, func(c context.Context) error {
		return client.Ping(c, nil)
	})

	mux := http.NewServeMux()
	apiServer.RegisterRoutes(mux)

	addr := fmt.Sprintf(":%s", readEnvDefault("HTTP_PORT", "8080"))
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	logger.Info("🚀 MongoDB API server listening on %s (uri=%s db=%s)", addr, mongoURI, mongoDB)

	var g errgroup.Group

	g.Go(func() error {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			return err
		}
		return nil
	})

	g.Go(func() error {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	})

	if err := g.Wait(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func readEnvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ✅ Unified seeding logic (config-first, env override)
func shouldSeedDemoDataWithConfig(cfg *config.AppConfig) bool {
	if v := strings.ToLower(strings.TrimSpace(os.Getenv("SEED_DEMO_TASKS"))); v != "" {
		return v == "1" || v == "true" || v == "yes"
	}
	if cfg != nil {
		return strings.EqualFold(strings.TrimSpace(cfg.Env), "development")
	}
	return false
}
