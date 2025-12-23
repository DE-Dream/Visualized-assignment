const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cet.db');
const db = new Database(DB_PATH);

// 查看students表的结构
try {
  const tableInfo = db.prepare("PRAGMA table_info(students)").all();
  console.log("students表结构:");
  console.table(tableInfo);
  
  // 检查是否需要添加photo字段
  const hasPhotoField = tableInfo.some(field => field.name === 'photo');
  if (!hasPhotoField) {
    console.log("\n添加photo字段到students表...");
    db.exec("ALTER TABLE students ADD COLUMN photo TEXT");
    console.log("photo字段添加成功!");
  } else {
    console.log("\nphoto字段已存在");
  }
  
  // 检查是否需要添加其他字段
  const hasSchoolField = tableInfo.some(field => field.name === 'school');
  if (!hasSchoolField) {
    console.log("\n添加school字段到students表...");
    db.exec("ALTER TABLE students ADD COLUMN school TEXT DEFAULT '西南科技大学'");
    console.log("school字段添加成功!");
  } else {
    console.log("\nschool字段已存在");
  }
  
  const hasGenderField = tableInfo.some(field => field.name === 'gender');
  if (!hasGenderField) {
    console.log("\n添加gender字段到students表...");
    db.exec("ALTER TABLE students ADD COLUMN gender TEXT");
    console.log("gender字段添加成功!");
  } else {
    console.log("\ngender字段已存在");
  }
  
  // 检查registrations表是否需要添加缴费状态字段
  console.log("\n--- 检查registrations表 ---\n");
  const regTableInfo = db.prepare("PRAGMA table_info(registrations)").all();
  console.log("registrations表结构:");
  console.table(regTableInfo);
  
  const hasPaymentStatusField = regTableInfo.some(field => field.name === 'paymentStatus');
  if (!hasPaymentStatusField) {
    console.log("\n添加paymentStatus字段到registrations表...");
    db.exec("ALTER TABLE registrations ADD COLUMN paymentStatus TEXT DEFAULT 'unpaid'");
    console.log("paymentStatus字段添加成功!");
  } else {
    console.log("\npaymentStatus字段已存在");
  }
  
  const hasExamStatusField = regTableInfo.some(field => field.name === 'examStatus');
  if (!hasExamStatusField) {
    console.log("\n添加examStatus字段到registrations表...");
    db.exec("ALTER TABLE registrations ADD COLUMN examStatus TEXT DEFAULT 'registered'");
    console.log("examStatus字段添加成功!");
  } else {
    console.log("\nexamStatus字段已存在");
  }
  
} catch (err) {
  console.error("错误:", err.message);
} finally {
  db.close();
}