# Contributing

## Development workflow
- Create a feature branch from `main`/`master`.
- Keep changes small and focused; avoid unrelated refactors in the same PR.
- Use clear commits that explain *why* the change is needed.

## Local quality gates
- Run `./scripts/run.sh` and use the `Test` option before opening a PR.
- For parity with CI, run frontend checks/tests and backend tests locally when touching both stacks.

## Pull request checklist
- Problem statement and scope are clear.
- Security and failure modes were considered for API, mobile, and CI changes.
- Tests were added/updated for non-trivial behavior.
- Docs were updated when behavior, config, or operations changed.
- No generated artifacts are committed unintentionally.

## Security and secrets
- Never commit secrets, API tokens, or private keys.
- Use environment variables or secret managers for credentials.
- Report vulnerabilities privately following `SECURITY.md`.

## API and compatibility
- Keep `backend/openapi.yaml` aligned with runtime behavior.
- If request/response semantics change, update frontend callers and tests in the same PR.
