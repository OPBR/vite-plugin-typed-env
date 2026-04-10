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

function getPackageJson(): { name: string; version: string } {
  const pkgPath = path.join(process.cwd(), 'packages/core/package.json')
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
}

function log(color: keyof typeof colors, ...messages: string[]) {
  console.log(colors[color], ...messages, colors.reset)
}

async function main() {
  const pkg = getPackageJson()

  log('bold', '\n🚀 vite-plugin-typed-env Release Script\n')
  log('cyan', `Current version: ${pkg.version}`)
  log('yellow', '\nChoose release type:')
  log('blue', '  patch  - Bug fixes, minor changes (0.1.2 → 0.1.3)')
  log('blue', '  minor  - New features, backwards compatible (0.1.2 → 0.2.0)')
  log('blue', '  major  - Breaking changes (0.1.2 → 1.0.0)')
  log('blue', '  custom - Specify version manually')

  const releaseType = await prompt('\nEnter release type (patch/minor/major/custom): ')

  if (!['custom', 'major', 'minor', 'patch'].includes(releaseType)) {
    log('red', '\n❌ Invalid release type. Exiting.')
    process.exit(1)
  }

  let versionArg = releaseType
  if (releaseType === 'custom') {
    const customVersion = await prompt('Enter version (e.g., 1.0.0): ')
    if (!/^\d+\.\d+\.\d+/.test(customVersion)) {
      log('red', '\n❌ Invalid version format. Exiting.')
      process.exit(1)
    }
    versionArg = customVersion
  }

  log('bold', '\n📝 Step 1: Pre-release checks\n')

  log('cyan', 'Running typecheck...')
  if (!runCommand('pnpm typecheck')) {
    log('red', '❌ Typecheck failed. Fix errors before releasing.')
    process.exit(1)
  }
  log('green', '✅ Typecheck passed')

  log('cyan', 'Running lint...')
  if (!runCommand('pnpm lint')) {
    log('red', '❌ Lint failed. Fix issues before releasing.')
    process.exit(1)
  }
  log('green', '✅ Lint passed')

  log('cyan', 'Running tests...')
  if (!runCommand('pnpm test')) {
    log('red', '❌ Tests failed. Fix failing tests before releasing.')
    process.exit(1)
  }
  log('green', '✅ Tests passed')

  log('cyan', 'Running build...')
  if (!runCommand('pnpm build')) {
    log('red', '❌ Build failed. Fix build errors before releasing.')
    process.exit(1)
  }
  log('green', '✅ Build passed')

  log('bold', '\n📝 Step 2: Update version\n')

  log('cyan', `Updating version with bumpp (${versionArg})...`)
  runCommand(`bumpp ${versionArg} --execute="pnpm build" --commit "chore: release v%s" --tag "v%s"`)

  const newPkg = getPackageJson()
  log('green', `✅ Version updated: ${pkg.version} → ${newPkg.version}`)

  log('bold', '\n📝 Step 3: Package preview\n')

  log('cyan', 'Previewing package contents...')
  runCommand('cd packages/core && npm pack --dry-run')

  log('bold', '\n📝 Step 4: Ready to publish\n')

  log('yellow', 'To publish to npm:')
  log('blue', '  1. Push commits and tag to GitHub:')
  log('reset', `     git push origin feat/release-script`)
  log('reset', `     git push origin v${newPkg.version}`)
  log('blue', '  2. GitHub Actions will automatically publish to npm')
  log('blue', '  3. GitHub Release will be created automatically')

  const confirmPush = await prompt('\nPush to GitHub now? (y/n): ')

  if (confirmPush.toLowerCase() === 'y') {
    log('cyan', '\nPushing to GitHub...')
    runCommand('git push origin feat/release-script')
    runCommand(`git push origin v${newPkg.version}`)
    log('green', '\n✅ Pushed successfully!')
    log('cyan', `Check progress at: https://github.com/OPBR/vite-plugin-typed-env/actions`)
  } else {
    log('yellow', '\n⏸️  Skipped push. You can push manually later.')
    log('blue', `Remember to push the tag: git push origin v${newPkg.version}`)
  }

  log('bold', '\n🎉 Release process completed!\n')
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
  log('red', `\n❌ Error: ${err.message}`)
  process.exit(1)
})
