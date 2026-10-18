import { pool } from "./config/db.js";

async function migrate() {
  console.log("🚀 Bắt đầu cập nhật cấu trúc database cho hồ sơ nhân sự & yêu cầu cấp tài khoản...");
  try {
    // 1. Kiểm tra và thêm các cột vào nguoi_dung
    const [cols] = await pool.query("DESCRIBE nguoi_dung");
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes("cccd")) {
      await pool.query("ALTER TABLE nguoi_dung ADD COLUMN cccd VARCHAR(20) NULL AFTER so_dien_thoai");
      console.log("✅ Đã thêm cột cccd vào nguoi_dung");
    }
    if (!colNames.includes("ngay_sinh")) {
      await pool.query("ALTER TABLE nguoi_dung ADD COLUMN ngay_sinh DATE NULL AFTER cccd");
      console.log("✅ Đã thêm cột ngay_sinh vào nguoi_dung");
    }
    if (!colNames.includes("chuc_danh")) {
      await pool.query("ALTER TABLE nguoi_dung ADD COLUMN chuc_danh VARCHAR(100) NULL AFTER ngay_sinh");
      console.log("✅ Đã thêm cột chuc_danh vào nguoi_dung");
    }
    if (!colNames.includes("file_ho_so")) {
      await pool.query("ALTER TABLE nguoi_dung ADD COLUMN file_ho_so TEXT NULL AFTER dia_chi");
      console.log("✅ Đã thêm cột file_ho_so vào nguoi_dung");
    }
    if (!colNames.includes("yeu_cau_doi_mat_khau")) {
      await pool.query("ALTER TABLE nguoi_dung ADD COLUMN yeu_cau_doi_mat_khau TINYINT(1) DEFAULT 0 AFTER trang_thai");
      console.log("✅ Đã thêm cột yeu_cau_doi_mat_khau vào nguoi_dung");
    }

    // 2. Tạo bảng yeu_cau_cap_tai_khoan
    await pool.query(`
      CREATE TABLE IF NOT EXISTS yeu_cau_cap_tai_khoan (
        ma_yeu_cau VARCHAR(20) PRIMARY KEY,
        nguoi_yeu_cau VARCHAR(20) NOT NULL,
        ma_khoa VARCHAR(20) NOT NULL,
        ho_ten VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL,
        so_dien_thoai VARCHAR(20) NULL,
        cccd VARCHAR(20) NULL,
        ngay_sinh DATE NULL,
        chuc_danh VARCHAR(100) NULL,
        vai_tro ENUM('TRUONG_KHOA', 'TRO_LY', 'NV_KHO', 'QL_KHO') NOT NULL DEFAULT 'TRO_LY',
        file_dinh_kem TEXT NULL,
        ghi_chu TEXT NULL,
        trang_thai ENUM('CHO_DUYET', 'DA_DUYET', 'TU_CHOI') DEFAULT 'CHO_DUYET',
        ly_do_tu_choi TEXT NULL,
        ma_nguoi_dung_tao VARCHAR(20) NULL,
        nguoi_duyet VARCHAR(20) NULL,
        ngay_duyet DATETIME NULL,
        ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_nguoi_yeu_cau (nguoi_yeu_cau),
        INDEX idx_ma_khoa (ma_khoa),
        INDEX idx_trang_thai (trang_thai)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Bảng yeu_cau_cap_tai_khoan đã sẵn sàng!");

    console.log("🎉 Hoàn tất migration thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi thực hiện migration:", err);
  } finally {
    process.exit(0);
  }
}

migrate();
