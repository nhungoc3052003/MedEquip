import { pool } from "../config/db.js";
import { sendNotification } from "../utils/notificationHelper.js";

function mapReturn(row, details = []) {
  return {
    maPhieuTra: row.ma_phieu_tra,
    maTruongKhoa: row.ma_truong_khoa,
    tenTruongKhoa: row.ten_truong_khoa || "",
    ngayTao: row.ngay_tao,
    trangThai: row.trang_thai,
    ghiChu: row.ghi_chu || "",
    qrData: row.qr_data || "",
    chiTiet: details.map(d => {
      let meta = {};
      try { if (d.anh_chung_minh && d.anh_chung_minh.startsWith('{')) meta = JSON.parse(d.anh_chung_minh); } catch (e) { }
      return {
        maPhieuCapPhat: meta.maPhieuCapPhat || row.ma_phieu_cap_phat,
        maThietBi: d.ma_thiet_bi,
        tenThietBi: d.ten_thiet_bi || d.ma_thiet_bi,
        soLuong: d.so_luong,
        donViTinh: d.don_vi_tinh,
        soLuongCoSo: d.so_luong_co_so,
        donViCoSo: d.don_vi_co_so,
        tinhTrangKhiTra: d.tinh_trang_khi_tra,
        anhMinhChung: meta.anhMinhChung || null,
        trangThai: d.trang_thai || "CHO_DUYET",
        lyDoTuChoi: d.ly_do_tu_choi || ""
      };
    })
  };
}

// POST /returns/create — TK tạo phiếu trả
export async function createReturn(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { chiTiet, ghiChu, qrData } = req.body;

    if (!chiTiet || chiTiet.length === 0) {
      await conn.rollback();
      return res.json({ success: false, message: "Vui lòng chọn ít nhất một thiết bị để trả." });
    }

    const userId = req.user.userId;
    const maPhieuTra = "TRA-" + new Date().getFullYear() + "-" + String(Date.now()).slice(-5);

    // Lấy ma_phieu_cap_phat của phần tử đầu tiên (DB yêu cầu NOT NULL trên phieu_tra_thiet_bi)
    const maPhieuCapPhatDauTien = chiTiet[0].maPhieuCapPhat;

    // Tạo phiếu tổng (Khởi tạo ở trạng thái CHO_TRUONG_KHOA_DUYET)
    const [insertResult] = await conn.query(
      "INSERT INTO phieu_tra_thiet_bi (ma_phieu_tra, ma_phieu_cap_phat, ma_truong_khoa, trang_thai, ghi_chu, qr_data) VALUES (?, ?, ?, 'CHO_TRUONG_KHOA_DUYET', ?, ?)",
      [maPhieuTra, maPhieuCapPhatDauTien, userId, ghiChu || "", qrData || maPhieuTra]
    );
    const parentId = insertResult.insertId;

    const processedCapPhats = new Set();
    for (const item of chiTiet) {
      if (!item.maPhieuCapPhat) continue;

      // Kiểm tra trạng thái phiếu cấp phát xem đã được yêu cầu trả chưa
      const [cpRows] = await conn.query(
        "SELECT trang_thai_tra FROM chi_tiet_cap_phat WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ? FOR UPDATE",
        [item.maPhieuCapPhat, item.maThietBi]
      );

      if (cpRows.length === 0 || cpRows[0].trang_thai_tra === 'YEU_CAU_TRA' || cpRows[0].trang_thai_tra === 'DA_TRA') {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Thiết bị từ phiếu ${item.maPhieuCapPhat} đã được yêu cầu trả hoặc đã trả xong.`
        });
      }

      // Lấy thông tin đơn vị từ chi tiết cấp phát
      const [cpDetail] = await conn.query(
        "SELECT don_vi_tinh, so_luong_co_so, so_luong FROM chi_tiet_cap_phat WHERE TRIM(ma_phieu_cap_phat) = TRIM(?) AND TRIM(ma_thiet_bi) = TRIM(?)",
        [item.maPhieuCapPhat, item.maThietBi]
      );
      
      let donVi = 'Cái';
      let soLuongCoSo = item.soLuong;

      if (cpDetail.length > 0) {
        donVi = cpDetail[0].don_vi_tinh || 'Cái';
        // Tỷ lệ quy đổi từ ban đầu
        if (cpDetail[0].so_luong > 0) {
          const exchangeRate = (cpDetail[0].so_luong_co_so || cpDetail[0].so_luong) / cpDetail[0].so_luong;
          soLuongCoSo = item.soLuong * exchangeRate;
        }
      }

      const meta = { maPhieuCapPhat: item.maPhieuCapPhat, anhMinhChung: item.anhMinhChung || null };
      await conn.query(
        "INSERT INTO chi_tiet_phieu_tra (ma_phieu_tra, ma_thiet_bi, so_luong, don_vi_tinh, so_luong_co_so, tinh_trang_khi_tra, anh_chung_minh, trang_thai) VALUES (?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET')",
        [parentId, item.maThietBi, item.soLuong, donVi, soLuongCoSo, item.tinhTrangKhiTra || "DA_BOC_SEAL", JSON.stringify(meta)]
      );

      await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'YEU_CAU_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [item.maPhieuCapPhat, item.maThietBi]);
      processedCapPhats.add(item.maPhieuCapPhat);
    }

    // Thông báo cho Trưởng khoa
    const [receivers] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE ma_khoa = (SELECT ma_khoa FROM nguoi_dung WHERE ma_nguoi_dung = ?) AND vai_tro = 'TRUONG_KHOA'", [userId]);
    for (const rec of receivers) {
      await sendNotification(rec.ma_nguoi_dung, `Yêu cầu trả thiết bị mới: ${maPhieuTra}`, `Phiếu trả ${maPhieuTra} vừa được tạo bởi Trợ lý Khoa, chờ bạn phê duyệt.`, 'info');
    }

    await conn.commit();
    res.json({ success: true, maPhieuTra, message: "Đã tạo phiếu trả thành công." });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    conn.release();
  }
}

// GET /returns — NV_KHO xem tất cả phiếu trả
export async function getAllReturns(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT ptt.*, nd.ho_ten as ten_truong_khoa
      FROM phieu_tra_thiet_bi ptt
      JOIN nguoi_dung nd ON ptt.ma_truong_khoa = nd.ma_nguoi_dung
      WHERE ptt.ghi_chu IS NULL OR ptt.ghi_chu NOT LIKE '%[DELETED_BY_NVKHO]%'
      ORDER BY ptt.ngay_tao DESC
    `);

    const result = [];
    for (const row of rows) {
      const [details] = await pool.query(`
        SELECT ct.*, COALESCE(tb.ten_thiet_bi, ct.ma_thiet_bi) as ten_thiet_bi, tb.don_vi_co_so
        FROM chi_tiet_phieu_tra ct
        LEFT JOIN thiet_bi tb ON ct.ma_thiet_bi = tb.ma_thiet_bi
        WHERE ct.ma_phieu_tra = ?
      `, [row.id]);
      result.push(mapReturn(row, details));
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

// GET /returns/my — TK xem phiếu trả của mình
export async function getMyReturns(req, res) {
  try {
    const userId = req.user.userId;
    const vaiTro = req.user.vaiTro;
    let query = "";
    let params = [];

    if (vaiTro === 'TRUONG_KHOA') {
      // Trưởng khoa thấy các phiếu của khoa mình (kể cả do trợ lý tạo)
      query = `
        SELECT ptt.*, nd.ho_ten as ten_truong_khoa
        FROM phieu_tra_thiet_bi ptt
        JOIN nguoi_dung nd ON ptt.ma_truong_khoa = nd.ma_nguoi_dung
        WHERE nd.ma_khoa = (SELECT ma_khoa FROM nguoi_dung WHERE ma_nguoi_dung = ?) 
          AND (ptt.ghi_chu IS NULL OR ptt.ghi_chu NOT LIKE '%[DELETED_BY_TK]%')
        ORDER BY ptt.ngay_tao DESC
      `;
      params = [userId];
    } else {
      // Trợ lý thấy phiếu của chính mình
      query = `
        SELECT ptt.*, nd.ho_ten as ten_truong_khoa
        FROM phieu_tra_thiet_bi ptt
        JOIN nguoi_dung nd ON ptt.ma_truong_khoa = nd.ma_nguoi_dung
        WHERE ptt.ma_truong_khoa = ? AND (ptt.ghi_chu IS NULL OR ptt.ghi_chu NOT LIKE '%[DELETED_BY_TK]%')
        ORDER BY ptt.ngay_tao DESC
      `;
      params = [userId];
    }

    const [rows] = await pool.query(query, params);

    const result = [];
    for (const row of rows) {
      const [details] = await pool.query(`
        SELECT ct.*, COALESCE(tb.ten_thiet_bi, ct.ma_thiet_bi) as ten_thiet_bi, tb.don_vi_co_so
        FROM chi_tiet_phieu_tra ct
        LEFT JOIN thiet_bi tb ON ct.ma_thiet_bi = tb.ma_thiet_bi
        WHERE ct.ma_phieu_tra = ?
      `, [row.id]);
      result.push(mapReturn(row, details));
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

// PUT /returns/:id/confirm — NV_KHO chấp nhận/từ chối
export async function confirmReturn(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { approved, lyDo } = req.body;

    const [rows] = await conn.query("SELECT * FROM phieu_tra_thiet_bi WHERE ma_phieu_tra = ?", [id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu trả." });
    }
    const phieu = rows[0];

    const newStatus = approved ? "DA_TRA" : "TU_CHOI";
    await conn.query("UPDATE phieu_tra_thiet_bi SET trang_thai = ? WHERE id = ?", [newStatus, phieu.id]);

    // Lấy chi tiết phiếu trả mà không bị từ chối
    const [details] = await conn.query("SELECT * FROM chi_tiet_phieu_tra WHERE ma_phieu_tra = ? AND trang_thai != 'TU_CHOI'", [phieu.id]);

    for (const d of details) {
      let meta = {};
      try { meta = JSON.parse(d.anh_chung_minh); } catch (e) { }
      const curMaPhieuCapPhat = meta.maPhieuCapPhat || phieu.ma_phieu_cap_phat;
      const soLuongCoSo = d.so_luong_co_so || d.so_luong; // Fallback for old records

      if (approved) {
        const [cpRows] = await conn.query(
          "SELECT trang_thai_tra FROM chi_tiet_cap_phat WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, d.ma_thiet_bi]
        );

        if (cpRows.length > 0 && cpRows[0].trang_thai_tra !== 'YEU_CAU_TRA') {
          // Nếu đã trả rồi hoặc chưa bao giờ yêu cầu trả thì bỏ quả để tránh sai lệch kho
          continue;
        }

        const [tbRows] = await conn.query("SELECT loai_thiet_bi FROM thiet_bi WHERE ma_thiet_bi = ?", [d.ma_thiet_bi]);
        const loaiTB = tbRows[0]?.loai_thiet_bi || "TAI_SU_DUNG";

        // Cộng lại tồn kho cho các thiết bị được trả
        if (d.tinh_trang_khi_tra !== "HONG") {
          if (loaiTB === 'VAT_TU_TIEU_HAO' && d.tinh_trang_khi_tra === 'DA_BOC_SEAL') {
            await conn.query(
              "UPDATE ton_kho SET so_luong_dang_dung = GREATEST(0, so_luong_dang_dung - ?) WHERE ma_thiet_bi = ?",
              [soLuongCoSo, d.ma_thiet_bi]
            );
          } else {
            // Tái sử dụng hoặc Vật tư nguyên seal
            await conn.query(
              "UPDATE ton_kho SET so_luong_kho = so_luong_kho + ?, so_luong_dang_dung = GREATEST(0, so_luong_dang_dung - ?) WHERE ma_thiet_bi = ?",
              [soLuongCoSo, soLuongCoSo, d.ma_thiet_bi]
            );
          }
        } else {
          // Thiết bị hỏng: trừ dang_dung, cộng hu
          await conn.query(
            "UPDATE ton_kho SET so_luong_hu = so_luong_hu + ?, so_luong_dang_dung = GREATEST(0, so_luong_dang_dung - ?) WHERE ma_thiet_bi = ?",
            [soLuongCoSo, soLuongCoSo, d.ma_thiet_bi]
          );
        }

        // Cập nhật phiếu cấp phát thành DA_TRA cho thiết bị này
        await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'DA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, d.ma_thiet_bi]);
      } else {
        // Từ chối: khôi phục trạng thái cũ (CHUA_TRA)
        await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, d.ma_thiet_bi]);
      }
    }

    // Thông báo cho người tạo phiếu (Trưởng khoa)
    const msg = approved
      ? `Phiếu trả thiết bị ${phieu.ma_phieu_tra} đã được xác nhận thành công.`
      : `Phiếu trả thiết bị ${phieu.ma_phieu_tra} đã bị từ chối. Lý do: ${lyDo || 'Không có'}`;
    await sendNotification(phieu.ma_truong_khoa, approved ? "Phiếu trả được xác nhận" : "Phiếu trả bị từ chối", msg, approved ? "success" : "error");

    await conn.commit();
    res.json({ success: true, message: approved ? "Đã xác nhận nhận hàng trả." : "Đã từ chối phiếu trả." });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    conn.release();
  }
}

// PUT /returns/:id/approve-dept — Trưởng khoa duyệt
export async function approveReturnDept(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { approved, lyDo, items } = req.body;

    const [rows] = await conn.query("SELECT * FROM phieu_tra_thiet_bi WHERE ma_phieu_tra = ?", [id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu trả." });
    }
    const phieu = rows[0];

    if (phieu.trang_thai !== 'CHO_TRUONG_KHOA_DUYET') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Phiếu không ở trạng thái Chờ Trưởng khoa duyệt." });
    }

    let approvedCount = 0;
    const [details] = await conn.query("SELECT * FROM chi_tiet_phieu_tra WHERE ma_phieu_tra = ?", [phieu.id]);

    if (items && Array.isArray(items)) {
      // Duyệt từng thiết bị
      for (const item of items) {
        const d = details.find(x => x.ma_thiet_bi === item.maThietBi);
        if (!d) continue;

        let meta = {};
        try { if (d.anh_chung_minh && d.anh_chung_minh.startsWith('{')) meta = JSON.parse(d.anh_chung_minh); } catch (e) {}
        const curMaPhieuCapPhat = meta.maPhieuCapPhat || phieu.ma_phieu_cap_phat;

        if (item.approved) {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'CHO_QL_KHO_DUYET' WHERE id = ?", [d.id]);
          approvedCount++;
        } else {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE id = ?", [item.lyDo || lyDo || "Trưởng khoa từ chối", d.id]);
          if (curMaPhieuCapPhat) {
            await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, d.ma_thiet_bi]);
          }
        }
      }
    } else {
      // Duyệt cả phiếu (fallback)
      for (const d of details) {
        let meta = {};
        try { if (d.anh_chung_minh && d.anh_chung_minh.startsWith('{')) meta = JSON.parse(d.anh_chung_minh); } catch (e) {}
        const curMaPhieuCapPhat = meta.maPhieuCapPhat || phieu.ma_phieu_cap_phat;

        if (approved) {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'CHO_QL_KHO_DUYET' WHERE id = ?", [d.id]);
          approvedCount++;
        } else {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE id = ?", [lyDo || "Trưởng khoa từ chối", d.id]);
          if (curMaPhieuCapPhat) {
            await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, d.ma_thiet_bi]);
          }
        }
      }
    }

    if (approvedCount > 0) {
      await conn.query("UPDATE phieu_tra_thiet_bi SET trang_thai = 'CHO_QL_KHO_DUYET' WHERE id = ?", [phieu.id]);
      
      // Notify QL_KHO
      const [receivers] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'QL_KHO' OR vai_tro = 'ADMIN'");
      for (const rec of receivers) {
        await sendNotification(rec.ma_nguoi_dung, `Yêu cầu trả thiết bị chờ duyệt`, `Phiếu trả ${phieu.ma_phieu_tra} đã được Trưởng khoa duyệt, chờ Quản lý kho phê duyệt.`, 'info');
      }
      
      // Notify TRO_LY (người tạo)
      await sendNotification(phieu.ma_truong_khoa, "Phiếu trả đã được duyệt", `Trưởng khoa đã duyệt phiếu trả ${phieu.ma_phieu_tra}.`, "success");
    } else {
      await conn.query("UPDATE phieu_tra_thiet_bi SET trang_thai = 'TU_CHOI', ghi_chu = CONCAT(IFNULL(ghi_chu, ''), ?) WHERE id = ?", [`\nLý do từ chối: ${lyDo || 'Từ chối toàn bộ thiết bị'}`, phieu.id]);
      // Notify TRO_LY
      await sendNotification(phieu.ma_truong_khoa, "Phiếu trả bị từ chối", `Trưởng khoa đã từ chối phiếu trả ${phieu.ma_phieu_tra}. Lý do: ${lyDo || 'Từ chối toàn bộ thiết bị'}`, "error");
    }

    await conn.commit();
    res.json({ success: true, message: approvedCount > 0 ? "Đã duyệt phiếu trả." : "Đã từ chối phiếu trả." });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    conn.release();
  }
}

// PUT /returns/:id/approve-mgr — Quản lý kho duyệt
export async function approveReturnManager(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { approved, lyDo, items } = req.body;

    const [rows] = await conn.query("SELECT * FROM phieu_tra_thiet_bi WHERE ma_phieu_tra = ?", [id]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu trả." });
    }
    const phieu = rows[0];

    if (phieu.trang_thai !== 'CHO_QL_KHO_DUYET') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Phiếu không ở trạng thái Chờ QL Kho duyệt." });
    }

    let approvedCount = 0;
    const [details] = await conn.query("SELECT * FROM chi_tiet_phieu_tra WHERE ma_phieu_tra = ?", [phieu.id]);

    if (items && Array.isArray(items)) {
      // Duyệt từng thiết bị
      for (const item of items) {
        const d = details.find(x => x.ma_thiet_bi === item.maThietBi);
        if (!d) continue;

        // Bỏ qua nếu đã bị từ chối ở Dept stage
        if (d.trang_thai === 'TU_CHOI') continue;

        let meta = {};
        try { if (d.anh_chung_minh && d.anh_chung_minh.startsWith('{')) meta = JSON.parse(d.anh_chung_minh); } catch (e) {}
        const curMaPhieuCapPhat = meta.maPhieuCapPhat || phieu.ma_phieu_cap_phat;

        if (item.approved) {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'CHO_XAC_NHAN' WHERE id = ?", [d.id]);
          approvedCount++;
        } else {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE id = ?", [item.lyDo || lyDo || "Quản lý kho từ chối", d.id]);
          if (curMaPhieuCapPhat) {
            await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, d.ma_thiet_bi]);
          }
        }
      }
    } else {
      // Duyệt cả phiếu (fallback)
      for (const d of details) {
        if (d.trang_thai === 'TU_CHOI') continue;

        let meta = {};
        try { if (d.anh_chung_minh && d.anh_chung_minh.startsWith('{')) meta = JSON.parse(d.anh_chung_minh); } catch (e) {}
        const curMaPhieuCapPhat = meta.maPhieuCapPhat || phieu.ma_phieu_cap_phat;

        if (approved) {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'CHO_XAC_NHAN' WHERE id = ?", [d.id]);
          approvedCount++;
        } else {
          await conn.query("UPDATE chi_tiet_phieu_tra SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE id = ?", [lyDo || "Quản lý kho từ chối", d.id]);
          if (curMaPhieuCapPhat) {
            await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, d.ma_thiet_bi]);
          }
        }
      }
    }

    if (approvedCount > 0) {
      await conn.query("UPDATE phieu_tra_thiet_bi SET trang_thai = 'CHO_XAC_NHAN' WHERE id = ?", [phieu.id]);
      
      // Notify NV_KHO
      const [receivers] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'NV_KHO'");
      for (const rec of receivers) {
        await sendNotification(rec.ma_nguoi_dung, `Phiếu trả thiết bị chờ xác nhận`, `Phiếu trả ${phieu.ma_phieu_tra} đã được Quản lý duyệt, bạn hãy chuẩn bị nhận và quét mã xác nhận.`, 'info');
      }
      
      // Notify TRO_LY
      await sendNotification(phieu.ma_truong_khoa, "Phiếu trả được QL duyệt", `Quản lý kho đã duyệt phiếu trả ${phieu.ma_phieu_tra}, vui lòng mang thiết bị xuống kho.`, "success");
    } else {
      await conn.query("UPDATE phieu_tra_thiet_bi SET trang_thai = 'TU_CHOI', ghi_chu = CONCAT(IFNULL(ghi_chu, ''), ?) WHERE id = ?", [`\nQL Kho từ chối: ${lyDo || 'Từ chối toàn bộ thiết bị'}`, phieu.id]);
      // Notify TRO_LY
      await sendNotification(phieu.ma_truong_khoa, "Phiếu trả bị từ chối", `Quản lý kho đã từ chối phiếu trả ${phieu.ma_phieu_tra}. Lý do: ${lyDo || 'Từ chối toàn bộ thiết bị'}`, "error");
    }

    await conn.commit();
    res.json({ success: true, message: approvedCount > 0 ? "Đã duyệt phiếu trả." : "Đã từ chối phiếu trả." });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    conn.release();
  }
}

// Xóa phiếu trả (Xóa mềm)
export async function deleteReturn(req, res) {
  try {
    const { id } = req.params;
    const role = req.user.vaiTro;

    if (role !== 'QL_KHO' && role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: "Không có quyền thực hiện hành động này." });
    }

    await pool.query("UPDATE phieu_tra_thiet_bi SET ghi_chu = CONCAT(IFNULL(ghi_chu, ''), ' [DELETED_BY_NVKHO]') WHERE ma_phieu_tra = ?", [id]);
    res.json({ success: true, message: "Đã xóa phiếu trả thành công." });
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function cancelReturn(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const userId = req.user.userId;

    const [rows] = await conn.query("SELECT * FROM phieu_tra_thiet_bi WHERE ma_phieu_tra = ? AND ma_truong_khoa = ?", [id, userId]);
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy hoặc không có quyền." });
    }

    const phieu = rows[0];
    if (phieu.trang_thai !== 'CHO_TRUONG_KHOA_DUYET' && phieu.trang_thai !== 'CHO_QL_KHO_DUYET') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Chỉ có thể hủy phiếu Đang chờ duyệt." });
    }

    // Kiểm tra thời hạn 30 phút
    const createdAt = new Date(phieu.ngay_tao);
    const now = new Date();
    const diffMinutes = (now - createdAt) / (1000 * 60);
    if (diffMinutes > 30) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Đã quá 30 phút kể từ khi tạo phiếu. Không thể hủy phiếu này nữa." });
    }

    // Cập nhật trạng thái phiếu trả thành HUY
    await conn.query("UPDATE phieu_tra_thiet_bi SET trang_thai = 'HUY', ghi_chu = CONCAT(IFNULL(ghi_chu, ''), ' [Hủy bởi Trợ lý]') WHERE id = ?", [phieu.id]);

    // Trả lại trạng thái cho các phiếu cấp phát liên quan
    const [details] = await conn.query("SELECT ma_thiet_bi, anh_chung_minh FROM chi_tiet_phieu_tra WHERE ma_phieu_tra = ?", [phieu.id]);
    
    for (const d of details) {
      let meta = {};
      try { 
        if (d.anh_chung_minh && d.anh_chung_minh.startsWith('{')) {
          meta = JSON.parse(d.anh_chung_minh); 
        }
      } catch (e) { console.error("Error parsing meta in cancelReturn:", e); }
      
      const curMaPhieuCapPhat = meta.maPhieuCapPhat || phieu.ma_phieu_cap_phat;
      const curMaThietBi = d.ma_thiet_bi;
      if (curMaPhieuCapPhat && curMaThietBi) {
        // Khi hủy, trả về trạng thái CHUA_TRA cho thiết bị cụ thể
        await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [curMaPhieuCapPhat, curMaThietBi]);
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Đã hủy yêu cầu trả thành công." });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    conn.release();
  }
}

// Yêu cầu gia hạn
export const extendReturn = async (req, res) => {
  const { maPhieu, ngayTraMoi, lyDo } = req.body;
  try {
    // Cập nhật phieu_cap_phat thành trạng thái đang gia hạn
    await pool.query(
      "UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'DA_GIA_HAN', ngay_tra_du_kien = ?, ly_do_gia_han = ? WHERE ma_phieu_cap_phat = ?",
      [ngayTraMoi, lyDo, maPhieu]
    );
    res.json({ success: true, message: "Đã gửi yêu cầu gia hạn." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi: " + err.message });
  }
};

// Duyệt gia hạn
export const approveExtension = async (req, res) => {
  const { maPhieu, approve } = req.body;
  try {
    if (approve) {
      // Duyệt: Trở về trạng thái CHUA_TRA (đang mượn) với ngày trả mới đã cập nhật ở bước trước
      await pool.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA', ly_do_gia_han = NULL WHERE ma_phieu_cap_phat = ?", [maPhieu]);
      res.json({ success: true, message: "Đã duyệt gia hạn thành công." });
    } else {
      // Từ chối: Trở về trạng thái CHUA_TRA nhưng có thể gắn flag quá hạn nếu cần
      await pool.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA', ly_do_gia_han = 'BỊ TỪ CHỐI GIA HẠN' WHERE ma_phieu_cap_phat = ?", [maPhieu]);
      res.json({ success: true, message: "Đã từ chối gia hạn." });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi: " + err.message });
  }
};

export async function remindOverdue(req, res) {
  try {
    const { items } = req.body;
    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "Danh sách thiết bị trống." });
    }

    const conn = await pool.getConnection();
    try {
      for (const item of items) {
        // Lấy thông tin khoa từ phiếu cấp phát
        const [allocs] = await conn.query("SELECT ma_khoa FROM phieu_cap_phat WHERE ma_phieu = ?", [item.maPhieuCapPhat]);
        if (allocs.length > 0) {
          const maKhoa = allocs[0].ma_khoa;
          // Tìm trợ lý của khoa
          const [troLy] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'TRO_LY' AND ma_khoa = ?", [maKhoa]);
          for (const tl of troLy) {
            await sendNotification(
              tl.ma_nguoi_dung,
              "Cảnh báo quá hạn trả thiết bị",
              `Thiết bị ${item.tenThietBi} (Phiếu ${item.maPhieuCapPhat}) đã quá hạn trả. Vui lòng lập phiếu trả hoặc gia hạn ngay.`,
              "warning"
            );
          }
        }
      }
      res.json({ success: true, message: "Đã gửi thông báo nhắc nhở thành công." });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
