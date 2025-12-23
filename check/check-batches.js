const Database = require('better-sqlite3');
const path = require('path');

// 定义数据库路径
const DB_PATH = path.join(__dirname, 'server', 'cet.db');

console.log('数据库路径:', DB_PATH);

// 连接数据库
const db = new Database(DB_PATH);

// 检查 batches 表是否存在
try {
  const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='batches'");
  const table = tableInfo.get();
  
  if (table) {
    console.log('✓ batches 表存在');
    
    // 查询 batches 表的所有内容
    const batches = db.prepare('SELECT * FROM batches').all();
    console.log('batches 表内容:');
    console.log(batches);
    
    // 计算记录数
    const count = db.prepare('SELECT COUNT(*) AS count FROM batches').get().count;
    console.log('记录数:', count);
    console.log('Has batches:', count > 0);
  } else {
    console.log('✗ batches 表不存在');
    
    // 创建 batches 表
    console.log('创建 batches 表...');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        registerStart TEXT NOT NULL,
        registerEnd TEXT NOT NULL,
        examDate TEXT NOT NULL
      )
    `).run();
    console.log('✓ batches 表创建成功');
    
    // 插入测试数据
    console.log('插入测试数据...');
    const insertBatch = db.prepare('INSERT INTO batches (id, name, registerStart, registerEnd, examDate) VALUES (?, ?, ?, ?, ?)');
    insertBatch.run('2025H1', '2025年上半年', '2025-03-01', '2025-03-10', '2025-06-15');
    insertBatch.run('2025H2', '2025年下半年', '2025-09-01', '2025-09-10', '2025-12-15');
    console.log('✓ 测试数据插入成功');
    
    // 再次查询验证
    const batches = db.prepare('SELECT * FROM batches').all();
    console.log('batches 表内容:');
    console.log(batches);
  }
} catch (error) {
  console.error('数据库操作错误:', error.message);
} finally {
  // 关闭数据库连接
  db.close();
  console.log('数据库连接已关闭');
}