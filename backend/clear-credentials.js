const { DataSource } = require('typeorm');

async function clearCredentials() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'deployify',
    entities: [],
  });

  try {
    await dataSource.initialize();
    console.log('Connected to database');
    
    const result = await dataSource.query('DELETE FROM user_credentials');
    console.log(`Deleted ${result[1]} credentials`);
    
    console.log('Credentials cleared successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await dataSource.destroy();
    process.exit(0);
  }
}

clearCredentials();