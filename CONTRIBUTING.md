# Contributing to vite-plugin-typed-env

Thanks for your interest in contributing!

## Development Setup

1. Clone the repository
2. Install dependencies with pnpm:
   ```bash
   pnpm install
   ```
3. Build the package:
   ```bash
   pnpm build
   ```
4. Run tests:
   ```bash
   pnpm test
   ```

## Project Structure

This is a monorepo using pnpm workspaces:

```
.
├── packages/
│   └── core/          # Main plugin source
│       ├── src/       # Source code
│       ├── tests/     # Unit tests
│       └── dist/      # Build output
├── .github/           # CI/CD workflows
└── eslint.config.js   # ESLint configuration
```

## Code Style

- Run linting: `pnpm lint`
- Fix lint issues: `pnpm lint:fix`
- Format code: `pnpm format`

## Pull Request Guidelines

1. Create an issue first for significant changes
2. Write tests for new features
3. Ensure all tests pass: `pnpm test`
4. Ensure linting passes: `pnpm lint`
5. Update documentation if needed

## Commit Message Format

Follow conventional commits:

- `feat: add new feature`
- `fix: fix a bug`
- `docs: update documentation`
- `refactor: refactor code`
- `test: add tests`