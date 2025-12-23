const Database = require('better-sqlite3');
const db = new Database('./data/cet.db');

console.log('=== 数据库表状态检查 ===');
console.log();

// 检查批次表
console.log('1. 考试批次表 (batches):');
const batches = db.prepare('SELECT id, name, examDate FROM batches ORDER BY id').all();
batches.forEach(b => {
  console.log(`   ${b.id}: ${b.name} (${b.examDate})`);
});
console.log(`   共 ${batches.length} 个批次`);
console.log();

// 检查报名记录表
console.log('2. 报名记录表 (registrations):');
const regCount = db.prepare('SELECT COUNT(*) as count FROM registrations').get().count;
const regs = db.prepare('SELECT regNo, name, level, batchId, ticket FROM registrations ORDER BY createdAt DESC LIMIT 5').all();

if (regCount === 0) {
  console.log('   数据库中没有报名记录！');
} else {
  console.log(`   共 ${regCount} 条报名记录，最新5条:`);
  regs.forEach(r => {
    console.log(`   ${r.regNo}: ${r.name} (${r.level}) - ${r.batchId} - ${r.ticket}`);
  });
}
console.log();

// 检查学生表
console.log('3. 学生表 (students):');
const studentCount = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
console.log(`   共 ${studentCount} 个学生账号`);

// 检查考点表
console.log('4. 考点表 (centers):');
const centers = db.prepare('SELECT id, name FROM centers').all();
centers.forEach(c => {
  console.log(`   ${c.id}: ${c.name}`);
});
console.log(`   共 ${centers.length} 个考点`);

console.log();
console.log('=== 检查完成 ===');

db.close();
