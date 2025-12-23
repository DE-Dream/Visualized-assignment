const Database = require('better-sqlite3');
const path = require('path');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'server', 'cet.db');

// 连接数据库
const db = new Database(DB_PATH);

console.log('正在删除存储考试批次的数据库数据...');

try {
  // 执行删除操作
  const result = db.prepare('DELETE FROM batches').run();
  console.log(`成功删除了 ${result.changes} 条考试批次记录`);
  
  // 也可以选择重置自增ID
  db.prepare('DELETE FROM sqlite_sequence WHERE name = "batches"').run();
  console.log('已重置batches表的自增ID');
} catch (error) {
  console.error('删除考试批次数据失败:', error.message);
} finally {
  // 关闭数据库连接
  db.close();
  console.log('操作完成');
}