// scripts/seedAdmin.js
// Interactive CLI script to safely create (or upgrade) an admin account.
// Run with: npm run seed:admin
//
// This avoids ever committing a hard-coded password hash to source
// control - the password is hashed at runtime, on your own machine,
// using the same bcrypt dependency the app uses.

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!hidden) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }
    // Basic masked input for the password prompt.
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(input.trim());
      } else if (char === '\u0003') {
        process.exit(1);
      } else if (char === '\u007f') {
        input = input.slice(0, -1);
      } else {
        input += char;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  console.log('=== Coin Wallet System: Admin Seeder ===\n');

  const username = (await ask('Admin username [admin]: ')) || 'admin';
  const email = (await ask('Admin email [admin@example.com]: ')) || 'admin@example.com';
  const password = await ask('Admin password (min 8 chars): ', { hidden: true });

  if (!password || password.length < 8) {
    console.error('\nPassword must be at least 8 characters. Aborting.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);

  if (existing.length > 0) {
    await pool.execute(
      'UPDATE users SET username = ?, password = ?, role = ? WHERE email = ?',
      [username, passwordHash, 'admin', email]
    );
    console.log(`\nExisting user updated to admin: ${email}`);
  } else {
    await pool.execute(
      `INSERT INTO users (username, email, password, coins, role)
       VALUES (?, ?, ?, 0, 'admin')`,
      [username, email, passwordHash]
    );
    console.log(`\nAdmin account created: ${email}`);
  }

  console.log('You can now log in with these credentials at /login.html.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed admin account:', err);
  process.exit(1);
});
