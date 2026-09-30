import { pool } from "./db.js";

async function runMigration() {
  const conn = await pool.getConnection();
  try {
    console.log("Running maintenance migration...");

    // 1. Alter thiet_bi
    const [tbCols] = await conn.query("DESCRIBE thiet_bi");
    const tbFields = tbCols.map(c => c.Field);

    if (!tbFields.includes("chu_ky_bao_tri")) {
      await conn.query("ALTER TABLE thiet_bi ADD COLUMN chu_ky_bao_tri INT DEFAULT NULL");
      console.log("+ Added chu_ky_bao_tri to thiet_bi");
    }
    if (!tbFields.includes("ngay_bao_tri_gan_nhat")) {
      await conn.query("ALTER TABLE thiet_bi ADD COLUMN ngay_bao_tri_gan_nhat DATE DEFAULT NULL");
      console.log("+ Added ngay_bao_tri_gan_nhat to thiet_bi");
    }
    if (!tbFields.includes("ngay_bao_tri_tiep_theo")) {
      await conn.query("ALTER TABLE thiet_bi ADD COLUMN ngay_bao_tri_tiep_theo DATE DEFAULT NULL");
      console.log("+ Added ngay_bao_tri_tiep_theo to thiet_bi");
    }
    if (!tbFields.includes("trang_thai_bao_tri")) {
      await conn.query("ALTER TABLE thiet_bi ADD COLUMN trang_thai_bao_tri VARCHAR(30) DEFAULT 'BINH_THUONG'");
      console.log("+ Added trang_thai_bao_tri to thiet_bi");
    }

    // 2. Alter chi_tiet_nhap_kho
    const [ctCols] = await conn.query("DESCRIBE chi_tiet_nhap_kho");
    const ctFields = ctCols.map(c => c.Field);

    if (!ctFields.includes("chu_ky_bao_tri")) {
      await conn.query("ALTER TABLE chi_tiet_nhap_kho ADD COLUMN chu_ky_bao_tri INT DEFAULT NULL");
      console.log("+ Added chu_ky_bao_tri to chi_tiet_nhap_kho");
    }
    if (!ctFields.includes("ngay_bao_tri_dau_tien")) {
      await conn.query("ALTER TABLE chi_tiet_nhap_kho ADD COLUMN ngay_bao_tri_dau_tien DATE DEFAULT NULL");
      console.log("+ Added ngay_bao_tri_dau_tien to chi_tiet_nhap_kho");
    }

    // 3. Create table lich_su_bao_tri
    await conn.query(`
      CREATE TABLE IF NOT EXISTS lich_su_bao_tri (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma_phieu_bao_tri VARCHAR(50) NOT NULL UNIQUE,
        ma_thiet_bi VARCHAR(50) NOT NULL,
        ngay_bat_dau DATE NOT NULL,
        ngay_hoan_thanh DATE,
        nguoi_thuc_hien VARCHAR(100),
        loai_bao_tri VARCHAR(50) DEFAULT 'DINH_KY',
        noi_dung TEXT,
        ket_qua VARCHAR(30) DEFAULT 'DAT',
        chi_phi DECIMAL(15,2) DEFAULT 0,
        anh_minh_chung TEXT,
        ghi_chu TEXT,
        ngay_tao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ma_tb (ma_thiet_bi),
        INDEX idx_ngay_ht (ngay_hoan_thanh)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("+ Table lich_su_bao_tri created or verified.");

    // 4. Update existing TAI_SU_DUNG devices with default 6 months if NULL
    await conn.query(`
      UPDATE thiet_bi 
      SET chu_ky_bao_tri = 6, 
          ngay_bao_tri_tiep_theo = DATE_ADD(COALESCE(ngay_tao, NOW()), INTERVAL 6 MONTH)
      WHERE loai_thiet_bi = 'TAI_SU_DUNG' AND chu_ky_bao_tri IS NULL
    `);
    console.log("+ Initialized chu_ky_bao_tri for existing reusable equipment.");

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runMigration();
