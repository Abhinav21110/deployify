async function testAPI() {
  try {
    console.log('Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3000/api/health');
    console.log('Health Status:', healthResponse.status);
    const healthData = await healthResponse.text();
    console.log('Health Response:', healthData);
    
    console.log('\nTesting deployments endpoint...');
    const deploymentsResponse = await fetch('http://localhost:3000/api/deploy?page=1&limit=20');
    console.log('Deployments Status:', deploymentsResponse.status);
    const deploymentsData = await deploymentsResponse.text();
    console.log('Deployments Response:', deploymentsData);
    
  } catch (error) {
    console.error('API test failed:', error.message);
  }
}

testAPI();