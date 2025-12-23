const http = require('http');

function testStudentMe() {
  // 1. First login to get token
  const loginData = JSON.stringify({
    idCard: '650203200501010002',
    password: 'password123'
  });

  const loginReq = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/student/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const loginRes = JSON.parse(data);
      if (loginRes.token) {
        console.log('Login successful, token obtained.');
        
        // 2. Call /student/me with token
        const meReq = http.request({
          hostname: 'localhost',
          port: 3000,
          path: '/api/student/me',
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + loginRes.token
          }
        }, (res2) => {
          let data2 = '';
          res2.on('data', (chunk) => data2 += chunk);
          res2.on('end', () => {
            const meRes = JSON.parse(data2);
            console.log('/student/me response:', JSON.stringify(meRes, null, 2));
            if (meRes.registration && meRes.registration.ticket) {
              console.log('SUCCESS: Ticket found in /student/me response:', meRes.registration.ticket);
            } else {
              console.error('FAILURE: Ticket NOT found in /student/me response');
            }
          });
        });
        meReq.end();
        
      } else {
        console.error('Login failed:', loginRes);
      }
    });
  });

  loginReq.write(loginData);
  loginReq.end();
}

testStudentMe();
