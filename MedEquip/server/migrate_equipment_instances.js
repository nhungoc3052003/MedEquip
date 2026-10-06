import { pool } from "./config/db.js";

async function migrateEquipmentInstances() {
  const conn = await pool.getConnection();
  try {
    console.log("🚀 Bắt đầu migration: Bảng cá thể thiết bị (ca_the_thiet_bi)...");
    await conn.beginTransaction();

    // 1. Tạo bảng ca_the_thiet_bi
    await conn.query(`
      CREATE TABLE IF NOT EXISTS ca_the_thiet_bi (
        ma_ca_the VARCHAR(50) PRIMARY KEY,
        ma_thiet_bi VARCHAR(20) NOT NULL,
        serial_number VARCHAR(100) NULL,
        vi_tri_hien_tai ENUM('KHO', 'KHOA_PHONG') NOT NULL DEFAULT 'KHO',
        ma_khoa_hien_tai VARCHAR(20) NULL,
        ma_phieu_cap_phat_hien_tai VARCHAR(30) NULL,
        trang_thai ENUM('SAN_SANG', 'DANG_SU_DUNG', 'DANG_BAO_TRI', 'HU_HONG', 'THANH_LY') NOT NULL DEFAULT 'SAN_SANG',
        ngay_nhap DATETIME DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_phat DATETIME NULL,
        ngay_tra_du_kien DATE NULL,
        ghi_chu TEXT NULL,
        ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
        ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Đã tạo bảng ca_the_thiet_bi thành công.");

    // 2. Tạo bảng cap_phat_ca_the (ghi nhận cá thể bàn giao trong từng phiếu cấp phát)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS cap_phat_ca_the (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ma_phieu_cap_phat VARCHAR(30) NOT NULL,
        ma_thiet_bi VARCHAR(20) NOT NULL,
        ma_ca_the VARCHAR(50) NOT NULL,
        ngay_cap DATETIME DEFAULT CURRENT_TIMESTAMP,
        trang_thai ENUM('DANG_SU_DUNG', 'DA_TRA', 'BAO_HONG') DEFAULT 'DANG_SU_DUNG',
        FOREIGN KEY (ma_ca_the) REFERENCES ca_the_thiet_bi(ma_ca_the) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✅ Đã tạo bảng cap_phat_ca_the thành công.");

    // 3. Thêm cột ma_ca_the vào chi_tiet_phieu_tra (nếu chưa có)
    const [cols] = await conn.query(`SHOW COLUMNS FROM chi_tiet_phieu_tra LIKE 'ma_ca_the'`);
    if (cols.length === 0) {
      await conn.query(`
        ALTER TABLE chi_tiet_phieu_tra 
        ADD COLUMN ma_ca_the VARCHAR(50) NULL 
        AFTER ma_thiet_bi
      `);
      console.log("✅ Đã thêm cột ma_ca_the vào chi_tiet_phieu_tra.");
    }

    // 4. Khởi tạo dữ liệu mẫu cho các thiết bị TAI_SU_DUNG hiện có trong kho
    const [tbRows] = await conn.query(`
      SELECT tb.ma_thiet_bi, tb.ten_thiet_bi, COALESCE(tk.so_luong_kho, 0) as so_luong_kho
      FROM thiet_bi tb
      LEFT JOIN ton_kho tk ON tb.ma_thiet_bi = tk.ma_thiet_bi
      WHERE tb.loai_thiet_bi = 'TAI_SU_DUNG' AND tb.trang_thai = TRUE
    `);

    let totalInstancesCreated = 0;
    for (const tb of tbRows) {
      const cleanPrefix = tb.ma_thiet_bi.replace(/[^A-Za-z0-9]/g, '');
      const count = Math.max(tb.so_luong_kho, 3); // Tạo ít nhất 3 cá thể cho mỗi loại để test

      for (let i = 1; i <= count; i++) {
        const maCaThe = `${cleanPrefix}-${String(i).padStart(3, '0')}`;
        await conn.query(`
          INSERT IGNORE INTO ca_the_thiet_bi 
          (ma_ca_the, ma_thiet_bi, serial_number, vi_tri_hien_tai, trang_thai, ghi_chu)
          VALUES (?, ?, ?, 'KHO', 'SAN_SANG', ?)
        `, [maCaThe, tb.ma_thiet_bi, `SN-${cleanPrefix}-${1000 + i}`, `Nhập kho tự động - ${tb.ten_thiet_bi}`]);
        totalInstancesCreated++;
      }
    }
    console.log(`✅ Đã khởi tạo/đồng bộ ${totalInstancesCreated} cá thể thiết bị trong kho.`);

    // 5. Khởi tạo cá thể cho các thiết bị ĐANG ĐƯỢC CẤP PHÁT (chưa trả)
    const [activeAllocations] = await conn.query(`
      SELECT c.*, p.ma_khoa_nhan, p.ngay_cap, tb.ten_thiet_bi
      FROM chi_tiet_cap_phat c
      JOIN phieu_cap_phat p ON c.ma_phieu_cap_phat = p.ma_phieu
      JOIN thiet_bi tb ON c.ma_thiet_bi = tb.ma_thiet_bi
      WHERE tb.loai_thiet_bi = 'TAI_SU_DUNG' 
        AND c.trang_thai_tra IN ('CHUA_TRA', 'DA_GIA_HAN')
    `);

    let allocatedInstancesCreated = 0;
    for (const alloc of activeAllocations) {
      const cleanPrefix = alloc.ma_thiet_bi.replace(/[^A-Za-z0-9]/g, '');
      const numNeeded = Math.min(alloc.so_luong || 1, 5);

      for (let i = 1; i <= numNeeded; i++) {
        const maCaThe = `${cleanPrefix}-M${String(i).padStart(2, '0')}-${alloc.ma_phieu_cap_phat.slice(-4)}`;
        await conn.query(`
          INSERT IGNORE INTO ca_the_thiet_bi 
          (ma_ca_the, ma_thiet_bi, serial_number, vi_tri_hien_tai, ma_khoa_hien_tai, ma_phieu_cap_phat_hien_tai, trang_thai, ngay_cap_phat, ngay_tra_du_kien, ghi_chu)
          VALUES (?, ?, ?, 'KHOA_PHONG', ?, ?, 'DANG_SU_DUNG', ?, ?, ?)
        `, [
          maCaThe, alloc.ma_thiet_bi, `SN-${cleanPrefix}-${2000 + i}`, 
          alloc.ma_khoa_nhan, alloc.ma_phieu_cap_phat, 
          alloc.ngay_cap || new Date(), alloc.ngay_tra_du_kien || null,
          `Đang được mượn bởi ${alloc.ma_khoa_nhan}`
        ]);

        await conn.query(`
          INSERT IGNORE INTO cap_phat_ca_the (ma_phieu_cap_phat, ma_thiet_bi, ma_ca_the, trang_thai)
          VALUES (?, ?, ?, 'DANG_SU_DUNG')
        `, [alloc.ma_phieu_cap_phat, alloc.ma_thiet_bi, maCaThe]);

        allocatedInstancesCreated++;
      }
    }
    console.log(`✅ Đã đồng bộ ${allocatedInstancesCreated} cá thể cho các phiếu cấp phát đang mượn.`);

    await conn.commit();
    console.log("🎉 Migration hoàn tất thành công!");
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error("❌ Migration thất bại:", err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrateEquipmentInstances();
