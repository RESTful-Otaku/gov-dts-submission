package httpapi

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/argon2"
)

type mongoAuthStore struct {
	users          *mongo.Collection
	sessions       *mongo.Collection
	passwordResets *mongo.Collection
	auditLogs      *mongo.Collection
}

type mongoSessionDoc struct {
	ID        string    `bson:"id"`
	UserID    string    `bson:"userId"`
	TokenHash string    `bson:"tokenHash"`
	ExpiresAt time.Time `bson:"expiresAt"`
	CreatedAt time.Time `bson:"createdAt"`
}

type mongoPasswordResetDoc struct {
	ID        string     `bson:"id"`
	UserID    string     `bson:"userId"`
	TokenHash string     `bson:"tokenHash"`
	ExpiresAt time.Time  `bson:"expiresAt"`
	CreatedAt time.Time  `bson:"createdAt"`
	UsedAt    *time.Time `bson:"usedAt,omitempty"`
}

func newMongoAuthStore(client *mongo.Client, dbName string) *mongoAuthStore {
	if dbName == "" {
		dbName = "tasks"
	}
	db := client.Database(dbName)
	return &mongoAuthStore{
		users:          db.Collection("users"),
		sessions:       db.Collection("sessions"),
		passwordResets: db.Collection("password_resets"),
		auditLogs:      db.Collection("audit_logs"),
	}
}

func (m *mongoAuthStore) ensure(ctx context.Context) error {
	if m == nil {
		return errors.New("nil mongo auth store")
	}
	userIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "username", Value: 1}}, Options: options.Index().SetUnique(true)},
	}
	if _, err := m.users.Indexes().CreateMany(ctx, userIndexes); err != nil {
		return err
	}
	sessionIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "tokenHash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}},
	}
	if _, err := m.sessions.Indexes().CreateMany(ctx, sessionIndexes); err != nil {
		return err
	}
	resetIndexes := []mongo.IndexModel{
		{Keys: bson.D{{Key: "id", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "tokenHash", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "expiresAt", Value: 1}}},
	}
	if _, err := m.passwordResets.Indexes().CreateMany(ctx, resetIndexes); err != nil {
		return err
	}
	if _, err := m.auditLogs.Indexes().CreateOne(ctx, mongo.IndexModel{Keys: bson.D{{Key: "createdAt", Value: -1}}}); err != nil {
		return err
	}
	return nil
}

func (s *Server) usingMongoAuth() bool {
	return s.mongoAuth != nil
}

func (s *Server) mongoSeedDefaultUsers(ctx context.Context) error {
	if s.mongoAuth == nil {
		return nil
	}
	now := time.Now().UTC()
	salt := []byte("dts-seed-static-salt")
	sum := argon2.IDKey([]byte("DemoPass123!"), salt, 1, 64*1024, 4, 32)
	hash := base64.RawStdEncoding.EncodeToString(salt) + "." + base64.RawStdEncoding.EncodeToString(sum)
	users := []authUser{
		{ID: "10000000-0001-4000-8000-000000000001", Email: "admin@example.gov", Username: "Sarah Chen", FirstName: "Sarah", LastName: "Chen", Role: roleAdmin, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000002", Email: "admin.morgan@example.gov", Username: "Morgan Blake", FirstName: "Morgan", LastName: "Blake", Role: roleAdmin, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000003", Email: "editor@example.gov", Username: "James Wilson", FirstName: "James", LastName: "Wilson", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000004", Email: "editor.alex@example.gov", Username: "Alex Rivera", FirstName: "Alex", LastName: "Rivera", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000005", Email: "editor.jordan@example.gov", Username: "Jordan Matthews", FirstName: "Jordan", LastName: "Matthews", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000006", Email: "editor.casey@example.gov", Username: "Casey Nguyen", FirstName: "Casey", LastName: "Nguyen", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000007", Email: "editor.riley@example.gov", Username: "Riley Foster", FirstName: "Riley", LastName: "Foster", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000008", Email: "editor.sam@example.gov", Username: "Sam Okonkwo", FirstName: "Sam", LastName: "Okonkwo", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000009", Email: "editor.taylor@example.gov", Username: "Taylor Brooks", FirstName: "Taylor", LastName: "Brooks", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-00000000000a", Email: "editor.quinn@example.gov", Username: "Quinn Mitchell", FirstName: "Quinn", LastName: "Mitchell", Role: roleEditor, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-00000000000b", Email: "viewer@example.gov", Username: "Priya Patel", FirstName: "Priya", LastName: "Patel", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-00000000000c", Email: "viewer.jamie@example.gov", Username: "Jamie Chen", FirstName: "Jamie", LastName: "Chen", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-00000000000d", Email: "viewer.robin@example.gov", Username: "Robin Ellis", FirstName: "Robin", LastName: "Ellis", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-00000000000e", Email: "viewer.dana@example.gov", Username: "Dana Singh", FirstName: "Dana", LastName: "Singh", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-00000000000f", Email: "viewer.lee@example.gov", Username: "Lee Garcia", FirstName: "Lee", LastName: "Garcia", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000010", Email: "viewer.avery@example.gov", Username: "Avery Moore", FirstName: "Avery", LastName: "Moore", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000011", Email: "viewer.drew@example.gov", Username: "Drew Thompson", FirstName: "Drew", LastName: "Thompson", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000012", Email: "viewer.remy@example.gov", Username: "Remy Clarke", FirstName: "Remy", LastName: "Clarke", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000013", Email: "viewer.sky@example.gov", Username: "Sky Patel", FirstName: "Sky", LastName: "Patel", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
		{ID: "10000000-0001-4000-8000-000000000014", Email: "viewer.jordanf@example.gov", Username: "Jordan Fox", FirstName: "Jordan", LastName: "Fox", Role: roleViewer, CreatedAt: now, UpdatedAt: now},
	}
	for _, u := range users {
		filter := bson.D{{Key: "email", Value: strings.ToLower(strings.TrimSpace(u.Email))}}
		update := bson.D{{Key: "$setOnInsert", Value: bson.D{
			{Key: "id", Value: u.ID},
			{Key: "email", Value: strings.ToLower(strings.TrimSpace(u.Email))},
			{Key: "username", Value: u.Username},
			{Key: "firstName", Value: u.FirstName},
			{Key: "lastName", Value: u.LastName},
			{Key: "passwordHash", Value: hash},
			{Key: "role", Value: string(u.Role)},
			{Key: "createdAt", Value: u.CreatedAt},
			{Key: "updatedAt", Value: u.UpdatedAt},
		}}}
		_, err := s.mongoAuth.users.UpdateOne(ctx, filter, update, options.UpdateOne().SetUpsert(true))
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) mongoGetUserByEmail(ctx context.Context, email string) (*authUser, string, error) {
	var out struct {
		ID           string    `bson:"id"`
		Email        string    `bson:"email"`
		Username     string    `bson:"username"`
		FirstName    string    `bson:"firstName"`
		LastName     string    `bson:"lastName"`
		Role         string    `bson:"role"`
		PasswordHash string    `bson:"passwordHash"`
		CreatedAt    time.Time `bson:"createdAt"`
		UpdatedAt    time.Time `bson:"updatedAt"`
	}
	err := s.mongoAuth.users.FindOne(ctx, bson.D{{Key: "email", Value: strings.ToLower(strings.TrimSpace(email))}}).Decode(&out)
	if err != nil {
		return nil, "", err
	}
	u := &authUser{
		ID:        out.ID,
		Email:     out.Email,
		Username:  out.Username,
		FirstName: out.FirstName,
		LastName:  out.LastName,
		Role:      parseUserRole(out.Role),
		CreatedAt: out.CreatedAt,
		UpdatedAt: out.UpdatedAt,
	}
	return u, out.PasswordHash, nil
}

func (s *Server) mongoCreateUser(ctx context.Context, u authUser, passwordHash string) error {
	doc := bson.D{
		{Key: "id", Value: u.ID},
		{Key: "email", Value: strings.ToLower(strings.TrimSpace(u.Email))},
		{Key: "username", Value: strings.TrimSpace(u.Username)},
		{Key: "firstName", Value: strings.TrimSpace(u.FirstName)},
		{Key: "lastName", Value: strings.TrimSpace(u.LastName)},
		{Key: "passwordHash", Value: passwordHash},
		{Key: "role", Value: string(u.Role)},
		{Key: "createdAt", Value: u.CreatedAt.UTC()},
		{Key: "updatedAt", Value: u.UpdatedAt.UTC()},
	}
	_, err := s.mongoAuth.users.InsertOne(ctx, doc)
	return err
}

func (s *Server) mongoCreateSession(ctx context.Context, userID string) (string, error) {
	rawToken, err := makeSessionToken()
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	expiry := now.Add(sessionDuration())
	doc := mongoSessionDoc{
		ID:        uuid.New().String(),
		UserID:    userID,
		TokenHash: hashToken(rawToken),
		ExpiresAt: expiry,
		CreatedAt: now,
	}
	if _, err := s.mongoAuth.sessions.InsertOne(ctx, doc); err != nil {
		return "", err
	}
	return rawToken, nil
}

func (s *Server) mongoCurrentUserFromToken(ctx context.Context, rawToken string) (*authUser, error) {
	var sess mongoSessionDoc
	err := s.mongoAuth.sessions.FindOne(ctx, bson.D{
		{Key: "tokenHash", Value: hashToken(rawToken)},
		{Key: "expiresAt", Value: bson.D{{Key: "$gt", Value: time.Now().UTC()}}},
	}).Decode(&sess)
	if err != nil {
		return nil, err
	}
	var out struct {
		ID        string    `bson:"id"`
		Email     string    `bson:"email"`
		Username  string    `bson:"username"`
		FirstName string    `bson:"firstName"`
		LastName  string    `bson:"lastName"`
		Role      string    `bson:"role"`
		CreatedAt time.Time `bson:"createdAt"`
		UpdatedAt time.Time `bson:"updatedAt"`
	}
	if err := s.mongoAuth.users.FindOne(ctx, bson.D{{Key: "id", Value: sess.UserID}}).Decode(&out); err != nil {
		return nil, err
	}
	return &authUser{
		ID:        out.ID,
		Email:     out.Email,
		Username:  out.Username,
		FirstName: out.FirstName,
		LastName:  out.LastName,
		Role:      parseUserRole(out.Role),
		CreatedAt: out.CreatedAt,
		UpdatedAt: out.UpdatedAt,
	}, nil
}

func (s *Server) mongoDeleteSessionByToken(ctx context.Context, rawToken string) {
	_, _ = s.mongoAuth.sessions.DeleteMany(ctx, bson.D{{Key: "tokenHash", Value: hashToken(rawToken)}})
}

func (s *Server) mongoInsertAudit(ctx context.Context, actor *authUser, action, entityType, entityID string, changed []string, beforeJSON, afterJSON, rawJSON string) {
	a := actor
	if a == nil {
		a = &authUser{ID: systemAuditActorID, Username: "system"}
	}
	_, _ = s.mongoAuth.auditLogs.InsertOne(ctx, bson.D{
		{Key: "id", Value: uuid.New().String()},
		{Key: "userId", Value: a.ID},
		{Key: "username", Value: a.Username},
		{Key: "action", Value: action},
		{Key: "entityType", Value: entityType},
		{Key: "entityId", Value: entityID},
		{Key: "changedFields", Value: changed},
		{Key: "beforeJson", Value: beforeJSON},
		{Key: "afterJson", Value: afterJSON},
		{Key: "rawJson", Value: rawJSON},
		{Key: "createdAt", Value: time.Now().UTC()},
	})
}

func (s *Server) mongoListDisplayNames(ctx context.Context) ([]string, error) {
	cur, err := s.mongoAuth.users.Find(ctx, bson.D{}, options.Find().SetProjection(bson.D{{Key: "username", Value: 1}, {Key: "_id", Value: 0}}).SetSort(bson.D{{Key: "username", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	out := make([]string, 0, 32)
	for cur.Next(ctx) {
		var row struct {
			Username string `bson:"username"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, err
		}
		if u := strings.TrimSpace(row.Username); u != "" {
			out = append(out, u)
		}
	}
	return out, cur.Err()
}

func (s *Server) mongoCreatePasswordReset(ctx context.Context, userID string) (string, error) {
	rawToken, err := makeSessionToken()
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	expiresAt := now.Add(30 * time.Minute)
	doc := mongoPasswordResetDoc{
		ID:        uuid.New().String(),
		UserID:    userID,
		TokenHash: hashToken(rawToken),
		ExpiresAt: expiresAt,
		CreatedAt: now,
	}
	if _, err := s.mongoAuth.passwordResets.InsertOne(ctx, doc); err != nil {
		return "", err
	}
	return rawToken, nil
}

func (s *Server) mongoConsumePasswordReset(ctx context.Context, rawToken, newPasswordHash string) (string, error) {
	var pr mongoPasswordResetDoc
	err := s.mongoAuth.passwordResets.FindOne(ctx, bson.D{
		{Key: "tokenHash", Value: hashToken(rawToken)},
		{Key: "usedAt", Value: bson.D{{Key: "$exists", Value: false}}},
		{Key: "expiresAt", Value: bson.D{{Key: "$gt", Value: time.Now().UTC()}}},
	}).Decode(&pr)
	if err != nil {
		return "", err
	}
	now := time.Now().UTC()
	_, err = s.mongoAuth.users.UpdateOne(ctx, bson.D{{Key: "id", Value: pr.UserID}}, bson.D{{Key: "$set", Value: bson.D{{Key: "passwordHash", Value: newPasswordHash}, {Key: "updatedAt", Value: now}}}})
	if err != nil {
		return "", err
	}
	_, _ = s.mongoAuth.passwordResets.UpdateOne(ctx, bson.D{{Key: "id", Value: pr.ID}}, bson.D{{Key: "$set", Value: bson.D{{Key: "usedAt", Value: now}}}})
	_, _ = s.mongoAuth.sessions.DeleteMany(ctx, bson.D{{Key: "userId", Value: pr.UserID}})
	return pr.UserID, nil
}

func (s *Server) mongoGetUserByID(ctx context.Context, id string) (*authUser, error) {
	var out struct {
		ID        string    `bson:"id"`
		Email     string    `bson:"email"`
		Username  string    `bson:"username"`
		FirstName string    `bson:"firstName"`
		LastName  string    `bson:"lastName"`
		Role      string    `bson:"role"`
		CreatedAt time.Time `bson:"createdAt"`
		UpdatedAt time.Time `bson:"updatedAt"`
	}
	if err := s.mongoAuth.users.FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&out); err != nil {
		return nil, err
	}
	return &authUser{ID: out.ID, Email: out.Email, Username: out.Username, FirstName: out.FirstName, LastName: out.LastName, Role: parseUserRole(out.Role), CreatedAt: out.CreatedAt, UpdatedAt: out.UpdatedAt}, nil
}

func (s *Server) mongoEnsureUserExists(ctx context.Context, id string) error {
	_, err := s.mongoGetUserByID(ctx, id)
	if err != nil {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (s *Server) mongoCountAdmins(ctx context.Context) (int64, error) {
	return s.mongoAuth.users.CountDocuments(ctx, bson.D{{Key: "role", Value: "admin"}})
}

func (s *Server) mongoDeleteUserByID(ctx context.Context, id string) (int64, error) {
	res, err := s.mongoAuth.users.DeleteOne(ctx, bson.D{{Key: "id", Value: id}})
	if err != nil {
		return 0, err
	}
	_, _ = s.mongoAuth.sessions.DeleteMany(ctx, bson.D{{Key: "userId", Value: id}})
	return res.DeletedCount, nil
}

func (s *Server) mongoUpdateUserByID(ctx context.Context, id, email, username, firstName, lastName string, role userRole, now time.Time) (int64, error) {
	res, err := s.mongoAuth.users.UpdateOne(ctx, bson.D{{Key: "id", Value: id}}, bson.D{{Key: "$set", Value: bson.D{
		{Key: "email", Value: email},
		{Key: "username", Value: username},
		{Key: "firstName", Value: firstName},
		{Key: "lastName", Value: lastName},
		{Key: "role", Value: string(role)},
		{Key: "updatedAt", Value: now.UTC()},
	}}})
	if err != nil {
		return 0, err
	}
	return res.ModifiedCount, nil
}

func (s *Server) mongoListUsers(ctx context.Context, q, roleFilter, sortCol, order string, limit, offset int) ([]authUser, int, error) {
	filter := bson.D{}
	if q != "" {
		p := bson.D{{Key: "$regex", Value: q}, {Key: "$options", Value: "i"}}
		filter = append(filter, bson.E{Key: "$or", Value: bson.A{
			bson.D{{Key: "email", Value: p}},
			bson.D{{Key: "username", Value: p}},
			bson.D{{Key: "firstName", Value: p}},
			bson.D{{Key: "lastName", Value: p}},
		}})
	}
	if roleFilter != "" {
		filter = append(filter, bson.E{Key: "role", Value: roleFilter})
	}
	total64, err := s.mongoAuth.users.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	dir := -1
	if strings.EqualFold(order, "ASC") {
		dir = 1
	}
	mongoSort := "createdAt"
	switch sortCol {
	case "updated_at":
		mongoSort = "updatedAt"
	case "email":
		mongoSort = "email"
	case "username":
		mongoSort = "username"
	case "first_name":
		mongoSort = "firstName"
	case "last_name":
		mongoSort = "lastName"
	case "role":
		mongoSort = "role"
	}
	cur, err := s.mongoAuth.users.Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: mongoSort, Value: dir}}).
		SetLimit(int64(limit)).
		SetSkip(int64(offset)))
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)
	out := make([]authUser, 0, limit)
	for cur.Next(ctx) {
		var row struct {
			ID        string    `bson:"id"`
			Email     string    `bson:"email"`
			Username  string    `bson:"username"`
			FirstName string    `bson:"firstName"`
			LastName  string    `bson:"lastName"`
			Role      string    `bson:"role"`
			CreatedAt time.Time `bson:"createdAt"`
			UpdatedAt time.Time `bson:"updatedAt"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, 0, err
		}
		out = append(out, authUser{ID: row.ID, Email: row.Email, Username: row.Username, FirstName: row.FirstName, LastName: row.LastName, Role: parseUserRole(row.Role), CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt})
	}
	return out, int(total64), cur.Err()
}

func (s *Server) mongoListAuditLogs(ctx context.Context, userID, query, fieldFilter, sortBy, order string, limit int) ([]auditLogRecord, error) {
	filter := bson.D{}
	if userID != "" {
		filter = append(filter, bson.E{Key: "userId", Value: userID})
	}
	if fieldFilter != "" {
		filter = append(filter, bson.E{Key: "changedFields", Value: fieldFilter})
	}
	if query != "" {
		p := bson.D{{Key: "$regex", Value: query}, {Key: "$options", Value: "i"}}
		filter = append(filter, bson.E{Key: "$or", Value: bson.A{
			bson.D{{Key: "username", Value: p}},
			bson.D{{Key: "action", Value: p}},
			bson.D{{Key: "entityType", Value: p}},
			bson.D{{Key: "rawJson", Value: p}},
		}})
	}
	sortField := "createdAt"
	switch sortBy {
	case "username":
		sortField = "username"
	case "action":
		sortField = "action"
	case "changed_fields":
		sortField = "changedFields"
	}
	dir := -1
	if strings.EqualFold(order, "ASC") {
		dir = 1
	}
	cur, err := s.mongoAuth.auditLogs.Find(ctx, filter, options.Find().SetSort(bson.D{{Key: sortField, Value: dir}}).SetLimit(int64(limit)))
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)
	out := make([]auditLogRecord, 0, limit)
	for cur.Next(ctx) {
		var row struct {
			ID           string    `bson:"id"`
			UserID       string    `bson:"userId"`
			Username     string    `bson:"username"`
			Action       string    `bson:"action"`
			EntityType   string    `bson:"entityType"`
			EntityID     string    `bson:"entityId"`
			ChangedFields []string `bson:"changedFields"`
			BeforeJSON   string    `bson:"beforeJson"`
			AfterJSON    string    `bson:"afterJson"`
			RawJSON      string    `bson:"rawJson"`
			CreatedAt    time.Time `bson:"createdAt"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, err
		}
		out = append(out, auditLogRecord{
			ID: row.ID, UserID: row.UserID, Username: row.Username, Action: row.Action,
			EntityType: row.EntityType, EntityID: row.EntityID, ChangedFields: row.ChangedFields,
			BeforeJSON: row.BeforeJSON, AfterJSON: row.AfterJSON, RawJSON: row.RawJSON, CreatedAt: row.CreatedAt,
		})
	}
	return out, cur.Err()
}
