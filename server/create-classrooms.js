const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cet.db');
const db = new Database(DB_PATH);

try {
  // 创建classrooms表，用于存储考场信息
  console.log("创建classrooms表...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS classrooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, -- 教室名称
      school TEXT NOT NULL DEFAULT '西南科技大学', -- 所属学校
      capacity INTEGER NOT NULL, -- 容纳人数
      building TEXT NOT NULL, -- 所属楼栋
      floor INTEGER NOT NULL, -- 楼层
      isActive INTEGER NOT NULL DEFAULT 1, -- 是否可用 (1:可用, 0:不可用)
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("classrooms表创建成功!");
  
  // 创建exam_rooms表，用于存储具体的考场安排
  console.log("\n创建exam_rooms表...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classroomId INTEGER NOT NULL, -- 教室ID
      batchId TEXT NOT NULL, -- 考试批次ID
      level TEXT NOT NULL, -- 考试级别 (CET-4/CET-6)
      examDate TEXT NOT NULL, -- 考试日期
      startTime TEXT NOT NULL, -- 开始时间
      endTime TEXT NOT NULL, -- 结束时间
      supervisor1 TEXT, -- 监考老师1
      supervisor2 TEXT, -- 监考老师2
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(classroomId) REFERENCES classrooms(id)
    );
  `);
  console.log("exam_rooms表创建成功!");
  
  // 创建exam_assignments表，用于存储考生与考场的分配关系
  console.log("\n创建exam_assignments表...");
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regNo TEXT NOT NULL, -- 报名号
      ticket TEXT NOT NULL, -- 准考证号
      examRoomId INTEGER NOT NULL, -- 考场ID
      seatNumber INTEGER NOT NULL, -- 座位号
      FOREIGN KEY(regNo) REFERENCES registrations(regNo),
      FOREIGN KEY(ticket) REFERENCES registrations(ticket),
      FOREIGN KEY(examRoomId) REFERENCES exam_rooms(id)
    );
  `);
  console.log("exam_assignments表创建成功!");
  
  // 添加一些初始教室数据作为示例
  console.log("\n添加初始教室数据...");
  const insertClassroom = db.prepare(`
    INSERT INTO classrooms (name, building, floor, capacity)
    VALUES (?, ?, ?, ?)
  `);
  
  const classrooms = [
    ['A101', '第一教学楼', 1, 60],
    ['A102', '第一教学楼', 1, 60],
    ['A201', '第一教学楼', 2, 60],
    ['A202', '第一教学楼', 2, 60],
    ['B101', '第二教学楼', 1, 45],
    ['B102', '第二教学楼', 1, 45],
    ['B201', '第二教学楼', 2, 45],
    ['B202', '第二教学楼', 2, 45]
  ];
  
  classrooms.forEach(classroom => {
    insertClassroom.run(classroom[0], classroom[1], classroom[2], classroom[3]);
  });
  
  console.log("初始教室数据添加成功!");
  
} catch (err) {
  console.error("错误:", err.message);
} finally {
  db.close();
}
