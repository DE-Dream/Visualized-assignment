const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, 'cet.db');
const db = new Database(DB_PATH);

// 为西南科技大学新区和老区创建考场
function createSWUSTClassrooms() {
  console.log('=== 为西南科技大学创建考场 ===\n');
  
  try {
    // 1. 清除旧的西南科技大学教室数据
    console.log('1. 清除旧的西南科技大学教室数据...');
    db.prepare('DELETE FROM classrooms WHERE school = ?').run('西南科技大学');
    console.log('   已清除旧数据');
    
    // 2. 新区教学楼配置（东一、东二、东三、东四）
    console.log('\n2. 创建新区考场...');
    
    const newBuildingNames = ['东一', '东二', '东三', '东四'];
    const newCampus = '新区';
    const newCapacity = 60; // 每个考场容纳60人
    
    const insertClassroom = db.prepare(`
      INSERT INTO classrooms (name, school, capacity, building, floor, isActive, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    let newRoomCount = 0;
    for (const building of newBuildingNames) {
      for (let floor = 1; floor <= 4; floor++) {
        for (let room = 1; room <= 12; room++) {
          const roomName = `${building}${floor}${String(room).padStart(2, '0')}`;
          insertClassroom.run(
            roomName,
            '西南科技大学',
            newCapacity,
            `${building}教学楼`,
            floor,
            1,
            new Date().toISOString()
          );
          newRoomCount++;
        }
      }
    }
    
    console.log(`   新区已创建 ${newRoomCount} 个考场`);
    
    // 3. 老区教学楼配置（西七）
    console.log('\n3. 创建老区考场...');
    
    const oldBuildingNames = ['西七'];
    const oldCampus = '老区';
    const oldCapacity = 50; // 每个考场容纳50人
    
    let oldRoomCount = 0;
    for (const building of oldBuildingNames) {
      for (let floor = 1; floor <= 4; floor++) {
        for (let room = 1; room <= 12; room++) {
          const roomName = `${building}${floor}${String(room).padStart(2, '0')}`;
          insertClassroom.run(
            roomName,
            '西南科技大学',
            oldCapacity,
            `${building}教学楼`,
            floor,
            1,
            new Date().toISOString()
          );
          oldRoomCount++;
        }
      }
    }
    
    console.log(`   老区已创建 ${oldRoomCount} 个考场`);
    
    // 4. 验证结果
    console.log('\n4. 验证创建结果...');
    
    // 统计教室数量
    const totalClassrooms = db.prepare('SELECT COUNT(*) AS count FROM classrooms WHERE school = ?').get('西南科技大学').count;
    console.log(`   总考场数: ${totalClassrooms}`);
    
    // 按楼栋统计
    const buildingStats = db.prepare(`
      SELECT building, COUNT(*) AS count 
      FROM classrooms 
      WHERE school = ? 
      GROUP BY building
      ORDER BY building
    `).all('西南科技大学');
    
    console.log('   按楼栋分布:');
    buildingStats.forEach(stat => {
      console.log(`   ${stat.building}: ${stat.count}个考场`);
    });
    
    // 显示前10个教室
    console.log('\n   前10个考场:');
    const classrooms = db.prepare(`
      SELECT name, building, floor, capacity 
      FROM classrooms 
      WHERE school = ? 
      ORDER BY building, floor, name
      LIMIT 10
    `).all('西南科技大学');
    
    classrooms.forEach(classroom => {
      console.log(`   ${classroom.name} (${classroom.building} - ${classroom.floor}楼) - 容纳${classroom.capacity}人`);
    });
    
    // 5. 为2025H2批次创建考场安排
    console.log('\n5. 为2025H2批次创建考场安排...');
    
    const batchId = '2025H2';
    const examDate = '2025-12-15';
    const startTime = '09:00:00';
    const endTime = '11:20:00';
    
    // 首先创建exam_rooms记录
    const insertExamRoom = db.prepare(`
      INSERT INTO exam_rooms (classroomId, batchId, level, examDate, startTime, endTime)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    // 获取所有教室
    const allClassrooms = db.prepare('SELECT id, name, building FROM classrooms WHERE school = ?').all('西南科技大学');
    
    let examRoomCount = 0;
    for (const classroom of allClassrooms) {
      // 根据楼栋分配考试级别（东一、东二分配给CET-4，东三、东四分配给CET-6，西七分配给CET-4）
      let level = 'CET-4';
      if (classroom.building === '东三教学楼' || classroom.building === '东四教学楼') {
        level = 'CET-6';
      }
      
      insertExamRoom.run(
        classroom.id,
        batchId,
        level,
        examDate,
        startTime,
        endTime
      );
      examRoomCount++;
    }
    
    console.log(`   已为2025H2批次创建 ${examRoomCount} 个考场安排`);
    
    console.log('\n=== 西南科技大学考场创建完成 ===');
    console.log(`总计创建了 ${totalClassrooms} 个考场，其中新区 ${newRoomCount} 个，老区 ${oldRoomCount} 个`);
    console.log(`为2025H2批次创建了 ${examRoomCount} 个考场安排`);
    
  } catch (err) {
    console.error('错误:', err.message);
  } finally {
    db.close();
  }
}

// 执行创建考场函数
createSWUSTClassrooms();
