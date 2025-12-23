const Database = require('better-sqlite3');
const db = new Database('cet.db', { verbose: console.log });

console.log('Checking scores for tickets...');

const tickets = ['T0006949837', 'T1121473951'];

tickets.forEach(t => {
  console.log(`\nChecking Ticket: ${t}`);
  const reg = db.prepare('SELECT * FROM registrations WHERE ticket = ?').get(t);
  console.log('Registration:', reg);
  
  const score = db.prepare('SELECT * FROM scores WHERE ticket = ?').get(t);
  console.log('Score:', score);
});

// Check if any score has null values
console.log('\nChecking for any scores with null total:');
const nullScores = db.prepare('SELECT * FROM scores WHERE total IS NULL').all();
console.log(nullScores);
