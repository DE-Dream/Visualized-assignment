;(function(){
  if(!window.CET_API_BASE){
    var m = location.search.match(/[?&]api=([^&]+)/)
    window.CET_API_BASE = m ? decodeURIComponent(m[1]) : '/api'
  }
})()
