const http = require('http');

function apiRequest(path, method, data, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
    
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function reproduce() {
  try {
    console.log('1. Login as student...');
    const loginRes = await apiRequest('/student/login', 'POST', JSON.stringify({
      idCard: '650203200501010002',
      password: 'Test123456'
    }));
    
    if (loginRes.status !== 200) {
      console.error('Login failed:', loginRes);
      return;
    }
    
    const token = loginRes.data.token;
    console.log('Login successful.');
    
    console.log('\n2. Query Score using Ticket (Simulate user using new ticket)...');
    // Assuming the user has the NEW ticket T1121473951
    const ticketQuery = 'T1121473951';
    const scoreByTicket = await apiRequest(`/score?ticket=${ticketQuery}`, 'GET', null, token);
    console.log(`Query ticket ${ticketQuery}: Status ${scoreByTicket.status}`);
    console.log('Response:', scoreByTicket.data);
    
    console.log('\n3. Query Score using ID Card (The fix)...');
    const idCardQuery = '650203200501010002';
    const scoreById = await apiRequest(`/score?idCard=${idCardQuery}`, 'GET', null, token);
    console.log(`Query idCard ${idCardQuery}: Status ${scoreById.status}`);
    console.log('Response:', scoreById.data);
    
  } catch (err) {
    console.error('Test failed:', err);
  }
}

reproduce();
