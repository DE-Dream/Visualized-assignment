;(function(){
  if(!window.CET_API_BASE){
    var m = location.search.match(/[?&]api=([^&]+)/)
    window.CET_API_BASE = m ? decodeURIComponent(m[1]) : 'http://127.0.0.1:3001/api'
  }
})()
