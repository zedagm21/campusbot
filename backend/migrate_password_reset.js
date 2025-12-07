import db from './src/db.js';

async function migrate() {
    try {
        console.log('Adding reset_password_token column...');
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token TEXT;`);

        console.log('Adding reset_password_expires column...');
        await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP;`);

        console.log('Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
