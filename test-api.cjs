const http = require('http');

function testAPI() {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/deploy?page=1&limit=20',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('RESPONSE BODY:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`API test failed: ${e.message}`);
  });

  req.setTimeout(5000, () => {
    console.error('Request timeout');
    req.destroy();
  });

  req.end();
}

testAPI();