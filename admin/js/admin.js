const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function setRoute(route) {
  $$(".view").forEach(v => v.classList.add("hidden"));
  const el = $(`#view-${route}`);
  if (el) el.classList.remove("hidden");
  if (route === "registrations") renderRegistrations();
  if (route === "scores") ensureAuth(() => {});
  if (route === "registrations") ensureAuth(() => {});
}
function ensureAuth(ok) {
  CET_API.me().then(() => {
    $("#navLogin").style.display = "none";
    $("#navLogout").style.display = "inline";
    refreshStatus();
    ok();
  }).catch(() => {
    refreshStatus();
    location.hash = "#login";
  });
}
function renderRegistrations() {
  const batchSel = $("#filterBatch");
  batchSel.innerHTML = `<option value="">全部批次</option>`;
  CET_API.fetchBatches().then(bs => {
    bs.forEach(b => {
      const o = document.createElement("option");
      o.value = b.id;
      o.textContent = `${b.name}`;
      batchSel.appendChild(o);
    });
  });
  function load() {
    const params = {
      batchId: batchSel.value || "",
      level: $("#filterLevel").value || ""
    };
    CET_API.listRegistrations(params).then(list => {
      const tbl = document.createElement("table");
      tbl.style.width = "100%";
      tbl.style.borderCollapse = "collapse";
      const head = document.createElement("tr");
      ["报名号","姓名","学校","级别","准考证号","批次","考点"].forEach(t => {
        const th = document.createElement("th");
        th.textContent = t;
        th.style.borderBottom = "1px solid #e5eaf0";
        th.style.textAlign = "left";
        th.style.padding = "6px";
        head.appendChild(th);
      });
      tbl.appendChild(head);
      list.forEach(r => {
        const tr = document.createElement("tr");
        [r.regNo, r.name, r.school, r.level, r.ticket, r.batchId, r.centerName].forEach(v => {
          const td = document.createElement("td");
          td.textContent = v || "";
          td.style.padding = "6px";
          tr.appendChild(td);
        });
        tbl.appendChild(tr);
      });
      const container = $("#regTable");
      container.innerHTML = "";
      container.appendChild(tbl);
    });
  }
  $("#btnRefresh").addEventListener("click", load);
  batchSel.addEventListener("change", load);
  $("#filterLevel").addEventListener("change", load);
  load();
}
function handleScoreSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.total = Number(payload.total);
  payload.listening = Number(payload.listening);
  payload.reading = Number(payload.reading);
  payload.writing = Number(payload.writing);
  CET_API.submitScore(payload).then(() => {
    const res = $("#scoreResult");
    res.classList.remove("hidden");
    res.textContent = "成绩已保存";
    e.target.reset();
  }).catch(() => {
    const res = $("#scoreResult");
    res.classList.remove("hidden");
    res.textContent = "保存失败，请检查准考证号与分数";
  });
}
function handleScoreQuery(e) {
  e.preventDefault();
  const ticket = new FormData(e.target).get("ticket");
  CET_API.getScoreByTicket(ticket).then(sc => {
    const container = $("#scoreQueryResult");
    container.innerHTML = "";
    if (!sc) {
      container.innerHTML = `<div class="result">未查询到成绩</div>`;
      return;
    }
    const card = document.createElement("div");
    card.className = "score-card";
    card.innerHTML = `
      <div>姓名：${sc.name}（${sc.level}）</div>
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
function boot() {
  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "") || "registrations";
    setRoute(hash);
  });
  const hash = location.hash.replace("#", "") || "registrations";
  setRoute(hash);
  const scoreForm = $("#scoreForm");
  if (scoreForm) scoreForm.addEventListener("submit", handleScoreSubmit);
  const scoreQueryForm = $("#scoreQueryForm");
  if (scoreQueryForm) scoreQueryForm.addEventListener("submit", handleScoreQuery);
  const loginForm = $("#loginForm");
  if (loginForm) loginForm.addEventListener("submit", e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = fd.get("username");
    const password = fd.get("password");
    CET_API.login(username, password).then(r => {
      window.CET_API_TOKEN = r.token;
      try { localStorage.setItem("CET_API_TOKEN", r.token) } catch {}
      $("#loginResult").classList.remove("hidden");
      $("#loginResult").textContent = "登录成功";
      refreshStatus();
      location.hash = "#registrations";
    }).catch(() => {
      $("#loginResult").classList.remove("hidden");
      $("#loginResult").textContent = "登录失败";
      refreshStatus();
    });
  });
  try {
    var t = localStorage.getItem("CET_API_TOKEN");
    if (t) window.CET_API_TOKEN = t;
  } catch {}
  refreshStatus();
  const navLogout = $("#navLogout");
  if (navLogout) navLogout.addEventListener("click", e => {
    e.preventDefault();
    CET_API.logout().finally(() => {
      window.CET_API_TOKEN = null;
      try { localStorage.removeItem("CET_API_TOKEN") } catch {}
      $("#navLogin").style.display = "inline";
      $("#navLogout").style.display = "none";
      refreshStatus();
      location.hash = "#login";
    });
  });
}
document.addEventListener("DOMContentLoaded", boot);
function refreshStatus(){
  var api = window.CET_API_BASE || "";
  var apiEl = $("#statusApi");
  var userEl = $("#statusUser");
  if (apiEl) apiEl.textContent = "后端: " + api;
  if (!window.CET_API_TOKEN) {
    if (userEl) userEl.textContent = "未登录";
    return;
  }
  CET_API.me().then(r=>{
    if (userEl) userEl.textContent = "已登录: " + (r.user && r.user.username || "");
  }).catch(()=>{
    if (userEl) userEl.textContent = "未登录";
  });
}
