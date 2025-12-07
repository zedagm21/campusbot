// Run database migration to add OAuth columns
import db from './src/db.js';

async function migrate() {
    try {
        console.log('Adding OAuth columns to users table...');

        // Add new columns
        await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
      ADD COLUMN IF NOT EXISTS google_id TEXT;
    `);

        console.log('✅ Columns added successfully!');

        // Update existing users to be verified
        await db.query(`
      UPDATE users 
      SET is_verified = true 
      WHERE auth_provider = 'email' OR auth_provider IS NULL;
    `);

        console.log('✅ Existing users updated!');

        // Verify the changes
        const result = await db.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);

        console.log('\n📋 Users table structure:');
        result.rows.forEach(row => {
            console.log(`  - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'none'})`);
        });

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
