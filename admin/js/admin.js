const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function setRoute(route) {
  $$(".view").forEach(v => v.classList.add("hidden"));
  const el = $(`#view-${route}`);
  if (el) el.classList.remove("hidden");
  if (route === "registrations") renderRegistrations();
  if (route === "scores") ensureAuth(() => { initScoreImport(); });
  if (route === "registrations") ensureAuth(() => {});
  if (route === "exam-rooms") ensureAuth(() => { initExamRoom(); });
}

function ensureAuth(ok) {
  const navLogin = $("#navLogin");
  const navLogout = $("#navLogout");
  
  CET_API.me().then(() => {
    if (navLogin) navLogin.style.display = "none";
    if (navLogout) navLogout.style.display = "inline";
    refreshStatus();
    ok();
  }).catch(err => {
    console.error('Auth check failed:', err);
    refreshStatus();
    setTimeout(() => {
      location.href = "../index.html#login";
    }, 100);
  });
}

function renderRegistrations() {
  const batchSel = $("#filterBatch");
  const levelSel = $("#filterLevel");
  
  if (!batchSel || !levelSel) {
    console.error('Required filter elements not found');
    return;
  }
  
  // 加载批次选项
  batchSel.innerHTML = `<option value="">全部批次</option>`;
  CET_API.fetchBatches().then(bs => {
    bs.forEach(b => {
      const o = document.createElement("option");
      o.value = b.id;
      o.textContent = `${b.name}`;
      batchSel.appendChild(o);
    });
  }).catch(err => {
    console.error('Failed to load batches:', err);
  });
  
  function load() {
    const params = {
      batchId: batchSel.value,
      level: levelSel.value
    };
    
    CET_API.listRegistrations(params).then(list => {
      const container = $("#regTable");
      if (!container) return;
      
      const tbl = document.createElement("table");
      tbl.style.width = "100%";
      tbl.style.borderCollapse = "collapse";
      
      // 表头
      const head = document.createElement("tr");
      ["缴费状态","报名号","姓名","学校","级别","准考证号","批次","考点","操作"].forEach(t => {
        const th = document.createElement("th");
        th.textContent = t;
        th.style.borderBottom = "1px solid #e5eaf0";
        th.style.textAlign = "left";
        th.style.padding = "6px";
        head.appendChild(th);
      });
      tbl.appendChild(head);
      
      // 表格内容
      list.forEach(r => {
        const tr = document.createElement("tr");
        
        // 缴费状态
        const statusTd = document.createElement("td");
        statusTd.textContent = r.paymentStatus || "未缴费";
        statusTd.style.padding = "6px";
        statusTd.style.color = r.paymentStatus === "paid" ? "green" : "red";
        tr.appendChild(statusTd);
        
        // 其他信息
        [r.regNo, r.name, r.school, r.level, r.ticket, r.batchId, r.centerName].forEach(v => {
          const td = document.createElement("td");
          td.textContent = v || "";
          td.style.padding = "6px";
          tr.appendChild(td);
        });
        
        // 操作列
        const actionTd = document.createElement("td");
        actionTd.style.padding = "6px";
        actionTd.style.textAlign = "center";
        
        // 编辑按钮
        const editBtn = document.createElement("button");
        editBtn.textContent = "编辑";
        editBtn.className = "btn-small";
        editBtn.style.marginRight = "4px";
        editBtn.addEventListener("click", () => openEditModal(r));
        actionTd.appendChild(editBtn);
        
        // 删除按钮（只对未缴费记录显示）
        if (r.paymentStatus !== "paid") {
          const deleteBtn = document.createElement("button");
          deleteBtn.textContent = "删除";
          deleteBtn.className = "btn-small";
          deleteBtn.style.backgroundColor = "#ef5350";
          deleteBtn.style.color = "white";
          deleteBtn.addEventListener("click", () => deleteUnpaidRegistration(r.regNo));
          actionTd.appendChild(deleteBtn);
        }
        
        tr.appendChild(actionTd);
        tbl.appendChild(tr);
      });
      
      container.innerHTML = "";
      container.appendChild(tbl);
    }).catch(err => {
      console.error('Failed to load registrations:', err);
      showError("regTable", "加载报名列表失败，请检查网络连接");
    });
    
    // 加载统计数据
    loadStats(batchSel.value, levelSel.value);
  }
  
  const btnRefresh = $("#btnRefresh");
  if (btnRefresh) btnRefresh.addEventListener("click", load);
  
  batchSel.addEventListener("change", load);
  levelSel.addEventListener("change", load);
  
  load();
}

// 显示错误信息
function showError(elementId, message) {
  const element = $("#" + elementId);
  if (element) {
    element.innerHTML = `<div class="error">${message}</div>`;
  }
}

// 删除未缴费报名记录
function deleteUnpaidRegistration(regNo) {
  if (!confirm(`确定要删除报名号为 ${regNo} 的未缴费记录吗？`)) {
    return;
  }
  
  // 检查API端点是否存在
  if (!CET_API.deleteRegistration) {
    console.error('CET_API.deleteRegistration方法不存在');
    alert('删除功能暂不可用，请检查API配置');
    return;
  }
  
  CET_API.deleteRegistration(regNo)
    .then(() => {
      alert(`报名号 ${regNo} 的记录已删除`);
      renderRegistrations();
    })
    .catch(err => {
      console.error('删除失败:', err);
      alert(`删除失败: ${err.message || '请检查网络连接'}`);
    });
}

// 打开编辑报名数据模态框
function openEditModal(registration) {
  // 创建模态框
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  modal.style.zIndex = "1000";
  
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modalContent.style.backgroundColor = "white";
  modalContent.style.padding = "20px";
  modalContent.style.borderRadius = "8px";
  modalContent.style.width = "90%";
  modalContent.style.maxWidth = "600px";
  modalContent.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
  
  const form = document.createElement("form");
  form.id = "editRegistrationForm";
  
  const title = document.createElement("h3");
  title.textContent = `编辑报名信息 - ${registration.regNo}`;
  title.style.marginBottom = "20px";
  form.appendChild(title);
  
  // 编辑字段
  const fields = [
    { name: "level", label: "考试级别", type: "select", options: ["CET-4", "CET-6"] },
    { name: "centerName", label: "考点名称", type: "text" },
    { name: "centerAddr", label: "考点地址", type: "text" },
    { name: "email", label: "邮箱", type: "email" },
    { name: "phone", label: "电话", type: "tel" },
    { name: "paymentStatus", label: "缴费状态", type: "select", options: ["unpaid", "paid", "refunded"] },
    { name: "examStatus", label: "考试状态", type: "select", options: ["registered", "cancelled", "completed"] }
  ];
  
  fields.forEach(field => {
    const formRow = document.createElement("div");
    formRow.className = "form-row";
    formRow.style.marginBottom = "15px";
    
    const label = document.createElement("label");
    label.textContent = field.label;
    label.style.display = "block";
    label.style.marginBottom = "5px";
    formRow.appendChild(label);
    
    let input;
    if (field.type === "select") {
      input = document.createElement("select");
      input.name = field.name;
      input.style.width = "100%";
      input.style.padding = "8px";
      input.style.border = "1px solid #ddd";
      input.style.borderRadius = "4px";
      
      field.options.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        if (registration[field.name] === option) {
          opt.selected = true;
        }
        input.appendChild(opt);
      });
    } else {
      input = document.createElement("input");
      input.type = field.type;
      input.name = field.name;
      input.style.width = "100%";
      input.style.padding = "8px";
      input.style.border = "1px solid #ddd";
      input.style.borderRadius = "4px";
      input.value = registration[field.name] || "";
    }
    
    formRow.appendChild(input);
    form.appendChild(formRow);
  });
  
  // 操作按钮
  const actions = document.createElement("div");
  actions.className = "form-actions";
  actions.style.display = "flex";
  actions.style.justifyContent = "flex-end";
  actions.style.marginTop = "20px";
  
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "取消";
  cancelBtn.className = "btn-secondary";
  cancelBtn.style.marginRight = "10px";
  cancelBtn.addEventListener("click", () => document.body.removeChild(modal));
  actions.appendChild(cancelBtn);
  
  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.textContent = "保存修改";
  saveBtn.className = "btn-primary";
  actions.appendChild(saveBtn);
  
  form.appendChild(actions);
  
  // 结果显示
  const result = document.createElement("div");
  result.id = "editResult";
  result.className = "result hidden";
  result.style.marginTop = "15px";
  form.appendChild(result);
  
  modalContent.appendChild(form);
  modal.appendChild(modalContent);
  
  // 表单提交
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData);
    
    // 检查更新API是否存在
    if (!CET_API.updateRegistration) {
      result.classList.remove("hidden");
      result.textContent = "更新功能暂不可用，请检查API配置";
      result.style.color = "red";
      return;
    }
    
    CET_API.updateRegistration(registration.regNo, payload)
      .then(() => {
        result.classList.remove("hidden");
        result.textContent = "修改成功";
        result.style.color = "green";
        
        setTimeout(() => {
          document.body.removeChild(modal);
          renderRegistrations();
        }, 1000);
      })
      .catch(err => {
        result.classList.remove("hidden");
        result.textContent = "修改失败: " + (err.message || "请检查网络连接");
        result.style.color = "red";
      });
  });
  
  document.body.appendChild(modal);
}

// 加载统计数据
function loadStats(batchId, level) {
  const loading = $("#statsLoading");
  const error = $("#statsError");
  const statsContainer = $("#statsContainer");
  
  if (loading) loading.classList.remove("hidden");
  if (error) error.classList.add("hidden");
  
  CET_API.getExamStats(batchId, level).then(stats => {
    if (loading) loading.classList.add("hidden");
    
    const totalEl = $("#totalRegistrations");
    const cet4El = $("#cet4Registrations");
    const cet6El = $("#cet6Registrations");
    const newCampusEl = $("#newCampusCount");
    const oldCampusEl = $("#oldCampusCount");
    const roomsEl = $("#assignedRooms");
    
    if (totalEl) totalEl.textContent = stats.total || 0;
    if (cet4El) cet4El.textContent = stats.cet4 || 0;
    if (cet6El) cet6El.textContent = stats.cet6 || 0;
    if (newCampusEl) newCampusEl.textContent = stats.newCampus || 0;
    if (oldCampusEl) oldCampusEl.textContent = stats.oldCampus || 0;
    if (roomsEl) roomsEl.textContent = stats.rooms || 0;
    
    updateExamCharts(stats);
  }).catch(err => {
    if (loading) loading.classList.add("hidden");
    if (error) {
      error.classList.remove("hidden");
      error.textContent = "获取统计数据失败: " + (err.message || "请检查网络连接");
    }
  });
}

// 更新考试图表
function updateExamCharts(stats) {
  let chartContainer = $("#examCharts");
  if (!chartContainer) {
    chartContainer = document.createElement("div");
    chartContainer.id = "examCharts";
    chartContainer.style.marginTop = "20px";
    chartContainer.innerHTML = `
      <h3>考试数据图表</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 20px;">
        <div style="flex: 1; min-width: 300px;">
          <h4>级别分布</h4>
          <canvas id="levelChart" width="300" height="300"></canvas>
        </div>
        <div style="flex: 1; min-width: 300px;">
          <h4>考点分布</h4>
          <canvas id="campusChart" width="300" height="300"></canvas>
        </div>
      </div>
    `;
    
    const statsContainer = $("#statsContainer");
    if (statsContainer) {
      const statsCard = statsContainer.closest(".card");
      if (statsCard) {
        statsCard.appendChild(chartContainer);
      }
    }
  }
  
  // 绘制饼图
  drawPieCharts(stats);
}

// 绘制饼图
function drawPieCharts(stats) {
  // 级别分布
  const levelChart = $("#levelChart");
  if (levelChart) {
    const levelCtx = levelChart.getContext("2d");
    if (levelCtx) {
      const levelData = [];
      if (stats.cet4 > 0) levelData.push({ label: "四级", value: stats.cet4, color: "#3498db" });
      if (stats.cet6 > 0) levelData.push({ label: "六级", value: stats.cet6, color: "#2ecc71" });
      if (levelData.length === 0) levelData.push({ label: "无数据", value: 1, color: "#ecf0f1" });
      drawPieChart(levelCtx, levelData);
    }
  }
  
  // 考点分布
  const campusChart = $("#campusChart");
  if (campusChart) {
    const campusCtx = campusChart.getContext("2d");
    if (campusCtx) {
      const campusData = [];
      if (stats.newCampus > 0) campusData.push({ label: "新区", value: stats.newCampus, color: "#e74c3c" });
      if (stats.oldCampus > 0) campusData.push({ label: "老区", value: stats.oldCampus, color: "#f39c12" });
      if (campusData.length === 0) campusData.push({ label: "无数据", value: 1, color: "#ecf0f1" });
      drawPieChart(campusCtx, campusData);
    }
  }
}

// 绘制单个饼图
function drawPieChart(ctx, data) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = -0.5 * Math.PI;
  
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  
  data.forEach(item => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    
    ctx.beginPath();
    ctx.moveTo(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.arc(ctx.canvas.width / 2, ctx.canvas.height / 2, 100, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const labelAngle = currentAngle + sliceAngle / 2;
    const labelX = ctx.canvas.width / 2 + Math.cos(labelAngle) * 120;
    const labelY = ctx.canvas.height / 2 + Math.sin(labelAngle) * 120;
    
    ctx.fillStyle = "#333";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${item.label}: ${item.value}`, labelX, labelY);
    
    currentAngle += sliceAngle;
  });
}

// 初始化成绩导入功能
function initScoreImport() {
  const scoreImportForm = $("#scoreImportForm");
  if (!scoreImportForm) return;
  
  scoreImportForm.addEventListener("submit", function(e) {
    e.preventDefault();
    const fileInput = scoreImportForm.querySelector('input[name="scoreFile"]');
    const file = fileInput.files[0];
    if (!file) {
      showImportResult("请选择文件", "error");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const csvContent = e.target.result;
        const rows = csvContent.split('\n').filter(row => row.trim() !== '');
        
        if (rows.length <= 1) {
          showImportResult("CSV文件没有数据", "error");
          return;
        }
        
        const scores = [];
        const errors = [];
        
        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].split(',').map(col => col.trim());
          if (cols.length !== 5) {
            errors.push(`第${i+1}行: 数据格式错误，需要5个字段`);
            continue;
          }
          
          const [ticket, total, listening, reading, writing] = cols;
          
          // 验证数字
          if (isNaN(total) || isNaN(listening) || isNaN(reading) || isNaN(writing)) {
            errors.push(`第${i+1}行: 成绩必须是数字`);
            continue;
          }
          
          scores.push({
            ticket,
            total: Number(total),
            listening: Number(listening),
            reading: Number(reading),
            writing: Number(writing)
          });
        }
        
        if (errors.length > 0) {
          showImportResult(`发现${errors.length}个错误: ${errors.join('; ')}`, "error");
          return;
        }
        
        if (scores.length === 0) {
          showImportResult("没有有效的数据可以导入", "error");
          return;
        }
        
        // 调用批量导入API
        importScoresBatch(scores);
        
      } catch (error) {
        showImportResult("文件解析错误: " + error.message, "error");
      }
    };
    
    reader.readAsText(file, 'utf-8');
  });
}

// 批量导入成绩
function importScoresBatch(scores) {
  const resultDiv = $("#scoreImportResult");
  resultDiv.classList.remove("hidden");
  resultDiv.textContent = "正在导入...";
  resultDiv.style.color = "#666";
  
  // 分批导入，每次10条
  const batchSize = 10;
  let successCount = 0;
  let errorCount = 0;
  const errorMessages = [];
  
  function processBatch(startIndex) {
    const batch = scores.slice(startIndex, startIndex + batchSize);
    if (batch.length === 0) {
      // 所有批次处理完成
      const message = `导入完成: ${successCount}条成功, ${errorCount}条失败`;
      resultDiv.textContent = message;
      resultDiv.style.color = errorCount === 0 ? "green" : "orange";
      
      if (errorMessages.length > 0) {
        resultDiv.innerHTML += `<br><small>失败详情: ${errorMessages.join('; ')}</small>`;
      }
      return;
    }
    
    // 调用API导入批次数据
    fetch('/api/admin/import-scores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.CET_API_TOKEN}`
      },
      body: JSON.stringify({ scores: batch })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      successCount += data.success || 0;
      errorCount += data.failed || 0;
      
      if (data.errors && data.errors.length > 0) {
        data.errors.forEach(err => {
          errorMessages.push(`第${err.index}行: ${err.error}`);
        });
      }
      
      // 更新进度显示
      const progress = Math.round(((startIndex + batchSize) / scores.length) * 100);
      resultDiv.textContent = `导入中... ${progress}% (${successCount}成功, ${errorCount}失败)`;
      
      // 处理下一批次
      setTimeout(() => processBatch(startIndex + batchSize), 500);
    })
    .catch(err => {
      errorCount += batch.length;
      errorMessages.push(`批次${startIndex/batchSize + 1}: ${err.message}`);
      
      // 继续处理下一批次
      setTimeout(() => processBatch(startIndex + batchSize), 500);
    });
  }
  
  // 开始处理
  processBatch(0);
}

function showImportResult(message, type = "success") {
  const result = $("#scoreImportResult");
  if (result) {
    result.classList.remove("hidden");
    result.textContent = message;
    result.style.color = type === "success" ? "green" : 
                        type === "error" ? "red" : "orange";
  }
}

// 处理成绩提交
function handleScoreSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  payload.total = Number(payload.total);
  payload.listening = Number(payload.listening);
  payload.reading = Number(payload.reading);
  payload.writing = Number(payload.writing);
  
  if (payload.oral) {
    payload.oral = Number(payload.oral);
  } else {
    delete payload.oral;
  }
  
  CET_API.submitScore(payload).then(() => {
    const res = $("#scoreResult");
    if (res) {
      res.classList.remove("hidden");
      res.textContent = "成绩已保存";
      res.style.color = "green";
    }
    e.target.reset();
  }).catch(err => {
    const res = $("#scoreResult");
    if (!res) return;
    
    res.classList.remove("hidden");
    res.style.color = "red";
    
    if (err && typeof err.json === "function") {
      err.json().then(data => {
        let msg = data.error || "未知错误";
        if (msg.includes("registration not found")) msg = "该准考证号或身份证号不存在，请检查";
        if (msg.includes("Missing field")) msg = "请填写所有必填项";
        if (msg.includes("总分错误")) msg = "总分错误，请确保总分为听力、阅读和写作分数之和";
        if (msg.includes("总分不能超过")) msg = "总分不能超过710分";
        res.textContent = "保存失败: " + msg;
      }).catch(() => {
        res.textContent = "保存失败: 网络或服务器错误";
      });
    } else {
      res.textContent = "保存失败: " + (err.message || "未知错误");
    }
  });
}

// 初始化考场安排功能
function initExamRoom() {
  const examRoomForm = $("#examRoomForm");
  const autoArrangeForm = $("#autoArrangeForm");
  
  // 加载批次选项
  loadBatchesForExamRoom();
  
  // 加载教室选项
  loadClassrooms();
  
  // 初始化自动安排表单
  if (autoArrangeForm) {
    initAutoArrangeForm(autoArrangeForm);
  }
  
  // 处理手动考场安排表单提交
  if (examRoomForm) {
    examRoomForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const payload = Object.fromEntries(formData);
      
      fetch('/api/admin/exam-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.CET_API_TOKEN}`
        },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        const result = $("#examRoomResult");
        if (result) {
          result.classList.remove("hidden");
          if (data.success) {
            result.textContent = "考场安排创建成功";
            result.style.color = "green";
            examRoomForm.reset();
            loadExamRooms();
          } else {
            result.textContent = "创建失败: " + (data.error || "未知错误");
            result.style.color = "red";
          }
        }
      })
      .catch(err => {
        const result = $("#examRoomResult");
        if (result) {
          result.classList.remove("hidden");
          result.textContent = "保存失败: " + (err.message || "未知错误");
          result.style.color = "red";
        }
      });
    });
  }
  
  // 加载考场列表
  loadExamRooms();
  
  // 初始化准考证编排
  initGenerateTickets();
}

// 加载批次选项
function loadBatchesForExamRoom() {
  CET_API.fetchBatches().then(batches => {
    // 更新所有批次选择框
    $$("select[name='batchId']").forEach(select => {
      const currentValue = select.value;
      select.innerHTML = "";
      batches.forEach(batch => {
        const option = document.createElement("option");
        option.value = batch.id;
        option.textContent = batch.name;
        if (batch.id === currentValue) option.selected = true;
        select.appendChild(option);
      });
    });
  }).catch(err => {
    console.error('Failed to load batches:', err);
  });
}

// 加载教室选项
function loadClassrooms() {
  fetch('/api/admin/classrooms', {
    headers: {
      'Authorization': `Bearer ${window.CET_API_TOKEN}`
    }
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(data => {
    const classroomSelect = $("#examRoomForm select[name='classroomId']");
    if (classroomSelect && data.classrooms) {
      classroomSelect.innerHTML = "";
      data.classrooms.forEach(classroom => {
        const option = document.createElement("option");
        option.value = classroom.id;
        option.textContent = `${classroom.building} ${classroom.name} (${classroom.capacity}人)`;
        classroomSelect.appendChild(option);
      });
    }
  })
  .catch(err => {
    console.error('Failed to load classrooms:', err);
  });
}

// 初始化自动安排表单
function initAutoArrangeForm(form) {
  // 加载批次选项
  CET_API.fetchBatches().then(batches => {
    const batchSelect = form.querySelector("select[name='batchId']");
    if (batchSelect) {
      batchSelect.innerHTML = "";
      batches.forEach(batch => {
        const option = document.createElement("option");
        option.value = batch.id;
        option.textContent = batch.name;
        batchSelect.appendChild(option);
      });
    }
  }).catch(err => {
    console.error('Failed to load batches for auto arrange:', err);
  });
  
  // 处理表单提交
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);
    
    const result = $("#autoArrangeResult");
    result.classList.remove("hidden");
    result.textContent = "正在自动安排考场...";
    result.style.color = "#666";
    
    // 调用自动安排API
    autoArrangeExamRooms(payload);
  });
}

// 自动安排考场
function autoArrangeExamRooms(params) {
  const result = $("#autoArrangeResult");
  
  // 1. 获取该批次的报名学生
  CET_API.listRegistrations({
    batchId: params.batchId,
    level: params.level
  }).then(registrations => {
    if (registrations.length === 0) {
      result.textContent = "该批次没有报名学生";
      result.style.color = "orange";
      return;
    }
    
    // 2. 获取可用教室
    return fetch('/api/admin/classrooms?isActive=1', {
      headers: {
        'Authorization': `Bearer ${window.CET_API_TOKEN}`
      }
    })
    .then(res => res.json())
    .then(data => {
      const classrooms = data.classrooms || [];
      
      // 3. 根据优先级筛选教室
      let filteredClassrooms = classrooms;
      if (params.campus === "new") {
        filteredClassrooms = classrooms.filter(c => c.building.includes("东"));
      } else if (params.campus === "old") {
        filteredClassrooms = classrooms.filter(c => c.building.includes("西"));
      }
      
      if (filteredClassrooms.length === 0) {
        result.textContent = "没有找到符合条件的教室";
        result.style.color = "red";
        return;
      }
      
      // 4. 安排考场逻辑
      const assignments = arrangeClassrooms(registrations, filteredClassrooms);
      
      // 5. 创建考场安排
      return createExamRoomAssignments(params, assignments);
    });
  })
  .then(data => {
    if (data && data.success) {
      result.textContent = `自动安排完成: ${data.message}`;
      result.style.color = "green";
      loadExamRooms(); // 刷新考场列表
    }
  })
  .catch(err => {
    console.error('Auto arrange error:', err);
    result.textContent = "自动安排失败: " + (err.message || "未知错误");
    result.style.color = "red";
  });
}

// 安排教室算法
function arrangeClassrooms(registrations, classrooms) {
  const assignments = [];
  let remainingStudents = [...registrations];
  
  // 按教室容量排序（大教室优先）
  classrooms.sort((a, b) => b.capacity - a.capacity);
  
  // 按楼栋和楼层排序
  classrooms.sort((a, b) => {
    // 先按校区：新区（东）在前，老区（西）在后
    const campusOrder = { '东': 1, '西': 2 };
    const aCampus = a.building.includes('东') ? '东' : '西';
    const bCampus = b.building.includes('东') ? '东' : '西';
    
    if (aCampus !== bCampus) {
      return campusOrder[aCampus] - campusOrder[bCampus];
    }
    
    // 再按楼栋号
    const aBuildingNum = parseInt(a.building.match(/\d+/)?.[0] || 0);
    const bBuildingNum = parseInt(b.building.match(/\d+/)?.[0] || 0);
    if (aBuildingNum !== bBuildingNum) {
      return aBuildingNum - bBuildingNum;
    }
    
    // 最后按楼层
    return a.floor - b.floor;
  });
  
  for (const classroom of classrooms) {
    if (remainingStudents.length === 0) break;
    
    // 计算该教室能安排多少学生
    const capacity = Math.min(classroom.capacity, 30); // 每考场最多30人
    const studentsForThisRoom = remainingStudents.splice(0, capacity);
    
    if (studentsForThisRoom.length > 0) {
      assignments.push({
        classroom: classroom,
        students: studentsForThisRoom
      });
    }
  }
  
  return assignments;
}

// 创建考场安排
function createExamRoomAssignments(params, assignments) {
  const promises = [];
  const examDate = new Date().toISOString().split('T')[0]; // 使用今天作为考试日期
  
  assignments.forEach((assignment, index) => {
    const payload = {
      classroomId: assignment.classroom.id,
      batchId: params.batchId,
      level: params.level,
      examDate: examDate,
      startTime: params.level === "CET-4" ? "09:00" : "15:00",
      endTime: params.level === "CET-4" ? "11:20" : "17:25",
      supervisor1: `监考${(index * 2) + 1}`,
      supervisor2: `监考${(index * 2) + 2}`
    };
    
    promises.push(
      fetch('/api/admin/exam-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.CET_API_TOKEN}`
        },
        body: JSON.stringify(payload)
      }).then(res => res.json())
    );
  });
  
  return Promise.all(promises).then(results => {
    const success = results.filter(r => r.success).length;
    return {
      success: true,
      message: `成功创建${success}个考场，安排了${assignments.reduce((sum, a) => sum + a.students.length, 0)}名学生`
    };
  });
}

// 加载考场列表
function loadExamRooms() {
  const batchSelect = $("#filterExamBatch");
  const levelSelect = $("#filterExamLevel");
  const examRoomsTable = $("#examRoomsTable");

  if (!batchSelect || !levelSelect || !examRoomsTable) return;

  // 加载批次选项
  CET_API.fetchBatches().then(batches => {
    batchSelect.innerHTML = "<option value=''>全部批次</option>";
    batches.forEach(batch => {
      const option = document.createElement("option");
      option.value = batch.id;
      option.textContent = batch.name;
      batchSelect.appendChild(option);
    });
  }).catch(err => {
    console.error('Failed to load batches for filter:', err);
  });

  // 刷新按钮
  const btnRefresh = $("#btnRefreshExamRooms");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => fetchExamRooms());
  }

  // 筛选器变化事件
  batchSelect.addEventListener("change", fetchExamRooms);
  levelSelect.addEventListener("change", fetchExamRooms);

  // 初始加载
  fetchExamRooms();

  function fetchExamRooms() {
    const batchId = batchSelect.value;
    const level = levelSelect.value;

    let url = '/api/admin/exam-rooms';
    const params = [];
    if (batchId) params.push(`batchId=${batchId}`);
    if (level) params.push(`level=${level}`);
    if (params.length) url += `?${params.join('&')}`;

    fetch(url, {
      headers: {
        'Authorization': `Bearer ${window.CET_API_TOKEN}`
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.examRooms) {
        renderExamRoomsTable(data.examRooms);
      }
    })
    .catch(err => {
      console.error('Failed to load exam rooms:', err);
      examRoomsTable.innerHTML = '<p class="error">加载考场列表失败，请检查网络连接</p>';
    });
  }

  function renderExamRoomsTable(examRooms) {
    if (!examRooms || examRooms.length === 0) {
      examRoomsTable.innerHTML = '<p>没有找到考场安排</p>';
      return;
    }

    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";

    // 表头
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const headers = ["批次", "级别", "教室", "考试日期", "开始时间", "结束时间", "监考教师1", "监考教师2", "操作"];
    headers.forEach(header => {
      const th = document.createElement("th");
      th.textContent = header;
      th.style.borderBottom = "1px solid #e5eaf0";
      th.style.padding = "8px";
      th.style.textAlign = "left";
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 表体
    const tbody = document.createElement("tbody");
    examRooms.forEach(examRoom => {
      const row = document.createElement("tr");
      
      const cells = [
        examRoom.batchId,
        examRoom.level,
        examRoom.classroomName,
        examRoom.examDate,
        examRoom.startTime,
        examRoom.endTime,
        examRoom.supervisor1 || '-',
        examRoom.supervisor2 || '-'
      ];
      
      cells.forEach(cellText => {
        const td = document.createElement("td");
        td.textContent = cellText;
        td.style.padding = "8px";
        td.style.borderBottom = "1px solid #e5eaf0";
        row.appendChild(td);
      });
      
      // 操作列
      const actionTd = document.createElement("td");
      actionTd.style.padding = "8px";
      actionTd.style.borderBottom = "1px solid #e5eaf0";
      
      const signinBtn = document.createElement("button");
      signinBtn.textContent = "生成签到表";
      signinBtn.className = "btn-small";
      signinBtn.style.marginRight = "4px";
      signinBtn.addEventListener("click", () => generateSigninSheet(examRoom.id));
      actionTd.appendChild(signinBtn);
      
      row.appendChild(actionTd);
      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    examRoomsTable.innerHTML = "";
    examRoomsTable.appendChild(table);
  }
}

// 生成签到表
function generateSigninSheet(examRoomId) {
  fetch(`/api/admin/exam-room/signin-sheet?examRoomId=${examRoomId}`, {
    headers: {
      'Authorization': `Bearer ${window.CET_API_TOKEN}`
    }
  })
  .then(res => res.json())
  .then(data => {
    if (data.examRoom && data.students) {
      renderSigninSheet(data.examRoom, data.students);
    }
  })
  .catch(err => {
    console.error('Failed to generate sign-in sheet:', err);
    alert('生成签到表失败，请稍后重试');
  });
}

// 渲染签到表
function renderSigninSheet(examRoom, students) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "flex-start";
  modal.style.overflowY = "auto";
  modal.style.zIndex = "1000";
  
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";
  modalContent.style.backgroundColor = "white";
  modalContent.style.padding = "20px";
  modalContent.style.borderRadius = "8px";
  modalContent.style.width = "90%";
  modalContent.style.maxWidth = "1000px";
  modalContent.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)";
  modalContent.style.margin = "20px 0";
  
  const title = document.createElement("h3");
  title.textContent = `考场签到表 - ${examRoom.building}${examRoom.classroomName}`;
  title.style.marginBottom = "20px";
  modalContent.appendChild(title);
  
  // 考场信息
  const infoDiv = document.createElement("div");
  infoDiv.style.marginBottom = "20px";
  infoDiv.innerHTML = `
    <p><strong>考试批次:</strong> ${examRoom.batchId}</p>
    <p><strong>考试级别:</strong> ${examRoom.level}</p>
    <p><strong>考试日期:</strong> ${examRoom.examDate}</p>
    <p><strong>考试时间:</strong> ${examRoom.startTime} - ${examRoom.endTime}</p>
    <p><strong>监考教师:</strong> ${examRoom.supervisor1} ${examRoom.supervisor2 ? `, ${examRoom.supervisor2}` : ''}</p>
  `;
  modalContent.appendChild(infoDiv);
  
  // 签到表格
  const signinTable = document.createElement("table");
  signinTable.style.width = "100%";
  signinTable.style.borderCollapse = "collapse";
  signinTable.style.marginBottom = "20px";
  
  // 表头
  const signinThead = document.createElement("thead");
  const signinHeaderRow = document.createElement("tr");
  const signinHeaders = ["序号", "座位号", "姓名", "准考证号", "身份证号", "照片", "签名"];
  signinHeaders.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header;
    th.style.border = "1px solid #e5eaf0";
    th.style.padding = "8px";
    th.style.textAlign = "center";
    th.style.fontWeight = "bold";
    signinHeaderRow.appendChild(th);
  });
  signinThead.appendChild(signinHeaderRow);
  signinTable.appendChild(signinThead);
  
  // 表体
  const signinTbody = document.createElement("tbody");
  students.forEach((student, index) => {
    const row = document.createElement("tr");
    
    const cells = [
      index + 1,
      student.seatNumber,
      student.name,
      student.ticket,
      student.idCard
    ];
    
    cells.forEach(cellText => {
      const td = document.createElement("td");
      td.textContent = cellText;
      td.style.border = "1px solid #e5eaf0";
      td.style.padding = "8px";
      if (cellText === student.idCard) {
        td.style.maxWidth = "150px";
        td.style.overflow = "hidden";
        td.style.textOverflow = "ellipsis";
      }
      row.appendChild(td);
    });
    
    // 照片列
    const photoTd = document.createElement("td");
    photoTd.style.border = "1px solid #e5eaf0";
    photoTd.style.padding = "8px";
    photoTd.style.textAlign = "center";
    photoTd.style.width = "80px";
    
    if (student.photo) {
      const photoImg = document.createElement("img");
      photoImg.src = student.photo;
      photoImg.style.maxWidth = "60px";
      photoImg.style.maxHeight = "80px";
      photoTd.appendChild(photoImg);
    } else {
      photoTd.textContent = "无照片";
      photoTd.style.color = "#999";
    }
    row.appendChild(photoTd);
    
    // 签名列
    const signatureTd = document.createElement("td");
    signatureTd.style.border = "1px solid #e5eaf0";
    signatureTd.style.padding = "8px";
    signatureTd.style.height = "60px";
    signatureTd.innerHTML = '<div style="width: 100%; height: 100%; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999;">签名</div>';
    row.appendChild(signatureTd);
    
    signinTbody.appendChild(row);
  });
  signinTable.appendChild(siginTbody);
  modalContent.appendChild(signinTable);
  
  // 按钮
  const btnContainer = document.createElement("div");
  btnContainer.style.display = "flex";
  btnContainer.style.justifyContent = "flex-end";
  
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "关闭";
  closeBtn.className = "btn-secondary";
  closeBtn.style.marginRight = "10px";
  closeBtn.addEventListener("click", () => document.body.removeChild(modal));
  btnContainer.appendChild(closeBtn);
  
  const printBtn = document.createElement("button");
  printBtn.textContent = "打印";
  printBtn.className = "btn-primary";
  printBtn.addEventListener("click", () => window.print());
  btnContainer.appendChild(printBtn);
  
  modalContent.appendChild(btnContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// 初始化准考证编排
function initGenerateTickets() {
  const generateTicketsForm = $("#generateTicketsForm");
  if (!generateTicketsForm) return;

  // 加载批次选项
  const batchSelect = generateTicketsForm.querySelector("select[name='batchId']");
  if (batchSelect) {
    CET_API.fetchBatches().then(batches => {
      batchSelect.innerHTML = "";
      batches.forEach(batch => {
        const option = document.createElement("option");
        option.value = batch.id;
        option.textContent = batch.name;
        batchSelect.appendChild(option);
      });
    }).catch(err => {
      console.error('Failed to load batches:', err);
    });
  }

  generateTicketsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);

    fetch('/api/admin/generate-tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${window.CET_API_TOKEN}`
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      const result = $("#generateTicketsResult");
      if (result) {
        result.classList.remove("hidden");
        if (data.success) {
          result.textContent = `${data.message}`;
          result.style.color = "green";
        } else {
          result.textContent = "生成失败: " + (data.error || "未知错误");
          result.style.color = "red";
        }
      }
    })
    .catch(err => {
      const result = $("#generateTicketsResult");
      if (result) {
        result.classList.remove("hidden");
        result.textContent = "保存失败: " + (err.message || "未知错误");
        result.style.color = "red";
      }
    });
  });
}

// 启动函数
function boot() {
  try {
    var t = localStorage.getItem("CET_API_TOKEN");
    if (t) window.CET_API_TOKEN = t;
  } catch {}

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "") || "registrations";
    setRoute(hash);
  });
  
  const hash = location.hash.replace("#", "") || "registrations";
  setRoute(hash);
  
  // 登录表单
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

  // 成绩提交表单
  const scoreForm = $("#scoreForm");
  if (scoreForm) scoreForm.addEventListener("submit", handleScoreSubmit);

  // 退出登录
  const navLogout = $("#navLogout");
  if (navLogout) navLogout.addEventListener("click", e => {
    e.preventDefault();
    CET_API.logout().finally(() => {
      window.CET_API_TOKEN = null;
      try { localStorage.removeItem("CET_API_TOKEN") } catch {}
      $("#navLogin").style.display = "inline";
      $("#navLogout").style.display = "none";
      refreshStatus();
      location.href = "../index.html#login";
    });
  });

  refreshStatus();
}

// 刷新状态
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

document.addEventListener("DOMContentLoaded", boot);