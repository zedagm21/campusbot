import db from './src/db.js';

async function migrate() {
    try {
        console.log('Adding portal_cookies column...');
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_cookies TEXT;`);
        console.log('Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
