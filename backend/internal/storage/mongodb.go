package storage

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/j-m-harrison/dts-submission/internal/task"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"go.mongodb.org/mongo-driver/v2/mongo/readpref"
)

// MongoStore implements Store using MongoDB as the backing database. It stores
// tasks in a single collection with a UUID string id field to keep parity with
// the SQL-backed stores.
type MongoStore struct {
	client     *mongo.Client
	collection *mongo.Collection
}

// Collection exposes the underlying MongoDB collection for testing and
// administrative tasks (e.g. clean-up). Application code should prefer the
// Store interface methods.
func (s *MongoStore) Collection() *mongo.Collection {
	return s.collection
}

// MongoConfig captures the minimal configuration required to initialise a
// MongoStore. It is deliberately small so that higher layers can remain
// database-agnostic.
type MongoConfig struct {
	DatabaseName   string
	CollectionName string
}

// NewMongoStore creates a MongoStore with the given client and configuration.
// The client lifetime is owned by the caller; the store only holds a reference.
func NewMongoStore(client *mongo.Client, cfg MongoConfig) *MongoStore {
	dbName := cfg.DatabaseName
	if dbName == "" {
		dbName = "tasks"
	}
	collName := cfg.CollectionName
	if collName == "" {
		collName = "tasks"
	}
	return &MongoStore{
		client:     client,
		collection: client.Database(dbName).Collection(collName),
	}
}

// EnsureMongoIndexes creates basic indexes for the tasks collection. It is
// intentionally minimal and idempotent so it can be called on startup.
func EnsureMongoIndexes(ctx context.Context, store *MongoStore) error {
	if store == nil || store.collection == nil {
		return errors.New("nil MongoStore")
	}
	// Unique index on id plus a compound index for common list queries.
	indexes := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "id", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys: bson.D{
				{Key: "dueAt", Value: 1},
				{Key: "id", Value: 1},
			},
		},
	}
	_, err := store.collection.Indexes().CreateMany(ctx, indexes)
	return err
}

type mongoTaskDoc struct {
	ID          string    `bson:"id"`
	Title       string    `bson:"title"`
	Description *string   `bson:"description,omitempty"`
	Status      string    `bson:"status"`
	Priority    string    `bson:"priority"`
	Owner       string    `bson:"owner,omitempty"`
	Tags        []string  `bson:"tags,omitempty"`
	DueAt       time.Time `bson:"dueAt"`
	CreatedAt   time.Time `bson:"createdAt"`
	UpdatedAt   time.Time `bson:"updatedAt"`
}

func (d *mongoTaskDoc) toDomain() *task.Task {
	return &task.Task{
		ID:          d.ID,
		Title:       d.Title,
		Description: d.Description,
		Status:      task.Status(d.Status),
		Priority:    task.Priority(d.Priority),
		Owner:       d.Owner,
		Tags:        append([]string(nil), d.Tags...),
		DueAt:       d.DueAt.UTC(),
		CreatedAt:   d.CreatedAt.UTC(),
		UpdatedAt:   d.UpdatedAt.UTC(),
	}
}

func fromDomain(tk *task.Task) *mongoTaskDoc {
	if tk == nil {
		return nil
	}
	return &mongoTaskDoc{
		ID:          tk.ID,
		Title:       tk.Title,
		Description: tk.Description,
		Status:      string(tk.Status),
		Priority:    string(tk.Priority),
		Owner:       tk.Owner,
		Tags:        append([]string(nil), tk.Tags...),
		DueAt:       tk.DueAt.UTC(),
		CreatedAt:   tk.CreatedAt.UTC(),
		UpdatedAt:   tk.UpdatedAt.UTC(),
	}
}

func (s *MongoStore) CreateTask(ctx context.Context, in task.NewTaskInput) (*task.Task, error) {
	now := time.Now().UTC()
	priority := in.Priority
	if priority == "" {
		priority = task.PriorityNormal
	}
	id := uuid.New().String()
	doc := &mongoTaskDoc{
		ID:          id,
		Title:       in.Title,
		Description: in.Description,
		Status:      string(in.Status),
		Priority:    string(priority),
		Owner:       in.Owner,
		Tags:        append([]string(nil), in.Tags...),
		DueAt:       in.DueAt.UTC(),
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if _, err := s.collection.InsertOne(ctx, doc); err != nil {
		return nil, err
	}
	return doc.toDomain(), nil
}

func (s *MongoStore) GetTask(ctx context.Context, id string) (*task.Task, error) {
	var doc mongoTaskDoc
	err := s.collection.FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return doc.toDomain(), nil
}

func (s *MongoStore) ListTasks(ctx context.Context, listOpts ListOptions) ([]*task.Task, error) {
	opts := options.Find().SetSort(bson.D{
		{Key: "dueAt", Value: 1},
		{Key: "id", Value: 1},
	})
	if listOpts.Limit > 0 {
		opts.SetLimit(int64(listOpts.Limit))
		opts.SetSkip(int64(max(0, listOpts.Offset)))
	}
	cur, err := s.collection.Find(ctx, bson.D{}, opts)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var tasks []*task.Task
	for cur.Next(ctx) {
		var doc mongoTaskDoc
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		tasks = append(tasks, doc.toDomain())
	}
	if err := cur.Err(); err != nil {
		return nil, err
	}
	return tasks, nil
}

func (s *MongoStore) UpdateTaskStatus(ctx context.Context, id string, status task.Status) (*task.Task, error) {
	now := time.Now().UTC()
	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "status", Value: string(status)},
			{Key: "updatedAt", Value: now},
		}},
	}
	res, err := s.collection.UpdateOne(ctx, bson.D{{Key: "id", Value: id}}, update)
	if err != nil {
		return nil, err
	}
	if res.MatchedCount == 0 {
		return nil, ErrNotFound
	}
	return s.GetTask(ctx, id)
}

func (s *MongoStore) UpdateTask(ctx context.Context, id string, in *task.UpdateTaskInput) (*task.Task, error) {
	if in == nil {
		return s.GetTask(ctx, id)
	}
	current, err := s.GetTask(ctx, id)
	if err != nil {
		return nil, err
	}

	title := current.Title
	if in.Title != nil {
		title = *in.Title
	}
	desc := current.Description
	if in.Description != nil {
		desc = in.Description
	}
	status := current.Status
	if in.Status != nil {
		status = *in.Status
	}
	priority := current.Priority
	if in.Priority != nil {
		priority = *in.Priority
	}
	tags := current.Tags
	if in.Tags != nil {
		tags = in.Tags
	}

	now := time.Now().UTC()
	update := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "title", Value: title},
			{Key: "description", Value: desc},
			{Key: "status", Value: string(status)},
			{Key: "priority", Value: string(priority)},
			{Key: "tags", Value: append([]string(nil), tags...)},
			{Key: "updatedAt", Value: now},
		}},
	}
	res, err := s.collection.UpdateOne(ctx, bson.D{{Key: "id", Value: id}}, update)
	if err != nil {
		return nil, err
	}
	if res.MatchedCount == 0 {
		return nil, ErrNotFound
	}
	return s.GetTask(ctx, id)
}

func (s *MongoStore) DeleteTask(ctx context.Context, id string) error {
	res, err := s.collection.DeleteOne(ctx, bson.D{{Key: "id", Value: id}})
	if err != nil {
		return err
	}
	if res.DeletedCount == 0 {
		return ErrNotFound
	}
	return nil
}

// PingMongo wraps a Mongo client ping call so it can be used in readiness
// checks without coupling the HTTP layer directly to the Mongo driver types.
func PingMongo(ctx context.Context, client *mongo.Client) error {
	if client == nil {
		return errors.New("nil mongo client")
	}
	// Use a ping to the primary; the database name is irrelevant here.
	return client.Ping(ctx, readpref.Primary())
}

