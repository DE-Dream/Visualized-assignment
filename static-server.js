const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

const PORT = process.env.STATIC_PORT ? Number(process.env.STATIC_PORT) : 3001
const API_PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 3000
const baseDir = __dirname
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}

function resolveFile(reqUrl) {
  const p = new URL(reqUrl, `http://localhost`).pathname || '/'
  let fp = p
  if (fp === '/' || fp === '/index.html') fp = '/index.html'
  if (fp === '/admin' || fp === '/admin/') fp = '/admin/index.html'
  const rel = path.normalize(fp).replace(/^(\.\.[/\\])+/, '')
  const full = path.join(baseDir, rel)
  if (!full.startsWith(baseDir)) return null
  return full
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api')) {
    const proxyReq = http.request({ hostname: 'localhost', port: API_PORT, path: req.url, method: req.method, headers: req.headers }, proxyRes => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
      proxyRes.pipe(res)
    })
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Bad gateway')
    })
    req.pipe(proxyReq)
    return
  }
  const filePath = resolveFile(req.url)
  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('File not found')
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end(err.code === 'ENOENT' ? 'File not found' : 'Server error')
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
    res.end(content)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Static server at http://localhost:${PORT}/`)
})
