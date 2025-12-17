const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const state = { route: "home", registrations: [] };
const storageKey = "cet-demo-registrations";
function loadState() {
  const raw = localStorage.getItem(storageKey);
  state.registrations = raw ? JSON.parse(raw) : [];
}
function isLoggedIn() {
  try {
    if (window.CET_API_TOKEN) return true;
    if (window.CET_STUDENT_TOKEN) return true;
    const s = localStorage.getItem("CET_STUDENT_TOKEN");
    if (s) { window.CET_STUDENT_TOKEN = s; return true; }
    return false;
  } catch (_) {
    return !!(window.CET_API_TOKEN || window.CET_STUDENT_TOKEN);
  }
}
function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state.registrations));
}
function pad(n, w) {
  return String(n).padStart(w, "0");
}
function genRegNo(batchId, level, idx) {
  return `${batchId}-${level === "CET-4" ? "CET4" : "CET6"}-${pad(idx, 8)}`;
}
function genTicketNo(regNo) {
  const h = Array.from(regNo).reduce((a, c) => a * 131 + c.charCodeAt(0), 7);
  return `T${String(h).slice(-10)}`;
}
function setRoute(route) {
  if (route !== "login" && !isLoggedIn()) {
    route = "login";
    location.hash = "#login";
  }
  state.route = route;
  $$(".view").forEach(v => v.classList.add("hidden"));
  const el = $(`#view-${route}`);
  if (el) el.classList.remove("hidden");
  if (route === "home") renderHome();
  if (route === "register") renderRegister();
}
function renderLogin() {
  const roleRadios = $$('input[name="role"]');
  const studentBox = $(".login-student");
  const adminBox = $(".login-admin");
  
  // Load saved role from localStorage
  try {
    const savedRole = localStorage.getItem("CET_LOGIN_ROLE");
    if (savedRole) {
      const radioToCheck = roleRadios.find(r => r.value === savedRole);
      if (radioToCheck) {
        radioToCheck.checked = true;
      }
    }
  } catch (e) {
    // Ignore localStorage errors - feature degrades gracefully
  }
  
  const update = () => {
    const val = (roleRadios.find(r => r.checked) || {}).value || "student";
    if (studentBox) studentBox.style.display = val === "student" ? "" : "none";
    if (adminBox) adminBox.style.display = val === "admin" ? "" : "none";
    
    // Save selected role to localStorage
    try {
      localStorage.setItem("CET_LOGIN_ROLE", val);
    } catch (e) {
      // Ignore localStorage errors - feature degrades gracefully
    }
  };
  
  roleRadios.forEach(r => r.addEventListener("change", update));
  update();
  
  // Add password toggle functionality
  const toggleButtons = $$('.toggle-password');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      const input = $(`#${targetId}`);
      if (input) {
        if (input.type === 'password') {
          input.type = 'text';
          this.setAttribute('aria-label', '隐藏密码');
        } else {
          input.type = 'password';
          this.setAttribute('aria-label', '显示密码');
        }
      }
    });
  });
}
function renderHome() {
  const list = $("#noticeList");
  list.innerHTML = "";
  CET_API.fetchNotices().then(ns => {
    list.innerHTML = "";
    ns.forEach(n => {
      const li = document.createElement("li");
      li.textContent = `${n.date}：${n.title}（${n.content}）`;
      list.appendChild(li);
    });
  });
  const batches = $("#batchList");
  batches.innerHTML = "";
  CET_API.fetchBatches().then(bs => {
    batches.innerHTML = "";
    bs.forEach(b => {
      const row = document.createElement("div");
      row.className = "batch";
      const left = document.createElement("div");
      left.innerHTML = `<div>${b.name}</div><div class="meta">报名 ${b.registerStart} ~ ${b.registerEnd} · 考试 ${b.examDate}</div>`;
      const right = document.createElement("div");
      const link = document.createElement("a");
      link.href = "#register";
      link.textContent = "报名";
      right.appendChild(link);
      row.appendChild(left);
      row.appendChild(right);
      batches.appendChild(row);
    });
  });
}
function renderRegister() {
  const batchSelect = $("#batchSelect");
  batchSelect.innerHTML = `<option value="">请选择</option>`;
  CET_API.fetchBatches().then(bs => {
    batchSelect.innerHTML = `<option value="">请选择</option>`;
    bs.forEach(b => {
      const o = document.createElement("option");
      o.value = b.id;
      o.textContent = `${b.name}（考试日期 ${b.examDate}）`;
      batchSelect.appendChild(o);
    });
  });
  const centerSelect = $("#centerSelect");
  centerSelect.innerHTML = `<option value="">请选择</option>`;
  CET_API.fetchCenters().then(cs => {
    centerSelect.innerHTML = `<option value="">请选择</option>`;
    cs.forEach(c => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = `${c.name}`;
      centerSelect.appendChild(o);
    });
  });
}
function handleRegisterSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  if (!data.name || !data.idCard || !data.school || !data.level || !data.batchId || !data.email || !data.phone || !data.centerId) return;
  CET_API.submitRegistration(data).then(resp => {
    const record = { ...data, regNo: resp.regNo, ticket: resp.ticket, centerName: resp.centerName, centerAddr: resp.centerAddr, examDate: resp.examDate };
    state.registrations.push(record);
    saveState();
    const result = $("#registerResult");
    result.classList.remove("hidden");
    result.innerHTML = `报名成功。报名号：${resp.regNo}，准考证号：${resp.ticket}。请在准考证开放后打印。`;
    e.target.reset();
  }).catch(() => {});
}
function handleAdmitQuery(e) {
  e.preventDefault();
  const q = new FormData(e.target).get("query");
  CET_API.getAdmitByQuery(q).then(item => {
    const container = $("#admitResult");
    container.innerHTML = "";
    if (!item) {
      const local = state.registrations.find(r => r.regNo === q || r.idCard === q);
      if (!local) {
        container.innerHTML = `<div class="result">未找到报名记录</div>`;
        return;
      }
      item = local;
    }
    const card = document.createElement("div");
    card.className = "admit-card";
    card.innerHTML = `
      <div>姓名：${item.name}</div>
      <div>学校：${item.school}</div>
      <div>级别：${item.level}</div>
      <div>考试日期：${item.examDate}</div>
      <div>准考证号：${item.ticket}</div>
      <div>考点：${item.centerName}</div>
      <div>地址：${item.centerAddr}</div>
    `;
    const actions = document.createElement("div");
    actions.className = "admit-actions";
    const btnPrint = document.createElement("button");
    btnPrint.textContent = "打印";
    btnPrint.addEventListener("click", () => window.print());
    const btnDownload = document.createElement("button");
    btnDownload.className = "secondary";
    btnDownload.textContent = "下载HTML";
    btnDownload.addEventListener("click", () => {
      const blob = new Blob([`<meta charset="utf-8"><div>${card.innerHTML}</div>`], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${item.ticket}.html`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
    actions.appendChild(btnPrint);
    actions.appendChild(btnDownload);
    container.appendChild(card);
    container.appendChild(actions);
  });
}
function handleScoreQuery(e) {
  e.preventDefault();
  const ticket = new FormData(e.target).get("ticket");
  CET_API.getScoreByTicket(ticket).then(sc => {
    const container = $("#scoreResult");
    container.innerHTML = "";
    if (!sc) {
      const reg = state.registrations.find(r => r.ticket === ticket);
      const demo = CET_DATA.demoScores[reg ? reg.regNo : ""];
      if (!reg || !demo) {
        container.innerHTML = `<div class="result">未查询到成绩，请确认准考证号或等待成绩发布</div>`;
        return;
      }
      sc = { total: demo.total, listening: demo.listening, reading: demo.reading, writing: demo.writing, name: reg.name, level: reg.level };
    }
    const card = document.createElement("div");
    card.className = "score-card";
    const name = sc.name || "";
    const level = sc.level || "";
    card.innerHTML = `
      <div>姓名：${name}（${level}）</div>
      <div class="score-total">总分：${sc.total}</div>
      <div class="score-grid">
        <div class="score-item">听力：${sc.listening}</div>
        <div class="score-item">阅读：${sc.reading}</div>
        <div class="score-item">写作与翻译：${sc.writing}</div>
      </div>
    `;
    container.appendChild(card);
  });
}
function initRoutes() {
  function onHashChange() {
    const defaultRoute = isLoggedIn() ? "home" : "login";
    const hash = location.hash.replace("#", "") || defaultRoute;
    setRoute(hash);
  }
  window.addEventListener("hashchange", onHashChange);
  $$("a[data-route]").forEach(a => a.addEventListener("click", () => {}));
  onHashChange();
}
function initForms() {
  const reg = $("#registerForm");
  if (reg) reg.addEventListener("submit", handleRegisterSubmit);
  const admit = $("#admitForm");
  if (admit) admit.addEventListener("submit", handleAdmitQuery);
  const score = $("#scoreForm");
  if (score) score.addEventListener("submit", handleScoreQuery);
  const loginForm = $("#loginForm");
  if (loginForm) {
    renderLogin();
    
    // Add real-time validation for login form
    const validateField = (field, errorId, validationFn) => {
      const errorEl = $(`#${errorId}`);
      const validate = () => {
        const error = validationFn(field.value);
        if (errorEl) {
          errorEl.textContent = error || '';
        }
        if (error) {
          field.classList.add('error');
        } else {
          field.classList.remove('error');
        }
        return !error;
      };
      field.addEventListener('blur', validate);
      field.addEventListener('input', () => {
        if (field.classList.contains('error')) {
          validate();
        }
      });
      return validate;
    };
    
    const studentIdCard = $('#student-idCard');
    const studentPassword = $('#student-password');
    const adminUsername = $('#admin-username');
    const adminPassword = $('#admin-password');
    
    // Setup real-time validation for each field
    if (studentIdCard) {
      validateField(studentIdCard, 'error-student-idCard', (val) => {
        if (!val) return '请输入身份证号';
        if (val.length !== 18) return '身份证号应为18位';
        return '';
      });
    }
    
    if (studentPassword) {
      validateField(studentPassword, 'error-student-password', (val) => {
        if (!val) return '请输入密码';
        if (val.length < 6) return '密码至少6位';
        return '';
      });
    }
    
    if (adminUsername) {
      validateField(adminUsername, 'error-admin-username', (val) => {
        if (!val) return '请输入用户名';
        return '';
      });
    }
    
    if (adminPassword) {
      validateField(adminPassword, 'error-admin-password', (val) => {
        if (!val) return '请输入密码';
        return '';
      });
    }
    
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const role = fd.get("role") || "student";
      const result = $("#loginResult");
      
      // Clear previous errors
      $$('.field-error').forEach(el => el.textContent = '');
      $$('.form-row input').forEach(el => el.classList.remove('error'));
      
      if (role === "admin") {
        const username = fd.get("username") || "";
        const password = fd.get("password") || "";
        
        // Validate admin fields
        let hasError = false;
        if (!username) {
          const errorEl = $('#error-admin-username');
          if (errorEl) errorEl.textContent = '请输入用户名';
          if (adminUsername) adminUsername.classList.add('error');
          hasError = true;
        }
        if (!password) {
          const errorEl = $('#error-admin-password');
          if (errorEl) errorEl.textContent = '请输入密码';
          if (adminPassword) adminPassword.classList.add('error');
          hasError = true;
        }
        
        if (hasError) return;
        
        CET_API.login(username, password).then(r => {
          window.CET_API_TOKEN = r.token;
          try { localStorage.setItem("CET_API_TOKEN", r.token) } catch {}
          if (result) { result.classList.remove("hidden"); result.textContent = "登录成功（管理员）"; }
          location.href = "./admin/index.html#registrations";
        }).catch(() => {
          if (result) { result.classList.remove("hidden"); result.textContent = "登录失败"; }
        });
        return;
      }
      
      const idCard = fd.get("idCard") || "";
      const pwd = fd.get("password") || "";
      
      // Validate student fields
      let hasError = false;
      if (!idCard) {
        const errorEl = $('#error-student-idCard');
        if (errorEl) errorEl.textContent = '请输入身份证号';
        if (studentIdCard) studentIdCard.classList.add('error');
        hasError = true;
      } else if (idCard.length !== 18) {
        const errorEl = $('#error-student-idCard');
        if (errorEl) errorEl.textContent = '身份证号应为18位';
        if (studentIdCard) studentIdCard.classList.add('error');
        hasError = true;
      }
      
      if (!pwd) {
        const errorEl = $('#error-student-password');
        if (errorEl) errorEl.textContent = '请输入密码';
        if (studentPassword) studentPassword.classList.add('error');
        hasError = true;
      } else if (pwd.length < 6) {
        const errorEl = $('#error-student-password');
        if (errorEl) errorEl.textContent = '密码至少6位';
        if (studentPassword) studentPassword.classList.add('error');
        hasError = true;
      }
      
      if (hasError) return;
      
      CET_API.studentLogin(idCard, pwd).then(r => {
        window.CET_STUDENT_TOKEN = r.token;
        try { localStorage.setItem("CET_STUDENT_TOKEN", r.token) } catch {}
        if (result) { result.classList.remove("hidden"); result.textContent = "登录成功（学生）"; }
        location.hash = "#home";
        setRoute("home");
      }).catch(() => {
        if (result) { result.classList.remove("hidden"); result.textContent = "学生登录失败"; }
      });
    });
  }
}
function boot() {
  loadState();
  initRoutes();
  initForms();
}
document.addEventListener("DOMContentLoaded", boot);
