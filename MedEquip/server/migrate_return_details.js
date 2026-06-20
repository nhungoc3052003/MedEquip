import { pool } from "./config/db.js";

async function migrate() {
  try {
    console.log("Đang thêm cột trang_thai và ly_do_tu_choi vào bảng chi_tiet_phieu_tra...");
    
    // Kiểm tra xem cột trang_thai đã tồn tại chưa
    const [columns] = await pool.query("SHOW COLUMNS FROM chi_tiet_phieu_tra");
    const hasTrangThai = columns.some(c => c.Field === 'trang_thai');
    const hasLyDo = columns.some(c => c.Field === 'ly_do_tu_choi');

    if (!hasTrangThai) {
      await pool.query("ALTER TABLE chi_tiet_phieu_tra ADD COLUMN trang_thai VARCHAR(50) DEFAULT 'CHO_DUYET'");
      console.log("Đã thêm cột trang_thai.");
    }
    if (!hasLyDo) {
      await pool.query("ALTER TABLE chi_tiet_phieu_tra ADD COLUMN ly_do_tu_choi VARCHAR(255) DEFAULT NULL");
      console.log("Đã thêm cột ly_do_tu_choi.");
    }
    console.log("Nâng cấp thành công!");
  } catch (err) {
    console.error("Lỗi khi nâng cấp:", err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
