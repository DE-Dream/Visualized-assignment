const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

//// 数据库路径
const DB_PATH = path.join(__dirname, 'cet.db');
const db = new Database(DB_PATH);

// 工具函数
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 主函数：批量导入报名数据
function importRegistrations() {
  console.log('=== 开始导入报名数据 ===');
  
  try {
    // 1. 读取数据文件
    console.log('\n1. 读取报名数据文件...');
    const dataPath = path.join(__dirname, '..', 'registration_data.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const registrations = JSON.parse(rawData);
    
    console.log(`   读取完成，共 ${registrations.length} 条记录`);
    
    // 2. 准备数据库语句
    console.log('\n2. 准备数据库操作...');
    
    // 检查并确保批次存在
    const batchId = '2025H2';
    const existingBatch = db.prepare('SELECT id FROM batches WHERE id = ?').get(batchId);
    if (!existingBatch) {
      console.log('   添加2025H2批次信息...');
      db.prepare(`
        INSERT INTO batches (id, name, registerStart, registerEnd, examDate)
        VALUES (?, ?, ?, ?, ?)
      `).run(batchId, '2025年下半年', '2025-09-01', '2025-09-10', '2025-12-15');
    }
    
    // 检查并确保考点存在
    const centerId = 'SWUST-01';
    const existingCenter = db.prepare('SELECT id FROM centers WHERE id = ?').get(centerId);
    if (!existingCenter) {
      console.log('   添加西南科技大学考点信息...');
      db.prepare(`
        INSERT INTO centers (id, name, address)
        VALUES (?, ?, ?)
      `).run(centerId, '西南科技大学考点', '四川省绵阳市涪城区青龙大道中段59号');
    }
    
    // 准备插入语句
    const insertStudent = db.prepare(`
      INSERT OR IGNORE INTO students (idCard, name, gender, email, phone, school, passwordHash, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertRegistration = db.prepare(`
      INSERT OR IGNORE INTO registrations (regNo, name, idCard, school, level, batchId, email, phone, centerId, ticket, examDate, centerName, centerAddr, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // 3. 批量导入数据
    console.log('\n3. 批量导入数据...');
    
    let successCount = 0;
    let errorCount = 0;
    
    db.transaction(() => {
      registrations.forEach((reg, index) => {
        try {
          const { name, idCard, school, level, batchId, email, phone } = reg;
          const createdAt = new Date().toISOString();
          
          // 生成随机性别
          const gender = Math.random() > 0.5 ? '男' : '女';
          
          // 生成默认密码
          const password = 'Test123456';
          const passwordHash = hashPassword(password);
          
          // 生成报名号
          const regNo = `${batchId}-${level === 'CET-4' ? 'C4' : 'C6'}-${String(index + 1).padStart(5, '0')}`;
          
          // 生成准考证号
          const ticket = `T${Math.floor(Math.random() * 10000000000).toString().padStart(10, '0')}`;
          
          // 获取考点信息
          const center = db.prepare('SELECT name, address FROM centers WHERE id = ?').get(centerId);
          const centerName = center ? center.name : '西南科技大学考点';
          const centerAddr = center ? center.address : '四川省绵阳市涪城区青龙大道中段59号';
          
          // 获取考试日期
          const batch = db.prepare('SELECT examDate FROM batches WHERE id = ?').get(batchId);
          const examDate = batch ? batch.examDate : '2025-12-15';
          
          // 插入学生记录（如果不存在）
          insertStudent.run(idCard, name, gender, email, phone, school, passwordHash, createdAt);
          
          // 插入报名记录
          insertRegistration.run(
            regNo, name, idCard, school, level, batchId, email, phone, centerId, ticket, 
            examDate, centerName, centerAddr, createdAt
          );
          
          successCount++;
          
          if (successCount % 10 === 0) {
            console.log(`   已导入 ${successCount} 条记录`);
          }
          
        } catch (err) {
          console.error(`   导入第 ${index + 1} 条记录失败:`, err.message);
          errorCount++;
        }
      });
    })();
    
    // 4. 输出结果
    console.log('\n=== 导入完成 ===');
    console.log(`成功导入: ${successCount} 条`);
    console.log(`失败: ${errorCount} 条`);
    console.log(`总记录数: ${registrations.length} 条`);
    
  } catch (error) {
    console.error('导入过程中发生错误:', error);
  } finally {
    db.close();
    console.log('\n数据库连接已关闭');
  }
}

// 执行导入
importRegistrations();