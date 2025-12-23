const Database = require('better-sqlite3');
const path = require('path');

console.log('=== 测试数据库连接 ===');

try {
  // 使用正确的数据库路径
  const dbPath = path.join(__dirname, 'server', 'cet.db');
  const db = new Database(dbPath);
  console.log('✅ 成功连接到数据库:', dbPath);
  
  // 测试批次表查询
  console.log('\n1. 查询批次表:');
  const batches = db.prepare('SELECT id, name FROM batches').all();
  console.log('   找到', batches.length, '个批次');
  batches.forEach(b => console.log(`   - ${b.id}: ${b.name}`));
  
  // 测试报名记录表查询
  console.log('\n2. 查询报名记录表:');
  const registrations = db.prepare('SELECT COUNT(*) as count FROM registrations').get();
  console.log('   共有', registrations.count, '条报名记录');
  
  // 测试教室表查询
  console.log('\n3. 查询教室表:');
  const classrooms = db.prepare('SELECT COUNT(*) as count FROM classrooms').get();
  console.log('   共有', classrooms.count, '个教室');
  
  // 测试考场表查询
  console.log('\n4. 查询考场表:');
  const examRooms = db.prepare('SELECT COUNT(*) as count FROM exam_rooms').get();
  console.log('   共有', examRooms.count, '个考场');
  
  // 测试成绩表查询
  console.log('\n5. 查询成绩表:');
  const scores = db.prepare('SELECT COUNT(*) as count FROM scores').get();
  console.log('   共有', scores.count, '条成绩记录');
  
  db.close();
  console.log('\n✅ 所有查询测试通过');
  
} catch (error) {
  console.error('❌ 数据库操作失败:', error.message);
  process.exit(1);
}

console.log('\n=== 测试完成 ===');
