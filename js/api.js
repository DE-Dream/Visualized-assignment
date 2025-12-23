;(function () {
  function qs(k) {
    var m = location.search.match(new RegExp("[?&]"+k+"=([^&]+)"))
    return m ? decodeURIComponent(m[1]) : null
  }
  
  // 配置API基础路径
  const API_BASE = window.CET_API_BASE || qs("api") || "/api"
  
  // API调用函数，与app.js保持一致的实现
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
        window.CET_STUDENT_TOKEN = studentToken;
        options.headers['Authorization'] = `Bearer ${studentToken}`;
      } else if (adminToken) {
        window.CET_API_TOKEN = adminToken;
        options.headers['Authorization'] = `Bearer ${adminToken}`;
      }
      
      let fullUrl = url;
      if (data) {
        if (method === 'GET') {
          const params = new URLSearchParams(data).toString();
          fullUrl = `${url}?${params}`;
        } else {
          options.body = JSON.stringify(data);
        }
      }
      
      const response = await fetch(fullUrl, options);
      
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
          window.CET_STUDENT_TOKEN = null;
          window.CET_API_TOKEN = null;
          // 跳转到登录页面
          alert('登录已过期，请重新登录');
          location.href = '../index.html#login';
        }
        
        throw error;
      }
      
      return responseData;
    } catch (error) {
      // 处理网络错误等其他类型的错误
      if (!error.status) {
        error.status = 0;
        // 详细判断错误类型，避免一律显示网络错误
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
          error.message = '网络错误，请检查网络连接';
          error.code = 'NETWORK_ERROR';
        } else {
          error.message = error.message || '请求失败，请稍后重试';
          error.code = error.code || 'UNKNOWN_ERROR';
        }
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
        'SERVER_ERROR': '服务器错误，请稍后重试',
        'REGISTRATION_NOT_FOUND': '报名记录不存在',
        'PERMISSION_DENIED': '没有权限执行此操作',
        'FIELD_REQUIRED': '请填写所有必填项'
      };
      
      if (error.code && errorMessages[error.code]) {
        error.message = errorMessages[error.code];
      }
      
      throw error;
    }
  }
  
  // API方法封装，保持与原有接口兼容
  var api = {
    fetchNotices: function () {
      return apiCall('GET', '/notices').catch(function(){
        var CD = window.CET_DATA || {}
        return Promise.resolve(CD.notices || [])
      })
    },
    fetchBatches: function () {
      return apiCall('GET', '/batches').catch(function(){
        var CD = window.CET_DATA || {}
        return Promise.resolve(CD.batches || [])
      })
    },
    fetchCenters: function () {
      return apiCall('GET', '/centers').catch(function(){
        var CD = window.CET_DATA || {}
        return Promise.resolve(CD.centers || [])
      })
    },
    listRegistrations: function (params) {
      return apiCall('GET', '/registrations', params).catch(function(){ return Promise.resolve([]) })
    },
    submitRegistration: function (payload) {
      return apiCall('POST', '/register', payload).catch(function(){
        var idx = (window.__cet_idx||0) + 1
        window.__cet_idx = idx
        var regNo = payload.batchId + "-" + (payload.level==="CET-4"?"CET4":"CET6") + "-" + String(idx).padStart(8,"0")
        var h = 0
        for (var i=0;i<regNo.length;i++){ h = ((h<<5)-h) + regNo.charCodeAt(i); h|=0 }
        var ticket = "T" + String(Math.abs(h)).padStart(10,'0').slice(-10)
        var c = CET_DATA.centers.find(function(x){ return x.id===payload.centerId }) || {}
        var b = CET_DATA.batches.find(function(x){ return x.id===payload.batchId }) || {}
        return Promise.resolve({ regNo: regNo, ticket: ticket, examDate: b.examDate || "", centerName: c.name || "", centerAddr: c.address || "" })
      })
    },
    getAdmitByQuery: function (q) {
      return apiCall('GET', '/admit', { query: q }).catch(function(){ return Promise.resolve(null) })
    },
    getScoreByTicket: function (t) {
      return apiCall('GET', '/score', { ticket: t }).catch(function(){ return Promise.resolve(null) })
    },
    submitScore: function (payload) {
      return apiCall('POST', '/score', payload)
    },
    login: function (username, password) {
      return apiCall('POST', '/admin/login', { username: username, password: password })
    },
    logout: function () {
      return apiCall('POST', '/logout', {})
    },
    me: function () {
      return apiCall('GET', '/me')
    },
    studentLogin: function (idCard, password) {
      return apiCall('POST', '/student/login', { idCard: idCard, password: password })
    },
    studentLogout: function () {
      return apiCall('POST', '/student/logout', {})
    },
    studentMe: function () {
      return apiCall('GET', '/student/me')
    },
    getUserInfo: function() {
      return this.studentMe()
    },
    register: function (idCard, password, email, phone, name) {
      return apiCall('POST', '/student/register', { idCard: idCard, password: password, email: email, phone: phone, name: name })
    },
    importScores: function (scores) {
      return apiCall('POST', '/admin/import-scores', { scores: scores })
    },
    getExamStats: function (batchId, level) {
      const params = {};
      if (batchId) params.batchId = batchId;
      if (level) params.level = level;
      return apiCall('GET', '/admin/stats', params)
    },
    updateRegistration: function (regNo, payload) {
      return apiCall('PUT', `/admin/registration/${regNo}`, payload)
    },
    deleteRegistration: function (regNo) {
      return apiCall('DELETE', `/admin/registration/${regNo}`)
    },
    // 自动安排考场
    autoArrangeExamRooms: function(params) {
      return apiCall('POST', '/admin/auto-arrange', params)
    }
  }
  
  window.CET_API = api
})()

