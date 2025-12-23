// 测试数据生成脚本
// 生成符合规则的学生数据，学校统一为"西南科技大学"

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// 数据库路径
const DB_PATH = path.join(__dirname, 'cet.db');
const db = new Database(DB_PATH);

// 工具函数
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 生成随机中文姓名
function generateChineseName() {
  const familyNames = [
    '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
    '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'
  ];
  
  const givenNames = [
    '伟', '芳', '娜', '秀英', '敏', '静', '丽', '强', '磊', '军',
    '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀兰', '霞'
  ];
  
  const familyName = familyNames[Math.floor(Math.random() * familyNames.length)];
  const givenName = givenNames[Math.floor(Math.random() * givenNames.length)];
  
  return familyName + givenName;
}

// 生成随机身份证号（18位）
function generateIdCard() {
  // 前6位：地区代码（四川省绵阳市三台县）
  const areaCode = '510722';
  
  // 年份：2000-2004
  const year = (2000 + Math.floor(Math.random() * 5)).toString();
  
  // 月份：01-12
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  
  // 日期：01-28
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  
  // 顺序码：3位随机数
  const sequence = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  
  // 校验码：简单生成，不保证真实有效
  const checkCode = String(Math.floor(Math.random() * 10));
  
  return areaCode + year + month + day + sequence + checkCode;
}

// 生成随机电话号码
function generatePhone() {
  return '1' + ['3', '4', '5', '7', '8'][Math.floor(Math.random() * 5)] + 
         String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');
}

// 生成随机邮箱
function generateEmail(name) {
  const domains = ['swust.edu.cn', 'qq.com', '163.com', 'gmail.com', '126.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const suffix = String(Math.floor(Math.random() * 1000));
  return `${name.toLowerCase().replace(/\s+/g, '')}${suffix}@${domain}`;
}

// 生成随机性别
function generateGender() {
  return Math.random() > 0.5 ? '男' : '女';
}

// 生成随机学院
function generateDepartment() {
  const departments = [
    '计算机科学与技术学院', '信息工程学院', '经济管理学院', '材料科学与工程学院',
    '环境与资源学院', '生命科学与工程学院', '理学院', '建筑与土木工程学院',
    '制造科学与工程学院', '文学与艺术学院', '外国语学院', '法学院'
  ];
  return departments[Math.floor(Math.random() * departments.length)];
}

// 生成随机专业
function generateMajor(department) {
  const majorsMap = {
    '计算机科学与技术学院': ['计算机科学与技术', '软件工程', '网络工程', '信息安全'],
    '信息工程学院': ['电子信息工程', '通信工程', '自动化', '物联网工程'],
    '经济管理学院': ['会计学', '工商管理', '市场营销', '国际经济与贸易'],
    '材料科学与工程学院': ['材料科学与工程', '材料成型及控制工程', '高分子材料与工程'],
    '环境与资源学院': ['环境工程', '安全工程', '地质工程', '资源勘查工程'],
    '生命科学与工程学院': ['生物技术', '生物工程', '农学', '食品科学与工程'],
    '理学院': ['数学与应用数学', '应用物理学', '应用化学'],
    '建筑与土木工程学院': ['建筑学', '土木工程', '城市规划'],
    '制造科学与工程学院': ['机械设计制造及其自动化', '工业工程', '车辆工程'],
    '文学与艺术学院': ['汉语言文学', '广播电视学', '音乐学'],
    '外国语学院': ['英语', '日语', '翻译'],
    '法学院': ['法学', '政治学与行政学']
  };
  
  const majors = majorsMap[department] || ['计算机科学与技术'];
  return majors[Math.floor(Math.random() * majors.length)];
}

// 生成随机班级
function generateClass() {
  const grade = Math.floor(Math.random() * 4) + 20;
  const classNum = Math.floor(Math.random() * 6) + 1;
  return `${grade}0${classNum}`;
}

// 生成随机学号
function generateStudentId() {
  return '20' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
}

// 生成随机入学年份
function generateEnrollmentYear() {
  return 2020 + Math.floor(Math.random() * 4);
}

// 生成年级
function generateGrade(enrollmentYear) {
  const currentYear = new Date().getFullYear();
  const yearDiff = currentYear - enrollmentYear;
  
  if (yearDiff < 1) return '大一';
  if (yearDiff < 2) return '大二';
  if (yearDiff < 3) return '大三';
  if (yearDiff < 4) return '大四';
  return '研究生';
}

// 主函数：生成测试数据
function generateTestData() {
  console.log('=== 开始生成测试数据 ===');
  
  // 1. 确保数据库表结构正确
  console.log('\n1. 检查数据库表结构...');
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
      createdAt TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idCard TEXT UNIQUE NOT NULL,
      name TEXT,
      gender TEXT,
      email TEXT,
      phone TEXT,
      school TEXT DEFAULT '西南科技大学',
      passwordHash TEXT NOT NULL,
      photo TEXT,
      createdAt TEXT NOT NULL
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
  `);
  
  console.log('   数据库表结构检查完成');
  
  // 2. 添加基础数据（如果不存在）
  console.log('\n2. 添加基础数据...');
  
  // 添加考试批次
  const batchCount = db.prepare('SELECT COUNT(*) AS c FROM batches').get().c;
  if (batchCount === 0) {
    const insertBatch = db.prepare(`
      INSERT INTO batches (id, name, registerStart, registerEnd, examDate)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertBatch.run('2025H1', '2025年上半年', '2025-03-01', '2025-03-10', '2025-06-15');
    insertBatch.run('2025H2', '2025年下半年', '2025-09-01', '2025-09-10', '2025-12-15');
    console.log('   已添加考试批次');
  }
  
  // 添加考点
  const centerCount = db.prepare('SELECT COUNT(*) AS c FROM centers').get().c;
  if (centerCount === 0) {
    const insertCenter = db.prepare(`
      INSERT INTO centers (id, name, address)
      VALUES (?, ?, ?)
    `);
    
    insertCenter.run('SWUST-01', '西南科技大学第一教学楼', '四川省绵阳市涪城区青龙大道中段59号西南科技大学第一教学楼');
    insertCenter.run('SWUST-02', '西南科技大学第二教学楼', '四川省绵阳市涪城区青龙大道中段59号西南科技大学第二教学楼');
    insertCenter.run('SWUST-03', '西南科技大学第三教学楼', '四川省绵阳市涪城区青龙大道中段59号西南科技大学第三教学楼');
    console.log('   已添加考点');
  }
  
  // 添加公告
  const noticeCount = db.prepare('SELECT COUNT(*) AS c FROM notices').get().c;
  if (noticeCount === 0) {
    const insertNotice = db.prepare(`
      INSERT INTO notices (title, content, date)
      VALUES (?, ?, ?)
    `);
    
    insertNotice.run('2025年上半年CET报名公告', '报名时间为3月1日至3月10日，请各校按时组织。', '2025-02-20');
    insertNotice.run('准考证打印开放时间', '打印时间预计考前7天开放，具体以学校通知为准。', '2025-05-20');
    insertNotice.run('成绩发布时间说明', '成绩预计考后45天发布，请关注本网站公告。', '2025-06-30');
    console.log('   已添加公告');
  }
  
  // 3. 生成学生数据
  console.log('\n3. 生成学生数据...');
  
  // 生成100条学生数据
  const studentCount = db.prepare('SELECT COUNT(*) AS c FROM students').get().c;
  if (studentCount < 100) {
    const insertStudent = db.prepare(`
      INSERT INTO students (idCard, name, gender, email, phone, school, passwordHash, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertAcademicInfo = db.prepare(`
      INSERT INTO academic_info (idCard, school, campus, education, lengthOfSchooling, enrollmentYear, grade, department, major, class, studentId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertRegistration = db.prepare(`
      INSERT INTO registrations (regNo, name, idCard, school, level, batchId, email, phone, centerId, ticket, examDate, centerName, centerAddr, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // 生成100条学生数据
    for (let i = studentCount; i < 100; i++) {
      const idCard = generateIdCard();
      const name = generateChineseName();
      const gender = generateGender();
      const email = generateEmail(name);
      const phone = generatePhone();
      const password = 'Test123456';
      const passwordHash = hashPassword(password);
      const createdAt = new Date().toISOString();
      const school = '西南科技大学';
      
      // 插入学生记录
      insertStudent.run(idCard, name, gender, email, phone, school, passwordHash, createdAt);
      
      // 生成学籍信息
      const department = generateDepartment();
      const major = generateMajor(department);
      const className = generateClass();
      const studentId = generateStudentId();
      const enrollmentYear = generateEnrollmentYear();
      const grade = generateGrade(enrollmentYear);
      
      insertAcademicInfo.run(
        idCard, school, '校本部', '本科', 4, enrollmentYear, grade, department, major, className, studentId
      );
      
      // 生成报名记录
      const level = Math.random() > 0.3 ? 'CET-4' : 'CET-6'; // 70%报四级，30%报六级
      const batchId = '2025H1';
      const centerId = `SWUST-0${Math.floor(Math.random() * 3) + 1}`;
      
      // 生成报名号和准考证号
      const regNo = `${batchId}-${level === 'CET-4' ? 'C4' : 'C6'}-${String(i + 1).padStart(5, '0')}`;
      const ticket = `T${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}`;
      
      // 获取考试批次和考点信息
      const batch = db.prepare('SELECT examDate FROM batches WHERE id = ?').get(batchId);
      const center = db.prepare('SELECT name, address FROM centers WHERE id = ?').get(centerId);
      
      insertRegistration.run(
        regNo, name, idCard, school, level, batchId, email, phone, centerId, ticket, 
        batch.examDate, center.name, center.address, createdAt
      );
      
      if ((i + 1) % 10 === 0) {
        console.log(`   已生成 ${i + 1} 条学生数据`);
      }
    }
    
    console.log('   学生数据生成完成');
  } else {
    console.log('   学生数据已存在，跳过生成');
  }
  
  // 4. 确保测试用户存在
  console.log('\n4. 添加测试用户...');
  
  // 添加指定的测试用户
  const testIdCard = '511321200410141486';
  const testUser = db.prepare('SELECT idCard FROM students WHERE idCard = ?').get(testIdCard);
  
  if (!testUser) {
    const name = '测试学生';
    const gender = '男';
    const email = 'test@swust.edu.cn';
    const phone = '13888888888';
    const password = 'Test123456';
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();
    const school = '西南科技大学';
    
    // 插入学生记录
    db.prepare(`
      INSERT INTO students (idCard, name, gender, email, phone, school, passwordHash, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testIdCard, name, gender, email, phone, school, passwordHash, createdAt);
    
    // 生成学籍信息
    const department = '计算机科学与技术学院';
    const major = '软件工程';
    const className = '2306';
    const studentId = '2023060301';
    const enrollmentYear = 2023;
    const grade = '大三';
    
    db.prepare(`
      INSERT INTO academic_info (idCard, school, campus, education, lengthOfSchooling, enrollmentYear, grade, department, major, class, studentId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testIdCard, school, '校本部', '本科', 4, enrollmentYear, grade, department, major, className, studentId
    );
    
    console.log('   测试用户已添加');
  } else {
    console.log('   测试用户已存在，跳过添加');
  }
  
  console.log('\n=== 测试数据生成完成 ===');
  console.log('\n登录信息：');
  console.log(`  测试用户身份证号: ${testIdCard}`);
  console.log('  密码: Test123456');
  console.log('\n所有学生的初始密码都是: Test123456');
}

// 执行生成测试数据
try {
  generateTestData();
  db.close();
  console.log('\n数据库连接已关闭');
} catch (error) {
  console.error('生成测试数据时出错:', error);
  db.close();
}