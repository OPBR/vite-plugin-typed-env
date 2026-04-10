# vite-plugin-typed-env

A Vite plugin that automatically generates TypeScript types and Zod schemas from your `.env` files.

## Packages

| Package | Description |
|---------|-------------|
| [`vite-plugin-typed-env`](./packages/core) | Core plugin |

## Features

- **Auto-generated TypeScript types** - `env.d.ts` with proper type inference
- **Zod schema generation** - Runtime validation with `env.schema.ts`
- **Runtime loader** - `env.ts` that validates and exposes typed environment variables
- **Vite `import.meta.env` augmentation** - Full type support for Vite's env system
- **Hot reload** - Automatically regenerate types when `.env` files change
- **Smart type inference** - Auto-detects types from values (boolean, number, URL, arrays, etc.)
- **Annotation support** - Fine-grained type control via special comments

## Quick Start

```bash
npm install vite-plugin-typed-env -D
npm install zod
```

```ts
// vite.config.ts
import envTs from 'vite-plugin-typed-env'

export default defineConfig({
  plugins: [envTs()]
})
```

See [packages/core/README.md](./packages/core/README.md) for full documentation.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
```

## License

[MIT](./LICENSE)