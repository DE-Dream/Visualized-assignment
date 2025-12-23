const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, 'server', 'cet.db');
const db = new Database(DB_PATH);

console.log('=== 添加默认考试批次 ===\n');

// 获取当前年份
const currentYear = new Date().getFullYear();

// 定义要添加的批次数据
const batches = [
  // 当前年份上半年
  {
    id: `${currentYear}H1`,
    name: `${currentYear}年上半年全国大学英语四、六级考试`,
    registerStart: `${currentYear}-03-01T00:00:00Z`,
    registerEnd: `${currentYear}-04-01T23:59:59Z`,
    examDate: `${currentYear}-06-15T09:00:00Z`
  },
  // 当前年份下半年
  {
    id: `${currentYear}H2`,
    name: `${currentYear}年下半年全国大学英语四、六级考试`,
    registerStart: `${currentYear}-09-01T00:00:00Z`,
    registerEnd: `${currentYear}-10-01T23:59:59Z`,
    examDate: `${currentYear}-12-15T09:00:00Z`
  },
  // 下一年上半年
  {
    id: `${currentYear + 1}H1`,
    name: `${currentYear + 1}年上半年全国大学英语四、六级考试`,
    registerStart: `${currentYear + 1}-03-01T00:00:00Z`,
    registerEnd: `${currentYear + 1}-04-01T23:59:59Z`,
    examDate: `${currentYear + 1}-06-15T09:00:00Z`
  }
];

// 开始添加批次
batches.forEach(batch => {
  try {
    // 检查批次是否已存在
    const existingBatch = db.prepare('SELECT id FROM batches WHERE id = ?').get(batch.id);
    
    if (existingBatch) {
      console.log(`✓ 批次 ${batch.id} 已存在，跳过`);
    } else {
      // 添加新批次
      db.prepare(
        'INSERT INTO batches (id, name, registerStart, registerEnd, examDate) VALUES (?, ?, ?, ?, ?)'
      ).run(
        batch.id,
        batch.name,
        batch.registerStart,
        batch.registerEnd,
        batch.examDate
      );
      console.log(`✓ 已添加批次 ${batch.id}: ${batch.name}`);
    }
  } catch (error) {
    console.error(`✗ 添加批次 ${batch.id} 失败: ${error.message}`);
  }
});

// 查询并显示所有批次
console.log('\n=== 当前数据库中的考试批次 ===\n');
try {
  const allBatches = db.prepare('SELECT id, name, examDate FROM batches ORDER BY examDate').all();
  allBatches.forEach(batch => {
    console.log(`${batch.id}: ${batch.name} (${batch.examDate})`);
  });
} catch (error) {
  console.error(`✗ 查询批次失败: ${error.message}`);
}

// 关闭数据库连接
db.close();

console.log('\n=== 操作完成 ===');
