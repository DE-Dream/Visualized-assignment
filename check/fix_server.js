const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server', 'server.js');

// 读取文件内容
let content = fs.readFileSync(serverPath, 'utf8');

// 查找并删除有问题的代码块
const startIndex = content.indexOf('// 绠＄悊鍛樼紪鎺掑噯鑰冭瘉');
if (startIndex !== -1) {
  // 找到对应的结束花括号位置
  let openBraces = 0;
  let endIndex = startIndex;
  
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      openBraces++;
    } else if (content[i] === '}') {
      openBraces--;
      if (openBraces === -1) {
        endIndex = i;
        break;
      }
    }
  }
  
  // 删除问题代码块
  if (endIndex > startIndex) {
    const newContent = content.slice(0, startIndex) + content.slice(endIndex + 1);
    fs.writeFileSync(serverPath, newContent, 'utf8');
    console.log('成功删除有问题的代码块！');
  } else {
    console.log('未找到对应的结束花括号');
  }
} else {
  console.log('未找到问题代码块');
}

// 修复SQL查询中的参数绑定问题
content = fs.readFileSync(serverPath, 'utf8');
content = content.replace(/SELECT COUNT\(\*\) as count FROM registrations WHERE level = 'CET4'\$\{whereClause\}/g,
  "SELECT COUNT(*) as count FROM registrations WHERE level = 'CET4'" + whereClause);
content = content.replace(/SELECT COUNT\(\*\) as count FROM registrations WHERE level = 'CET6'\$\{whereClause\}/g,
  "SELECT COUNT(*) as count FROM registrations WHERE level = 'CET6'" + whereClause);
fs.writeFileSync(serverPath, content, 'utf8');

console.log('修复完成！');