// 身份证号码验证工具

// 加权因子
const WEIGHT_FACTORS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
// 校验码映射表
const VERIFY_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

/**
 * 验证身份证号码是否有效
 * @param {string} idCard - 18位身份证号码
 * @returns {Object} - 验证结果
 */
function verifyIdCard(idCard) {
  // 检查格式
  if (!/^\d{17}[\dXx]$/.test(idCard)) {
    return { valid: false, message: '身份证号码格式不正确，请输入18位数字或最后一位为X/x' };
  }

  // 提取前17位数字和校验码
  const mainPart = idCard.slice(0, 17).split('').map(Number);
  const checkCode = idCard.slice(17).toUpperCase();

  // 计算加权和
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += mainPart[i] * WEIGHT_FACTORS[i];
  }

  // 计算校验码
  const mod = sum % 11;
  const expectedCheckCode = VERIFY_CODES[mod];

  // 验证校验码
  if (checkCode !== expectedCheckCode) {
    return {
      valid: false,
      message: `身份证号码校验码错误，期望的校验码是${expectedCheckCode}，实际是${checkCode}`
    };
  }

  // 验证出生日期
  const birthDate = idCard.slice(6, 14);
  const year = parseInt(birthDate.slice(0, 4));
  const month = parseInt(birthDate.slice(4, 6));
  const day = parseInt(birthDate.slice(6, 8));

  if (month < 1 || month > 12) {
    return { valid: false, message: '身份证号码中的月份无效' };
  }

  // 检查闰年
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (day < 1 || day > daysInMonth[month - 1]) {
    return { valid: false, message: '身份证号码中的日期无效' };
  }

  // 验证年龄范围（18-100岁）
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  if (age < 18 || age > 100) {
    return { valid: false, message: '身份证号码对应的年龄不在合理范围内' };
  }

  return { valid: true, message: '身份证号码有效', birthDate: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`, age };
}

/**
 * 生成有效的身份证号码
 * @returns {string} - 有效的18位身份证号码
 */
function generateValidIdCard() {
  // 前6位：行政区划代码（以510106为例，成都市金牛区）
  const areaCode = '510106';

  // 中间8位：出生日期（18-50岁之间的随机日期）
  const currentYear = new Date().getFullYear();
  const birthYear = currentYear - Math.floor(Math.random() * 32) - 18;
  const birthMonth = Math.floor(Math.random() * 12) + 1;
  // 检查闰年
  const isLeapYear = (birthYear % 4 === 0 && birthYear % 100 !== 0) || birthYear % 400 === 0;
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const birthDay = Math.floor(Math.random() * daysInMonth[birthMonth - 1]) + 1;
  
  const birthDate = `${birthYear}${birthMonth.toString().padStart(2, '0')}${birthDay.toString().padStart(2, '0')}`;

  // 后4位：顺序码和校验码
  const sequenceCode = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

  // 计算校验码
  const mainPart = (areaCode + birthDate + sequenceCode).split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += mainPart[i] * WEIGHT_FACTORS[i];
  }
  const mod = sum % 11;
  const checkCode = VERIFY_CODES[mod];

  return areaCode + birthDate + sequenceCode + checkCode;
}

// 验证用户提供的身份证号码
const testIdCard = '510106200001010018';
console.log(`验证身份证号码: ${testIdCard}`);
const result = verifyIdCard(testIdCard);
console.log(result);

// 生成有效的身份证号码
console.log('\n生成有效的身份证号码:');
const validIdCard = generateValidIdCard();
const validResult = verifyIdCard(validIdCard);
console.log(`${validIdCard} - ${validResult.message}`);
if (validResult.birthDate) {
  console.log(`出生日期: ${validResult.birthDate}`);
  console.log(`年龄: ${validResult.age}岁`);
}
