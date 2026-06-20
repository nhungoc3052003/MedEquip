import { pool } from '../config/db.js';

async function fix() {
  try {
    console.log('Adding DA_HUY to phieu_yeu_cau.trang_thai...');
    await pool.query("ALTER TABLE phieu_yeu_cau MODIFY COLUMN trang_thai ENUM('CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'DA_CAP_PHAT', 'DA_HUY') DEFAULT 'CHO_DUYET'");
    
    console.log('Adding DA_HUY to chi_tiet_yeu_cau.trang_thai...');
    await pool.query("ALTER TABLE chi_tiet_yeu_cau MODIFY COLUMN trang_thai ENUM('CHO_DUYET', 'DA_DUYET', 'TU_CHOI', 'DA_CAP_PHAT', 'DA_HUY') DEFAULT 'CHO_DUYET'");
    
    console.log('Fixing existing empty statuses...');
    await pool.query("UPDATE phieu_yeu_cau SET trang_thai = 'DA_HUY' WHERE trang_thai = ''");
    await pool.query("UPDATE chi_tiet_yeu_cau SET trang_thai = 'DA_HUY' WHERE trang_thai = ''");
    
    console.log('✅ Success! Database schema updated.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error fixing DB:', err);
    process.exit(1);
  }
}

fix();
