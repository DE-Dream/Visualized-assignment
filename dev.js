const { spawn } = require('child_process')

function run(name, cmd, args, env) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, cwd: __dirname, stdio: 'inherit' })
  p.on('exit', code => {
    console.log(`${name} exited with code ${code}`)
  })
  return p
}

const api = run('api', 'node', ['server/server.js'], { PORT: '3001' })
const staticSrv = run('static', 'node', ['static-server.js'], { STATIC_PORT: '3000', API_PORT: '3001' })

process.on('SIGINT', () => {
  try { api.kill('SIGINT') } catch {}
  try { staticSrv.kill('SIGINT') } catch {}
  process.exit(0)
})
