const { Client } = require('pg');

async function clearDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'deployify'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Clear all data
    await client.query('TRUNCATE TABLE deployments CASCADE');
    await client.query('TRUNCATE TABLE user_credentials CASCADE');
    
    console.log('Database wiped successfully!');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await client.end();
  }
}

clearDatabase();