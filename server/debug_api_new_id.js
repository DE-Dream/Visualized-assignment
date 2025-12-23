const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api' + path,
      method: 'GET',
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
        console.log(`\n--- Request: GET ${path} ---`);
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log('Body:', JSON.stringify(json, null, 2));
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

    req.end();
  });
}

async function runTests() {
  // Query by ID Card
  await makeRequest('/score?idCard=650203200504090722');
  
  // Query by Ticket
  await makeRequest('/score?ticket=T1514500962');
}

runTests();
