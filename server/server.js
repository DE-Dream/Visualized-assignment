const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
const API_PREFIX = '/api'
const STORE_PATH = path.join(__dirname, 'store.json')
const DB_PATH = path.join(__dirname, 'cet.db')
const db = new Database(DB_PATH)

db.exec(`
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registerStart TEXT NOT NULL,
  registerEnd TEXT NOT NULL,
  examDate TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS centers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regNo TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  idCard TEXT NOT NULL,
  school TEXT NOT NULL,
  level TEXT NOT NULL,
  batchId TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  centerId TEXT NOT NULL,
  ticket TEXT UNIQUE NOT NULL,
  examDate TEXT,
  centerName TEXT,
  centerAddr TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS scores (
  ticket TEXT PRIMARY KEY,
  total INTEGER NOT NULL,
  listening INTEGER NOT NULL,
  reading INTEGER NOT NULL,
  writing INTEGER NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  adminId INTEGER NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(adminId) REFERENCES admins(id)
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idCard TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS student_sessions (
  token TEXT PRIMARY KEY,
  idCard TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
`)

// Initialize default admin if not exists, or reset password to ensure access
const adminHash = crypto.createHash('sha256').update('admin123').digest('hex')
const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin')

if (existingAdmin) {
  // Always reset password to admin123 on startup to avoid login issues
  db.prepare('UPDATE admins SET passwordHash = ? WHERE id = ?').run(adminHash, existingAdmin.id)
  console.log('Admin password reset to: admin123')
} else {
  db.prepare('INSERT INTO admins (username, passwordHash, createdAt) VALUES (?, ?, ?)').run('admin', adminHash, new Date().toISOString())
  console.log('Default admin created: admin / admin123')
}

function send(res, code, data, headers) {
  res.writeHead(code, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }, headers || {}))
  res.end(typeof data === 'string' ? data : JSON.stringify(data))
}
function notFound(res, msg) {
  send(res, 404, { error: msg || 'Not Found' })
}
function badReq(res, msg) {
  send(res, 400, { error: msg || 'Bad Request' })
}
function ok(res, data) {
  send(res, 200, data)
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let buf = ''
    req.on('data', chunk => { buf += chunk })
    req.on('end', () => {
      try {
        resolve(buf ? JSON.parse(buf) : {})
      } catch (e) {
        reject(e)
      }
    })
  })
}
function pad(n, w) { return String(n).padStart(w, '0') }
function genRegNo(batchId, level, idx) {
  return `${batchId}-${level === 'CET-4' ? 'CET4' : 'CET6'}-${pad(idx, 8)}`
}
function genTicketNo(regNo) {
  let h = 0
  for (let i = 0; i < regNo.length; i++) {
    h = ((h << 5) - h) + regNo.charCodeAt(i)
    h |= 0
  }
  const n = Math.abs(h)
  return `T${String(n).padStart(10, '0').slice(-10)}`
}

function handleApi(req, res) {
  const u = url.parse(req.url, true)
  const p = u.pathname
  if (req.method === 'OPTIONS') {
    const reqHdr = req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    return send(res, 204, '', { 'Access-Control-Allow-Headers': reqHdr })
  }

  function auth() {
    const h = req.headers['authorization'] || ''
    const m = /^Bearer\s+(.+)$/.exec(h)
    if (!m) return null
    const t = m[1]
    const s = db.prepare('SELECT token, adminId, expiresAt FROM sessions WHERE token = ?').get(t)
    if (!s) return null
    if (new Date(s.expiresAt).getTime() <= Date.now()) return null
    const admin = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(s.adminId)
    if (!admin) return null
    return { token: t, admin }
  }
  function requireAuth() {
    const a = auth()
    if (!a) { send(res, 401, { error: 'Unauthorized' }); return null }
    return a
  }
  function studentAuth() {
    const h = req.headers['authorization'] || ''
    const m = /^Bearer\s+(.+)$/.exec(h)
    if (!m) return null
    const t = m[1]
    const s = db.prepare('SELECT token, idCard, expiresAt FROM student_sessions WHERE token = ?').get(t)
    if (!s) return null
    if (new Date(s.expiresAt).getTime() <= Date.now()) return null
    const idCard = s.idCard
    const reg = db.prepare('SELECT name, school, level FROM registrations WHERE idCard = ? ORDER BY createdAt DESC').get(idCard) || {}
    const stu = db.prepare('SELECT idCard, name FROM students WHERE idCard = ?').get(idCard) || {}
    return { token: t, idCard, user: { idCard, name: reg.name || stu.name || '', school: reg.school || '', level: reg.level || '' } }
  }

  if (p === API_PREFIX + '/notices' && req.method === 'GET') {
    const list = db.prepare('SELECT title, content, date FROM notices ORDER BY date DESC').all()
    return ok(res, list)
  }
  if (p === API_PREFIX + '/batches' && req.method === 'GET') {
    const list = db.prepare('SELECT id, name, registerStart, registerEnd, examDate FROM batches ORDER BY registerStart').all()
    return ok(res, list)
  }
  if (p === API_PREFIX + '/centers' && req.method === 'GET') {
    const list = db.prepare('SELECT id, name, address FROM centers ORDER BY name').all()
    return ok(res, list)
  }
  if (p === API_PREFIX + '/register' && req.method === 'POST') {
    const authUser = studentAuth()
    if (!authUser) return send(res, 401, { error: 'Unauthorized' })

    return parseBody(req).then(body => {
      const required = ['name','idCard','school','level','batchId','email','phone','centerId']
      for (const k of required) {
        if (!body[k]) return badReq(res, `Missing field: ${k}`)
      }
      if (body.idCard !== authUser.idCard) return badReq(res, '身份证号与登录用户不符')

      const count = db.prepare('SELECT COUNT(1) AS c FROM registrations').get().c
      const idx = count + 1
      const regNo = genRegNo(body.batchId, body.level, idx)
      const ticket = genTicketNo(regNo)
      const center = db.prepare('SELECT name, address FROM centers WHERE id = ?').get(body.centerId) || {}
      const batch = db.prepare('SELECT examDate FROM batches WHERE id = ?').get(body.batchId) || {}
      const record = Object.assign({}, body, {
        regNo, ticket,
        centerName: center.name || '',
        centerAddr: center.address || '',
        examDate: batch.examDate || ''
      })
      
      // Update student name in profile
      db.prepare('UPDATE students SET name = ? WHERE idCard = ?').run(record.name, authUser.idCard)

      db.prepare(`
        INSERT INTO registrations
        (regNo, name, idCard, school, level, batchId, email, phone, centerId, ticket, examDate, centerName, centerAddr, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.regNo, record.name, record.idCard, record.school, record.level, record.batchId,
        record.email, record.phone, record.centerId, record.ticket, record.examDate,
        record.centerName, record.centerAddr, new Date().toISOString()
      )
      return ok(res, {
        regNo, ticket,
        examDate: record.examDate,
        centerName: record.centerName,
        centerAddr: record.centerAddr
      })
    }).catch(() => badReq(res, 'Invalid JSON'))
  }
  if (p === API_PREFIX + '/admit' && req.method === 'GET') {
    const q = (u.query.query || '').trim()
    if (!q) return badReq(res, 'Missing query')
    const item = db.prepare(`
      SELECT name, school, level, examDate, ticket, centerName, centerAddr
      FROM registrations WHERE regNo = ? OR idCard = ?
    `).get(q, q)
    if (!item) return notFound(res, 'registration not found')
    return ok(res, item)
  }
  if (p === API_PREFIX + '/score' && req.method === 'GET') {
    const ticket = (u.query.ticket || '').trim()
    if (!ticket) return badReq(res, 'Missing ticket')
    const reg = db.prepare('SELECT name, level FROM registrations WHERE ticket = ?').get(ticket)
    const sc = db.prepare('SELECT total, listening, reading, writing FROM scores WHERE ticket = ?').get(ticket)
    if (!reg || !sc) return notFound(res, 'score not found')
    return ok(res, Object.assign({}, reg, sc))
  }
  if (p === API_PREFIX + '/registrations' && req.method === 'GET') {
    if (!requireAuth()) return
    const batchId = (u.query.batchId || '').trim()
    const level = (u.query.level || '').trim()
    let sql = 'SELECT regNo, name, school, level, ticket, batchId, centerName FROM registrations'
    const params = []
    const where = []
    if (batchId) { where.push('batchId = ?'); params.push(batchId) }
    if (level) { where.push('level = ?'); params.push(level) }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY createdAt DESC'
    const list = db.prepare(sql).all(...params)
    return ok(res, list)
  }
  if (p === API_PREFIX + '/score' && req.method === 'POST') {
    if (!requireAuth()) return
    return parseBody(req).then(body => {
      const query = (body.ticket || '').trim()
      const total = Number(body.total)
      const listening = Number(body.listening)
      const reading = Number(body.reading)
      const writing = Number(body.writing)
      if (!query) return badReq(res, 'Missing field: ticket')
      const reg = db.prepare('SELECT ticket FROM registrations WHERE ticket = ? OR idCard = ?').get(query, query)
      if (!reg) return notFound(res, 'registration not found for ticket/idCard')
      const ticket = reg.ticket
      function isValid(n) { return Number.isFinite(n) && n >= 0 }
      if (![total, listening, reading, writing].every(isValid)) return badReq(res, 'Invalid score fields')
      db.prepare(`
        INSERT INTO scores (ticket, total, listening, reading, writing, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(ticket) DO UPDATE SET
          total=excluded.total,
          listening=excluded.listening,
          reading=excluded.reading,
          writing=excluded.writing,
          updatedAt=excluded.updatedAt
      `).run(ticket, total, listening, reading, writing, new Date().toISOString())
      return ok(res, { ok: true })
    }).catch(() => badReq(res, 'Invalid JSON'))
  }
  if (p === API_PREFIX + '/login' && req.method === 'POST') {
    return parseBody(req).then(body => {
      const username = String(body.username || '').trim()
      const password = String(body.password || '')
      if (!username || !password) return badReq(res, 'Missing username or password')
      const admin = db.prepare('SELECT id, username, passwordHash FROM admins WHERE username = ?').get(username)
      const hash = crypto.createHash('sha256').update(password).digest('hex')
      if (!admin || admin.passwordHash !== hash) return send(res, 401, { error: 'Invalid credentials' })
      const token = crypto.randomBytes(24).toString('hex')
      const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      db.prepare('INSERT INTO sessions (token, adminId, expiresAt, createdAt) VALUES (?, ?, ?, ?)').run(token, admin.id, expiresAt, new Date().toISOString())
      return ok(res, { token, expiresAt, user: { username: admin.username } })
    }).catch(() => badReq(res, 'Invalid JSON'))
  }
  if (p === API_PREFIX + '/student/login' && req.method === 'POST') {
    return parseBody(req).then(body => {
      const idCard = String(body.idCard || '').trim()
      const password = String(body.password || '')
      if (!idCard || !password) return badReq(res, 'Missing idCard or password')
      const stu = db.prepare('SELECT idCard, name, passwordHash FROM students WHERE idCard = ?').get(idCard)
      const hash = crypto.createHash('sha256').update(password).digest('hex')
      if (!stu || stu.passwordHash !== hash) return send(res, 401, { error: 'Invalid credentials' })
      const token = crypto.randomBytes(24).toString('hex')
      const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      db.prepare('INSERT INTO student_sessions (token, idCard, expiresAt, createdAt) VALUES (?, ?, ?, ?)').run(token, idCard, expiresAt, new Date().toISOString())
      const reg = db.prepare('SELECT name, school, level FROM registrations WHERE idCard = ? ORDER BY createdAt DESC').get(idCard) || {}
      return ok(res, { token, expiresAt, user: { idCard, name: reg.name || stu.name || '', school: reg.school || '', level: reg.level || '' } })
    }).catch(() => badReq(res, 'Invalid JSON'))
  }
  if (p === API_PREFIX + '/student/register' && req.method === 'POST') {
    return parseBody(req).then(body => {
      const idCard = String(body.idCard || '').trim()
      const password = String(body.password || '')
      const email = String(body.email || '').trim()
      const phone = String(body.phone || '').trim()
      
      // Validation
      if (!idCard || idCard.length !== 18) return badReq(res, '身份证号不能为空，且必须为18位')
      if (!password || password.length < 6) return badReq(res, '密码需要至少6个字符')
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) ) return badReq(res, '密码需要包含字母和数字')
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq(res, '邮箱需要符合基本邮箱格式')
      if (!phone || !/^\d{11}$/.test(phone)) return badReq(res, '联系电话仅支持数字输入，且长度应为11位')
      
      // Check if idCard already exists
      const existing = db.prepare('SELECT idCard FROM students WHERE idCard = ?').get(idCard)
      if (existing) return badReq(res, '身份证号已注册')
      
      const hash = crypto.createHash('sha256').update(password).digest('hex')
      // Store user account with idCard, and save email/phone
      // Note: name is set to empty string or idCard initially since we don't ask for it during simple registration
      db.prepare('INSERT INTO students (idCard, name, email, phone, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(idCard, idCard, email, phone, hash, new Date().toISOString())
      
      return ok(res, { success: true, message: '注册成功' })
    }).catch(() => badReq(res, 'Invalid JSON'))
  }
  if (p === API_PREFIX + '/logout' && req.method === 'POST') {
    const a = auth()
    if (a) db.prepare('DELETE FROM sessions WHERE token = ?').run(a.token)
    return ok(res, { ok: true })
  }
  if (p === API_PREFIX + '/student/logout' && req.method === 'POST') {
    const a = studentAuth()
    if (a) db.prepare('DELETE FROM student_sessions WHERE token = ?').run(a.token)
    return ok(res, { ok: true })
  }
  if (p === API_PREFIX + '/me' && req.method === 'GET') {
    const a = auth()
    if (!a) return send(res, 401, { error: 'Unauthorized' })
    return ok(res, { user: a.admin })
  }
  if (p === API_PREFIX + '/student/me' && req.method === 'GET') {
    const a = studentAuth()
    if (!a) return send(res, 401, { error: 'Unauthorized' })
    return ok(res, { user: a.user })
  }
  if (p === API_PREFIX + '/openapi' && req.method === 'GET') {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'CET API', version: '1.0.0' },
      servers: [{ url: `http://localhost:${PORT}${API_PREFIX}` }],
      paths: {
        '/login': { post: { responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' } } } },
        '/logout': { post: { responses: { '200': { description: 'OK' } } } },
        '/student/login': { post: { responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' } } } },
        '/student/logout': { post: { responses: { '200': { description: 'OK' } } } },
        '/student/me': { get: { responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' } } } },
        '/me': { get: { responses: { '200': { description: 'OK' }, '401': { description: 'Unauthorized' } } } },
        '/notices': { get: { responses: { '200': { description: 'OK' } } } },
        '/batches': { get: { responses: { '200': { description: 'OK' } } } },
        '/centers': { get: { responses: { '200': { description: 'OK' } } } },
        '/registrations': {
          get: {
            parameters: [
              { name: 'batchId', in: 'query', schema: { type: 'string' } },
              { name: 'level', in: 'query', schema: { type: 'string', enum: ['CET-4','CET-6'] } }
            ],
            responses: { '200': { description: 'OK' } }
          }
        },
        '/register': {
          post: {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      idCard: { type: 'string' },
                      school: { type: 'string' },
                      level: { type: 'string', enum: ['CET-4','CET-6'] },
                      batchId: { type: 'string' },
                      email: { type: 'string' },
                      phone: { type: 'string' },
                      centerId: { type: 'string' }
                    },
                    required: ['name','idCard','school','level','batchId','email','phone','centerId']
                  }
                }
              }
            },
            responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } }
          }
        },
        '/admit': {
          get: {
            parameters: [{ name: 'query', in: 'query', schema: { type: 'string' } }],
            responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } }
          }
        },
        '/score': {
          get: {
            parameters: [{ name: 'ticket', in: 'query', schema: { type: 'string' } }],
            responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } }
          },
          post: {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: {
                type: 'object',
                properties: {
                  ticket: { type: 'string' },
                  total: { type: 'number' },
                  listening: { type: 'number' },
                  reading: { type: 'number' },
                  writing: { type: 'number' }
                },
                required: ['ticket','total','listening','reading','writing']
              } } }
            },
            responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } }
          }
        }
      }
    }
    return ok(res, spec)
  }
  return notFound(res)
}

;(function initSeed() {
  const hasNotices = db.prepare('SELECT COUNT(1) AS c FROM notices').get().c > 0
  const hasBatches = db.prepare('SELECT COUNT(1) AS c FROM batches').get().c > 0
  const hasCenters = db.prepare('SELECT COUNT(1) AS c FROM centers').get().c > 0
  const hasAdmin = db.prepare('SELECT COUNT(1) AS c FROM admins').get().c > 0
  const hasStudents = db.prepare('SELECT COUNT(1) AS c FROM students').get().c > 0
  const insertNotice = db.prepare('INSERT INTO notices (title, content, date) VALUES (?, ?, ?)')
  const insertBatch = db.prepare('INSERT INTO batches (id, name, registerStart, registerEnd, examDate) VALUES (?, ?, ?, ?, ?)')
  const insertCenter = db.prepare('INSERT INTO centers (id, name, address) VALUES (?, ?, ?)')
  const insertAdmin = db.prepare('INSERT INTO admins (username, passwordHash, createdAt) VALUES (?, ?, ?)')
  const insertStudent = db.prepare('INSERT INTO students (idCard, name, email, phone, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
  if (!hasNotices) {
    insertNotice.run('2025年上半年CET报名公告', '报名时间为3月1日至3月10日，请各校按时组织。', '2025-02-20')
    insertNotice.run('准考证打印开放时间', '打印时间预计考前7天开放，具体以学校通知为准。', '2025-05-20')
    insertNotice.run('成绩发布时间说明', '成绩预计考后45天发布，请关注本网站公告。', '2025-06-30')
  }
  if (!hasBatches) {
    insertBatch.run('2025H1', '2025年上半年', '2025-03-01', '2025-03-10', '2025-06-15')
    insertBatch.run('2025H2', '2025年下半年', '2025-09-01', '2025-09-10', '2025-12-15')
  }
  if (!hasCenters) {
    insertCenter.run('LCU-01', '聊城大学西校区考点', '山东省聊城市东昌府区东外环路1号')
    insertCenter.run('LCU-02', '聊城大学东校区考点', '山东省聊城市花园北路7号')
    insertCenter.run('LCU-03', '聊城大学体育馆考点', '聊城市花园北路体育馆内')
  }
  if (!hasAdmin) {
    const hash = crypto.createHash('sha256').update('admin123').digest('hex')
    insertAdmin.run('admin', hash, new Date().toISOString())
  }
  if (!hasStudents) {
    const demoId = '370000000000000000'
    const demoName = '示例学生'
    const demoEmail = 'demo@example.com'
    const demoPhone = '13800000000'
    const pwdHash = crypto.createHash('sha256').update('123456').digest('hex')
    insertStudent.run(demoId, demoName, demoEmail, demoPhone, pwdHash, new Date().toISOString())
  }
})()

const server = http.createServer((req, res) => {
  if (req.url.startsWith(API_PREFIX)) return handleApi(req, res)
  send(res, 404, { error: 'Only API endpoints are available on this server.' })
})
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CET API server running at http://127.0.0.1:${PORT}${API_PREFIX}/`)
})
