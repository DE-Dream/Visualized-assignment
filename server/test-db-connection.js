const Database = require('better-sqlite3');

console.log('=== 测试数据库连接 ===');

try {
  const db = new Database('./data/cet.db');
  console.log('✅ 成功连接到数据库');
  
  // 测试批次表查询
  console.log('\n1. 查询批次表:');
  const batches = db.prepare('SELECT id, name FROM batches').all();
  console.log('   找到', batches.length, '个批次');
  batches.forEach(b => console.log(`   - ${b.id}: ${b.name}`));
  
  // 测试报名记录表查询
  console.log('\n2. 查询报名记录表:');
  const registrations = db.prepare('SELECT COUNT(*) as count FROM registrations').get();
  console.log('   共有', registrations.count, '条报名记录');
  
  // 测试带筛选条件的查询
  console.log('\n3. 测试带筛选条件的报名记录查询:');
  const filtered = db.prepare('SELECT regNo, name, level, batchId FROM registrations WHERE level = ? AND batchId = ?').all('CET4', '2025H2');
  console.log('   四级2025H2批次有', filtered.length, '条记录');
  
  // 测试JOIN查询
  console.log('\n4. 测试学生和报名记录的JOIN查询:');
  const joined = db.prepare('SELECT r.regNo, r.name, s.email, s.phone FROM registrations r LEFT JOIN students s ON r.idCard = s.idCard LIMIT 3').all();
  console.log('   JOIN查询结果:');
  joined.forEach(j => console.log(`   - ${j.regNo}: ${j.name}, ${j.email}, ${j.phone}`));
  
  db.close();
  console.log('\n✅ 所有查询测试通过');
  
} catch (error) {
  console.error('❌ 数据库操作失败:', error.message);
  process.exit(1);
}

console.log('\n=== 测试完成 ===');
