import type { EnvEntry } from './parser'

export interface InferredType {
  tsType: string // TypeScript 类型字符串
  zodSchema: string // Zod schema 字符串
  isOptional: boolean
  defaultValue?: string
}

// 判断是否是布尔值
function isBoolean(v: string): boolean {
  return ['true', 'false', '1', '0', 'yes', 'no'].includes(v.toLowerCase())
}

// 判断是否是纯数字
function isNumber(v: string): boolean {
  return v !== '' && !isNaN(Number(v))
}

// 判断是否是 URL
function isUrl(v: string): boolean {
  try {
    new URL(v)
    return v.startsWith('http://') || v.startsWith('https://') || v.includes('://') // postgres://, redis:// 等
  } catch {
    return false
  }
}

// 判断是否是逗号分隔的数字列表
function isNumberArray(v: string): boolean {
  if (!v.includes(',')) return false
  return v.split(',').every((s) => isNumber(s.trim()))
}

// 判断是否是逗号分隔的字符串列表
function isStringArray(v: string): boolean {
  return v.includes(',') && v.split(',').length > 1
}

// 解析 @type 注释指令
function inferFromAnnotation(ann: string): Pick<InferredType, 'tsType' | 'zodSchema'> | null {
  // @type: enum(a, b, c)
  const enumMatch = ann.match(/^enum\((.+)\)$/)
  if (enumMatch) {
    const values = enumMatch[1].split(',').map((s) => s.trim())
    const tsLiterals = values.map((v) => `'${v}'`).join(' | ')
    const zodValues = values.map((v) => `'${v}'`).join(', ')
    return {
      tsType: tsLiterals,
      zodSchema: `z.enum([${zodValues}])`
    }
  }

  // @type: number[]
  if (ann === 'number[]') {
    return {
      tsType: 'number[]',
      zodSchema: `z.string().transform(v => v.split(',').map(Number))`
    }
  }

  // @type: string[]
  if (ann === 'string[]') {
    return {
      tsType: 'string[]',
      zodSchema: `z.string().transform(v => v.split(','))`
    }
  }

  // @type: url
  if (ann === 'url') {
    return { tsType: 'string', zodSchema: `z.string().url()` }
  }

  // @type: number
  if (ann === 'number') {
    return { tsType: 'number', zodSchema: `z.coerce.number()` }
  }

  // @type: boolean
  if (ann === 'boolean') {
    return {
      tsType: 'boolean',
      zodSchema: `z.enum(['true','false','1','0']).transform(v => v === 'true' || v === '1')`
    }
  }

  // @type: port
  if (ann === 'port') {
    return { tsType: 'number', zodSchema: `z.coerce.number().int().min(1).max(65535)` }
  }

  // @type: email
  if (ann === 'email') {
    return { tsType: 'string', zodSchema: `z.string().email()` }
  }

  return null
}

// 从值自动推断类型
function inferFromValue(value: string): Pick<InferredType, 'tsType' | 'zodSchema'> {
  if (value === '') {
    return { tsType: 'string', zodSchema: 'z.string()' }
  }

  if (isBoolean(value)) {
    return {
      tsType: 'boolean',
      zodSchema: `z.enum(['true','false','1','0','yes','no']).transform(v => ['true','1','yes'].includes(v.toLowerCase()))`
    }
  }

  if (isNumber(value)) {
    // 区分整数和浮点
    const schema = Number.isInteger(Number(value)) ? 'z.coerce.number().int()' : 'z.coerce.number()'
    return { tsType: 'number', zodSchema: schema }
  }

  if (isNumberArray(value)) {
    return {
      tsType: 'number[]',
      zodSchema: `z.string().transform(v => v.split(',').map(Number))`
    }
  }

  if (isUrl(value)) {
    return { tsType: 'string', zodSchema: 'z.string().url()' }
  }

  if (isStringArray(value)) {
    return {
      tsType: 'string[]',
      zodSchema: `z.string().transform(v => v.split(',').map(s => s.trim()))`
    }
  }

  return { tsType: 'string', zodSchema: 'z.string().min(1)' }
}

export function inferType(entry: EnvEntry): InferredType {
  const { value, annotations } = entry
  const isOptional = annotations.optional === true || value === ''

  // 优先使用 @type 注释
  const fromAnnotation = annotations.type ? inferFromAnnotation(annotations.type) : null

  const base = fromAnnotation ?? inferFromValue(value)

  let zodSchema = base.zodSchema
  // 处理 optional 和 default
  if (annotations.default !== undefined) {
    zodSchema = `${zodSchema}.default('${annotations.default}')`
  } else if (isOptional) {
    zodSchema = `${zodSchema}.optional()`
  }

  return {
    tsType: base.tsType,
    zodSchema,
    isOptional,
    defaultValue: annotations.default
  }
}
