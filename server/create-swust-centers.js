const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, 'cet.db');
const db = new Database(DB_PATH);

// 添加新区和老区考点
function createSWUSTCenters() {
  console.log('=== 创建西南科技大学考点 ===\n');
  
  try {
    // 1. 添加新区考点
    console.log('1. 添加西南科技大学新区考点...');
    const newCenterId = 'SWUST-NEW';
    const newCenterName = '西南科技大学新区';
    const newCenterAddr = '四川省绵阳市涪城区青龙大道中段59号（新区）';
    
    db.prepare(`
      INSERT OR IGNORE INTO centers (id, name, address)
      VALUES (?, ?, ?)
    `).run(newCenterId, newCenterName, newCenterAddr);
    console.log('   成功添加新区考点');
    
    // 2. 添加老区考点
    console.log('\n2. 添加西南科技大学老区考点...');
    const oldCenterId = 'SWUST-OLD';
    const oldCenterName = '西南科技大学老区';
    const oldCenterAddr = '四川省绵阳市涪城区青龙大道中段59号（老区）';
    
    db.prepare(`
      INSERT OR IGNORE INTO centers (id, name, address)
      VALUES (?, ?, ?)
    `).run(oldCenterId, oldCenterName, oldCenterAddr);
    console.log('   成功添加老区考点');
    
    // 3. 更新现有报名数据，将它们分配到新区或老区考点
    console.log('\n3. 更新现有报名数据...');
    
    // 更新2025H2批次的报名数据
    const batchId = '2025H2';
    
    // 先更新所有2025H2批次的考点为新区
    const updatedNew = db.prepare(`
      UPDATE registrations
      SET centerId = ?, centerName = ?, centerAddr = ?
      WHERE batchId = ? AND (centerId = 'SWUST-01' OR centerName LIKE '%西南科技大学%')
    `).run(newCenterId, newCenterName, newCenterAddr, batchId).changes;
    
    // 随机将一半的学生分配到老区考点
    // 使用id奇偶数来分配
    const updatedOld = db.prepare(`
      UPDATE registrations
      SET centerId = ?, centerName = ?, centerAddr = ?
      WHERE batchId = ? AND (centerId = '${newCenterId}' OR centerName = '${newCenterName}')
      AND CAST(SUBSTR(idCard, 17, 1) AS INTEGER) % 2 = 1
    `).run(oldCenterId, oldCenterName, oldCenterAddr, batchId).changes;
    
    console.log(`   更新了${updatedNew}条记录，其中新区${updatedNew - updatedOld}条，老区${updatedOld}条`);
    
    // 4. 验证结果
    console.log('\n4. 验证结果...');
    
    // 检查考点数据
    const centers = db.prepare('SELECT id, name, address FROM centers WHERE id LIKE ?').all('SWUST%');
    centers.forEach(center => {
      console.log(`   ${center.id}: ${center.name} - ${center.address}`);
    });
    
    // 检查报名数据统计
    const stats = db.prepare(`
      SELECT centerName, COUNT(*) AS count 
      FROM registrations 
      WHERE batchId = ? 
      GROUP BY centerName
    `).all(batchId);
    
    console.log('\n   2025H2批次考点分配统计:');
    stats.forEach(stat => {
      console.log(`   ${stat.centerName}: ${stat.count}人`);
    });
    
    console.log('\n=== 考点创建和分配完成 ===');
    
  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    db.close();
  }
}

// 执行创建考点函数
createSWUSTCenters();
