const { spawn } = require('child_process')

function run(name, cmd, args, env) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, cwd: __dirname, stdio: 'inherit' })
  p.on('exit', code => {
    console.log(`${name} exited with code ${code}`)
  })
  return p
}

const NODE_PATH = process.execPath;
const api = run('api', NODE_PATH, ['server/server.js'], { PORT: '3000' })

process.on('SIGINT', () => {
  try { api.kill('SIGINT') } catch {}
  process.exit(0)
})
