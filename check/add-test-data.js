const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'cet.db');
const db = new Database(dbPath);

// 添加或更新测试学生信息
const idCard = '511321200410141486';
const name = '测试学生';
const gender = '男';
const email = 'test@example.com';
const phone = '13800000000';
const school = '某某大学';
const password = 'Test123456';

// 哈希密码
const crypto = require('crypto');
const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

// 更新students表
db.prepare('INSERT OR REPLACE INTO students (idCard, name, gender, email, phone, school, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  .run(idCard, name, gender, email, phone, school, passwordHash, new Date().toISOString());

console.log('✓ 更新了students表');

// 添加或更新学籍信息
const academicInfo = {
  idCard: idCard,
  school: '(51079) 某某大学',
  campus: '(510790) 某某大学-校本部',
  education: '本科',
  lengthOfSchooling: 4,
  enrollmentYear: 2023,
  grade: '大三',
  department: '计算机科学与技术学院',
  major: '软件工程',
  class: '软件2306',
  studentId: '2023060301'
};

db.prepare('INSERT OR REPLACE INTO academic_info (idCard, school, campus, education, lengthOfSchooling, enrollmentYear, grade, department, major, class, studentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  .run(
    academicInfo.idCard,
    academicInfo.school,
    academicInfo.campus,
    academicInfo.education,
    academicInfo.lengthOfSchooling,
    academicInfo.enrollmentYear,
    academicInfo.grade,
    academicInfo.department,
    academicInfo.major,
    academicInfo.class,
    academicInfo.studentId
  );

console.log('✓ 更新了academic_info表');

// 验证数据
try {
  const student = db.prepare('SELECT * FROM students WHERE idCard = ?').get(idCard);
  console.log('\n学生信息:');
  console.log('- 身份证号:', student.idCard);
  console.log('- 姓名:', student.name);
  console.log('- 性别:', student.gender);
  console.log('- 邮箱:', student.email);
  console.log('- 电话:', student.phone);
  console.log('- 学校:', student.school);
  
  const academic = db.prepare('SELECT * FROM academic_info WHERE idCard = ?').get(idCard);
  console.log('\n学籍信息:');
  console.log('- 学校:', academic.school);
  console.log('- 校区:', academic.campus);
  console.log('- 学历:', academic.education);
  console.log('- 学制:', academic.lengthOfSchooling);
  console.log('- 入学年份:', academic.enrollmentYear);
  console.log('- 年级:', academic.grade);
  console.log('- 院系:', academic.department);
  console.log('- 专业:', academic.major);
  console.log('- 班级:', academic.class);
  console.log('- 学号:', academic.studentId);
} catch (err) {
  console.error('验证数据失败:', err);
}

db.close();
console.log('\n✓ 测试数据添加完成！');
