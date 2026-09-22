import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const target = process.argv[2]
if (target !== 'staging' && target !== 'production') {
  console.error('Deployment requires an explicit staging or production target.')
  process.exit(1)
}

if (process.env.CACTIGROW_DEPLOY_CONFIRM !== target) {
  console.error(`Refusing ${target} deployment. Set CACTIGROW_DEPLOY_CONFIRM=${target} after completing the runbook checks.`)
  process.exit(1)
}

const result = spawnSync(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'deploy', '--env', target, '--config', 'wrangler.jsonc'], {
  stdio: 'inherit',
  shell: false,
})
if (result.error) console.error(`Wrangler did not start: ${result.error.message}`)
process.exit(result.status ?? 1)
