import { describe, expect, it } from 'vitest'

import { generateDts, generateZodSchema } from '../src/generator'
import { inferType } from '../src/inferrer'
import { parseEnvFile } from '../src/parser'

// ─── Parser ──────────────────────────────────────────────────────────────────

describe('parseEnvFile', () => {
  it('parses basic key=value', () => {
    const result = parseEnvFile('PORT=3000\nHOST=localhost')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ key: 'PORT', value: '3000' })
    expect(result[1]).toMatchObject({ key: 'HOST', value: 'localhost' })
  })

  it('strips quotes', () => {
    const result = parseEnvFile(`DB_URL="postgres://localhost/mydb"`)
    expect(result[0].value).toBe('postgres://localhost/mydb')
  })

  it('parses @type annotation', () => {
    const result = parseEnvFile(`# @type: enum(info, warn, error)\nLOG_LEVEL=info`)
    expect(result[0].annotations.type).toBe('enum(info, warn, error)')
  })

  it('parses @optional annotation', () => {
    const result = parseEnvFile(`# @optional\nSENTRY_DSN=`)
    expect(result[0].annotations.optional).toBe(true)
  })

  it('parses @default annotation', () => {
    const result = parseEnvFile(`# @default: 3000\nPORT=`)
    expect(result[0].annotations.default).toBe('3000')
  })

  it('ignores empty lines and resets comment buffer', () => {
    const result = parseEnvFile(`# @optional\n\nPORT=3000`)
    expect(result[0].annotations.optional).toBeUndefined()
  })

  it('parses description comment', () => {
    const result = parseEnvFile(`# Database connection string\nDATABASE_URL=postgres://localhost/db`)
    expect(result[0].annotations.description).toBe('Database connection string')
  })
})

// ─── Inferrer ────────────────────────────────────────────────────────────────

describe('inferType', () => {
  const make = (value: string, annType?: string, optional?: boolean) =>
    inferType({
      annotations: { optional, type: annType },
      comment: '',
      key: 'TEST',
      value
    })

  it('infers number from numeric string', () => {
    const r = make('3000')
    expect(r.tsType).toBe('number')
    expect(r.zodSchema).toContain('z.coerce.number()')
  })

  it('infers boolean from true/false', () => {
    const r = make('true')
    expect(r.tsType).toBe('boolean')
  })

  it('infers string for plain string', () => {
    const r = make('hello')
    expect(r.tsType).toBe('string')
  })

  it('infers url type for http URLs', () => {
    const r = make('https://api.example.com')
    expect(r.zodSchema).toContain('.url()')
  })

  it('infers number[] for comma-separated numbers', () => {
    const r = make('1,2,3')
    expect(r.tsType).toBe('number[]')
  })

  it('infers string[] for comma-separated strings', () => {
    const r = make('a,b,c')
    expect(r.tsType).toBe('string[]')
  })

  it('respects @type: enum annotation', () => {
    const r = make('info', 'enum(info, warn, error)')
    expect(r.tsType).toBe("'info' | 'warn' | 'error'")
    expect(r.zodSchema).toContain("z.enum(['info', 'warn', 'error'])")
  })

  it('respects @type: url annotation', () => {
    const r = make('not-a-url', 'url')
    expect(r.zodSchema).toContain('.url()')
  })

  it('marks empty value as optional', () => {
    const r = make('')
    expect(r.isOptional).toBe(true)
  })

  it('marks @optional annotated entry as optional', () => {
    const r = make('value', undefined, true)
    expect(r.isOptional).toBe(true)
    expect(r.zodSchema).toContain('.optional()')
  })
})

// ─── Generator ───────────────────────────────────────────────────────────────

describe('generateDts', () => {
  const items = [
    {
      entry: { annotations: { description: 'Server port' }, comment: '', key: 'PORT', value: '3000' },
      inferred: { isOptional: false, tsType: 'number', zodSchema: 'z.coerce.number()' }
    },
    {
      entry: { annotations: { optional: true }, comment: '', key: 'SENTRY_DSN', value: '' },
      inferred: { isOptional: true, tsType: 'string', zodSchema: 'z.string().optional()' }
    }
  ]

  it('generates ImportMetaEnv augmentation', () => {
    const output = generateDts(items, { augmentImportMeta: true, schema: 'zod' })
    expect(output).toContain('interface ImportMetaEnv')
    expect(output).toContain('readonly PORT: number')
    expect(output).toContain('readonly SENTRY_DSN?: string')
  })

  it('includes JSDoc from description', () => {
    const output = generateDts(items, { augmentImportMeta: true, schema: 'zod' })
    expect(output).toContain('/** Server port */')
  })
})

describe('generateZodSchema', () => {
  const items = [
    {
      entry: { annotations: {}, comment: '', key: 'DATABASE_URL', value: 'postgres://localhost/db' },
      inferred: { isOptional: false, tsType: 'string', zodSchema: 'z.string().url()' }
    }
  ]

  it('generates valid zod schema', () => {
    const output = generateZodSchema(items)
    expect(output).toContain("import { z } from 'zod'")
    expect(output).toContain('export const envSchema = z.object({')
    expect(output).toContain('DATABASE_URL: z.string().url()')
    expect(output).toContain('export type Env = z.infer<typeof envSchema>')
  })
})
