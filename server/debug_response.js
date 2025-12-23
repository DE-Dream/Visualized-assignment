const http = require('http');

function makeRequest(path, method = 'GET', body = null) {
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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        console.log(`\n--- Request: ${method} ${path} ---`);
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log('Body:', JSON.stringify(json, null, 2));
          
          if (res.statusCode === 200) {
            if (json.total === undefined || json.total === null) {
              console.error('!!! REPRODUCED: Status 200 but total is missing !!!');
            } else {
              console.log('Check: total is present:', json.total);
            }
          }
        } catch (e) {
          console.log('Body (raw):', data);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`Problem with request: ${e.message}`);
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('Starting API Response Tests...');
  
  // 1. Query by ID Card (Should find score)
  await makeRequest('/score?idCard=650203200501010002');

  // 2. Query by Ticket (Old ticket with score)
  await makeRequest('/score?ticket=T0006949837');

  // 3. Query by Ticket (New ticket without score)
  await makeRequest('/score?ticket=T1121473951');

  // 4. Query by Both (Should prioritize ticket if provided?)
  // server.js: if (!ticket && idCard) -> checks ID. If ticket is provided, it uses ticket.
  // So this should use T1121473951 and return 404.
  await makeRequest('/score?ticket=T1121473951&idCard=650203200501010002');
  
  // 5. Query by Both (Empty ticket?)
  await makeRequest('/score?ticket=&idCard=650203200501010002');
}

runTests();
