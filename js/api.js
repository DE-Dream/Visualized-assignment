;(function () {
  function qs(k) {
    var m = location.search.match(new RegExp("[?&]"+k+"=([^&]+)"))
    return m ? decodeURIComponent(m[1]) : null
  }
  var base = window.CET_API_BASE || qs("api") || "/api"
  function url(p) { return base.replace(/\/+$/,"") + p }
  function j(r) { return r.ok ? r.json() : Promise.reject(r) }
  function hdr(extra, useStudent) {
    var h = {}
    var t = useStudent ? window.CET_STUDENT_TOKEN : window.CET_API_TOKEN || window.CET_STUDENT_TOKEN
    if (t) h['Authorization'] = 'Bearer ' + t
    if (extra) for (var k in extra) h[k]=extra[k]
    return h
  }
  function get(p) { return fetch(url(p), { headers: hdr(null, p.indexOf('/student')===0) }).then(j) }
  function post(p, data) {
    var headers = { "Content-Type": "application/json" }
    var useAuth = !(p === "/login" || p === "/logout" || p === "/student/login" || p === "/student/logout" || p === "/student/register")
    return fetch(url(p), {
      method: "POST",
      headers: useAuth ? hdr(headers, p.indexOf('/student')===0) : headers,
      body: JSON.stringify(data)
    }).then(j)
  }
  var api = {
    fetchNotices: function () {
      return get("/notices").catch(function(){
        var CD = window.CET_DATA || {}
        return Promise.resolve(CD.notices || [])
      })
    },
    fetchBatches: function () {
      return get("/batches").catch(function(){
        var CD = window.CET_DATA || {}
        return Promise.resolve(CD.batches || [])
      })
    },
    fetchCenters: function () {
      return get("/centers").catch(function(){
        var CD = window.CET_DATA || {}
        return Promise.resolve(CD.centers || [])
      })
    },
    listRegistrations: function (params) {
      var q = ''
      if (params && (params.batchId || params.level)) {
        var qs = []
        if (params.batchId) qs.push('batchId='+encodeURIComponent(params.batchId))
        if (params.level) qs.push('level='+encodeURIComponent(params.level))
        q = '?' + qs.join('&')
      }
      return get("/registrations"+q).catch(function(){ return Promise.resolve([]) })
    },
    submitRegistration: function (payload) {
      return post("/register", payload).catch(function(){
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
      return get("/admit?query="+encodeURIComponent(q)).catch(function(){ return Promise.resolve(null) })
    },
    getScoreByTicket: function (t) {
      return get("/score?ticket="+encodeURIComponent(t)).catch(function(){ return Promise.resolve(null) })
    },
    submitScore: function (payload) {
      return post("/score", payload)
    },
    login: function (username, password) {
      return post("/login", { username: username, password: password })
    },
    logout: function () {
      return post("/logout", {})
    },
    me: function () {
      return get("/me")
    },
    studentLogin: function (idCard, password) {
      return post("/student/login", { idCard: idCard, password: password })
    },
    studentLogout: function () {
      return post("/student/logout", {})
    },
    studentMe: function () {
      return get("/student/me")
    },
    register: function (username, password, email, phone) {
      return post("/student/register", { username: username, password: password, email: email, phone: phone })
    }
  }
  window.CET_API = api
})()
