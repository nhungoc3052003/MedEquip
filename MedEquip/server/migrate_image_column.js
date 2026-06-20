import { pool } from "./config/db.js";

async function migrate() {
  try {
    console.log("Đang nâng cấp cột anh_chung_minh lên LONGTEXT...");
    await pool.query("ALTER TABLE chi_tiet_phieu_tra MODIFY COLUMN anh_chung_minh LONGTEXT COMMENT 'URL hoặc Base64 ảnh chứng minh'");
    console.log("Nâng cấp thành công! CSDL đã sẵn sàng chứa ảnh Base64 lớn.");
  } catch (err) {
    console.error("Lỗi khi nâng cấp:", err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
