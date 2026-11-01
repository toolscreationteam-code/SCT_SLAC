import pool from './db.js';

async function updateSchema() {
  try {
    // 1. Add password to SCT_users if not exists
    const [cols] = await pool.query("SHOW COLUMNS FROM SCT_users LIKE 'password'");
    if (cols.length === 0) {
      console.log('Adding password column to SCT_users...');
      await pool.query("ALTER TABLE SCT_users ADD COLUMN password VARCHAR(255) NOT NULL DEFAULT 'sct@123' AFTER name");
      console.log('Password column added with default sct@123!');
    } else {
      console.log('Password column already exists.');
    }

    // 2. Add is_direct and post_permission to SCT_channels
    const [chanCols] = await pool.query("SHOW COLUMNS FROM SCT_channels LIKE 'post_permission'");
    if (chanCols.length === 0) {
      console.log('Adding post_permission and is_direct to SCT_channels...');
      await pool.query("ALTER TABLE SCT_channels ADD COLUMN is_direct TINYINT(1) NOT NULL DEFAULT 0 AFTER is_announcement");
      await pool.query("ALTER TABLE SCT_channels ADD COLUMN post_permission ENUM('all', 'admin_only', 'leaders_only') NOT NULL DEFAULT 'all' AFTER is_direct");
      // Set announcements to admin_only
      await pool.query("UPDATE SCT_channels SET post_permission = 'admin_only' WHERE is_announcement = 1");
      console.log('Channel columns added!');
    } else {
      console.log('Channel columns already exist.');
    }

    console.log('Schema update complete!');
    process.exit(0);
  } catch (err) {
    console.error('Schema update failed:', err);
    process.exit(1);
  }
}
updateSchema();
