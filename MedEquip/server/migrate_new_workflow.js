/**
 * Migration: Thêm vai trò TRO_LY và trạng thái phiếu mới cho luồng 4 bước
 * Chạy: node migrate_new_workflow.js
 */
import { pool } from "./config/db.js";

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log("🔄 Bắt đầu migration...");

    // 1. Thêm TRO_LY vào ENUM vai_tro
    await conn.query(`
      ALTER TABLE nguoi_dung 
      MODIFY vai_tro ENUM('ADMIN','NV_KHO','TRUONG_KHOA','QL_KHO','TRO_LY') 
      NOT NULL DEFAULT 'TRO_LY'
    `);
    console.log("✅ Đã thêm vai trò TRO_LY");

    // 2. Thêm trạng thái mới vào phieu_yeu_cau
    await conn.query(`
      ALTER TABLE phieu_yeu_cau 
      MODIFY trang_thai ENUM(
        'CHO_DUYET',
        'DA_DUYET',
        'CHO_TRUONG_KHOA_DUYET',
        'CHO_QL_KHO_DUYET',
        'DA_QL_KHO_DUYET',
        'TU_CHOI',
        'DA_CAP_PHAT',
        'DA_HUY'
      ) DEFAULT 'CHO_TRUONG_KHOA_DUYET'
    `);
    console.log("✅ Đã thêm trạng thái phiếu mới");

    // 3. Thêm cột ma_nv_kho_thuc_hien (nếu chưa có)
    const [cols] = await conn.query(`SHOW COLUMNS FROM phieu_yeu_cau LIKE 'ma_nv_kho_thuc_hien'`);
    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE phieu_yeu_cau 
        ADD COLUMN ma_nv_kho_thuc_hien VARCHAR(20) NULL 
        COMMENT 'NV Kho thực hiện cấp phát'
        AFTER nguoi_duyet
      `);
      console.log("✅ Đã thêm cột ma_nv_kho_thuc_hien");
    } else {
      console.log("ℹ️ Cột ma_nv_kho_thuc_hien đã tồn tại, bỏ qua");
    }

    // 4. Thêm thêm trạng thái DA_HUY vào chi_tiet_yeu_cau
    await conn.query(`
      ALTER TABLE chi_tiet_yeu_cau 
      MODIFY trang_thai ENUM('CHO_DUYET','DA_DUYET','TU_CHOI','DA_HUY') 
      DEFAULT 'CHO_DUYET'
    `);
    console.log("✅ Đã cập nhật trạng thái chi tiết yêu cầu");

    // 5. Thêm dữ liệu mẫu TRO_LY cho từng khoa
    const sampleTroLy = [
      ['ND-007', 'Trợ lý Khoa Nội', 'troly.noi@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'TRO_LY', 'K-001'],
      ['ND-008', 'Trợ lý Khoa Ngoại', 'troly.ngoai@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'TRO_LY', 'K-002'],
      ['ND-009', 'Trợ lý Khoa Sản', 'troly.san@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'TRO_LY', 'K-003'],
    ];
    for (const [id, hoTen, email, matKhau, vaiTro, maKhoa] of sampleTroLy) {
      await conn.query(
        `INSERT IGNORE INTO nguoi_dung (ma_nguoi_dung, ho_ten, email, mat_khau, vai_tro, ma_khoa) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, hoTen, email, matKhau, vaiTro, maKhoa]
      );
    }
    console.log("✅ Đã thêm dữ liệu mẫu TRO_LY");

    console.log("\n🎉 Migration hoàn thành! Mật khẩu mẫu: 123456");
  } catch (err) {
    console.error("❌ Migration thất bại:", err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
