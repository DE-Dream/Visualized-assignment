// 修复数据库表结构的脚本
const fs = require('fs');
const path = require('path');

// 数据库路径
const dbPath = path.join(__dirname, 'server', 'cet.db');

// 确保数据库存在
if (!fs.existsSync(dbPath)) {
  console.error('数据库文件不存在:', dbPath);
  process.exit(1);
}

// 使用better-sqlite3连接数据库
const Database = require('better-sqlite3');
const db = new Database(dbPath);

console.log('\n开始修复数据库表结构...');

// 1. 修复students表，添加缺失的字段
console.log('\n1. 修复students表:');
try {
  // 添加gender字段
  try {
    db.exec('ALTER TABLE students ADD COLUMN gender TEXT');
    console.log('   ✓ 添加gender字段');
  } catch (e) {
    console.log('   gender字段已存在');
  }
  
  // 添加school字段
  try {
    db.exec('ALTER TABLE students ADD COLUMN school TEXT');
    console.log('   ✓ 添加school字段');
  } catch (e) {
    console.log('   school字段已存在');
  }
  
} catch (e) {
  console.error('   修复students表失败:', e.message);
}

// 2. 创建academic_info表
console.log('\n2. 创建academic_info表:');
try {
  db.exec(`
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
  console.log('   ✓ 创建/确认academic_info表');
} catch (e) {
  console.error('   创建academic_info表失败:', e.message);
}

// 3. 添加测试数据
console.log('\n3. 添加测试数据:');
try {
  const idCard = '511321200410141486';
  const crypto = require('crypto');
  const passwordHash = crypto.createHash('sha256').update('Test123456').digest('hex');
  
  // 更新students表
  db.prepare('INSERT OR REPLACE INTO students (idCard, name, gender, email, phone, school, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(idCard, '测试学生', '男', 'test@example.com', '13800000000', '某某大学', passwordHash, new Date().toISOString());
  
  // 更新academic_info表
  db.prepare('INSERT OR REPLACE INTO academic_info (idCard, school, campus, education, lengthOfSchooling, enrollmentYear, grade, department, major, class, studentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(
      idCard,
      '(51079) 某某大学',
      '(510790) 某某大学-校本部',
      '本科',
      4,
      2023,
      '大三',
      '计算机科学与技术学院',
      '软件工程',
      '软件2306',
      '2023060301'
    );
  
  console.log('   ✓ 添加测试数据成功');
  console.log('   身份证号:', idCard);
  console.log('   密码:', 'Test123456');
  
} catch (e) {
  console.error('   添加测试数据失败:', e.message);
}

// 4. 验证修复结果
console.log('\n4. 验证修复结果:');
try {
  const idCard = '511321200410141486';
  
  // 检查students表
  const student = db.prepare('SELECT idCard, name, gender, email, phone, school FROM students WHERE idCard = ?').get(idCard);
  if (student) {
    console.log('   ✓ students表数据:');
    console.log(`     姓名: ${student.name}`);
    console.log(`     性别: ${student.gender}`);
    console.log(`     学校: ${student.school}`);
  } else {
    console.log('   ✗ students表中未找到数据');
  }
  
  // 检查academic_info表
  const academic = db.prepare('SELECT * FROM academic_info WHERE idCard = ?').get(idCard);
  if (academic) {
    console.log('   ✓ academic_info表数据:');
    console.log(`     学校: ${academic.school}`);
    console.log(`     年级: ${academic.grade}`);
    console.log(`     专业: ${academic.major}`);
  } else {
    console.log('   ✗ academic_info表中未找到数据');
  }
  
} catch (e) {
  console.error('   验证失败:', e.message);
}

db.close();
console.log('\n✅ 修复完成！');
