import db from './src/db.js';

async function migrate() {
    try {
        console.log('Adding portal_username and portal_password_encrypted columns...');
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_username TEXT;`);
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_password_encrypted TEXT;`);
        console.log('Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
