package storage

import (
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestNewStoreFromDB_DriverSelection(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	t.Run("default sqlite", func(t *testing.T) {
		s := NewStoreFromDBDriver(db, "")
		if _, ok := s.(*SQLiteStore); !ok {
			t.Fatalf("want *SQLiteStore, got %T", s)
		}
	})

	t.Run("explicit sqlite3", func(t *testing.T) {
		s := NewStoreFromDBDriver(db, "sqlite3")
		if _, ok := s.(*SQLiteStore); !ok {
			t.Fatalf("want *SQLiteStore, got %T", s)
		}
	})

	t.Run("pgx", func(t *testing.T) {
		s := NewStoreFromDBDriver(db, "pgx")
		if _, ok := s.(*PostgresStore); !ok {
			t.Fatalf("want *PostgresStore, got %T", s)
		}
	})

	t.Run("postgres alias", func(t *testing.T) {
		s := NewStoreFromDBDriver(db, "postgres")
		if _, ok := s.(*PostgresStore); !ok {
			t.Fatalf("want *PostgresStore, got %T", s)
		}
	})

	t.Run("mariadb", func(t *testing.T) {
		s := NewStoreFromDBDriver(db, "mariadb")
		if _, ok := s.(*MariaDBStore); !ok {
			t.Fatalf("want *MariaDBStore, got %T", s)
		}
	})
}

func TestNewStoreFromDB_CaseInsensitiveDriver(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	s := NewStoreFromDBDriver(db, "PGX")
	if _, ok := s.(*PostgresStore); !ok {
		t.Fatalf("want *PostgresStore, got %T", s)
	}
}
