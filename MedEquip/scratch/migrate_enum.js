import mysql from 'mysql2/promise';

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'medequip_db'
  });

  try {
    console.log('Migrating phieu_tra_thiet_bi.trang_thai...');
    await connection.query("ALTER TABLE phieu_tra_thiet_bi MODIFY COLUMN trang_thai ENUM('CHO_XAC_NHAN', 'DA_TRA', 'TU_CHOI', 'HUY') DEFAULT 'CHO_XAC_NHAN'");
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

migrate();
