import { pool } from './config/db.js';

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log("Starting migration for transfers & needs bulletin...");

    // 1. Create table nhu_cau_thiet_bi
    await conn.query(`
      CREATE TABLE IF NOT EXISTS nhu_cau_thiet_bi (
        ma_nhu_cau VARCHAR(30) PRIMARY KEY,
        ma_khoa_yeu_cau VARCHAR(20) NOT NULL,
        ma_nguoi_dang VARCHAR(20) NOT NULL,
        ma_thiet_bi VARCHAR(20) DEFAULT NULL,
        ten_thiet_bi VARCHAR(255) NOT NULL,
        so_luong_can INT NOT NULL DEFAULT 1,
        so_luong_da_dap_ung INT NOT NULL DEFAULT 0,
        muc_do_uu_tien VARCHAR(20) DEFAULT 'BINH_THUONG',
        ly_do TEXT DEFAULT NULL,
        trang_thai VARCHAR(30) DEFAULT 'DANG_TIM_KIEM',
        ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
        KEY (ma_khoa_yeu_cau),
        KEY (ma_thiet_bi)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ Table nhu_cau_thiet_bi created / verified.");

    // 2. Add columns to phieu_yeu_cau if they don't exist
    const [cols] = await conn.query("SHOW COLUMNS FROM phieu_yeu_cau");
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('checklist_ky_thuat')) {
      await conn.query("ALTER TABLE phieu_yeu_cau ADD COLUMN checklist_ky_thuat LONGTEXT DEFAULT NULL;");
      console.log("✓ Added column checklist_ky_thuat to phieu_yeu_cau");
    }
    if (!colNames.includes('ma_nguoi_nhan_test')) {
      await conn.query("ALTER TABLE phieu_yeu_cau ADD COLUMN ma_nguoi_nhan_test VARCHAR(20) DEFAULT NULL;");
      console.log("✓ Added column ma_nguoi_nhan_test to phieu_yeu_cau");
    }
    if (!colNames.includes('ngay_tiep_nhan')) {
      await conn.query("ALTER TABLE phieu_yeu_cau ADD COLUMN ngay_tiep_nhan DATETIME DEFAULT NULL;");
      console.log("✓ Added column ngay_tiep_nhan to phieu_yeu_cau");
    }
    if (!colNames.includes('ma_nhu_cau')) {
      await conn.query("ALTER TABLE phieu_yeu_cau ADD COLUMN ma_nhu_cau VARCHAR(30) DEFAULT NULL;");
      console.log("✓ Added column ma_nhu_cau to phieu_yeu_cau");
    }

    console.log("All transfer migrations completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

migrate();
