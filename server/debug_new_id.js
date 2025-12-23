const Database = require('better-sqlite3');
const db = new Database('cet.db', { verbose: console.log });

const idCard = '650203200504090722';

console.log(`\n=== Debugging ID: ${idCard} ===`);

// 1. Check Student
const student = db.prepare('SELECT * FROM students WHERE idCard = ?').get(idCard);
console.log('\nStudent:', student);

// 2. Check Registrations
const regs = db.prepare('SELECT * FROM registrations WHERE idCard = ?').all(idCard);
console.log('\nRegistrations:', regs);

if (regs.length > 0) {
  regs.forEach(r => {
    console.log(`\nChecking Score for Ticket: ${r.ticket}`);
    const score = db.prepare('SELECT * FROM scores WHERE ticket = ?').get(r.ticket);
    console.log('Score:', score);
  });
} else {
  console.log('No registrations found.');
}

// 3. Check for ANY score that might be related (orphan?)
// (This is harder to do without ticket, but we can check if there are scores with no matching registration)
