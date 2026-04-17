# Testing Strategy and Quality Gates

This document defines the minimum expected test coverage by layer and the quality gates required before merge/release.

## Test pyramid for this project

- **Unit tests**
  - Backend domain and helpers (`backend/internal/**`)
  - Frontend utility and component behavior (`frontend/tests/**`)
- **Integration tests**
  - Backend HTTP contract (`backend/tests/http`)
  - Backend storage adapters (`backend/tests/storage`)
  - Frontend app-level interaction tests (`frontend/tests/App.*`)
- **E2E tests**
  - Critical user journeys (`frontend/e2e`)
  - Health/readiness and auth behavior in CI pipelines

## Required coverage by risk area

## Authentication and authorization

- Must test:
  - valid auth path
  - invalid token rejection (`401`)
  - missing token rejection (`401`)
  - insufficient permissions (`403`)
  - configuration failure (`503`)
- Must include route-level scope tests for read/write routes.

## Data correctness and determinism

- Must test:
  - input validation edge cases
  - enum and status transitions
  - pagination boundaries and invalid query values
  - conflict behavior (`409`) for concurrent updates

## Security controls

- Must test or verify via workflow:
  - CORS behavior and allowed headers
  - strict JSON payload handling
  - security headers presence
  - dependency and vulnerability scans

## CI quality gates (current baseline)

- **Frontend/web:** `.github/workflows/web-build.yml`
  - type checks
  - unit tests
  - build
  - Playwright E2E
- **Backend/storage:** `.github/workflows/db-smoke-tests.yml`
  - `go test`
  - `go vet`
  - DB-specific smoke tests
- **Security:** `.github/workflows/security-checks.yml`
  - dependency audit
  - `govulncheck`
  - secret scan
- **SAST:** `.github/workflows/codeql-analysis.yml`
  - CodeQL for Go and JS/TS

## Release gates (mobile)

- Build artifacts must include:
  - binary artifact
  - checksum file (`.sha256`)
  - source SBOM (`spdx-json`)
  - provenance attestation

## Contributor expectations

- Any non-trivial behavior change requires automated tests.
- Bug fixes should include a regression test where feasible.
- Security-related changes must include at least one denied-path test.
- Docs must be updated if runtime configuration or operational behavior changes.
