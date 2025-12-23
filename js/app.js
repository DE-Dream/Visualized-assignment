// app.js - 全国大学英语四六级考试系统前端逻辑

// ==================== 工具函数和初始化 ====================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const API_BASE = window.CET_API_BASE || '/api';
let currentUser = null;

const state = { 
  route: "home", 
  registrations: [],
  notices: [],
  batches: [],
  centers: []
};

const storageKey = "cet-demo-registrations";

// 加载状态
function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      state.registrations = JSON.parse(raw);
    }
  } catch (e) {
    console.error('加载状态失败:', e);
    state.registrations = [];
  }
}

// 保存状态
function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state.registrations));
  } catch (e) {
    console.error('保存状态失败:', e);
  }
}

// 检查登录状态
function isLoggedIn() {
  try {
    // 检查学生token
    const studentToken = localStorage.getItem("CET_STUDENT_TOKEN");
    if (studentToken) {
      window.CET_STUDENT_TOKEN = studentToken;
      return true;
    }
    
    // 检查管理员token
    const adminToken = localStorage.getItem("CET_API_TOKEN");
    if (adminToken) {
      window.CET_API_TOKEN = adminToken;
      return true;
    }
    
    return false;
  } catch (_) {
    return !!(window.CET_API_TOKEN || window.CET_STUDENT_TOKEN);
  }
}

// 获取当前用户信息
function getCurrentUser() {
  try {
    const userStr = localStorage.getItem('current_user');
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch (e) {
    console.error('解析用户信息失败:', e);
  }
  return null;
}

// 保存当前用户信息
function saveCurrentUser(userData) {
  try {
    localStorage.setItem('current_user', JSON.stringify(userData));
  } catch (e) {
    console.error('保存用户信息失败:', e);
  }
}

// API调用函数
async function apiCall(method, endpoint, data = null) {
  try {
    const url = API_BASE + endpoint;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    // 添加认证token
    const studentToken = localStorage.getItem("CET_STUDENT_TOKEN");
    const adminToken = localStorage.getItem("CET_API_TOKEN");
    
    if (studentToken) {
      options.headers['Authorization'] = `Bearer ${studentToken}`;
    } else if (adminToken) {
      options.headers['Authorization'] = `Bearer ${adminToken}`;
    }
    
    if (data) {
      if (method === 'GET') {
        const params = new URLSearchParams(data).toString();
        return fetch(`${url}?${params}`, options);
      } else {
        options.body = JSON.stringify(data);
      }
    }
    
    const response = await fetch(url, options);
    
    // 解析响应数据
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      // 如果响应不是有效的JSON，创建一个简单的响应对象
      responseData = { error: '服务器返回无效数据', code: 'INVALID_RESPONSE' };
    }
    
    if (!response.ok) {
      const error = new Error(responseData.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = responseData;
      error.code = responseData.code || 'UNKNOWN_ERROR';
      
      // 处理令牌过期的情况
      if (response.status === 401) {
        error.isTokenExpired = true;
        // 清除本地存储的登录状态
        localStorage.removeItem('CET_STUDENT_TOKEN');
        localStorage.removeItem('CET_API_TOKEN');
        localStorage.removeItem('current_user');
        window.CET_STUDENT_TOKEN = null;
        window.CET_API_TOKEN = null;
        // 跳转到登录页面
        alert('登录已过期，请重新登录');
        location.hash = '#login';
      }
      
      throw error;
    }
    
    return responseData;
  } catch (error) {
    // 处理网络错误等其他类型的错误
    if (!error.status) {
      error.status = 0;
      error.message = '网络错误，请检查网络连接';
      error.code = 'NETWORK_ERROR';
    }
    
    // 处理特定错误码
    const errorMessages = {
      'NAME_REQUIRED': '请输入姓名',
      'INVALID_IDCARD_LENGTH': '身份证号必须为18位',
      'INVALID_IDCARD_FORMAT': '身份证号格式不正确',
      'INVALID_IDCARD_CHECKCODE': '身份证号校验码错误',
      'PASSWORD_TOO_SHORT': '密码需要至少6个字符',
      'PASSWORD_INVALID': '密码需要包含字母和数字',
      'INVALID_EMAIL': '请输入有效的邮箱地址',
      'INVALID_PHONE': '请输入11位有效的手机号码',
      'IDCARD_ALREADY_EXISTS': '该身份证号已注册',
      'CREDENTIALS_REQUIRED': '请输入用户名和密码',
      'UNAUTHORIZED': '用户名或密码错误',
      'INVALID_JSON': '请求格式错误',
      'SERVER_ERROR': '服务器错误，请稍后重试'
    };
    
    if (error.code && errorMessages[error.code]) {
      error.message = errorMessages[error.code];
    }
    
    throw error;
  }
}

// 身份证号验证函数
function isValidIdCard(idCard) {
  // 1. 长度验证
  if (!idCard || idCard.length !== 18) {
    return false;
  }
  
  // 2. 格式验证：前17位必须为数字，第18位可以是数字或X/x
  const regex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  if (!regex.test(idCard)) {
    return false;
  }
  
  // 3. 校验码验证
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += parseInt(idCard[i]) * weights[i];
  }
  
  const checkCode = checkCodes[sum % 11];
  return idCard[17].toUpperCase() === checkCode;
}

// 显示结果消息
function showResult(elementId, message, type = 'info') {
  const element = $(`#${elementId}`);
  if (!element) return;
  
  element.classList.remove('hidden');
  element.textContent = message;
  
  // 根据类型设置样式
  element.className = 'result';
  if (type === 'error') {
    element.style.backgroundColor = '#fef2f2';
    element.style.borderColor = '#fecaca';
    element.style.color = '#dc2626';
  } else if (type === 'success') {
    element.style.backgroundColor = '#f0fdf4';
    element.style.borderColor = '#86efac';
    element.style.color = '#15803d';
  } else {
    element.style.backgroundColor = '#eff6ff';
    element.style.borderColor = '#93c5fd';
    element.style.color = '#1e40af';
  }
}

// ==================== 路由管理 ====================
function setRoute(route) {
  console.log('设置路由:', route);
  
  // 检查是否需要登录
  const publicRoutes = ['login', 'home', 'admit', 'score', 'faq'];
  if (!publicRoutes.includes(route) && !isLoggedIn()) {
    route = 'login';
    location.hash = '#login';
  }
  
  // 检查是否已经报名，禁止重复报名
  const registrationRoutes = ['agreement', 'qualification', 'register'];
  if (registrationRoutes.includes(route) && isLoggedIn()) {
    const userData = getCurrentUser();
    if (userData && userData.ticket && userData.ticket !== '请先报名') {
      route = 'admit';
      location.hash = '#admit';
      alert('您已经完成报名，不可重复报名。请查看您的准考证信息。');
    }
  }
  
  state.route = route;
  
  // 隐藏所有视图
  $$('.view').forEach(v => v.classList.add('hidden'));
  
  // 显示当前路由对应的视图
  const el = $(`#view-${route}`);
  if (el) {
    el.classList.remove('hidden');
    console.log('显示视图:', el.id);
  } else {
    console.error('找不到视图:', `#view-${route}`);
  }
  
  // 初始化特定页面的功能
  switch (route) {
    case 'home':
      renderHome();
      break;
    case 'register':
      renderRegister();
      break;
    case 'agreement':
      initAgreementPage();
      break;
    case 'qualification':
      initQualificationPage();
      break;
    case 'admit':
      initAdmitPage();
      break;
    case 'score':
      initScorePage();
      break;
    case 'payment':
      initPaymentPage();
      break;
  }
}

// ==================== 页面初始化函数 ====================

// 初始化报名协议页面
function initAgreementPage() {
  const agreeCheckbox = $("#agreeCheckbox");
  const btnAgree = $("#btnAgree");
  const btnDisagree = $("#btnDisagree");
  
  if (agreeCheckbox && btnAgree) {
    agreeCheckbox.addEventListener("change", function() {
      btnAgree.disabled = !this.checked;
    });
  }
  
  if (btnAgree) {
    btnAgree.addEventListener("click", function() {
      location.hash = "#qualification";
    });
  }
  
  if (btnDisagree) {
    btnDisagree.addEventListener("click", function() {
      if (confirm("确认退出报名？")) {
        location.hash = "#home";
      }
    });
  }
}

// 初始化资格信息页面
function initQualificationPage() {
  const qualificationCheckbox = $("#qualificationCheckbox");
  const btnContinue = $("#btnContinueRegistration");
  const btnBackToHome = $("#btnBackToHome");
  const photoUpload = $("#photoUpload");
  const studentPhoto = $("#studentPhoto");
  
  // 从用户信息填充基本数据
  const userData = getCurrentUser();
  if (userData) {
    const studentIdCard = $("#studentIdCard");
    const studentName = $("#studentName");
    const studentGender = $("#studentGender");
    
    if (studentIdCard) studentIdCard.textContent = userData.idCard || '';
    if (studentName) studentName.textContent = userData.name || '示例学生';
    if (studentGender) studentGender.textContent = userData.gender || '男';
    
    // 从API获取详细信息
    fetch(API_BASE + '/student/details', {
      headers: {
        'Authorization': 'Bearer ' + userData.token
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.student) {
        // 更新学生基本信息
        if (studentName) studentName.textContent = data.student.name || userData.name || '示例学生';
        if (studentGender) studentGender.textContent = data.student.gender || userData.gender || '男';
        
        // 如果有照片，显示照片
        if (studentPhoto && data.student.photo) {
          const photoUrl = `${API_BASE}/student/photo?file=${data.student.photo}`;
          studentPhoto.style.backgroundImage = `url(${photoUrl})`;
          studentPhoto.innerHTML = "";
          studentPhoto.classList.add("has-photo");
        }
      }
      
      if (data.academicInfo) {
        // 更新学籍信息
        const academicSchool = $("#academicSchool");
        const academicCampus = $("#academicCampus");
        const academicEducation = $("#academicEducation");
        const academicLength = $("#academicLength");
        const academicEnrollmentYear = $("#academicEnrollmentYear");
        const academicGrade = $("#academicGrade");
        const academicDepartment = $("#academicDepartment");
        const academicMajor = $("#academicMajor");
        const academicClass = $("#academicClass");
        const academicStudentId = $("#academicStudentId");
        
        if (academicSchool) academicSchool.textContent = data.academicInfo.school || '(51079) 某某大学';
        if (academicCampus) academicCampus.textContent = data.academicInfo.campus || '(510790) 某某大学-校本部';
        if (academicEducation) academicEducation.textContent = data.academicInfo.education || '本科';
        if (academicLength) academicLength.textContent = data.academicInfo.lengthOfSchooling || 4;
        if (academicEnrollmentYear) academicEnrollmentYear.textContent = data.academicInfo.enrollmentYear || 2023;
        if (academicGrade) academicGrade.textContent = data.academicInfo.grade || '大三';
        if (academicDepartment) academicDepartment.textContent = data.academicInfo.department || '计算机科学与技术学院';
        if (academicMajor) academicMajor.textContent = data.academicInfo.major || '软件工程';
        if (academicClass) academicClass.textContent = data.academicInfo.class || '软件2306';
        if (academicStudentId) academicStudentId.textContent = data.academicInfo.studentId || '2023060301';
      }
    })
    .catch(error => {
      console.error('获取学生详细信息失败:', error);
    });
  }
  
  // 照片上传功能
  if (studentPhoto && photoUpload) {
    studentPhoto.addEventListener("click", function() {
      photoUpload.click();
    });
    
    photoUpload.addEventListener("change", function(e) {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          alert("照片大小不能超过2MB");
          return;
        }
        if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
          alert("请上传JPG或PNG格式的图片");
          return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
          studentPhoto.style.backgroundImage = `url(${e.target.result})`;
          studentPhoto.innerHTML = "";
          studentPhoto.classList.add("has-photo");
          
          // 上传照片到服务器
          uploadPhoto(file);
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // 上传照片到服务器
  async function uploadPhoto(file) {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      
      const response = await fetch(API_BASE + '/student/photo', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('CET_STUDENT_TOKEN')
        },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '照片上传失败');
      }
      
      console.log('照片上传成功:', data);
      // 可以在这里保存照片URL到用户信息
    } catch (error) {
      console.error('照片上传失败:', error);
      alert('照片上传失败，请稍后重试');
    }
  }
  
  // 复选框控制
  if (qualificationCheckbox && btnContinue) {
    qualificationCheckbox.addEventListener("change", function() {
      btnContinue.disabled = !this.checked;
    });
  }
  
  // 按钮事件
  if (btnContinue) {
    btnContinue.addEventListener("click", function() {
      if (confirm("保存成功后，学籍信息将无法修改。如果信息有误，请先联系学校老师更正，以免影响参加考试和成绩单信息。确认学籍信息无误并继续？")) {
        location.hash = "#register";
      }
    });
  }
  
  if (btnBackToHome) {
    btnBackToHome.addEventListener("click", function() {
      if (confirm("返回首页？")) {
        location.hash = "#home";
      }
    });
  }
}

// 初始化成绩查询页面
function initScorePage() {
  const userData = getCurrentUser();
  const scoreForm = $("#scoreForm");
  
  // 如果用户已登录
  if (userData && scoreForm) {
    const ticketInput = scoreForm.querySelector('input[name="ticket"]');
    if (ticketInput) {
      // 只有当输入框为空或者值为"undefined"时才填充
      if (!ticketInput.value || ticketInput.value === 'undefined') {
        // 优先填充身份证号，因为服务器支持自动查找成绩
        if (userData.idCard) {
          ticketInput.value = userData.idCard;
        } else if (userData.ticket && userData.ticket !== 'undefined') {
          ticketInput.value = userData.ticket;
        }
      }
    }
  }
}

// 初始化首页
function renderHome() {
  // 加载公告
  const list = $("#noticeList");
  if (list) {
    apiCall('GET', '/notices')
      .then(notices => {
        list.innerHTML = '';
        notices.forEach(n => {
          const li = document.createElement("li");
          li.innerHTML = `<strong>${n.date}</strong>：${n.title}<br><small>${n.content}</small>`;
          list.appendChild(li);
        });
      })
      .catch(err => {
        console.error('加载公告失败:', err);
        list.innerHTML = '<li>加载公告失败，请稍后重试</li>';
      });
  }
  
  // 加载考试批次（用于重要提示）
  const batchList = $("#batchList");
  if (batchList) {
    apiCall('GET', '/batches')
      .then(batches => {
        if (batches.length > 0) {
          const latestBatch = batches[batches.length - 1];
          const importantNotice = $(".important-notice");
          if (importantNotice) {
            importantNotice.innerHTML += `<p>• 当前可报名批次：${latestBatch.name}（${latestBatch.examDate}）</p>`;
          }
        }
      })
      .catch(err => {
        console.error('加载考试批次失败:', err);
      });
  }
}

// 初始化注册页面
function renderRegister() {
  // 自动填充用户信息
  const userData = getCurrentUser();
  if (userData) {
    const displayName = $("#displayName");
    const displayIdCard = $("#displayIdCard");
    const schoolInput = $("#schoolInput");
    if (displayName) displayName.textContent = userData.name || '';
    if (displayIdCard) displayIdCard.textContent = userData.idCard || '';
    if (schoolInput) schoolInput.value = userData.school || '';
  }
  
  // 加载所有考试批次，让用户可以选择
  const batchSelect = $("#batchSelect");
  if (batchSelect) {
    // 显示批次选择框
    batchSelect.style.display = '';
    
    // 清空选择框
    batchSelect.innerHTML = '<option value="">请选择考试批次</option>';
    
    // 从API获取所有批次
    apiCall('GET', '/batches')
      .then(batches => {
        batches.forEach(batch => {
          const option = document.createElement('option');
          option.value = batch.id;
          option.textContent = batch.name;
          batchSelect.appendChild(option);
        });
      })
      .catch(err => {
        console.error('加载考试批次失败:', err);
        // 如果API调用失败，添加默认批次选项
        const now = new Date();
        const year = now.getFullYear();
        batchSelect.innerHTML += `<option value="${year}H1">${year}年上半年</option>`;
        batchSelect.innerHTML += `<option value="${year}H2">${year}年下半年</option>`;
        batchSelect.innerHTML += `<option value="${year + 1}H1">${year + 1}年上半年</option>`;
      });
    
    // 移除可能存在的批次显示元素和隐藏输入
    const batchDisplay = document.getElementById('batchDisplay');
    if (batchDisplay && batchDisplay.parentNode) {
      batchDisplay.parentNode.removeChild(batchDisplay);
    }
    
    const hiddenBatchInput = document.getElementById('hiddenBatchId');
    if (hiddenBatchInput && hiddenBatchInput.parentNode) {
      hiddenBatchInput.parentNode.removeChild(hiddenBatchInput);
    }
  }
  
  // 恢复考点选择功能
  const centerSelect = $("#centerSelect");
  if (centerSelect) {
    // 显示考点选择框
    centerSelect.style.display = '';
    
    // 清空选择框
    centerSelect.innerHTML = '<option value="">请选择考点</option>';
    
    // 监听学校输入框的变化，自动加载对应考点
    const schoolInput = $("#schoolInput");
    if (schoolInput) {
      const updateCenters = () => {
        const schoolName = schoolInput.value.trim();
        if (schoolName) {
          // 从API获取所有考点
          apiCall('GET', '/centers')
            .then(centers => {
              // 清空选择框
              centerSelect.innerHTML = '<option value="">请选择考点</option>';
              
              // 添加与学校相关的考点
              const relevantCenters = centers.filter(center => 
                center.name.includes(schoolName) || center.address.includes(schoolName)
              );
              
              relevantCenters.forEach(center => {
                const option = document.createElement('option');
                option.value = center.id;
                option.textContent = center.name;
                centerSelect.appendChild(option);
              });
              
              // 如果没有相关考点，添加默认考点
              if (relevantCenters.length === 0) {
                const option = document.createElement('option');
                option.value = schoolName;
                option.textContent = schoolName;
                centerSelect.appendChild(option);
              }
            })
            .catch(err => {
              console.error('加载考点失败:', err);
              // 如果API调用失败，添加默认考点选项
              centerSelect.innerHTML = '<option value="">请选择考点</option>';
              centerSelect.innerHTML += `<option value="${schoolName}">${schoolName}</option>`;
            });
        }
      };
      
      // 当学校输入框变化时更新考点列表
      schoolInput.addEventListener('input', updateCenters);
      
      // 页面加载时如果有学校信息，初始化考点列表
      if (schoolInput.value.trim()) {
        updateCenters();
      }
    }
    
    // 移除可能存在的考点显示元素和隐藏输入
    const centerDisplay = document.getElementById('centerDisplay');
    if (centerDisplay && centerDisplay.parentNode) {
      centerDisplay.parentNode.removeChild(centerDisplay);
    }
    
    const hiddenCenterInput = document.getElementById('hiddenCenterId');
    if (hiddenCenterInput && hiddenCenterInput.parentNode) {
      hiddenCenterInput.parentNode.removeChild(hiddenCenterInput);
    }
  }
}

// ==================== 准考证页面功能 ====================

// 初始化准考证页面
function initAdmitPage() {
  console.log('初始化准考证页面');
  
  // 绑定准考证相关事件
  bindTicketEvents();
  
  // 更新用户准考证信息
  const userData = getCurrentUser();
  if (userData) {
    // 先显示本地存储的信息
    showUserTicketInfo(userData);
    
    // 从服务器获取最新的学生信息和报名信息
    if (userData.token) {
      // 1. 先获取用户的最新基本信息和报名信息
      apiCall('GET', '/student/me')
        .then(studentData => {
          if (studentData && studentData.user) {
            let updatedUser = {
              ...userData,
              ...studentData.user
            };
            
            if (studentData.registration) {
              updatedUser = {
                ...updatedUser,
                ticket: studentData.registration.ticket || userData.ticket,
                regNo: studentData.registration.regNo || userData.regNo,
                examDate: studentData.registration.examDate || userData.examDate,
                centerName: studentData.registration.centerName || userData.centerName,
                centerAddr: studentData.registration.centerAddr || userData.centerAddr,
                level: studentData.registration.level || userData.level,
                batchId: studentData.registration.batchId || userData.batchId
              };
            }
            
            // 2. 如果有准考证号，获取更详细的准考证信息
            if (updatedUser.ticket && updatedUser.ticket !== '请先报名') {
              return apiCall('GET', '/admit', { query: updatedUser.ticket })
                .then(admitData => {
                  if (admitData && !admitData.error) {
                    // 合并更详细的准考证信息
                    updatedUser = {
                      ...updatedUser,
                      examDate: admitData.examDate || updatedUser.examDate,
                      centerName: admitData.centerName || updatedUser.centerName,
                      centerAddr: admitData.centerAddr || updatedUser.centerAddr,
                      gender: admitData.gender || updatedUser.gender,
                      photo: admitData.photo || updatedUser.photo
                    };
                  }
                  return updatedUser;
                })
                .catch(err => {
                  console.error('获取准考证详情失败:', err);
                  return updatedUser; // 即使失败也返回已更新的用户信息
                });
            }
            return updatedUser;
          }
          return userData;
        })
        .then(updatedUser => {
          // 更新本地存储和页面显示
          saveCurrentUser(updatedUser);
          showUserTicketInfo(updatedUser);
        })
        .catch(err => {
          console.error('获取用户最新信息失败:', err);
        });
    }
  }
}

// 初始化缴费页面
function initPaymentPage() {
  console.log('初始化缴费页面');
  
  // 从URL参数获取报名号
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
  const regNo = urlParams.get('regNo');
  
  if (!regNo) {
    // 如果没有报名号参数，尝试从用户信息中获取
    const userData = getCurrentUser();
    if (userData && userData.regNo) {
      loadPaymentInfo(userData.regNo);
    } else {
      showResult('paymentResult', '无效的报名信息，请重新报名', 'error');
      setTimeout(() => {
        location.hash = '#register';
      }, 2000);
    }
  } else {
    loadPaymentInfo(regNo);
  }
  
  // 绑定支付按钮事件
  const btnConfirmPayment = $('#btnConfirmPayment');
  if (btnConfirmPayment) {
    btnConfirmPayment.addEventListener('click', handlePaymentSubmit);
  }
  
  // 绑定取消按钮事件
  const btnCancelPayment = $('#btnCancelPayment');
  if (btnCancelPayment) {
    btnCancelPayment.addEventListener('click', function() {
      if (confirm('确定要取消缴费吗？')) {
        location.hash = '#admit';
      }
    });
  }
}

// 加载缴费信息
async function loadPaymentInfo(regNo) {
  try {
    // 获取用户信息
    const userData = getCurrentUser();
    if (!userData || !userData.token) {
      throw new Error('请先登录');
    }
    
    // 获取报名详细信息
    const registrationData = await apiCall('GET', '/student/me');
    
    if (registrationData && registrationData.registration && registrationData.registration.regNo === regNo) {
      const reg = registrationData.registration;
      
      // 更新页面显示的缴费信息
      const paymentName = $('#paymentName');
      const paymentRegNo = $('#paymentRegNo');
      const paymentLevel = $('#paymentLevel');
      const paymentCenter = $('#paymentCenter');
      const paymentExamDate = $('#paymentExamDate');
      const paymentStatus = $('#paymentStatus');
      
      if (paymentName) paymentName.textContent = reg.name || userData.name || '';
      if (paymentRegNo) paymentRegNo.textContent = reg.regNo;
      if (paymentLevel) paymentLevel.textContent = reg.level || '';
      if (paymentCenter) paymentCenter.textContent = reg.centerName || '';
      if (paymentExamDate) paymentExamDate.textContent = reg.examDate || '';
      if (paymentStatus) {
        paymentStatus.textContent = reg.paymentStatus === 'paid' ? '已缴费' : '未缴费';
        paymentStatus.className = reg.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid';
      }
      
      // 如果已经缴费，禁用支付按钮
      const btnConfirmPayment = $('#btnConfirmPayment');
      if (btnConfirmPayment && reg.paymentStatus === 'paid') {
        btnConfirmPayment.disabled = true;
        btnConfirmPayment.textContent = '已缴费';
      }
    } else {
      throw new Error('无法获取报名信息');
    }
  } catch (error) {
    console.error('加载缴费信息失败:', error);
    showResult('paymentResult', '加载缴费信息失败: ' + error.message, 'error');
  }
}

// 处理支付提交
async function handlePaymentSubmit() {
  try {
    // 获取用户信息
    const userData = getCurrentUser();
    if (!userData || !userData.regNo) {
      throw new Error('请先登录并完成报名');
    }
    
    // 显示加载状态
    const btnConfirmPayment = $('#btnConfirmPayment');
    const originalText = btnConfirmPayment ? btnConfirmPayment.textContent : '';
    if (btnConfirmPayment) {
      btnConfirmPayment.disabled = true;
      btnConfirmPayment.textContent = '支付中...';
    }
    
    // 调用支付API
    const response = await apiCall('POST', '/payment', { regNo: userData.regNo });
    
    if (response && response.success) {
      // 更新缴费状态
      const paymentStatus = $('#paymentStatus');
      if (paymentStatus) {
        paymentStatus.textContent = '已缴费';
        paymentStatus.className = 'status-paid';
      }
      
      // 更新用户信息
      const updatedUser = { ...userData, paymentStatus: 'paid' };
      saveCurrentUser(updatedUser);
      
      // 显示成功消息
      showResult('paymentResult', '支付成功！您的报名已完成', 'success');
      
      // 禁用支付按钮
      if (btnConfirmPayment) {
        btnConfirmPayment.disabled = true;
        btnConfirmPayment.textContent = '已缴费';
      }
      
      // 2秒后跳转到准考证页面
      setTimeout(() => {
        location.hash = '#admit';
      }, 2000);
    } else {
      throw new Error(response.message || '支付失败');
    }
  } catch (error) {
    console.error('支付失败:', error);
    showResult('paymentResult', '支付失败: ' + error.message, 'error');
    
    // 恢复支付按钮状态
    const btnConfirmPayment = $('#btnConfirmPayment');
    if (btnConfirmPayment) {
      btnConfirmPayment.disabled = false;
      btnConfirmPayment.textContent = '确认支付';
    }
  }
}

// 显示当前用户的准考证信息
function showUserTicketInfo(userData) {
  console.log('显示用户准考证信息:', userData);
  
  const userName = $('#userName');
  const userTicketNo = $('#userTicketNo');
  const userLevel = $('#userLevel');
  const userExamDate = $('#userExamDate');
  const userCenter = $('#userCenter');
  
  if (userName && userTicketNo && userLevel) {
    userName.textContent = userData.name || '';
    userTicketNo.textContent = userData.ticket || '请先报名';
    userLevel.textContent = userData.level || '';
    userExamDate.textContent = userData.examDate || '';
    userCenter.textContent = userData.centerName || '';
    
    const userSection = $('#userTicketSection');
    const publicSection = $('#publicTicketSection');
    
    // 如果有准考证号，显示用户部分，隐藏公共查询
    if (userData.ticket && userData.ticket !== '请先报名') {
      if (userSection) {
        userSection.classList.remove('hidden');
        console.log('显示用户准考证部分');
      }
      if (publicSection) {
        publicSection.classList.add('hidden');
      }
    } else {
      if (userSection) {
        userSection.classList.add('hidden');
      }
      if (publicSection) {
        publicSection.classList.remove('hidden');
      }
    }
  }
}

// 打印准考证
function printTicket(ticketNo, idCard) {
  let url = API_BASE + '/ticket/print';
  if (ticketNo) {
    url += `?ticket=${encodeURIComponent(ticketNo)}`;
  } else if (idCard) {
    url += `?idCard=${encodeURIComponent(idCard)}`;
  }
  
  console.log('打印准考证URL:', url);
  
  // 在新窗口中打开准考证打印页面
  const printWindow = window.open(url, '_blank', 'width=800,height=600');
  if (!printWindow) {
    alert('请允许弹出窗口以打印准考证');
  }
}

// 查询准考证信息
function queryAdmitTicket(query) {
  if (!query.trim()) {
    showResult('admitResult', '请输入准考证号或身份证号', 'error');
    return;
  }
  
  apiCall('GET', '/admit', { query })
    .then(data => {
      if (data.error) {
        showResult('admitResult', data.error, 'error');
        return;
      }
      
      // 显示查询结果
      const publicName = $('#publicName');
      const publicTicketNo = $('#publicTicketNo');
      const publicLevel = $('#publicLevel');
      const publicExamDate = $('#publicExamDate');
      const publicCenter = $('#publicCenter');
      
      if (publicName && publicTicketNo && publicLevel) {
        publicName.textContent = data.name || '';
        publicTicketNo.textContent = data.ticket || '';
        publicLevel.textContent = data.level || '';
        publicExamDate.textContent = data.examDate || '';
        publicCenter.textContent = data.centerName || '';
        
        // 显示结果卡片
        const resultDiv = $('#publicTicketResult');
        if (resultDiv) {
          resultDiv.classList.remove('hidden');
          console.log('显示公共查询结果');
        }
        
        // 隐藏原来的结果提示
        showResult('admitResult', '', 'success');
      }
    })
    .catch(err => {
      console.error('查询准考证失败:', err);
      showResult('admitResult', '查询失败: ' + (err.message || '网络错误'), 'error');
    });
}

// 绑定准考证相关事件
function bindTicketEvents() {
  console.log('绑定准考证事件...');
  
  // 绑定准考证查询表单
  const admitForm = $('#admitForm');
  if (admitForm) {
    admitForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const query = this.elements.query.value.trim();
      queryAdmitTicket(query);
    });
    console.log('已绑定准考证查询表单');
  }
  
  // 绑定打印我的准考证按钮
  const btnPrintMyTicket = $('#btnPrintMyTicket');
  if (btnPrintMyTicket) {
    btnPrintMyTicket.addEventListener('click', function() {
      const userData = getCurrentUser();
      console.log('打印我的准考证，用户数据:', userData);
      if (userData && userData.ticket && userData.ticket !== '请先报名') {
        printTicket(userData.ticket, userData.idCard);
      } else {
        alert('请先登录并完成报名');
      }
    });
    console.log('已绑定打印我的准考证按钮');
  }
  
  // 绑定预览我的准考证按钮
  const btnViewMyTicket = $('#btnViewMyTicket');
  if (btnViewMyTicket) {
    btnViewMyTicket.addEventListener('click', function() {
      const userData = getCurrentUser();
      if (userData && userData.ticket && userData.ticket !== '请先报名') {
        const url = API_BASE + '/ticket/print?ticket=' + encodeURIComponent(userData.ticket);
        window.open(url, '_blank');
      } else {
        alert('请先登录并完成报名');
      }
    });
    console.log('已绑定预览我的准考证按钮');
  }
  
  // 绑定打印公共查询的准考证按钮
  const btnPrintPublicTicket = $('#btnPrintPublicTicket');
  if (btnPrintPublicTicket) {
    btnPrintPublicTicket.addEventListener('click', function() {
      const ticketNo = $('#publicTicketNo').textContent;
      if (ticketNo && ticketNo !== '请先报名') {
        printTicket(ticketNo);
      }
    });
    console.log('已绑定打印公共准考证按钮');
  }
}

// ==================== 表单处理 ====================

// 处理注册表单提交
function handleRegisterSubmit(e) {
  e.preventDefault();
  console.log('处理注册表单提交');
  
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData.entries());
  
  // 验证必填字段
  const requiredFields = ['province', 'level', 'batchId', 'centerId', 'school'];
  for (const field of requiredFields) {
    if (!data[field]) {
      showResult('registerResult', `请${field === 'school' ? '填写学校名称' : '完成所有必填项'}`, 'error');
      return;
    }
  }
  
  // 获取用户信息
  const userData = getCurrentUser();
  if (!userData || !userData.idCard) {
    showResult('registerResult', '请先登录', 'error');
    return;
  }
  
  // 完善报名数据
  data.name = userData.name || '';
  data.idCard = userData.idCard;
  data.email = userData.email || '';
  data.phone = userData.phone || '';
  
  // 提交报名
  apiCall('POST', '/register', data)
    .then(response => {
      console.log('报名成功:', response);
      
      // 更新用户信息
      const updatedUser = {
        ...userData,
        ticket: response.ticket,
        regNo: response.regNo,
        examDate: response.examDate,
        centerName: response.centerName,
        centerAddr: response.centerAddr,
        level: data.level,
        school: data.school,
        batchId: data.batchId,
        paymentStatus: 'unpaid' // 设置初始缴费状态为未缴费
      };
      
      saveCurrentUser(updatedUser);
      
      // 显示成功消息
      showResult('registerResult', `
        报名信息提交成功！
        报名号：${response.regNo}
        准考证号：${response.ticket}
        考试日期：${response.examDate}
        考点：${response.centerName}
        地址：${response.centerAddr}
        
        请尽快完成缴费以确认报名！
      `, 'success');
      
      // 重置表单
      e.target.reset();
      
      // 跳转到缴费页面
      setTimeout(() => {
        location.hash = `#payment?regNo=${response.regNo}`;
      }, 1000);
      
    })
    .catch(err => {
      console.error('报名失败:', err);
      if (err.status === 401) {
        showResult('registerResult', '登录已过期，请重新登录', 'error');
      } else {
        // 检查错误消息是否为重复报名
        const errorMessage = err.message || '报名失败，请稍后重试';
        if (errorMessage.includes('您已经为该批次报名，不可重复报名')) {
          // 使用弹窗形式显示重复报名错误
          alert(errorMessage);
        } else {
          showResult('registerResult', errorMessage, 'error');
        }
      }
    });
}

// 处理准考证查询表单
function handleAdmitQuery(e) {
  e.preventDefault();
  const query = new FormData(e.target).get("query");
  queryAdmitTicket(query);
}

// 处理成绩查询表单
function handleScoreQuery(e) {
  e.preventDefault();
  const rawInput = new FormData(e.target).get("ticket") || '';
  let inputVal = rawInput.trim();
  
  // 如果输入为空，尝试从用户信息中获取
  if (!inputVal || inputVal.toLowerCase() === 'undefined' || inputVal.toLowerCase() === 'null') {
    const userData = getCurrentUser();
    // 优先使用身份证号，因为服务器端可以根据身份证号查找最近的有成绩的记录
    if (userData && userData.idCard) {
      inputVal = userData.idCard;
    } else if (userData && userData.ticket) {
      const ticketVal = userData.ticket.toLowerCase();
      if (ticketVal !== 'undefined' && ticketVal !== 'null') {
        inputVal = userData.ticket;
      }
    }
    
    // 同时也更新输入框显示
    if (inputVal) {
      const ticketInput = e.target.querySelector('input[name="ticket"]');
      if (ticketInput) ticketInput.value = inputVal;
    }
  }
  
  inputVal = (inputVal || '').trim();
  if (!inputVal) {
    showResult('scoreResult', '请输入准考证号或身份证号', 'error');
    return;
  }
  
  // 智能识别参数
  const params = {};
  
  // 简单的判断：如果长度为18且最后一位可能是X，则认为是身份证号
  // 否则认为是准考证号
  if (inputVal.length === 18 && /^[\d]{17}[\dXx]$/.test(inputVal)) {
     params.idCard = inputVal;
  } else {
     params.ticket = inputVal;
  }
  
  // 添加时间戳防止缓存
  params._t = Date.now();
  
  apiCall('GET', '/score', params)
    .then(data => {
      console.log('Score Data Received:', data); // Debug log
      
      if (data.error) {
        showResult('scoreResult', data.error, 'error');
        return;
      }
      
      const scoreResult = $('#scoreResult');
      if (scoreResult) {
        // 辅助函数：安全显示数值
        const showScore = (val) => (val !== undefined && val !== null) ? val : '<span class="text-gray-400">--</span>';
        
        scoreResult.innerHTML = `
          <!-- DEBUG INFO (Temporary) -->
          <div style="display:none; font-size: 10px; color: #999; margin-bottom: 10px;">
            Debug: ${JSON.stringify(data)}
          </div>
          
          <div class="score-card">
            <h3>成绩查询结果</h3>
            <div class="score-info">
              <p><strong>姓名：</strong>${data.name || '未知'}</p>
              <p><strong>级别：</strong>${data.level || '未知'}</p>
              <p><strong>准考证号：</strong>${data.ticket || '未知'}</p>
            </div>
            <div class="score-details">
              <div class="score-item total">
                <span class="score-label">总分</span>
                <span class="score-value">${showScore(data.total)}</span>
              </div>
              <div class="score-item">
                <span class="score-label">听力</span>
                <span class="score-value">${showScore(data.listening)}</span>
              </div>
              <div class="score-item">
                <span class="score-label">阅读</span>
                <span class="score-value">${showScore(data.reading)}</span>
              </div>
              <div class="score-item">
                <span class="score-label">写作与翻译</span>
                <span class="score-value">${showScore(data.writing)}</span>
              </div>
            </div>
          </div>
        `;
      }
    })
    .catch(err => {
      console.error('查询成绩失败:', err);
      showResult('scoreResult', '查询失败，请稍后重试', 'error');
    });
}

// ==================== 登录注册功能 ====================

// 初始化登录页面
function renderLogin() {
  // 处理登录/注册标签切换
  const authTabs = $$('.auth-tab');
  const loginContainer = $('#login-container');
  const registerContainer = $('#register-container');
  
  authTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabType = this.getAttribute('data-tab');
      
      // 更新活动标签
      authTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      
      // 显示/隐藏容器
      if (tabType === 'login') {
        if (loginContainer) loginContainer.classList.remove('hidden');
        if (registerContainer) registerContainer.classList.add('hidden');
      } else if (tabType === 'register') {
        if (loginContainer) loginContainer.classList.add('hidden');
        if (registerContainer) registerContainer.classList.remove('hidden');
      }

      // 清除所有错误
      $$('.field-error').forEach(el => el.textContent = '');
      $$('.form-row input').forEach(el => el.classList.remove('error'));
    });
  });
  
  // 处理角色切换
  const roleRadios = $$('input[name="role"]');
  const studentBox = $(".login-student");
  const adminBox = $(".login-admin");
  
  const updateRoleDisplay = () => {
    const val = (roleRadios.find(r => r.checked) || {}).value || "student";
    if (studentBox) studentBox.style.display = val === "student" ? "" : "none";
    if (adminBox) adminBox.style.display = val === "admin" ? "" : "none";
  };
  
  roleRadios.forEach(r => r.addEventListener("change", updateRoleDisplay));
  updateRoleDisplay();
  
  // 密码显示/隐藏切换
  const toggleButtons = $$('.toggle-password');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('data-target');
      const input = $(`#${targetId}`);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        
        const eyeOpen = this.querySelector('.eye-open');
        const eyeClosed = this.querySelector('.eye-closed');
        
        if (isPassword) {
          if (eyeOpen) eyeOpen.classList.add('hidden');
          if (eyeClosed) eyeClosed.classList.remove('hidden');
          this.setAttribute('aria-label', '隐藏密码');
        } else {
          if (eyeOpen) eyeOpen.classList.remove('hidden');
          if (eyeClosed) eyeClosed.classList.add('hidden');
          this.setAttribute('aria-label', '显示密码');
        }
        
        input.focus();
      }
    });
  });
}

// 处理登录表单提交
function handleLoginSubmit(e) {
  e.preventDefault();
  console.log('处理登录表单提交');
  
  const formData = new FormData(e.target);
  const role = formData.get("role") || "student";
  const result = $("#loginResult");
  
  if (role === "admin") {
    // 管理员登录
    // 直接获取管理员输入框的值，而不是通过FormData
    const username = document.getElementById("admin-username").value || "";
    const password = document.getElementById("admin-password").value || "";
    
    if (!username || !password) {
      showResult('loginResult', '请填写用户名和密码', 'error');
      return;
    }
    
    apiCall('POST', '/admin/login', { username, password })
      .then(data => {
        if (data.token) {
          localStorage.setItem("CET_API_TOKEN", data.token);
          window.CET_API_TOKEN = data.token;
          
          showResult('loginResult', '管理员登录成功', 'success');
          
          // 跳转到管理员页面
          setTimeout(() => {
            window.location.href = "/admin/index.html";
          }, 500);
        }
      })
      .catch(err => {
        console.error('管理员登录失败:', err);
        showResult('loginResult', '登录失败，请检查用户名和密码', 'error');
      });
    
  } else {
    // 学生登录
    // 直接获取学生输入框的值，而不是通过FormData
    const idCard = document.getElementById("student-idCard").value || "";
    const password = document.getElementById("student-password").value || "";
    
    if (!idCard || !password) {
      showResult('loginResult', '请填写身份证号和密码', 'error');
      return;
    }
    
    // 验证身份证号格式
    if (idCard.length !== 18 || !isValidIdCard(idCard)) {
      showResult('loginResult', '请输入有效的18位身份证号', 'error');
      return;
    }
    
    apiCall('POST', '/student/login', { idCard, password })
      .then(data => {
        if (data.token && data.user) {
          localStorage.setItem("CET_STUDENT_TOKEN", data.token);
          window.CET_STUDENT_TOKEN = data.token;
          
          // 保存用户信息
          const userData = {
            idCard: data.user.idCard,
            name: data.user.name,
            school: data.user.school,
            level: data.user.level,
            token: data.token
          };
          saveCurrentUser(userData);
          
          // 立即获取最新的报名信息（包括准考证号）
          apiCall('GET', '/student/me')
            .then(meData => {
              if (meData && meData.registration) {
                const updatedUser = {
                  ...userData,
                  ...meData.user,
                  ticket: meData.registration.ticket,
                  regNo: meData.registration.regNo,
                  examDate: meData.registration.examDate,
                  centerName: meData.registration.centerName,
                  centerAddr: meData.registration.centerAddr,
                  level: meData.registration.level,
                  batchId: meData.registration.batchId,
                  paymentStatus: meData.registration.paymentStatus
                };
                saveCurrentUser(updatedUser);
                console.log('登录后已更新用户报名信息', updatedUser);
              }
            })
            .catch(err => console.error('获取报名信息失败:', err))
            .finally(() => {
              showResult('loginResult', '登录成功', 'success');
              
              // 更新导航
              updateNav();
              
              // 跳转到首页
              setTimeout(() => {
                location.hash = "#home";
                setRoute("home");
              }, 500);
            });
        }
      })
      .catch(err => {
        console.error('学生登录失败:', err);
        showResult('loginResult', '登录失败，请检查身份证号和密码', 'error');
      });
  }
}

// 处理注册表单提交
function handleRegisterAccountSubmit(e) {
  e.preventDefault();
  console.log('处理账号注册');
  
  const formData = new FormData(e.target);
  const name = formData.get("name") || "";
  const idCard = formData.get("idCard") || "";
  const password = formData.get("password") || "";
  const email = formData.get("email") || "";
  const phone = formData.get("phone") || "";
  
  // 验证姓名
  if (!name || name.trim().length === 0) {
    showResult('accountRegisterResult', '请输入姓名', 'error');
    return;
  }
  
  // 基本验证
  if (!idCard || idCard.length !== 18 || !isValidIdCard(idCard)) {
    showResult('accountRegisterResult', '请输入有效的18位身份证号', 'error');
    return;
  }
  
  if (!password || password.length < 6) {
    showResult('accountRegisterResult', '密码需要至少6个字符', 'error');
    return;
  }
  
  if (!email) {
    showResult('accountRegisterResult', '请输入邮箱', 'error');
    return;
  }
  
  if (!phone || phone.length !== 11) {
    showResult('accountRegisterResult', '请输入11位手机号码', 'error');
    return;
  }
  
  apiCall('POST', '/student/register', { name, idCard, password, email, phone })
    .then(data => {
      if (data.success) {
        showResult('accountRegisterResult', '注册成功！请使用身份证号和密码登录', 'success');
        
        // 重置表单
        e.target.reset();
        
        // 切换到登录标签
        setTimeout(() => {
          const loginTab = $('.auth-tab[data-tab="login"]');
          if (loginTab) loginTab.click();
        }, 1500);
      }
    })
    .catch(err => {
      console.error('注册失败:', err);
      if (err.code === 'PASSWORD_INVALID') {
        // 使用弹窗显示密码错误信息
        alert('密码需要包含字母和数字');
      } else {
        showResult('accountRegisterResult', err.message || '注册失败，请稍后重试', 'error');
      }
    });
}

// ==================== 导航功能 ====================

// 更新导航状态
function updateNav() {
  const loggedIn = isLoggedIn();
  const loginBtn = $("#navLogin");
  const logoutBtn = $("#navLogout");
  
  if (loginBtn) loginBtn.classList.toggle("hidden", loggedIn);
  if (logoutBtn) logoutBtn.classList.toggle("hidden", !loggedIn);
}

// 初始化导航
function initNav() {
  const logoutBtn = $("#navLogout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      
      // 清除所有登录状态
      window.CET_STUDENT_TOKEN = null;
      window.CET_API_TOKEN = null;
      localStorage.removeItem("CET_STUDENT_TOKEN");
      localStorage.removeItem("CET_API_TOKEN");
      localStorage.removeItem('current_user');
      
      updateNav();
      location.hash = "#login";
      setRoute("login");
    });
  }
  updateNav();
}

// ==================== 初始化函数 ====================

// 初始化表单事件
function initForms() {
  // 注册表单（考试报名）
  const registerForm = $("#registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", handleRegisterSubmit);
  }
  
  // 登录表单
  const loginForm = $("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }
  
  // 账号注册表单
  const registerAccountForm = $("#registerAccountForm");
  if (registerAccountForm) {
    registerAccountForm.addEventListener("submit", handleRegisterAccountSubmit);
  }
  
  // 准考证查询表单
  const admitForm = $("#admitForm");
  if (admitForm) {
    admitForm.addEventListener("submit", handleAdmitQuery);
  }
  
  // 成绩查询表单
  const scoreForm = $("#scoreForm");
  if (scoreForm) {
    scoreForm.addEventListener("submit", handleScoreQuery);
  }
  
  // 注册表单的上一步按钮
  const btnPrevStep = $("#btnPrevStep");
  if (btnPrevStep) {
    btnPrevStep.addEventListener("click", function() {
      location.hash = "#qualification";
    });
  }
}

// 初始化路由
function initRoutes() {
  function onHashChange() {
    const defaultRoute = isLoggedIn() ? "home" : "login";
    const hash = location.hash.replace("#", "") || defaultRoute;
    setRoute(hash);
  }
  
  window.addEventListener("hashchange", onHashChange);
  
  // 初始化路由链接
  $$("a[data-route]").forEach(a => {
    a.addEventListener("click", function(e) {
      e.preventDefault();
      const route = this.getAttribute("href")?.replace("#", "") || "home";
      location.hash = "#" + route;
    });
  });
  
  onHashChange();
}

// 主启动函数
function boot() {
  console.log('启动CET考试系统...');
  
  loadState();
  initRoutes();
  initForms();
  initNav();
  renderLogin();
  
  // 如果已登录，更新用户信息
  if (isLoggedIn()) {
    const userData = getCurrentUser();
    if (userData) {
      // 先显示本地存储的信息
      showUserTicketInfo(userData);
      
      // 从服务器获取最新的报名信息
      if (userData.token) {
        apiCall('GET', '/student/me')
          .then(data => {
            if (data && data.registration) {
              const updatedUser = {
                ...userData,
                ...data.user, // 更新用户基本信息
                ticket: data.registration.ticket || userData.ticket,
                regNo: data.registration.regNo || userData.regNo,
                examDate: data.registration.examDate || userData.examDate,
                centerName: data.registration.centerName || userData.centerName,
                centerAddr: data.registration.centerAddr || userData.centerAddr,
                level: data.registration.level || userData.level,
                batchId: data.registration.batchId || userData.batchId,
                paymentStatus: data.registration.paymentStatus || userData.paymentStatus
              };
              saveCurrentUser(updatedUser);
              showUserTicketInfo(updatedUser);
            } else if (data && data.user) {
              // 如果有用户信息但没有注册信息
              const updatedUser = {
                ...userData,
                ...data.user
              };
              saveCurrentUser(updatedUser);
              showUserTicketInfo(updatedUser);
            }
          })
          .catch(err => {
            console.error('获取用户最新信息失败:', err);
          });
      }
    }
  }
  
  console.log('系统启动完成');
}

// ==================== 事件监听器 ====================

// 页面加载完成后启动
document.addEventListener("DOMContentLoaded", boot);

// 监听登录状态变化
document.addEventListener('login', function() {
  console.log('收到登录事件');
  const userData = getCurrentUser();
  if (userData) {
    showUserTicketInfo(userData);
  }
});

document.addEventListener('logout', function() {
  console.log('收到登出事件');
  const userSection = $('#userTicketSection');
  const publicSection = $('#publicTicketSection');
  const publicResult = $('#publicTicketResult');
  
  if (userSection) userSection.classList.add('hidden');
  if (publicSection) publicSection.classList.remove('hidden');
  if (publicResult) publicResult.classList.add('hidden');
});

// 导出全局函数（如果需要）
window.CET_APP = {
  setRoute,
  isLoggedIn,
  getCurrentUser,
  apiCall,
  showResult,
  printTicket,
  queryAdmitTicket
};
