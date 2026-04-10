import fs from 'node:fs'
import path from 'node:path'

import type { Plugin, ResolvedConfig } from 'vite'

import { generateDts, generateLoader, generateZodSchema } from './generator'
import { inferType } from './inferrer'
import { type EnvEntry, parseEnvFile } from './parser'

export interface EnvTsOptions {
  /**
   * 是否扩展 Vite 的 ImportMetaEnv 类型
   * 开启后 import.meta.env.YOUR_VAR 自动有类型
   * @default true
   */
  augmentImportMeta?: boolean
  /**
   * 额外监听的 .env 文件（默认自动检测 .env, .env.local 等）
   */
  envFiles?: string[]
  /**
   * 生成文件的输出目录（相对于项目根目录）
   * @default 'src'
   */
  output?: string
  /**
   * 生成 Zod schema 文件
   * @default 'zod'
   */
  schema?: 'zod' | false
  /**
   * 缺失必填变量时是否让构建失败
   * @default true
   */
  strict?: boolean
}

// ─── 核心函数 ─────────────────────────────────────────────────────────────────

export default function envTs(userOptions: EnvTsOptions = {}): Plugin {
  const options: Required<EnvTsOptions> = {
    augmentImportMeta: true,
    envFiles: [],
    output: 'src',
    schema: 'zod',
    strict: true,
    ...userOptions
  }

  let config: ResolvedConfig
  let outputDir: string

  return {
    async buildStart() {
      const envDir = config.envDir === false ? config.root : config.envDir
      await generateTypes(envDir, outputDir, options)
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig
      outputDir = path.resolve(config.root, options.output)
    },

    enforce: 'pre', // 在其他插件之前运行，确保类型文件先生成

    async handleHotUpdate({ file, server }) {
      if (!file) return

      const fileName = path.basename(file)
      const isEnvFile = fileName.startsWith('.env') || options.envFiles.includes(file)

      if (!isEnvFile) return

      console.log(`[env-ts] Detected change in ${fileName}, regenerating...`)
      const envDir = config.envDir === false ? config.root : config.envDir
      await generateTypes(envDir, outputDir, options)

      // 通知 client 有文件更新（触发 TS 语言服务刷新）
      server.hot.send({ type: 'full-reload' })
    },

    name: 'vite-plugin-typed-env'
  }
}

export async function generateTypes(envDir: string, outputDir: string, options: Required<EnvTsOptions>): Promise<void> {
  // 1. 找到所有 .env 文件（按优先级顺序读取，后面的覆盖前面的）
  const envFileNames = [
    '.env',
    '.env.local',
    `.env.${process.env.NODE_ENV ?? 'development'}`,
    `.env.${process.env.NODE_ENV ?? 'development'}.local`,
    ...options.envFiles
  ]

  const entries = new Map<string, EnvEntry>()

  for (const fileName of envFileNames) {
    const filePath = path.join(envDir, fileName)
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = parseEnvFile(content)

    // 后读的文件覆盖先读的（保留注释/annotation）
    for (const entry of parsed) {
      entries.set(entry.key, entry)
    }
  }

  if (entries.size === 0) {
    console.warn('[env-ts] No .env files found or all are empty, skipping generation.')
    return
  }

  // 2. 对每个变量做类型推断
  const items = Array.from(entries.values()).map((entry) => ({
    entry,
    inferred: inferType(entry)
  }))

  // strict 模式：检查必填变量在 process.env 里是否真实存在
  if (options.strict) {
    const missing = items
      .filter(({ inferred }) => !inferred.isOptional && inferred.defaultValue === undefined)
      .filter(({ entry }) => {
        const v = process.env[entry.key]
        return v === undefined || v === ''
      })
      .map(({ entry }) => entry.key)

    if (missing.length > 0) {
      // 开发时警告，构建时报错
      const msg = `[env-ts] Missing required env variables: ${missing.join(', ')}`
      if (process.env.NODE_ENV === 'production') {
        throw new Error(msg)
      } else {
        console.warn(msg)
      }
    }
  }

  // 3. 确保输出目录存在
  fs.mkdirSync(outputDir, { recursive: true })

  const genOptions = {
    augmentImportMeta: options.augmentImportMeta,
    schema: options.schema
  }

  // 4. 生成 env.d.ts
  const dtsContent = generateDts(items, genOptions)
  writeIfChanged(path.join(outputDir, 'env.d.ts'), dtsContent)

  // 5. 生成 env.schema.ts（可选）
  if (options.schema === 'zod') {
    const schemaContent = generateZodSchema(items)
    writeIfChanged(path.join(outputDir, 'env.schema.ts'), schemaContent)
  }

  // 6. 生成 env.ts（运行时 loader）
  const loaderContent = generateLoader(items, genOptions)
  writeIfChanged(path.join(outputDir, 'env.ts'), loaderContent)

  console.log(`[env-ts] Generated ${items.length} env types → ${path.relative(process.cwd(), outputDir)}/`)
}

// ─── Vite 插件 ────────────────────────────────────────────────────────────────

// 只在内容变化时写文件，避免触发不必要的热更新
function writeIfChanged(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf-8')
    if (existing === content) return
  }
  fs.writeFileSync(filePath, content, 'utf-8')
}
