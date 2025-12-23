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

// 静态文件类型映射
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// 解析文件路径
function resolveFile(reqUrl) {
  // 使用WHATWG URL API解析URL，移除查询参数
  const urlObj = new URL(reqUrl, 'http://localhost');
  let p = urlObj.pathname;
  if (p === '/' || p === '/index.html') p = '/index.html';
  if (p === '/admin' || p === '/admin/') p = '/admin/index.html';
  const rel = path.normalize(p).replace(/^\/\.\.[/\\]+/, ''); // 防止路径遍历攻击
  const full = path.join(__dirname, '..', rel);
  if (!full.startsWith(path.join(__dirname, '..'))) return null; // 验证路径在项目内
  return full;
}

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
  paymentStatus TEXT DEFAULT 'unpaid',
  examStatus TEXT DEFAULT 'registered',
  createdAt TEXT NOT NULL,
  UNIQUE(idCard, batchId)
);
CREATE TABLE IF NOT EXISTS scores (
  ticket TEXT PRIMARY KEY,
  total INTEGER NOT NULL,
  listening INTEGER NOT NULL,
  reading INTEGER NOT NULL,
  writing INTEGER NOT NULL,
  oral INTEGER,
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
  gender TEXT,
  email TEXT,
  phone TEXT,
  school TEXT,
  photo TEXT,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS student_sessions (
  token TEXT PRIMARY KEY,
  idCard TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reset_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS academic_info (
  idCard TEXT PRIMARY KEY,
  school TEXT NOT NULL,
  campus TEXT NOT NULL,
  education TEXT NOT NULL,
  lengthOfSchooling INTEGER NOT NULL,
  enrollmentYear INTEGER NOT NULL,
  grade TEXT NOT NULL,
  department TEXT NOT NULL,
  major TEXT NOT NULL,
  class TEXT NOT NULL,
  studentId TEXT NOT NULL,
  FOREIGN KEY(idCard) REFERENCES students(idCard)
);
CREATE TABLE IF NOT EXISTS cet6_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idCard TEXT NOT NULL,
  cet4Ticket TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/auto-pass/manual-pending/manual-pass/manual-fail
  applyTime TEXT NOT NULL,
  reviewTime TEXT,
  reviewerId INTEGER,
  FOREIGN KEY(reviewerId) REFERENCES admins(id)
);
CREATE TABLE IF NOT EXISTS exam_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batchId TEXT NOT NULL,
  level TEXT NOT NULL,
  totalStudents INTEGER NOT NULL,
  cet4Count INTEGER NOT NULL,
  cet6Count INTEGER NOT NULL,
  newCampusCount INTEGER NOT NULL,
  oldCampusCount INTEGER NOT NULL,
  roomCount INTEGER NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS classrooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  building TEXT NOT NULL,
  floor INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  school TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS exam_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classroomId TEXT NOT NULL,
  batchId TEXT NOT NULL,
  level TEXT NOT NULL,
  examDate TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  supervisor1 TEXT,
  supervisor2 TEXT,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(classroomId) REFERENCES classrooms(id)
);
CREATE TABLE IF NOT EXISTS exam_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regNo TEXT NOT NULL,
  ticket TEXT NOT NULL,
  examRoomId INTEGER NOT NULL,
  seatNumber INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  FOREIGN KEY(regNo) REFERENCES registrations(regNo),
  FOREIGN KEY(examRoomId) REFERENCES exam_rooms(id)
);
`)

// 简单但可靠的密码哈希函数
function hashPassword(password) {
  // 使用 SHA256 哈希，这是简单可靠的方法
  return crypto.createHash('sha256').update(password).digest('hex')
}

// 验证密码
function verifyPassword(password, hash) {
  // 直接比较哈希值
  const inputHash = crypto.createHash('sha256').update(password).digest('hex')
  return inputHash === hash
}

// Initialize default admin if not exists, or reset password to ensure access
const adminHash = hashPassword('admin123')
const existingAdmin = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin')

if (existingAdmin) {
  // Always reset password to admin123 on startup to avoid login issues
  db.prepare('UPDATE admins SET passwordHash = ? WHERE id = ?').run(adminHash, existingAdmin.id)
  console.log('✓ Admin password reset to: admin123')
  console.log('Admin hash:', adminHash)
} else {
  db.prepare('INSERT INTO admins (username, passwordHash, createdAt) VALUES (?, ?, ?)').run('admin', adminHash, new Date().toISOString())
  console.log('✓ Default admin created: admin / admin123')
  console.log('Admin hash:', adminHash)
}



// 简化CORS配置，允许所有来源

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
  console.log('404 Not Found:', msg)
  send(res, 404, { error: msg || 'Not Found' })
}
function badReq(res, msg) {
  console.log('400 Bad Request:', msg)
  send(res, 400, { error: msg || 'Bad Request' })
}
function ok(res, data) {
  send(res, 200, data)
}
function unauthorized(res, msg) {
  console.log('401 Unauthorized:', msg)
  send(res, 401, { error: msg || 'Unauthorized' })
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
function normalizeQueryValue(value) {
  if (typeof value !== 'string') return ''
  const val = value.trim()
  const lower = val.toLowerCase()
  if (val.length === 0 || lower === 'undefined' || lower === 'null') return ''
  return val
}

function handleApi(req, res) {
  const u = new URL(req.url, 'http://localhost')
  const p = u.pathname
  if (req.method === 'OPTIONS') {
    const reqHdr = req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    return send(res, 204, '', { 'Access-Control-Allow-Headers': reqHdr })
  }

  function auth() {
    const h = req.headers['authorization'] || ''
    console.log('Auth header:', h.substring(0, 20) + '...')
    const m = /^Bearer\s+(.+)$/.exec(h)
    if (!m) {
      console.log('No Bearer token found')
      return null
    }
    const t = m[1]
    const s = db.prepare('SELECT token, adminId, expiresAt FROM sessions WHERE token = ?').get(t)
    if (!s) {
      console.log('Session not found for token')
      return null
    }
    if (new Date(s.expiresAt).getTime() <= Date.now()) {
      console.log('Session expired')
      return null
    }
    const admin = db.prepare('SELECT id, username FROM admins WHERE id = ?').get(s.adminId)
    if (!admin) {
      console.log('Admin not found for session')
      return null
    }
    console.log('Auth successful for admin:', admin.username)
    return { token: t, admin }
  }
  function requireAuth() {
    const a = auth()
    if (!a) { 
      console.log('Require auth failed')
      unauthorized(res, 'Unauthorized')
      return null 
    }
    return a
  }
  function studentAuth() {
    const h = req.headers['authorization'] || ''
    console.log('Student auth header:', h.substring(0, 20) + '...')
    const m = /^Bearer\s+(.+)$/.exec(h)
    if (!m) {
      console.log('No Bearer token found for student')
      return null
    }
    const t = m[1]
    const s = db.prepare('SELECT token, idCard, expiresAt FROM student_sessions WHERE token = ?').get(t)
    if (!s) {
      console.log('Student session not found')
      return null
    }
    if (new Date(s.expiresAt).getTime() <= Date.now()) {
      console.log('Student session expired')
      return null
    }
    const idCard = s.idCard
    const reg = db.prepare('SELECT name, school, level FROM registrations WHERE idCard = ? ORDER BY createdAt DESC').get(idCard) || {}
    const stu = db.prepare('SELECT idCard, name, gender, school FROM students WHERE idCard = ?').get(idCard) || {}
    console.log('Student auth successful for:', idCard)
    return { token: t, idCard, user: { idCard, name: reg.name || stu.name || '', gender: stu.gender || '', school: reg.school || stu.school || '', level: reg.level || '' } }
  }

  // 模板读取函数
  function loadTemplate(templatePath) {
    try {
      return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
      console.error('Error loading template:', error);
      return null;
    }
  }

  // 渲染模板函数
  function renderTemplate(template, data) {
    let html = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value || '');
    }
    return html;
  }

  if (p === API_PREFIX + '/notices' && req.method === 'GET') {
    const list = db.prepare('SELECT title, content, date FROM notices ORDER BY date DESC').all()
    console.log('Returning notices:', list.length)
    return ok(res, list)
  }
  if (p === API_PREFIX + '/batches' && req.method === 'GET') {
    const list = db.prepare('SELECT id, name, registerStart, registerEnd, examDate FROM batches ORDER BY registerStart').all()
    console.log('Returning batches:', list.length)
    return ok(res, list)
  }
  if (p === API_PREFIX + '/centers' && req.method === 'GET') {
    const list = db.prepare('SELECT id, name, address FROM centers ORDER BY name').all()
    console.log('Returning centers:', list.length)
    return ok(res, list)
  }
  if (p === API_PREFIX + '/register' && req.method === 'POST') {
    const authUser = studentAuth()
    if (!authUser) return unauthorized(res, 'Unauthorized')

    return parseBody(req).then(body => {
      console.log('Registration body:', body)
      const required = ['name','idCard','school','level','batchId','centerId']
      for (const k of required) {
        if (!body[k]) return badReq(res, `Missing field: ${k}`)
      }
      if (body.idCard !== authUser.idCard) return badReq(res, '身份证号与登录用户不符')
      
      // 检查是否已经注册过同一批次
      const existing = db.prepare('SELECT id FROM registrations WHERE idCard = ? AND batchId = ?').get(body.idCard, body.batchId)
      if (existing) return badReq(res, '您已经为该批次报名，不可重复报名')
      
      // 从学生资料中获取email和phone信息
      const student = db.prepare('SELECT email, phone FROM students WHERE idCard = ?').get(authUser.idCard)
      if (!student) return badReq(res, '学生信息不存在')
      
      // 将email和phone添加到body中
      body.email = student.email
      body.phone = student.phone

      const count = db.prepare('SELECT COUNT(1) AS c FROM registrations').get().c
      const idx = count + 1
      const regNo = genRegNo(body.batchId, body.level, idx)
      const ticket = genTicketNo(regNo)
      
      // 处理考点信息：如果没有找到对应考点，使用学校名称作为考点
      let center = db.prepare('SELECT name, address FROM centers WHERE id = ?').get(body.centerId) || {}
      
      // 如果没有找到考点，使用学校名称作为考点
      if (!center.name || !center.address) {
        center.name = body.school || '未知考点'
        center.address = body.school || '未知地址'
        
        // 检查是否已存在该学校的考点，如果不存在则创建
        const existingCenter = db.prepare('SELECT id FROM centers WHERE name = ?').get(body.school)
        if (!existingCenter) {
          // 创建新考点，使用学校名称的哈希值作为ID，确保唯一性
          const newCenterId = crypto.createHash('md5').update(body.school).digest('hex').substring(0, 10)
          db.prepare('INSERT INTO centers (id, name, address) VALUES (?, ?, ?)').run(
            newCenterId, 
            center.name, 
            center.address
          )
        }
      }
      
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
        (regNo, name, idCard, school, level, batchId, email, phone, centerId, ticket, examDate, centerName, centerAddr, paymentStatus, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.regNo, record.name, record.idCard, record.school, record.level, record.batchId,
        record.email, record.phone, record.centerId, record.ticket, record.examDate,
        record.centerName, record.centerAddr, 'unpaid', new Date().toISOString()
      )
      
      console.log('Registration successful:', record)
      return ok(res, {
        regNo, ticket,
        examDate: record.examDate,
        centerName: record.centerName,
        centerAddr: record.centerAddr
      })
    }).catch((err) => {
      console.error('Registration error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  if (p === API_PREFIX + '/admit' && req.method === 'GET') {
    const q = (u.searchParams.get('query') || '').trim()
    console.log('Admit query:', q)
    if (!q) return badReq(res, 'Missing query')
    
    // 查询报名信息和学生信息
    const item = db.prepare(`
      SELECT r.name, r.school, r.level, r.examDate, r.ticket, r.centerName, r.centerAddr, 
             s.gender, s.photo
      FROM registrations r
      LEFT JOIN students s ON r.idCard = s.idCard
      WHERE r.regNo = ? OR r.idCard = ?
    `).get(q, q)
    
    if (!item) {
      console.log('Registration not found for query:', q)
      return notFound(res, 'registration not found')
    }
    
    console.log('Found registration with student info:', item)
    return ok(res, item)
  }
  if (p === API_PREFIX + '/score' && req.method === 'GET') {
    let ticket = normalizeQueryValue(u.searchParams.get('ticket'))
    const idCard = normalizeQueryValue(u.searchParams.get('idCard'))
    
    console.log('Score query:', { ticket, idCard })
    
    if (!ticket && !idCard) return badReq(res, 'Missing ticket or idCard')

    // 如果提供了身份证号但没有准考证号，先查找准考证号
    if (!ticket && idCard) {
      // 优先查找该身份证号最近的有成绩的报名记录
      let regWithScore = db.prepare(`
        SELECT r.ticket 
        FROM registrations r
        JOIN scores s ON r.ticket = s.ticket
        WHERE r.idCard = ?
        ORDER BY r.createdAt DESC
        LIMIT 1
      `).get(idCard)

      if (regWithScore) {
        ticket = regWithScore.ticket
        console.log('Found ticket with score for idCard:', idCard, '->', ticket)
      } else {
        // 如果没有找到有成绩的记录，则查找最近的一次报名（可能还没出成绩）
        const reg = db.prepare('SELECT ticket FROM registrations WHERE idCard = ? ORDER BY createdAt DESC LIMIT 1').get(idCard)
        if (reg) {
          ticket = reg.ticket
          console.log('Found latest ticket (no score) for idCard:', idCard, '->', ticket)
        } else {
          console.log('No registration found for idCard:', idCard)
          return notFound(res, 'Registration not found')
        }
      }
    }

    const reg = db.prepare('SELECT name, level FROM registrations WHERE ticket = ?').get(ticket)
    const sc = db.prepare('SELECT total, listening, reading, writing, oral FROM scores WHERE ticket = ?').get(ticket)
    
    if (!reg) {
      console.log('Registration not found for ticket:', ticket)
      return notFound(res, 'Registration not found')
    }
  
    if (!sc) {
      console.log('Score not found for ticket:', ticket)
      return notFound(res, 'Score not found')
    }
    
    const result = {
      name: reg.name,
      level: reg.level,
      ticket: ticket,
      total: Number(sc.total),
      listening: Number(sc.listening),
      reading: Number(sc.reading),
      writing: Number(sc.writing),
      oral: sc.oral ? Number(sc.oral) : null
    }
    
    console.log('Found score:', result)
    return ok(res, result)
  }
  if (p === API_PREFIX + '/registrations' && req.method === 'GET') {
    if (!requireAuth()) return
    const batchId = (u.searchParams.get('batchId') || '').trim()
    const level = (u.searchParams.get('level') || '').trim()
    let sql = 'SELECT regNo, name, school, level, ticket, batchId, centerName FROM registrations'
    const params = []
    const where = []
    if (batchId) { where.push('batchId = ?'); params.push(batchId) }
    if (level) { 
      // 将前端传递的CET4/CET6转换为数据库中的CET-4/CET-6
      const dbLevel = level === 'CET4' ? 'CET-4' : level === 'CET6' ? 'CET-6' : level;
      where.push('level = ?'); params.push(dbLevel) 
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY createdAt DESC'
    const list = db.prepare(sql).all(...params)
    console.log('Returning registrations:', list.length)
    return ok(res, list)
  }
  if (p === API_PREFIX + '/score' && req.method === 'POST') {
    if (!requireAuth()) return
    return parseBody(req).then(body => {
      console.log('Update score body:', body)
      const query = (body.ticket || '').trim()
      const total = Number(body.total)
      const listening = Number(body.listening)
      const reading = Number(body.reading)
      const writing = Number(body.writing)
      const oral = body.oral ? Number(body.oral) : null
      if (!query) return badReq(res, 'Missing field: ticket')
      // 优先查找最新的报名记录，确保身份证号查询时定位到最新考试
      const reg = db.prepare('SELECT ticket FROM registrations WHERE ticket = ? OR idCard = ? ORDER BY createdAt DESC').get(query, query)
      if (!reg) {
        console.log('Registration not found for query:', query)
        return notFound(res, 'registration not found for ticket/idCard')
      }
      const ticket = reg.ticket
      function isValid(n) { return Number.isFinite(n) && n >= 0 }
      if (![total, listening, reading, writing].every(isValid)) return badReq(res, 'Invalid score fields')
      if (oral !== null && !isValid(oral)) return badReq(res, 'Invalid oral score')
      
      // 验证总分是否正确（总分应该等于听力+阅读+写作，口语不计入总分）
      const calculatedTotal = listening + reading + writing;
      if (total !== calculatedTotal) {
        return badReq(res, '总分错误，请确保总分为听力、阅读和写作分数之和')
      }
      
      // 验证总分是否小于等于710（CET考试满分）
      if (total > 710) {
        return badReq(res, '总分不能超过710分')
      }
      
      db.prepare(`
        INSERT INTO scores (ticket, total, listening, reading, writing, oral, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ticket) DO UPDATE SET
          total=excluded.total,
          listening=excluded.listening,
          reading=excluded.reading,
          writing=excluded.writing,
          oral=excluded.oral,
          updatedAt=excluded.updatedAt
      `).run(ticket, total, listening, reading, writing, oral, new Date().toISOString())
      console.log('Score updated for ticket:', ticket)
      return ok(res, { ok: true })
    }).catch((err) => {
      console.error('Update score error:', err)
      return badReq(res, err.message || 'Server Error')
    })
  }

  // 管理员编排准考证
  if (p === API_PREFIX + '/admin/generate-tickets' && req.method === 'POST') {
    if (!requireAuth()) return
    
    return parseBody(req).then(body => {
      console.log('Admin generating tickets:', body)
      
      const { batchId, level } = body
      if (!batchId || !level) {
        return badReq(res, 'Missing batchId or level')
      }
      
      // 开始事务
      db.transaction(() => {
        // 获取该批次和级别的未分配准考证的报名记录
        // 按报名时间排序，确保按报名顺序分配考场
        const registrations = db.prepare(`
          SELECT regNo, idCard, name, createdAt FROM registrations 
          WHERE batchId = ? AND level = ? AND ticket = ''
          ORDER BY createdAt ASC
        `).all(batchId, level)
        
        if (registrations.length === 0) {
          return ok(res, { success: true, message: '所有报名记录已分配准考证', generated: 0 })
        }
        
        // 获取可用考场并计算总容量
        const examRooms = db.prepare(`
          SELECT er.id as examRoomId, c.capacity, er.examDate, er.startTime, er.endTime 
          FROM exam_rooms er
          JOIN classrooms c ON er.classroomId = c.id
          WHERE er.batchId = ? AND er.level = ?
          ORDER BY er.examDate, er.startTime, er.id
        `).all(batchId, level)
        
        if (examRooms.length === 0) {
          return badReq(res, '未找到可用考场')
        }
        
        // 计算总考场容量
        const totalCapacity = examRooms.reduce((sum, room) => sum + room.capacity, 0)
        if (registrations.length > totalCapacity) {
          console.warn(`Warning: Not enough capacity. Registrations: ${registrations.length}, Capacity: ${totalCapacity}`)
        }
        
        // 分配准考证号
        const roomAssignments = []
        
        // 初始化每个考场的分配状态
        examRooms.forEach(room => {
          roomAssignments.push({
            examRoomId: room.examRoomId,
            capacity: room.capacity,
            currentSeat: 1,
            examDate: room.examDate,
            startTime: room.startTime
          })
        })
        
        let currentRoomIndex = 0
        let generated = 0
        
        for (const reg of registrations) {
          // 找到当前可用的考场（未填满的）
          let availableRoom = null
          let roomFound = false
          
          // 先查找当前考场是否还有空位
          const currentRoom = roomAssignments[currentRoomIndex]
          if (currentRoom.currentSeat <= currentRoom.capacity) {
            availableRoom = currentRoom
            roomFound = true
          } else {
            // 如果当前考场已满，查找下一个可用考场
            for (let i = 0; i < roomAssignments.length; i++) {
              const room = roomAssignments[i]
              if (room.currentSeat <= room.capacity) {
                availableRoom = room
                currentRoomIndex = i
                roomFound = true
                break
              }
            }
          }
          
          // 如果所有考场都已满，跳出循环
          if (!roomFound) {
            break
          }
          
          // 生成准考证号（格式：T + 批次号 + 级别代码 + 考场号 + 座位号）
          const levelCode = level === 'CET-4' ? '04' : '06'
          const examRoomIdStr = String(availableRoom.examRoomId).padStart(3, '0')
          const seatNumberStr = String(availableRoom.currentSeat).padStart(3, '0')
          const newTicket = `T${batchId}${levelCode}${examRoomIdStr}${seatNumberStr}`
          
          // 更新报名记录
          db.prepare('UPDATE registrations SET ticket = ? WHERE regNo = ?').run(newTicket, reg.regNo)
          
          // 记录准考证分配
          db.prepare(`
            INSERT INTO exam_assignments (regNo, ticket, examRoomId, seatNumber)
            VALUES (?, ?, ?, ?)
          `).run(reg.regNo, newTicket, availableRoom.examRoomId, availableRoom.currentSeat)
          
          // 更新考场座位计数
          availableRoom.currentSeat++
          
          generated++
        }
        
        console.log(`Generated ${generated} tickets for ${batchId} ${level}`)
        return ok(res, { 
          success: true, 
          message: `成功生成${generated}张准考证`, 
          generated, 
          remaining: registrations.length - generated,
          totalCapacity: totalCapacity
        })
      })()
    }).catch((err) => {
      console.error('Generate tickets error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  // 管理员批量导入成绩
  if (p === API_PREFIX + '/admin/import-scores' && req.method === 'POST') {
    if (!requireAuth()) return
    return parseBody(req).then(body => {
      console.log('Import scores body:', body)
      const scores = body.scores || []
      if (!Array.isArray(scores) || scores.length === 0) {
        return badReq(res, 'Missing or invalid scores data')
      }
      
      let success = 0
      let failed = 0
      let errors = []
      
      // 使用事务批量处理
      db.transaction(() => {
        scores.forEach((score, index) => {
          try {
            const ticket = (score.ticket || '').trim()
            const total = Number(score.total)
            const listening = Number(score.listening)
            const reading = Number(score.reading)
            const writing = Number(score.writing)
            const oral = score.oral ? Number(score.oral) : null
            
            if (!ticket) {
              throw new Error('Missing ticket number')
            }
            
            // 验证成绩字段
            function isValid(n) { return Number.isFinite(n) && n >= 0 }
            if (![total, listening, reading, writing].every(isValid)) {
              throw new Error('Invalid score values')
            }
            
            if (oral !== null && !isValid(oral)) {
              throw new Error('Invalid oral score')
            }
            
            // 验证总分是否正确（总分应该等于听力+阅读+写作，口语不计入总分）
            const calculatedTotal = listening + reading + writing;
            if (total !== calculatedTotal) {
              throw new Error('总分错误，请确保总分为听力、阅读和写作分数之和')
            }
            
            // 验证总分是否小于等于710（CET考试满分）
            if (total > 710) {
              throw new Error('总分不能超过710分')
            }
            
            // 检查准考证号是否存在
            const reg = db.prepare('SELECT ticket FROM registrations WHERE ticket = ?').get(ticket)
            if (!reg) {
              throw new Error('Registration not found')
            }
            
            // 插入或更新成绩
            db.prepare(`
              INSERT INTO scores (ticket, total, listening, reading, writing, oral, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(ticket) DO UPDATE SET
                total=excluded.total,
                listening=excluded.listening,
                reading=excluded.reading,
                writing=excluded.writing,
                oral=excluded.oral,
                updatedAt=excluded.updatedAt
            `).run(ticket, total, listening, reading, writing, oral, new Date().toISOString())
            
            success++
          } catch (err) {
            failed++
            errors.push({
              index: index + 1,
              error: err.message || 'Unknown error'
            })
          }
        })
      })()
      
      console.log(`Imported scores: ${success} success, ${failed} failed`)
      return ok(res, {
        success,
        failed,
        errors
      })
    }).catch((err) => {
      console.error('Import scores error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  // 管理员获取报名数据
  if (p === API_PREFIX + '/admin/registrations' && req.method === 'GET') {
    if (!requireAuth()) return
    
    console.log('Admin requesting registrations:', Object.fromEntries(u.searchParams))
    
    // 获取查询参数
    const batchId = (u.searchParams.get('batchId') || '').trim()
    const level = (u.searchParams.get('level') || '').trim()
    const paymentStatus = (u.searchParams.get('paymentStatus') || '').trim()
    const examStatus = (u.searchParams.get('examStatus') || '').trim()
    const page = Number(u.searchParams.get('page') || 1)
    const pageSize = Number(u.searchParams.get('pageSize') || 20)
    
    // 构建查询条件
    let sql = 'SELECT r.*, s.name, s.phone, s.email, s.gender, s.photo FROM registrations r LEFT JOIN students s ON r.idCard = s.idCard'
    const params = []
    const where = []
    
    if (batchId) { where.push('r.batchId = ?'); params.push(batchId) }
    if (level) { 
      // 将前端传递的CET4/CET6转换为数据库中的CET-4/CET-6
      const dbLevel = level === 'CET4' ? 'CET-4' : level === 'CET6' ? 'CET-6' : level;
      where.push('r.level = ?'); params.push(dbLevel) 
    }
    if (paymentStatus) { where.push('r.paymentStatus = ?'); params.push(paymentStatus) }
    if (examStatus) { where.push('r.examStatus = ?'); params.push(examStatus) }
    
    if (where.length) sql += ' WHERE ' + where.join(' AND ')
    sql += ' ORDER BY r.createdAt DESC'
    
    // 添加分页
    sql += ' LIMIT ? OFFSET ?'
    params.push(pageSize, (page - 1) * pageSize)
    
    // 执行查询
    const registrations = db.prepare(sql).all(...params)
    
    // 获取总记录数
    const countSql = 'SELECT COUNT(*) AS total FROM registrations r'
    let countWhere = []
    let countParams = []
    
    if (batchId) { countWhere.push('r.batchId = ?'); countParams.push(batchId) }
    if (level) { countWhere.push('r.level = ?'); countParams.push(level) }
    if (paymentStatus) { countWhere.push('r.paymentStatus = ?'); countParams.push(paymentStatus) }
    if (examStatus) { countWhere.push('r.examStatus = ?'); countParams.push(examStatus) }
    
    if (countWhere.length) countSql += ' WHERE ' + countWhere.join(' AND ')
    
    const total = db.prepare('SELECT COUNT(*) AS total FROM registrations' + (countWhere.length ? ' WHERE ' + countWhere.join(' AND ') : '')).get(...countParams).total
    
    console.log('Returning registrations:', registrations.length)
    return ok(res, { 
      registrations, 
      pagination: { 
        page, 
        pageSize, 
        total, 
        pages: Math.ceil(total / pageSize) 
      } 
    })
  }
  
  // 学生支付报名费用
  if (p === API_PREFIX + '/payment' && req.method === 'POST') {
    const authUser = studentAuth()
    if (!authUser) return unauthorized(res, 'Unauthorized')
    
    return parseBody(req).then(body => {
      const { regNo } = body
      
      if (!regNo) {
        return badReq(res, 'Missing field: regNo')
      }
      
      // 验证报名记录是否存在且属于当前用户
      const registration = db.prepare('SELECT regNo, name, idCard, paymentStatus FROM registrations WHERE regNo = ? AND idCard = ?').get(regNo, authUser.idCard)
      
      if (!registration) {
        return notFound(res, '报名记录不存在或不属于当前用户')
      }
      
      if (registration.paymentStatus === 'paid') {
        return badReq(res, '该报名记录已经支付过费用')
      }
      
      // 更新支付状态
      db.prepare('UPDATE registrations SET paymentStatus = ? WHERE regNo = ?').run('paid', regNo)
      
      console.log('Payment successful for:', regNo)
      return ok(res, { 
        success: true, 
        message: '支付成功',
        regNo: registration.regNo,
        name: registration.name,
        paymentStatus: 'paid'
      })
    }).catch((err) => {
      console.error('Payment error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }

  // 学生查询支付状态
  if (p === API_PREFIX + '/payment/status' && req.method === 'GET') {
    const authUser = studentAuth()
    if (!authUser) return unauthorized(res, 'Unauthorized')
    
    const regNo = u.searchParams.get('regNo')
    
    if (!regNo) {
      return badReq(res, 'Missing field: regNo')
    }
    
    // 验证报名记录是否存在且属于当前用户
    const registration = db.prepare('SELECT regNo, name, idCard, paymentStatus FROM registrations WHERE regNo = ? AND idCard = ?').get(regNo, authUser.idCard)
    
    if (!registration) {
      return notFound(res, '报名记录不存在或不属于当前用户')
    }
    
    return ok(res, {
      regNo: registration.regNo,
      name: registration.name,
      paymentStatus: registration.paymentStatus
    })
  }

  // 管理员删除报名数据（未缴费或退考）
  if (p.startsWith(API_PREFIX + '/admin/registration/') && req.method === 'DELETE') {
    if (!requireAuth()) return
    
    console.log('Admin deleting registration:', p)
    
    // 提取报名号
    const regNo = p.substring((API_PREFIX + '/admin/registration/').length)
    if (!regNo) {
      return badReq(res, '缺少报名号')
    }
    
    // 检查记录是否存在
    const registration = db.prepare('SELECT regNo, paymentStatus, examStatus FROM registrations WHERE regNo = ?').get(regNo)
    if (!registration) {
      return notFound(res, '报名记录不存在')
    }
    
    // 验证是否可以被删除（未缴费或退考）
    if (registration.paymentStatus !== 'unpaid' && registration.examStatus !== 'refunded') {
      return badReq(res, '只能删除未缴费或已退考的报名记录')
    }
    
    // 删除报名记录
    db.prepare('DELETE FROM registrations WHERE regNo = ?').run(regNo)
    console.log('Registration deleted:', regNo)
    return ok(res, { success: true, message: '报名记录删除成功' })
  }

  // 在server.js中添加以下API端点（找到合适的位置添加）

// 自动安排考场API
if (p === API_PREFIX + '/admin/auto-arrange' && req.method === 'POST') {
  if (!requireAuth()) return
  
  return parseBody(req).then(body => {
    console.log('Auto arrange exam rooms:', body)
    
    const { batchId, level, campus } = body
    if (!batchId || !level) {
      return badReq(res, 'Missing batchId or level')
    }
    
    // 1. 获取该批次的报名学生
    const registrations = db.prepare(`
      SELECT r.* FROM registrations r
      WHERE r.batchId = ? AND r.level = ? AND r.paymentStatus = 'paid'
      ORDER BY r.idCard
    `).all(batchId, level)
    
    if (registrations.length === 0) {
      return badReq(res, '该批次没有已缴费的报名学生')
    }
    
    // 2. 获取可用教室
    let classroomSql = `
      SELECT * FROM classrooms 
      WHERE school = ? AND isActive = 1
    `
    const params = ['西南科技大学']
    
    if (campus === 'new') {
      classroomSql += " AND (building LIKE '东%' OR building LIKE '新区%')"
    } else if (campus === 'old') {
      classroomSql += " AND (building LIKE '西%' OR building LIKE '老区%')"
    }
    
    classroomSql += " ORDER BY building, floor, name"
    
    const classrooms = db.prepare(classroomSql).all(...params)
    
    if (classrooms.length === 0) {
      return badReq(res, '没有找到符合条件的教室')
    }
    
    // 3. 安排学生到教室
    const assignments = []
    let studentIndex = 0
    
    // 按校区、楼栋、楼层排序
    const sortedClassrooms = [...classrooms].sort((a, b) => {
      // 新区优先
      const aIsNew = a.building.includes('东') || a.building.includes('新区')
      const bIsNew = b.building.includes('东') || b.building.includes('新区')
      if (aIsNew && !bIsNew) return -1
      if (!aIsNew && bIsNew) return 1
      
      // 按楼栋号
      const aBuildingNum = parseInt(a.building.match(/\d+/)?.[0] || 0)
      const bBuildingNum = parseInt(b.building.match(/\d+/)?.[0] || 0)
      if (aBuildingNum !== bBuildingNum) return aBuildingNum - bBuildingNum
      
      // 按楼层
      if (a.floor !== b.floor) return a.floor - b.floor
      
      // 按教室号
      const aRoomNum = parseInt(a.name.match(/\d+/)?.[0] || 0)
      const bRoomNum = parseInt(b.name.match(/\d+/)?.[0] || 0)
      return aRoomNum - bRoomNum
    })
    
    // 创建考场安排
    const createdRooms = []
    const batchInfo = db.prepare('SELECT examDate FROM batches WHERE id = ?').get(batchId)
    const examDate = batchInfo?.examDate || new Date().toISOString().split('T')[0]
    
    for (const classroom of sortedClassrooms) {
      if (studentIndex >= registrations.length) break
      
      const capacity = Math.min(classroom.capacity, 30) // 每考场最多30人
      const studentsForRoom = registrations.slice(studentIndex, studentIndex + capacity)
      studentIndex += studentsForRoom.length
      
      if (studentsForRoom.length > 0) {
        // 创建考场安排
        const roomId = crypto.randomBytes(8).toString('hex')
        const startTime = level === 'CET-4' ? '09:00' : '15:00'
        const endTime = level === 'CET-4' ? '11:20' : '17:25'
        
        db.prepare(`
          INSERT INTO exam_rooms (classroomId, batchId, level, examDate, startTime, endTime, supervisor1, supervisor2, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          classroom.id,
          batchId,
          level,
          examDate,
          startTime,
          endTime,
          `监考${createdRooms.length * 2 + 1}`,
          `监考${createdRooms.length * 2 + 2}`,
          new Date().toISOString()
        )
        
        const examRoomId = db.prepare('SELECT last_insert_rowid() as id').get().id
        
        // 分配座位
        studentsForRoom.forEach((student, seatIndex) => {
          const seatNumber = seatIndex + 1
          db.prepare(`
            INSERT INTO exam_assignments (regNo, ticket, examRoomId, seatNumber, createdAt)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            student.regNo,
            student.ticket,
            examRoomId,
            seatNumber,
            new Date().toISOString()
          )
        })
        
        createdRooms.push({
          classroom: `${classroom.building}${classroom.name}`,
          capacity: classroom.capacity,
          students: studentsForRoom.length
        })
      }
    }
    
    console.log(`Auto arranged ${createdRooms.length} rooms for ${batchId} ${level}`)
    
    return ok(res, {
      success: true,
      message: `成功创建${createdRooms.length}个考场，安排了${studentIndex}名学生`,
      rooms: createdRooms,
      remaining: registrations.length - studentIndex
    })
    
  }).catch((err) => {
    console.error('Auto arrange error:', err)
    return badReq(res, 'Invalid JSON')
  })
}
  
  // 管理员修改报名数据
  if (p.startsWith(API_PREFIX + '/admin/registration/') && req.method === 'PUT') {
    if (!requireAuth()) return
    
    console.log('Admin updating registration:', p)
    
    // 提取报名号
    const regNo = p.substring((API_PREFIX + '/admin/registration/').length)
    if (!regNo) {
      return badReq(res, '缺少报名号')
    }
    
    return parseBody(req).then(body => {
      console.log('Update registration body:', body)
      
      // 检查记录是否存在
      const registration = db.prepare('SELECT regNo FROM registrations WHERE regNo = ?').get(regNo)
      if (!registration) {
        return notFound(res, '报名记录不存在')
      }
      
      // 构建更新字段
      const updates = []
      const params = []
      
      if (body.level) {
        updates.push('level = ?')
        params.push(body.level)
      }
      if (body.centerId) {
        updates.push('centerId = ?')
        params.push(body.centerId)
      }
      if (body.centerName) {
        updates.push('centerName = ?')
        params.push(body.centerName)
      }
      if (body.centerAddr) {
        updates.push('centerAddr = ?')
        params.push(body.centerAddr)
      }
      if (body.examStatus) {
        updates.push('examStatus = ?')
        params.push(body.examStatus)
      }
      if (body.paymentStatus) {
        updates.push('paymentStatus = ?')
        params.push(body.paymentStatus)
      }
      if (body.email) {
        updates.push('email = ?')
        params.push(body.email)
      }
      if (body.phone) {
        updates.push('phone = ?')
        params.push(body.phone)
      }
      
      // 如果没有更新字段，返回错误
      if (updates.length === 0) {
        return badReq(res, '没有要更新的字段')
      }
      
      // 添加报名号到参数列表
      params.push(regNo)
      
      // 构建并执行更新SQL
      const sql = `UPDATE registrations SET ${updates.join(', ')} WHERE regNo = ?`
      db.prepare(sql).run(...params)
      
      console.log('Registration updated:', regNo)
      return ok(res, { success: true, message: '报名记录更新成功' })
    }).catch((err) => {
      console.error('Update registration error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  // 管理员登录
  if (p === API_PREFIX + '/admin/login' && req.method === 'POST') {
    return parseBody(req).then(body => {
      console.log('=== ADMIN LOGIN ATTEMPT ===')
      console.log('Login body:', body)
      
      const username = String(body.username || '').trim()
      const password = String(body.password || '')
      
      console.log('Username:', username)
      console.log('Password:', password)
      console.log('Expected admin hash:', adminHash)
      
      if (!username || !password) {
        console.log('Missing username or password')
        return badReq(res, 'Missing username or password')
      }
      
      const admin = db.prepare('SELECT id, username, passwordHash FROM admins WHERE username = ?').get(username)
      console.log('Found admin in DB:', admin)
      
      if (!admin) {
        console.log('Admin not found')
        return unauthorized(res, 'Invalid credentials')
      }
      
      console.log('Stored hash:', admin.passwordHash)
      console.log('Input hash:', hashPassword(password))
      
      if (!verifyPassword(password, admin.passwordHash)) {
        console.log('Password mismatch')
        return unauthorized(res, 'Invalid credentials')
      }
      
      const token = crypto.randomBytes(24).toString('hex')
      const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      
      db.prepare('INSERT INTO sessions (token, adminId, expiresAt, createdAt) VALUES (?, ?, ?, ?)').run(
        token, admin.id, expiresAt, new Date().toISOString()
      )
      
      console.log('✓ Admin login successful')
      console.log('Token:', token)
      console.log('Expires at:', expiresAt)
      
      return ok(res, { 
        token, 
        expiresAt, 
        user: { 
          username: admin.username,
          id: admin.id 
        } 
      })
    }).catch((err) => {
      console.error('Admin login parse error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }

  // 管理员获取教室列表
  if (p === API_PREFIX + '/admin/classrooms' && req.method === 'GET') {
    if (!requireAuth()) return
    
    console.log('Admin requesting classrooms:', Object.fromEntries(u.searchParams))
    
    // 获取查询参数
    const isActive = u.searchParams.get('isActive')
    let sql = 'SELECT * FROM classrooms WHERE school = ?'
    const params = ['西南科技大学']
    
    if (isActive !== undefined) {
      sql += ' AND isActive = ?'
      params.push(Number(isActive))
    }
    
    sql += ' ORDER BY building, floor, name'
    
    const classrooms = db.prepare(sql).all(...params)
    console.log('Returning classrooms:', classrooms.length)
    return ok(res, { classrooms })
  }
  
  // 管理员创建考场安排
  if (p === API_PREFIX + '/admin/exam-room' && req.method === 'POST') {
    if (!requireAuth()) return
    
    return parseBody(req).then(body => {
      console.log('Admin creating exam room:', body)
      
      const required = ['classroomId', 'batchId', 'level', 'examDate', 'startTime', 'endTime']
      for (const k of required) {
        if (!body[k]) return badReq(res, `Missing field: ${k}`)
      }
      
      // 检查教室是否存在
      const classroom = db.prepare('SELECT id, capacity, name FROM classrooms WHERE id = ? AND isActive = 1').get(body.classroomId)
      if (!classroom) {
        return badReq(res, '教室不存在或不可用')
      }
      
      // 插入考场安排
      db.prepare(`
        INSERT INTO exam_rooms (classroomId, batchId, level, examDate, startTime, endTime, supervisor1, supervisor2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        body.classroomId,
        body.batchId,
        body.level,
        body.examDate,
        body.startTime,
        body.endTime,
        body.supervisor1 || '',
        body.supervisor2 || ''
      )
      
      console.log('Exam room created successfully')
      return ok(res, { success: true, message: '考场安排创建成功' })
    }).catch((err) => {
      console.error('Create exam room error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  // 管理员获取考场安排列表
  if (p === API_PREFIX + '/admin/exam-rooms' && req.method === 'GET') {
    if (!requireAuth()) return
    
    console.log('Admin requesting exam rooms:', Object.fromEntries(u.searchParams))
    
    // 获取查询参数
    const batchId = (u.searchParams.get('batchId') || '').trim()
    const level = (u.searchParams.get('level') || '').trim()
    
    // 构建查询条件
    let sql = `
      SELECT er.*, c.name as classroomName, c.building, c.floor, c.capacity
      FROM exam_rooms er
      JOIN classrooms c ON er.classroomId = c.id
      WHERE c.school = ?
    `
    const params = ['西南科技大学']
    
    if (batchId) {
      sql += ' AND er.batchId = ?'
      params.push(batchId)
    }
    if (level) {
      sql += ' AND er.level = ?'
      params.push(level)
    }
    
    sql += ' ORDER BY er.examDate, c.building, c.floor, c.name'
    
    const examRooms = db.prepare(sql).all(...params)
    console.log('Returning exam rooms:', examRooms.length)
    return ok(res, { examRooms })
  }
  
  // 管理员生成考场签到表
  if (p === API_PREFIX + '/admin/exam-room/signin-sheet' && req.method === 'GET') {
    if (!requireAuth()) return
    
    console.log('Admin requesting sign-in sheet:', Object.fromEntries(u.searchParams))
    
    // 获取查询参数
    const examRoomId = u.searchParams.get('examRoomId')
    if (!examRoomId) {
      return badReq(res, 'Missing examRoomId parameter')
    }
    
    // 查询考场信息
    const examRoom = db.prepare(`
      SELECT er.*, c.name as classroomName, c.building, c.floor, c.capacity, b.name as batchName
      FROM exam_rooms er
      JOIN classrooms c ON er.classroomId = c.id
      JOIN batches b ON er.batchId = b.id
      WHERE er.id = ?
    `).get(examRoomId)
    
    if (!examRoom) {
      return notFound(res, 'Exam room not found')
    }
    
    // 查询该考场的学生分配信息
    const signinSheetData = db.prepare(`
      SELECT 
        r.regNo, r.name, r.idCard, r.ticket, 
        ea.seatNumber, 
        s.photo
      FROM registrations r
      JOIN exam_assignments ea ON r.regNo = ea.regNo
      LEFT JOIN students s ON r.idCard = s.idCard
      WHERE ea.examRoomId = ?
      ORDER BY ea.seatNumber
    `).all(examRoomId)
    
    console.log('Returning sign-in sheet data for exam room', examRoomId, ':', signinSheetData.length, 'students')
    return ok(res, {
      examRoom,
      students: signinSheetData
    })
  }
  
  // 管理员获取考试数据统计
  if (p === API_PREFIX + '/admin/stats' && req.method === 'GET') {
    if (!requireAuth()) return
    
    console.log('Admin requesting exam statistics:', Object.fromEntries(u.searchParams))
    
    // 获取查询参数
    const batchId = (u.searchParams.get('batchId') || '').trim()
    const level = (u.searchParams.get('level') || '').trim()
    
    // 构建查询条件
    let whereClause = 'WHERE r.school = ?'
    const params = ['西南科技大学']
    
    if (batchId) {
      whereClause += ' AND r.batchId = ?'
      params.push(batchId)
    }
    
    if (level) {
      // 将前端传递的CET4/CET6转换为数据库中的CET-4/CET-6
      const dbLevel = level === 'CET4' ? 'CET-4' : level === 'CET6' ? 'CET-6' : level;
      whereClause += ' AND r.level = ?'
      params.push(dbLevel)
    }
    
    // 获取四级报考人数
    const cet4Query = level === 'CET6' ? 0 : db.prepare(`
      SELECT COUNT(*) AS count FROM registrations r
      ${whereClause} AND r.level = 'CET-4'
    `).get(...params).count
    
    // 获取六级报考人数
    const cet6Query = level === 'CET4' ? 0 : db.prepare(`
      SELECT COUNT(*) AS count FROM registrations r
      ${whereClause} AND r.level = 'CET-6'
    `).get(...params).count
    
    // 获取新区考点人数
    const newCampusCount = db.prepare(`
      SELECT COUNT(*) AS count FROM registrations r
      ${whereClause} AND r.centerId LIKE 'SWUST-NEW%'
    `).get(...params).count
    
    // 获取老区考点人数
    const oldCampusCount = db.prepare(`
      SELECT COUNT(*) AS count FROM registrations r
      ${whereClause} AND r.centerId LIKE 'SWUST-OLD%'
    `).get(...params).count
    
    // 获取已分配考场数
    const roomsCount = db.prepare(`
      SELECT COUNT(DISTINCT r.centerId) AS count FROM registrations r
      ${whereClause} AND r.centerId IS NOT NULL AND r.centerId != ''
    `).get(...params).count
    
    // 计算总报名人数
    const totalCount = cet4Query + cet6Query
    
    // 构建返回数据结构
    const stats = {
      total: totalCount,
      cet4: cet4Query,
      cet6: cet6Query,
      newCampus: newCampusCount,
      oldCampus: oldCampusCount,
      rooms: roomsCount
    }
    
    console.log('Returning exam statistics:', stats)
    return ok(res, stats)
  }
  
  // 学生登录
  if (p === API_PREFIX + '/student/login' && req.method === 'POST') {
    return parseBody(req).then(body => {
      console.log('=== STUDENT LOGIN ATTEMPT ===')
      console.log('Login body:', body)
      
      // 注意：前端发送的是 idCard 和 password 字段
      const idCard = String(body.idCard || '').trim()
      const password = String(body.password || '')
      
      console.log('ID Card:', idCard)
      console.log('Password:', password)
      
      if (!idCard || !password) {
        console.log('Missing idCard or password')
        return badReq(res, 'Missing idCard or password')
      }
      
      // 先查看所有学生记录，确认用户存在
      const allStudents = db.prepare('SELECT idCard, name FROM students LIMIT 10').all()
      console.log('All students in DB:', allStudents)
      
      const stu = db.prepare('SELECT idCard, name, passwordHash FROM students WHERE idCard = ?').get(idCard)
      console.log('Found student in DB:', stu)
      
      if (!stu) {
        console.log('Student not found')
        return unauthorized(res, 'Invalid credentials')
      }
      
      console.log('Stored hash:', stu.passwordHash)
      console.log('Input hash:', hashPassword(password))
      console.log('Hash comparison result:', verifyPassword(password, stu.passwordHash))
      
      // 如果密码哈希不匹配，可能是数据库中的哈希值有问题，尝试修复
      if (!verifyPassword(password, stu.passwordHash)) {
        console.log('Password mismatch, attempting to fix...')
        
        // 检查是否是简单的密码 '123456'
        const defaultPassword = '123456'
        if (password === defaultPassword) {
          // 重新生成正确的哈希值并更新数据库
          const correctHash = hashPassword(defaultPassword)
          console.log('Updating hash to correct value:', correctHash)
          db.prepare('UPDATE students SET passwordHash = ? WHERE idCard = ?').run(correctHash, idCard)
          // 更新stu对象的哈希值，继续登录流程
          stu.passwordHash = correctHash
        } else {
          console.log('Password mismatch for non-default password')
          return unauthorized(res, 'Invalid credentials')
        }
      }
      
      const token = crypto.randomBytes(24).toString('hex')
      const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString()
      
      db.prepare('INSERT INTO student_sessions (token, idCard, expiresAt, createdAt) VALUES (?, ?, ?, ?)').run(
        token, idCard, expiresAt, new Date().toISOString()
      )
      
      const reg = db.prepare('SELECT name, school, level FROM registrations WHERE idCard = ? ORDER BY createdAt DESC').get(idCard) || {}
      
      console.log('✓ Student login successful')
      console.log('Token:', token)
      console.log('Expires at:', expiresAt)
      console.log('Registration info:', reg)
      
      return ok(res, { 
        token, 
        expiresAt, 
        user: { 
          idCard, 
          name: reg.name || stu.name || idCard, 
          school: reg.school || '', 
          level: reg.level || '' 
        } 
      })
    }).catch((err) => {
      console.error('Student login parse error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  if (p === API_PREFIX + '/student/register' && req.method === 'POST') {
    return parseBody(req).then(body => {
      console.log('Student register body:', body)
      const idCard = String(body.idCard || '').trim()
      const password = String(body.password || '')
      const email = String(body.email || '').trim()
      const phone = String(body.phone || '').trim()
      const name = String(body.name || '').trim()
      
      // Validation
      if (!name || name.trim().length === 0) return badReq(res, '姓名不能为空')
      if (!idCard || idCard.length !== 18) return badReq(res, '身份证号不能为空，且必须为18位')
      if (!password || password.length < 6) return badReq(res, '密码需要至少6个字符')
      if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password) ) return badReq(res, '密码需要包含字母和数字')
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badReq(res, '邮箱需要符合基本邮箱格式')
      if (!phone || !/^\d{11}$/.test(phone)) return badReq(res, '联系电话仅支持数字输入，且长度应为11位')
      
      // Check if idCard already exists
      const existing = db.prepare('SELECT idCard FROM students WHERE idCard = ?').get(idCard)
      if (existing) return badReq(res, '身份证号已注册')
      
      const hash = hashPassword(password)
      console.log('Register student hash:', hash)
      
      db.prepare('INSERT INTO students (idCard, name, email, phone, school, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        idCard, name, email, phone, '西南科技大学', hash, new Date().toISOString()
      )
      
      console.log('Student registered successfully:', idCard)
      return ok(res, { success: true, message: '注册成功' })
    }).catch((err) => {
      console.error('Student register error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  if (p === API_PREFIX + '/student/send-reset-code' && req.method === 'POST') {
    return parseBody(req).then(body => {
      console.log('Send reset code body:', body)
      const { phone } = body
      const stu = db.prepare('SELECT idCard FROM students WHERE phone = ?').get(phone)
      if (!stu) {
        console.log('Phone not registered:', phone)
        return badReq(res, '手机号未注册')
      }
      // 生成6位验证码
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      // 存储验证码（有效期5分钟）
      db.prepare('INSERT OR REPLACE INTO reset_codes (phone, code, expiresAt) VALUES (?, ?, ?)')
        .run(phone, code, new Date(Date.now() + 300000).toISOString())
      console.log(`验证码发送到 ${phone}: ${code}`) // 临时打印验证码用于测试
      return ok(res, { success: true })
    }).catch((err) => {
      console.error('Send reset code error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  if (p === API_PREFIX + '/student/reset-password' && req.method === 'POST') {
    return parseBody(req).then(body => {
      console.log('Reset password body:', body)
      const { phone, code, newPwd } = body
      if (!phone || !code || !newPwd) return badReq(res, '缺少必要参数')
      if (newPwd.length < 6) return badReq(res, '密码需要至少6个字符')
      
      // 验证验证码
      const resetCode = db.prepare('SELECT code, expiresAt FROM reset_codes WHERE phone = ?').get(phone)
      if (!resetCode) return badReq(res, '请先获取验证码')
      if (new Date(resetCode.expiresAt).getTime() <= Date.now()) return badReq(res, '验证码已过期')
      if (resetCode.code !== code) return badReq(res, '验证码错误')
      
      const hash = hashPassword(newPwd)
      db.prepare('UPDATE students SET passwordHash = ? WHERE phone = ?').run(hash, phone)
      // 删除已使用的验证码
      db.prepare('DELETE FROM reset_codes WHERE phone = ?').run(phone)
      console.log('Password reset for phone:', phone)
      return ok(res, { success: true, message: '密码重置成功' })
    }).catch((err) => {
      console.error('Reset password error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  if (p === API_PREFIX + '/student/verify-reset-code' && req.method === 'POST') {
    return parseBody(req).then(body => {
      console.log('Verify reset code body:', body)
      const { phone, code } = body
      if (!phone || !code) return badReq(res, '缺少必要参数')
      
      // 验证验证码
      const resetCode = db.prepare('SELECT code, expiresAt FROM reset_codes WHERE phone = ?').get(phone)
      if (!resetCode) return badReq(res, '请先获取验证码')
      if (new Date(resetCode.expiresAt).getTime() <= Date.now()) return badReq(res, '验证码已过期')
      if (resetCode.code !== code) return badReq(res, '验证码错误')
      
      // 获取对应的身份证号
      const stu = db.prepare('SELECT idCard FROM students WHERE phone = ?').get(phone)
      if (!stu) return badReq(res, '用户不存在')
      
      console.log('Reset code verified for:', phone)
      return ok(res, { 
        success: true, 
        idCard: stu.idCard,
        message: '验证码正确' 
      })
    }).catch((err) => {
      console.error('Verify reset code error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }
  
  if (p === API_PREFIX + '/logout' && req.method === 'POST') {
    const a = auth()
    if (a) {
      console.log('Admin logout for token:', a.token)
      db.prepare('DELETE FROM sessions WHERE token = ?').run(a.token)
    }
    return ok(res, { ok: true })
  }
  
  if (p === API_PREFIX + '/student/logout' && req.method === 'POST') {
    const a = studentAuth()
    if (a) {
      console.log('Student logout for token:', a.token)
      db.prepare('DELETE FROM student_sessions WHERE token = ?').run(a.token)
    }
    return ok(res, { ok: true })
  }
  
  if (p === API_PREFIX + '/me' && req.method === 'GET') {
    const a = auth()
    if (!a) {
      console.log('Unauthorized access to /me')
      return unauthorized(res, 'Unauthorized')
    }
    console.log('Returning admin info for:', a.admin.username)
    return ok(res, { user: a.admin })
  }
  
  if (p === API_PREFIX + '/student/me' && req.method === 'GET') {
    const a = studentAuth()
    if (!a) {
      console.log('Unauthorized access to /student/me')
      return unauthorized(res, 'Unauthorized')
    }
    
    // 获取用户的最新报名信息
    const latestRegistration = db.prepare('SELECT regNo, ticket, batchId, level, examDate, centerName, centerAddr, paymentStatus FROM registrations WHERE idCard = ? ORDER BY createdAt DESC LIMIT 1').get(a.idCard)
    
    const response = {
      user: a.user,
      registration: latestRegistration || null
    }
    
    console.log('Returning student info with registration:', a.idCard)
    return ok(res, response)
  }
  
  if (p === API_PREFIX + '/student/details' && req.method === 'GET') {
    const a = studentAuth()
    if (!a) {
      console.log('Unauthorized access to /student/details')
      return unauthorized(res, 'Unauthorized')
    }
    
    const idCard = a.idCard
    const student = db.prepare('SELECT idCard, name, gender, email, phone, school, photo FROM students WHERE idCard = ?').get(idCard)
    const academicInfo = db.prepare('SELECT * FROM academic_info WHERE idCard = ?').get(idCard)
    
    console.log('Returning detailed student info for:', idCard)
    return ok(res, { 
      student: { ...student },
      academicInfo: academicInfo || null
    })
  }
  
  // 照片上传端点
  if (p === API_PREFIX + '/student/photo' && req.method === 'POST') {
    const a = studentAuth()
    if (!a) {
      console.log('Unauthorized access to /student/photo')
      return unauthorized(res, 'Unauthorized')
    }
    
    const idCard = a.idCard
    
    // 处理文件上传
    const contentType = req.headers['content-type'] || ''
    if (!contentType.startsWith('multipart/form-data')) {
      return badReq(res, 'Unsupported content type, expecting multipart/form-data')
    }
    
    // 创建目录存储照片
    const uploadDir = path.join(__dirname, 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir)
    }
    
    // 解析multipart/form-data
    let photoPath = null
    let buffer = Buffer.alloc(0)
    
    req.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk])
    })
    
    req.on('end', () => {
      try {
        const boundary = contentType.split('boundary=')[1]
        if (!boundary) {
          return badReq(res, 'Invalid multipart/form-data format')
        }
        
        // 正确解析multipart/form-data
        const boundaryBytes = Buffer.from(`--${boundary}`, 'utf8')
        let currentIndex = 0
        
        while (true) {
          // 查找下一个边界
          const boundaryIndex = buffer.indexOf(boundaryBytes, currentIndex)
          if (boundaryIndex === -1) break
          
          // 提取当前部分
          const part = buffer.slice(currentIndex, boundaryIndex)
          
          // 查找文件名
          const partStr = part.toString('utf8')
          const fileNameMatch = partStr.match(/filename="(.+)"/)
          
          if (fileNameMatch) {
            const fileName = fileNameMatch[1]
            if (fileName) {
              // 查找文件内容的起始位置
              const contentStart = part.indexOf(Buffer.from('\r\n\r\n', 'utf8')) + 4
              const fileContent = part.slice(contentStart)
              
              // 保存文件
              const fileExt = path.extname(fileName)
              const uniqueFileName = `${idCard}${fileExt}`
              photoPath = path.join(uploadDir, uniqueFileName)
              fs.writeFileSync(photoPath, fileContent)
              
              // 更新学生记录
              db.prepare('UPDATE students SET photo = ? WHERE idCard = ?').run(uniqueFileName, idCard)
              
              console.log('Photo uploaded successfully for:', idCard)
              return ok(res, { 
                success: true, 
                photoUrl: `/api/student/photo?file=${uniqueFileName}` 
              })
            }
          }
          
          currentIndex = boundaryIndex + boundaryBytes.length
        }
        
        return badReq(res, 'No file found in request')
      } catch (err) {
        console.error('Photo upload error:', err)
        return badReq(res, 'Error processing file upload')
      }
    })
    
    return
  }
  
  // 学生缴费
  if (p === API_PREFIX + '/student/pay' && req.method === 'POST') {
    const authUser = studentAuth()
    if (!authUser) return unauthorized(res, 'Unauthorized')

    return parseBody(req).then(body => {
      console.log('Payment body:', body)
      const { regNo } = body
      
      if (!regNo) return badReq(res, 'Missing field: regNo')
      
      // 检查报名记录是否存在且属于当前用户
      const registration = db.prepare('SELECT id, idCard, paymentStatus FROM registrations WHERE regNo = ?').get(regNo)
      if (!registration) return notFound(res, '报名记录不存在')
      if (registration.idCard !== authUser.idCard) return unauthorized(res, '该报名记录不属于您')
      
      // 检查是否已经缴费
      if (registration.paymentStatus === 'paid') return badReq(res, '该报名已缴费')
      
      // 更新缴费状态
      db.prepare('UPDATE registrations SET paymentStatus = ?, examStatus = ? WHERE regNo = ?').run('paid', 'registered', regNo)
      
      console.log('Payment successful for registration:', regNo)
      return ok(res, { success: true, message: '缴费成功' })
    }).catch((err) => {
      console.error('Payment error:', err)
      return badReq(res, 'Invalid JSON')
    })
  }

  // 获取学生照片 - 允许公开访问（用于准考证打印）
  if (p === API_PREFIX + '/student/photo' && req.method === 'GET') {
    const fileName = u.searchParams.get('file')
    if (!fileName) {
      return badReq(res, 'Missing file parameter')
    }
    
    const photoPath = path.join(__dirname, 'uploads', fileName)
    if (!fs.existsSync(photoPath)) {
      return notFound(res, 'Photo not found')
    }
    
    const ext = path.extname(photoPath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'image/jpeg',
      'Access-Control-Allow-Origin': '*'
    })
    
    const stream = fs.createReadStream(photoPath)
    stream.pipe(res)
    return
  }
  
  // 准考证打印端点
  if (p === API_PREFIX + '/ticket/print' && req.method === 'GET') {
    console.log('Ticket print request:', Object.fromEntries(u.searchParams))
    const ticketNo = (u.searchParams.get('ticket') || '').trim()
    const idCard = (u.searchParams.get('idCard') || '').trim()
    
    if (!ticketNo && !idCard) {
      console.log('Missing ticket or idCard')
      return badReq(res, '需要提供准考证号或身份证号')
    }
    
    let query = `
      SELECT r.name, r.regNo, r.ticket, r.school, r.idCard, r.level, 
             r.examDate, r.centerName, r.centerAddr, r.batchId,
             b.name as batchName,
             s.photo
      FROM registrations r
      LEFT JOIN batches b ON r.batchId = b.id
      LEFT JOIN students s ON r.idCard = s.idCard
      WHERE r.ticket = ? OR r.idCard = ?
      ORDER BY r.createdAt DESC
      LIMIT 1
    `
    
    const registration = db.prepare(query).get(ticketNo || '', idCard || '')
    
    if (!registration) {
      console.log('Registration not found for ticket/idCard:', ticketNo, idCard)
      return notFound(res, '未找到报名信息')
    }
    
    console.log('Found registration for printing:', registration)
    
    // 格式化日期
    const examDate = registration.examDate
    let formattedDate = examDate
    try {
      if (examDate) {
        const date = new Date(examDate)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        formattedDate = `${year}年${month}月${day}日`
      }
    } catch (e) {
      console.error('Date formatting error:', e)
    }
    
    // 准备模板数据
    const photoUrl = registration.photo ? `${API_PREFIX}/student/photo?file=${registration.photo}` : '';
    
    const templateData = {
      name: registration.name,
      ticket: registration.ticket,
      school: registration.school,
      idCard: registration.idCard,
      level: registration.level,
      examDate: formattedDate,
      examTime: registration.level === 'CET-4' ? '09:00-11:20' : '15:00-17:25',
      centerName: registration.centerName,
      centerAddr: registration.centerAddr,
      batchId: registration.batchName || registration.batchId,
      printTime: new Date().toLocaleDateString('zh-CN'),
      photoUrl: photoUrl
    }
    
    console.log('Template data:', templateData)
    
    // 加载模板
    const templatePath = path.join(__dirname, 'ticket.html')
    let template = loadTemplate(templatePath)
    
    if (!template) {
      console.log('Ticket template not found, using default')
      template = `<!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><style>
        body { font-family: 'Microsoft YaHei'; padding: 2cm; }
        .header { text-align: center; margin-bottom: 30px; }
        h1 { color: #333; }
        .info { margin: 20px 0; }
        .label { font-weight: bold; }
        .notice { border-top: 2px solid #333; margin-top: 30px; padding-top: 20px; }
      </style></head>
      <body>
        <div class="header">
          <h1>全国大学英语四、六级考试</h1>
          <h2>CET Admission Ticket</h2>
        </div>
        <div class="info">
          <div><span class="label">姓名：</span>{{name}}</div>
          <div><span class="label">准考证号：</span>{{ticket}}</div>
          <div><span class="label">学校：</span>{{school}}</div>
          <div><span class="label">身份证号：</span>{{idCard}}</div>
          <div><span class="label">考试级别：</span>{{level}}</div>
          <div><span class="label">考试日期：</span>{{examDate}}</div>
          <div><span class="label">考试时间：</span>{{examTime}}</div>
          <div><span class="label">考场：</span>{{centerName}}</div>
          <div><span class="label">地址：</span>{{centerAddr}}</div>
        </div>
        <div class="notice">
          <h3>考生须知</h3>
          <p>请携带准考证、身份证和学生证参加考试。</p>
          <p>提前30分钟到达考场，迟到15分钟不得入场。</p>
          <p>准考证打印时间：{{printTime}}</p>
        </div>
        <script>setTimeout(() => window.print(), 1000);</script>
      </body>
      </html>`
    }
    
    // 渲染模板
    const html = renderTemplate(template, templateData)
    
    // 返回HTML
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(html)
    return
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
        '/student/register': { post: { responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } } } },
        '/student/send-reset-code': { post: { responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } } } },
        '/student/verify-reset-code': { post: { responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } } } },
        '/student/reset-password': { post: { responses: { '200': { description: 'OK' }, '400': { description: 'Bad Request' } } } },
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
        },
        '/ticket/print': {
          get: {
            parameters: [
              { name: 'ticket', in: 'query', schema: { type: 'string' } },
              { name: 'idCard', in: 'query', schema: { type: 'string' } }
            ],
            responses: { '200': { description: 'OK' }, '404': { description: 'Not Found' } }
          }
        }
      }
    }
    return ok(res, spec)
  }
  
  console.log('API endpoint not found:', p)
  return notFound(res)
}

;(function initSeed() {
  console.log('\n=== Database Initialization ===')
  
  const hasNotices = db.prepare('SELECT COUNT(1) AS c FROM notices').get().c > 0
  const hasBatches = db.prepare('SELECT COUNT(1) AS c FROM batches').get().c > 0
  const hasCenters = db.prepare('SELECT COUNT(1) AS c FROM centers').get().c > 0
  const hasAdmin = db.prepare('SELECT COUNT(1) AS c FROM admins').get().c > 0
  const hasStudents = db.prepare('SELECT COUNT(1) AS c FROM students').get().c > 0
  
  console.log('Has notices:', hasNotices)
  console.log('Has batches:', hasBatches)
  console.log('Has centers:', hasCenters)
  console.log('Has admin:', hasAdmin)
  console.log('Has students:', hasStudents)
  
  const insertNotice = db.prepare('INSERT INTO notices (title, content, date) VALUES (?, ?, ?)')
  const insertBatch = db.prepare('INSERT INTO batches (id, name, registerStart, registerEnd, examDate) VALUES (?, ?, ?, ?, ?)')
  const insertCenter = db.prepare('INSERT INTO centers (id, name, address) VALUES (?, ?, ?)')
  const insertAdmin = db.prepare('INSERT INTO admins (username, passwordHash, createdAt) VALUES (?, ?, ?)')
  const insertStudent = db.prepare('INSERT INTO students (idCard, name, email, phone, school, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
  
  if (!hasNotices) {
    console.log('Inserting notices...')
    insertNotice.run('2025年上半年CET报名公告', '报名时间为3月1日至3月10日，请各校按时组织。', '2025-02-20')
    insertNotice.run('准考证打印开放时间', '打印时间预计考前7天开放，具体以学校通知为准。', '2025-05-20')
    insertNotice.run('成绩发布时间说明', '成绩预计考后45天发布，请关注本网站公告。', '2025-06-30')
    console.log('✓ Notices inserted')
  }
  
  if (!hasBatches) {
    console.log('Inserting batches...')
    insertBatch.run('2025H1', '2025年上半年', '2025-03-01', '2025-03-10', '2025-06-15')
    insertBatch.run('2025H2', '2025年下半年', '2025-09-01', '2025-09-10', '2025-12-15')
    console.log('✓ Batches inserted')
  }
  
  if (!hasCenters) {
    console.log('Inserting centers...')
    insertCenter.run('LCU-01', '聊城大学西校区考点', '山东省聊城市东昌府区东外环路1号')
    insertCenter.run('LCU-02', '聊城大学东校区考点', '山东省聊城市花园北路7号')
    insertCenter.run('LCU-03', '聊城大学体育馆考点', '聊城市花园北路体育馆内')
    console.log('✓ Centers inserted')
  }
  
  if (!hasAdmin) {
    console.log('Inserting admin...')
    const hash = hashPassword('admin123')
    console.log('Admin password hash:', hash)
    insertAdmin.run('admin', hash, new Date().toISOString())
    console.log('✓ Admin inserted')
  }
  
  if (!hasStudents) {
    console.log('Inserting demo student...')
    const demoId = '370000000000000000'
    const demoName = '示例学生'
    const demoEmail = 'demo@example.com'
    const demoPhone = '13800000000'
    
    // 计算密码 '123456' 的 SHA256 哈希
    const pwdHash = hashPassword('123456')
    
    console.log('Demo student details:')
    console.log('  ID Card:', demoId)
    console.log('  Name:', demoName)
    console.log('  Email:', demoEmail)
    console.log('  Phone:', demoPhone)
    console.log('  Password: 123456')
    console.log('  Password Hash:', pwdHash)
    
    insertStudent.run(demoId, demoName, demoEmail, demoPhone, '西南科技大学', pwdHash, new Date().toISOString())
    console.log('✓ Demo student inserted')
  } else {
    // 修复现有学生的密码哈希
    console.log('Checking existing students for password hash issues...')
    const students = db.prepare('SELECT idCard, name, passwordHash FROM students').all()
    students.forEach(stu => {
      console.log(`Student ${stu.idCard}: hash = ${stu.passwordHash ? stu.passwordHash.substring(0, 20) + '...' : 'null'}`)
    })
  }
  
  // 添加默认教室数据
  console.log('Adding default classroom data...')
  try {
    // 直接插入教室数据，不使用对象属性
    const insertClassroom = db.prepare('INSERT OR IGNORE INTO classrooms (id, name, building, floor, capacity, school, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    const createdAt = new Date().toISOString()
    
    // 手动插入每个教室，确保数值类型正确
    insertClassroom.run('C001', '201', '东2', 2, 50, '西南科技大学', 1, createdAt)
    insertClassroom.run('C002', '202', '东2', 2, 50, '西南科技大学', 1, createdAt)
    insertClassroom.run('C003', '301', '东2', 3, 50, '西南科技大学', 1, createdAt)
    insertClassroom.run('C004', '302', '东2', 3, 50, '西南科技大学', 1, createdAt)
    insertClassroom.run('C005', '401', '东2', 4, 50, '西南科技大学', 1, createdAt)
    insertClassroom.run('C006', '101', '西1', 1, 40, '西南科技大学', 1, createdAt)
    insertClassroom.run('C007', '102', '西1', 1, 40, '西南科技大学', 1, createdAt)
    insertClassroom.run('C008', '201', '西1', 2, 40, '西南科技大学', 1, createdAt)
    
    console.log('✓ Default classrooms added')
  } catch (error) {
    console.log('Warning: Failed to add default classrooms:', error.message)
    console.log('Continuing server startup...')
  }

  console.log('=== Database Initialization Complete ===\n')
})()

const server = http.createServer((req, res) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.url}`)
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    const reqHdr = req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    
    console.log('Preflight request, returning CORS headers')
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': reqHdr
    })
    return res.end()
  }
  
  if (req.url.startsWith(API_PREFIX)) return handleApi(req, res)
  
  // 处理静态文件请求
  const filePath = resolveFile(req.url)
  if (!filePath) {
    console.log('Invalid file path, returning 404')
    return send(res, 404, { error: 'File not found' })
  }
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      console.log('Error reading file:', filePath, err)
      return err.code === 'ENOENT' ? 
        send(res, 404, { error: 'File not found' }) : 
        send(res, 500, { error: 'Internal server error' })
    }
    
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(content)
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
========================================
   CET API Server Started Successfully!
========================================
   Server URL: http://127.0.0.1:${PORT}
   API Base URL: http://127.0.0.1:${PORT}${API_PREFIX}
   
   Test Accounts:
   - Admin:     admin / admin123
   - Student:   370000000000000000 / 123456
   
   API Documentation:
   http://127.0.0.1:${PORT}${API_PREFIX}/openapi
========================================
  `)
})
