import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const colors = {
  blue: '\x1b[34m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
  yellow: '\x1b[33m'
}

const log = {
  error: (...messages: string[]) => console.log(colors.red, ...messages, colors.reset),
  info: (...messages: string[]) => console.log(colors.cyan, ...messages, colors.reset),
  option: (...messages: string[]) => console.log(colors.blue, ...messages, colors.reset),
  plain: (...messages: string[]) => console.log(colors.reset, ...messages),
  success: (...messages: string[]) => console.log(colors.green, ...messages, colors.reset),
  title: (...messages: string[]) => console.log(colors.bold, ...messages, colors.reset),
  warn: (...messages: string[]) => console.log(colors.yellow, ...messages, colors.reset)
}

function calculateNewVersion(current: string, releaseType: string): string {
  const parts = current.split('.').map(Number)
  const [major, minor, patch] = parts

  switch (releaseType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      // custom version
      return releaseType
  }
}

function getPackageJson(): { name: string; version: string } {
  const pkgPath = path.join(process.cwd(), 'packages/core/package.json')
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
}

async function main() {
  const pkg = getPackageJson()

  log.title('\n🚀 vite-plugin-typed-env Release Script\n')
  log.info(`Current version: ${pkg.version}`)
  log.warn('\nChoose release type:')
  log.option('  patch  - Bug fixes, minor changes (0.1.2 → 0.1.3)')
  log.option('  minor  - New features, backwards compatible (0.1.2 → 0.2.0)')
  log.option('  major  - Breaking changes (0.1.2 → 1.0.0)')
  log.option('  custom - Specify version manually')

  const releaseType = await prompt('\nEnter release type (patch/minor/major/custom): ')

  if (!['custom', 'major', 'minor', 'patch'].includes(releaseType)) {
    log.error('\n❌ Invalid release type. Exiting.')
    process.exit(1)
  }

  let versionArg = releaseType
  if (releaseType === 'custom') {
    const customVersion = await prompt('Enter version (e.g., 1.0.0): ')
    if (!/^\d+\.\d+\.\d+/.test(customVersion)) {
      log.error('\n❌ Invalid version format. Exiting.')
      process.exit(1)
    }
    versionArg = customVersion
  }

  const newVersion = calculateNewVersion(pkg.version, versionArg)

  log.title('\n📝 Step 1: Pre-release checks\n')

  log.info('Running typecheck...')
  if (!runCommand('pnpm typecheck')) {
    log.error('❌ Typecheck failed. Fix errors before releasing.')
    process.exit(1)
  }
  log.success('✅ Typecheck passed')

  log.info('Running lint...')
  if (!runCommand('pnpm lint')) {
    log.error('❌ Lint failed. Fix issues before releasing.')
    process.exit(1)
  }
  log.success('✅ Lint passed')

  log.info('Running tests...')
  if (!runCommand('pnpm test')) {
    log.error('❌ Tests failed. Fix failing tests before releasing.')
    process.exit(1)
  }
  log.success('✅ Tests passed')

  log.info('Running build...')
  if (!runCommand('pnpm build')) {
    log.error('❌ Build failed. Fix build errors before releasing.')
    process.exit(1)
  }
  log.success('✅ Build passed')

  log.title('\n📝 Step 2: Update version\n')

  // 显示版本变化预览
  log.info(`Version change: ${pkg.version} → ${newVersion}`)

  const confirmVersion = await prompt('\nConfirm version update? (y/n): ')

  if (confirmVersion.toLowerCase() !== 'y') {
    log.warn('\n⏸️  Version update cancelled. Exiting.')
    process.exit(0)
  }

  // 执行版本更新 (直接指定 packages/core/package.json)
  log.info('Updating version...')
  const bumppCmd = `pnpm exec bumpp packages/core/package.json --release ${versionArg} -y --no-push -c "chore: release v%s" -t "v%s"`
  if (!runCommand(bumppCmd)) {
    log.error('❌ Version update failed.')
    process.exit(1)
  }

  const newPkg = getPackageJson()
  log.success(`✅ Version updated: ${pkg.version} → ${newPkg.version}`)

  log.title('\n📝 Step 3: Package preview\n')

  log.info('Previewing package contents...')
  runCommand('cd packages/core && npm pack --dry-run')

  log.title('\n📝 Step 4: Ready to publish\n')

  log.warn('To publish to npm:')
  log.option('  1. Push commits and tag to GitHub:')
  log.plain(`     git push origin HEAD`)
  log.plain(`     git push origin v${newPkg.version}`)
  log.option('  2. GitHub Actions will automatically publish to npm')
  log.option('  3. GitHub Release will be created automatically')

  const confirmPush = await prompt('\nPush to GitHub now? (y/n): ')

  if (confirmPush.toLowerCase() === 'y') {
    log.info('\nPushing to GitHub...')

    // 获取当前分支名
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()

    runCommand(`git push origin ${branch}`)
    runCommand(`git push origin v${newPkg.version}`)
    log.success('\n✅ Pushed successfully!')
    log.info('Check progress at: https://github.com/OPBR/vite-plugin-typed-env/actions')
  } else {
    log.warn('\n⏸️  Skipped push. You can push manually later.')
    log.option(`git push origin HEAD && git push origin v${newPkg.version}`)
  }

  log.title('\n🎉 Release process completed!\n')
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

function runCommand(command: string, silent = false): boolean {
  try {
    execSync(command, { stdio: silent ? 'pipe' : 'inherit' })
    return true
  } catch {
    return false
  }
}

main().catch((err) => {
  log.error(`\n❌ Error: ${err.message}`)
  process.exit(1)
})