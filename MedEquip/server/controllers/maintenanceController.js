import { pool } from "../config/db.js";
import { sendNotificationToRoles } from "../utils/notificationHelper.js";

// ──────────────────────────────────────────────
// GET /api/maintenance — Danh sách thiết bị cần bảo trì
// ──────────────────────────────────────────────
export async function getAllMaintenance(req, res) {
  try {
    const [equipmentList] = await pool.query(`
      SELECT tb.*, tk.so_luong_kho, tk.so_luong_dang_dung, tk.so_luong_hu, ncc.ten_nha_cung_cap
      FROM thiet_bi tb
      LEFT JOIN ton_kho tk ON tb.ma_thiet_bi = tk.ma_thiet_bi
      LEFT JOIN nha_cung_cap ncc ON tb.ma_nha_cung_cap = ncc.ma_nha_cung_cap
      WHERE tb.loai_thiet_bi = 'TAI_SU_DUNG' AND tb.trang_thai = TRUE
      ORDER BY 
        CASE 
          WHEN tb.trang_thai_bao_tri = 'DANG_BAO_TRI' THEN 1
          WHEN tb.ngay_bao_tri_tiep_theo < CURDATE() THEN 2
          WHEN tb.ngay_bao_tri_tiep_theo <= DATE_ADD(CURDATE(), INTERVAL 15 DAY) THEN 3
          ELSE 4
        END,
        tb.ngay_bao_tri_tiep_theo ASC
    `);

    // Phân quyền: Trưởng khoa và Trợ lý chỉ thấy thiết bị khoa mình đang mượn
    let userDept = req.user?.maKhoa;
    if (!userDept && req.user?.userId) {
      const [u] = await pool.query("SELECT ma_khoa FROM nguoi_dung WHERE ma_nguoi_dung = ?", [req.user.userId]);
      if (u.length > 0) userDept = u[0].ma_khoa;
    }
    const isDepartmentRole = (req.user?.vaiTro === 'TRUONG_KHOA' || req.user?.vaiTro === 'TRO_LY');

    let tenKhoaUser = "";
    if (isDepartmentRole && userDept) {
      const [kRows] = await pool.query("SELECT ten_khoa FROM khoa WHERE ma_khoa = ?", [userDept]);
      if (kRows.length > 0) tenKhoaUser = kRows[0].ten_khoa;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];

    for (const item of equipmentList) {
      // Tìm vị trí hiện tại (Khoa nào đang mượn hoặc nằm tại Kho)
      const [allocations] = await pool.query(`
        SELECT pcp.ma_phieu, k.ten_khoa, k.ma_khoa, pcp.ngay_cap, ccp.so_luong
        FROM chi_tiet_cap_phat ccp
        JOIN phieu_cap_phat pcp ON ccp.ma_phieu_cap_phat = pcp.ma_phieu
        LEFT JOIN khoa k ON pcp.ma_khoa_nhan = k.ma_khoa
        WHERE ccp.ma_thiet_bi = ? AND ccp.trang_thai_tra != 'DA_TRA'
        ORDER BY pcp.ngay_cap DESC
      `, [item.ma_thiet_bi]);

      // Nếu là vai trò Khoa: chỉ hiển thị nếu khoa mình đang mượn thiết bị này
      if (isDepartmentRole) {
        const myDeptAlloc = allocations.find(a => a.ma_khoa === userDept);
        if (!myDeptAlloc) {
          continue; // Thiết bị nằm ở kho hoặc khoa khác -> ẨN
        }
      }

      const dangOPhuongKhoa = allocations.length > 0;
      const tenKhoaSuDung = dangOPhuongKhoa 
        ? allocations.map(a => `${a.ten_khoa || a.ma_khoa} (${a.so_luong})`).join(", ") 
        : "Tại kho thiết bị";

      let soNgayConLai = null;
      let trangThaiTinhToan = item.trang_thai_bao_tri || "BINH_THUONG";

      if (item.ngay_bao_tri_tiep_theo) {
        const nextDate = new Date(item.ngay_bao_tri_tiep_theo);
        nextDate.setHours(0, 0, 0, 0);
        soNgayConLai = Math.round((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (item.trang_thai_bao_tri !== "DANG_BAO_TRI") {
          if (soNgayConLai < 0) {
            trangThaiTinhToan = "QUA_HAN";
          } else if (soNgayConLai <= 15) {
            trangThaiTinhToan = "SAP_DEN_HAN";
          } else {
            trangThaiTinhToan = "BINH_THUONG";
          }
        }
      }

      result.push({
        maThietBi: item.ma_thiet_bi,
        tenThietBi: item.ten_thiet_bi,
        loaiThietBi: item.loai_thiet_bi,
        donViCoSo: item.don_vi_co_so,
        serialNumber: item.serial_number || "",
        chuKyBaoTri: item.chu_ky_bao_tri || 6,
        ngayBaoTriGanNhat: item.ngay_bao_tri_gan_nhat || null,
        ngayBaoTriTiepTheo: item.ngay_bao_tri_tiep_theo || null,
        trangThaiBaoTri: trangThaiTinhToan,
        soNgayConLai,
        soLuongKho: item.so_luong_kho || 0,
        soLuongDangDung: item.so_luong_dang_dung || 0,
        viTriHienTai: tenKhoaSuDung,
        dangSuDung: dangOPhuongKhoa,
        tenNhaCungCap: item.ten_nha_cung_cap || "",
        hinhAnh: item.hinh_anh || ""
      });
    }

    // Thống kê nhanh
    const summary = {
      tongSo: result.length,
      binhThuong: result.filter(r => r.trangThaiBaoTri === "BINH_THUONG").length,
      sapDenHan: result.filter(r => r.trangThaiBaoTri === "SAP_DEN_HAN").length,
      quaHan: result.filter(r => r.trangThaiBaoTri === "QUA_HAN").length,
      dangBaoTri: result.filter(r => r.trangThaiBaoTri === "DANG_BAO_TRI").length
    };

    res.json({ success: true, isDepartmentRole, tenKhoaUser, summary, data: result });
  } catch (err) {
    console.error("Error in getAllMaintenance:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  }
}

// ──────────────────────────────────────────────
// POST /api/maintenance/start — Đưa thiết bị vào bảo trì
// ──────────────────────────────────────────────
export async function startMaintenance(req, res) {
  try {
    const { maThietBi } = req.body;
    if (!maThietBi) {
      return res.status(400).json({ success: false, message: "Thiếu mã thiết bị." });
    }

    await pool.query(
      "UPDATE thiet_bi SET trang_thai_bao_tri = 'DANG_BAO_TRI' WHERE ma_thiet_bi = ?",
      [maThietBi]
    );

    res.json({ success: true, message: `Thiết bị ${maThietBi} đã chuyển sang trạng thái Đang bảo trì.` });
  } catch (err) {
    console.error("Error in startMaintenance:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  }
}

// ──────────────────────────────────────────────
// POST /api/maintenance/complete — Nghiệm thu hoàn tất bảo trì
// ──────────────────────────────────────────────
export async function completeMaintenance(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      maThietBi,
      ngayBatDau,
      ngayHoanThanh,
      nguoiThucHien,
      loaiBaoTri,
      noiDung,
      ketQua,
      chiPhi,
      anhMinhChung,
      ghiChu
    } = req.body;

    if (!maThietBi) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Thiếu mã thiết bị." });
    }

    // Kiểm tra thiết bị
    const [tbRows] = await conn.query("SELECT * FROM thiet_bi WHERE ma_thiet_bi = ?", [maThietBi]);
    if (tbRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị." });
    }
    const tb = tbRows[0];
    const chuKy = tb.chu_ky_bao_tri || 6;

    const maPhieuBaoTri = "BT-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
    const completedDate = ngayHoanThanh || new Date().toISOString().slice(0, 10);
    const startDate = ngayBatDau || completedDate;

    // Lưu nhật ký bảo trì
    await conn.query(`
      INSERT INTO lich_su_bao_tri 
      (ma_phieu_bao_tri, ma_thiet_bi, ngay_bat_dau, ngay_hoan_thanh, nguoi_thuc_hien, loai_bao_tri, noi_dung, ket_qua, chi_phi, anh_minh_chung, ghi_chu)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      maPhieuBaoTri,
      maThietBi,
      startDate,
      completedDate,
      nguoiThucHien || req.user?.hoTen || "Kỹ thuật viên",
      loaiBaoTri || "DINH_KY",
      noiDung || "Bảo dưỡng định kỳ, kiểm tra thông số an toàn",
      ketQua || "DAT",
      parseFloat(chiPhi) || 0,
      anhMinhChung || null,
      ghiChu || ""
    ]);

    if (ketQua === "DAT") {
      // Tự động gia hạn mốc bảo trì tiếp theo = completedDate + chuKy (tháng)
      await conn.query(`
        UPDATE thiet_bi 
        SET ngay_bao_tri_gan_nhat = ?,
            ngay_bao_tri_tiep_theo = DATE_ADD(?, INTERVAL ? MONTH),
            trang_thai_bao_tri = 'BINH_THUONG'
        WHERE ma_thiet_bi = ?
      `, [completedDate, completedDate, chuKy, maThietBi]);
    } else {
      // Nếu không đạt chuẩn hoặc hỏng
      await conn.query(`
        UPDATE thiet_bi 
        SET ngay_bao_tri_gan_nhat = ?,
            trang_thai_bao_tri = 'HONG_CHO_SUA'
        WHERE ma_thiet_bi = ?
      `, [completedDate, maThietBi]);
    }

    await conn.commit();

    // Gửi thông báo đến quản lý và thủ kho
    await sendNotificationToRoles(
      ["ADMIN", "QL_KHO", "NV_KHO"],
      "Hoàn tất bảo trì thiết bị",
      `Thiết bị ${tb.ten_thiet_bi} (${maThietBi}) đã được nghiệm thu bảo trì: ${ketQua === "DAT" ? "ĐẠT CHUẨN" : "CẦN SỬA CHỮA"}.`,
      ketQua === "DAT" ? "success" : "warning"
    );

    res.json({
      success: true,
      message: `Đã hoàn tất nghiệm thu bảo trì cho ${tb.ten_thiet_bi} (${maThietBi}). Mốc kế tiếp đã được tự động gia hạn thêm ${chuKy} tháng.`,
      maPhieuBaoTri
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) { }
    }
    console.error("Error in completeMaintenance:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    if (conn) {
      try { conn.release(); } catch (e) { }
    }
  }
}

// ──────────────────────────────────────────────
// GET /api/maintenance/history/:maThietBi — Lịch sử bảo trì
// ──────────────────────────────────────────────
export async function getMaintenanceHistory(req, res) {
  try {
    const { maThietBi } = req.params;
    const [rows] = await pool.query(`
      SELECT ls.*, tb.ten_thiet_bi, tb.loai_thiet_bi, tb.serial_number, tb.chu_ky_bao_tri
      FROM lich_su_bao_tri ls
      JOIN thiet_bi tb ON ls.ma_thiet_bi = tb.ma_thiet_bi
      WHERE ls.ma_thiet_bi = ?
      ORDER BY ls.ngay_hoan_thanh DESC, ls.id DESC
    `, [maThietBi]);

    const formatted = rows.map(r => ({
      ...r,
      id: r.id,
      maPhieuBaoTri: r.ma_phieu_bao_tri,
      maThietBi: r.ma_thiet_bi,
      tenThietBi: r.ten_thiet_bi,
      loaiThietBi: r.loai_thiet_bi,
      serialNumber: r.serial_number,
      chuKyBaoTri: r.chu_ky_bao_tri,
      ngayBatDau: r.ngay_bat_dau,
      ngayHoanThanh: r.ngay_hoan_thanh,
      nguoiThucHien: r.nguoi_thuc_hien,
      loaiBaoTri: r.loai_bao_tri,
      noiDung: r.noi_dung,
      ketQua: r.ket_qua,
      chiPhi: r.chi_phi,
      anhMinhChung: r.anh_minh_chung,
      ghiChu: r.ghi_chu,
      ngayTao: r.ngay_tao
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error("Error in getMaintenanceHistory:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  }
}

// ──────────────────────────────────────────────
// PUT /api/maintenance/record — Cập nhật / Lưu biên bản bàn giao & nghiệm thu
// ──────────────────────────────────────────────
export async function saveOrUpdateMaintenanceRecord(req, res) {
  try {
    const {
      maPhieu,
      maThietBi,
      ngayHoanThanh,
      nguoiThucHien,
      loaiBaoTri,
      noiDung,
      ketQua,
      chiPhi,
      ghiChu,
      ngayBaoTriTiepTheo
    } = req.body;

    if (!maThietBi) {
      return res.status(400).json({ success: false, message: "Thiếu mã thiết bị." });
    }

    const maPhieuFinal = maPhieu || `BT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(Date.now()).slice(-4)}`;
    const completedDate = ngayHoanThanh || new Date().toISOString().slice(0, 10);

    // Kiểm tra tính hợp lệ của ngày bảo trì tiếp theo
    if (ngayBaoTriTiepTheo && new Date(ngayBaoTriTiepTheo) <= new Date(completedDate)) {
      return res.status(400).json({
        success: false,
        message: "Ngày bảo trì tiếp theo phải sau ngày hoàn thành kiểm định."
      });
    }

    const updaterName = req.user.hoTen || "Kỹ thuật viên TBYT";
    const technicianName = nguoiThucHien || updaterName;

    const [existing] = await pool.query(
      "SELECT * FROM lich_su_bao_tri WHERE ma_phieu_bao_tri = ?",
      [maPhieuFinal]
    );

    if (existing.length > 0) {
      await pool.query(`
        UPDATE lich_su_bao_tri 
        SET ngay_hoan_thanh = ?,
            nguoi_thuc_hien = ?,
            loai_bao_tri = ?,
            noi_dung = ?,
            ket_qua = ?,
            chi_phi = ?,
            ghi_chu = ?
        WHERE ma_phieu_bao_tri = ?
      `, [
        completedDate,
        technicianName,
        loaiBaoTri || "DINH_KY",
        noiDung || "",
        ketQua || "DAT",
        parseFloat(chiPhi) || 0,
        ghiChu || "",
        maPhieuFinal
      ]);
    } else {
      await pool.query(`
        INSERT INTO lich_su_bao_tri 
        (ma_phieu_bao_tri, ma_thiet_bi, ngay_bat_dau, ngay_hoan_thanh, nguoi_thuc_hien, loai_bao_tri, noi_dung, ket_qua, chi_phi, ghi_chu)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        maPhieuFinal,
        maThietBi,
        completedDate,
        completedDate,
        technicianName,
        loaiBaoTri || "DINH_KY",
        noiDung || "",
        ketQua || "DAT",
        parseFloat(chiPhi) || 0,
        ghiChu || ""
      ]);
    }

    if (ngayBaoTriTiepTheo) {
      await pool.query(`
        UPDATE thiet_bi 
        SET ngay_bao_tri_tiep_theo = ?,
            ngay_bao_tri_gan_nhat = ?
        WHERE ma_thiet_bi = ?
      `, [ngayBaoTriTiepTheo, completedDate, maThietBi]);
    }

    // Gửi thông báo đến Khoa đang mượn thiết bị để xác nhận minh bạch 2 bên
    try {
      const [allocRows] = await pool.query(`
        SELECT DISTINCT p.ma_khoa_nhan 
        FROM chi_tiet_cap_phat c
        JOIN phieu_cap_phat p ON c.ma_phieu_cap_phat = p.ma_phieu
        WHERE c.ma_thiet_bi = ? AND c.trang_thai_tra != 'DA_TRA'
      `, [maThietBi]);

      for (const a of allocRows) {
        const [deptUsers] = await pool.query(
          "SELECT ma_nguoi_dung FROM nguoi_dung WHERE ma_khoa = ? AND vai_tro IN ('TRUONG_KHOA', 'TRO_LY')",
          [a.ma_khoa_nhan]
        );
        for (const u of deptUsers) {
          const nextDateStr = ngayBaoTriTiepTheo ? new Date(ngayBaoTriTiepTheo).toLocaleDateString('vi-VN') : 'Đã cập nhật';
          await pool.query(
            "INSERT INTO thong_bao (tieu_de, noi_dung, loai, nguoi_nhan, da_doc, ngay_tao) VALUES (?, ?, 'info', ?, FALSE, NOW())",
            [
              `Biên bản kiểm định thiết bị ${maThietBi}`,
              `${updaterName} đã xác nhận biên bản kiểm định cho thiết bị ${maThietBi}. Hạn bảo trì kế tiếp: ${nextDateStr}.`,
              u.ma_nguoi_dung
            ]
          );
        }
      }
    } catch (notifErr) {
      console.error("Notice error to dept:", notifErr);
    }

    res.json({
      success: true,
      message: `Đã lưu thành công biên bản cho thiết bị ${maThietBi} bởi ${updaterName}.`,
      maPhieuBaoTri: maPhieuFinal
    });
  } catch (err) {
    console.error("Error in saveOrUpdateMaintenanceRecord:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  }
}
