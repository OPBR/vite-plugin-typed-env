# vite-plugin-typed-env

A Vite plugin that automatically generates TypeScript types and Zod schemas from your `.env` files.

## Features

- **Auto-generated TypeScript types** - `env.d.ts` with proper type inference
- **Zod schema generation** - Runtime validation with `env.schema.ts`
- **Runtime loader** - `env.ts` that validates and exposes typed environment variables
- **Vite `import.meta.env` augmentation** - Full type support for Vite's env system
- **Hot reload** - Automatically regenerate types when `.env` files change
- **Smart type inference** - Auto-detects types from values (boolean, number, URL, arrays, etc.)
- **Annotation support** - Fine-grained type control via special comments

## Installation

```bash
npm install vite-plugin-typed-env -D
```

If using Zod validation (default), also install zod:

```bash
npm install zod
```

## Usage

### 1. Add to Vite config

```ts
// vite.config.ts
import envTs from 'vite-plugin-typed-env'

export default defineConfig({
  plugins: [envTs()]
})
```

### 2. Write your `.env` file

```env
# Database configuration
DATABASE_URL=postgres://localhost:5432/mydb

# API keys
# @optional
API_KEY=

# Server settings
# @type: port
# @desc: The port the server listens on
PORT=3000

# Feature flags
# @type: boolean
DEBUG=true

# Allowed origins (comma-separated)
# @type: string[]
ALLOWED_ORIGINS=http://localhost,https://example.com
```

### 3. Generated files

The plugin generates three files in your configured output directory (default: `src/`):

#### `env.d.ts` - TypeScript declarations

```ts
interface ImportMetaEnv {
  readonly DATABASE_URL: string
  readonly API_KEY?: string
  /** The port the server listens on */
  readonly PORT: number
  readonly DEBUG: boolean
  readonly ALLOWED_ORIGINS: string[]
}
```

#### `env.schema.ts` - Zod validation schema

```ts
import { z } from 'zod'

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  API_KEY: z.string().optional(),
  // The port the server listens on
  PORT: z.coerce.number().int().min(1).max(65535),
  DEBUG: z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1'),
  ALLOWED_ORIGINS: z.string().transform((v) => v.split(',').map((s) => s.trim()))
})

export type Env = z.infer<typeof envSchema>
```

#### `env.ts` - Runtime loader

```ts
import { envSchema } from './env.schema'

const _parsed = envSchema.safeParse(import.meta.env)

if (!_parsed.success) {
  throw new Error('[env-ts] Invalid environment variables')
}

export const env = _parsed.data
export default env
```

### 4. Use in your code

```ts
// With schema validation
import env from './env'

console.log(env.PORT) // fully typed!

// Or use Vite's import.meta.env
console.log(import.meta.env.PORT) // also typed!
```

## Annotations

Control type generation with special comments:

| Annotation  | Example                | Description                      |
| ----------- | ---------------------- | -------------------------------- |
| `@type`     | `# @type: number`      | Override inferred type           |
| `@optional` | `# @optional`          | Mark variable as optional        |
| `@default`  | `# @default: 8080`     | Provide default value            |
| `@desc`     | `# @desc: Server port` | Add description (shows in JSDoc) |

### Supported `@type` values

| Type          | TypeScript          | Zod Schema                                            |
| ------------- | ------------------- | ----------------------------------------------------- |
| `number`      | `number`            | `z.coerce.number()`                                   |
| `boolean`     | `boolean`           | `z.enum([...]).transform()`                           |
| `url`         | `string`            | `z.string().url()`                                    |
| `port`        | `number`            | `z.coerce.number().int().min(1).max(65535)`           |
| `email`       | `string`            | `z.string().email()`                                  |
| `string[]`    | `string[]`          | `z.string().transform(v => v.split(','))`             |
| `number[]`    | `number[]`          | `z.string().transform(v => v.split(',').map(Number))` |
| `enum(a,b,c)` | `'a' \| 'b' \| 'c'` | `z.enum(['a','b','c'])`                               |

## Options

```ts
envTs({
  // Generate Zod schema file
  // @default 'zod'
  schema: 'zod' | false,

  // Output directory (relative to project root)
  // @default 'src'
  output: 'src',

  // Augment Vite's ImportMetaEnv type
  // @default true
  augmentImportMeta: true,

  // Fail build if required vars are missing
  // @default true
  strict: true,

  // Additional .env files to watch
  // @default []
  envFiles: ['.env.custom']
})
```

## Type Inference

The plugin automatically infers types from values:

| Value Pattern                          | Inferred Type                  |
| -------------------------------------- | ------------------------------ |
| `true`, `false`, `1`, `0`, `yes`, `no` | `boolean`                      |
| Pure numbers (`3000`, `3.14`)          | `number`                       |
| URLs (`http://...`, `postgres://...`)  | `string` (with URL validation) |
| Comma-separated numbers (`1,2,3`)      | `number[]`                     |
| Comma-separated strings (`a,b,c`)      | `string[]`                     |
| Empty value                            | `string` (optional)            |
| Everything else                        | `string`                       |

## Env File Priority

Files are loaded in this order (later overrides earlier):

1. `.env`
2. `.env.local`
3. `.env.{NODE_ENV}`
4. `.env.{NODE_ENV}.local`

## License

MIT
