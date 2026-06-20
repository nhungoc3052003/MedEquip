import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medequip_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    console.log('Connecting to database...');
    const conn = await pool.getConnection();
    
    console.log('Creating chi_tiet_yeu_cau table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS chi_tiet_yeu_cau (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ma_phieu_yeu_cau VARCHAR(30) NOT NULL,
          ma_thiet_bi VARCHAR(20) NOT NULL,
          so_luong INT NOT NULL DEFAULT 1,
          trang_thai ENUM('CHO_DUYET','DA_DUYET','TU_CHOI', 'DA_CAP_PHAT') DEFAULT 'CHO_DUYET',
          ly_do_tu_choi TEXT NULL,
          FOREIGN KEY (ma_phieu_yeu_cau) REFERENCES phieu_yeu_cau(ma_phieu),
          FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi)
      )
    `);

    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
