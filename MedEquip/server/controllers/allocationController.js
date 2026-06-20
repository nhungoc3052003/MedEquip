import { pool } from "../config/db.js";
import { sendNotification } from "../utils/notificationHelper.js";

export async function getAllAllocations(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM phieu_cap_phat ORDER BY ngay_cap DESC");
    const result = [];
    for (const row of rows) {
      const [details] = await pool.query(
        `SELECT c.*, COALESCE(t.ten_thiet_bi, c.ma_thiet_bi) as ten_thiet_bi,
                t.loai_thiet_bi, t.don_vi_co_so
         FROM chi_tiet_cap_phat c
         LEFT JOIN thiet_bi t ON c.ma_thiet_bi = t.ma_thiet_bi
         WHERE c.ma_phieu_cap_phat = ?`,
        [row.ma_phieu]
      );
      const [reqRows] = await pool.query("SELECT * FROM phieu_yeu_cau WHERE ma_phieu = ?", [row.ma_phieu_yeu_cau]);
      const request = reqRows[0];

      for (const d of details) {
        result.push({
          maPhieu: row.ma_phieu,
          maPhieuYeuCau: row.ma_phieu_yeu_cau,
          maNhanVienKho: row.ma_nguoi_cap,
          maThietBi: d.ma_thiet_bi,
          tenThietBi: d.ten_thiet_bi || d.ma_thiet_bi,
          loaiThietBi: d.loai_thiet_bi || "TAI_SU_DUNG",
          donViTinh: d.don_vi_tinh || d.don_vi_co_so || "Cái",
          soLuongCoSo: d.so_luong_co_so || d.so_luong,
          maNguoiMuon: request ? request.ma_nguoi_yeu_cau : "",
          maKhoa: row.ma_khoa_nhan,
          soLuongCapPhat: d.so_luong,
          ngayCapPhat: row.ngay_cap,
          ngayDuKienTra: d.ngay_tra_du_kien || null,
          trangThaiTra: d.trang_thai_tra || "CHUA_TRA",
          lyDoGiaHan: d.ly_do_gia_han || "",
          ghiChu: row.ghi_chu || ""
        });
      }
      if (details.length === 0) {
        result.push({
          maPhieu: row.ma_phieu,
          maPhieuYeuCau: row.ma_phieu_yeu_cau,
          maNhanVienKho: row.ma_nguoi_cap,
          maThietBi: "", tenThietBi: "", loaiThietBi: "TAI_SU_DUNG",
          maNguoiMuon: request ? request.ma_nguoi_yeu_cau : "",
          maKhoa: row.ma_khoa_nhan,
          soLuongCapPhat: 0,
          ngayCapPhat: row.ngay_cap,
          ngayDuKienTra: null,
          trangThaiTra: "CHUA_TRA",
          ghiChu: row.ghi_chu || ""
        });
      }
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createAllocation(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { maPhieuYeuCau, maNhanVienKho, maKhoa, maThietBi, soLuongCapPhat, ghiChu, ngayDuKienTra } = req.body;
    const id = "CP-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + String(Date.now()).slice(-4);

    await conn.query(
      "INSERT INTO phieu_cap_phat (ma_phieu, ma_phieu_yeu_cau, ma_nguoi_cap, ma_khoa_nhan, ghi_chu) VALUES (?, ?, ?, ?, ?)",
      [id, maPhieuYeuCau, maNhanVienKho || req.user.userId, maKhoa, ghiChu || ""]
    );

    if (maThietBi && soLuongCapPhat) {
      // Lấy thông tin thiết bị để quy đổi
      const [tbInfo] = await conn.query(
        "SELECT don_vi_co_so, don_vi_nhap, he_so_quy_doi, loai_thiet_bi FROM thiet_bi WHERE ma_thiet_bi = ?",
        [maThietBi]
      );
      
      let soLuongCoSo = soLuongCapPhat;
      let isTieuHao = false;

      if (tbInfo.length > 0) {
        const { don_vi_nhap, don_vi_co_so, he_so_quy_doi, loai_thiet_bi } = tbInfo[0];
        isTieuHao = (loai_thiet_bi === 'VAT_TU_TIEU_HAO');
        // Nếu input không có donVi, giả định là đơn vị cơ sở
        const selectedUnit = req.body.donVi || don_vi_co_so;
        if (selectedUnit === don_vi_nhap && don_vi_nhap !== don_vi_co_so) {
          soLuongCoSo = soLuongCapPhat * (he_so_quy_doi || 1);
        }
      }

      await conn.query(
        "INSERT INTO chi_tiet_cap_phat (ma_phieu_cap_phat, ma_thiet_bi, so_luong, so_luong_co_so, don_vi_tinh, ngay_tra_du_kien, trang_thai_tra) VALUES (?, ?, ?, ?, ?, ?, 'CHUA_TRA')",
        [id, maThietBi, soLuongCapPhat, soLuongCoSo, req.body.donVi || 'Cái', ngayDuKienTra || null]
      );

      if (isTieuHao) {
        await conn.query(
          "UPDATE ton_kho SET so_luong_kho = so_luong_kho - ? WHERE ma_thiet_bi = ?",
          [soLuongCoSo, maThietBi]
        );
      } else {
        await conn.query(
          "UPDATE ton_kho SET so_luong_kho = so_luong_kho - ?, so_luong_dang_dung = so_luong_dang_dung + ? WHERE ma_thiet_bi = ?",
          [soLuongCoSo, soLuongCoSo, maThietBi]
        );
      }
    }

    if (maPhieuYeuCau) {
      await conn.query("UPDATE phieu_yeu_cau SET trang_thai = 'DA_CAP_PHAT' WHERE ma_phieu = ?", [maPhieuYeuCau]);
      const [reqData] = await conn.query("SELECT ma_nguoi_yeu_cau FROM phieu_yeu_cau WHERE ma_phieu = ?", [maPhieuYeuCau]);
      if (reqData.length > 0) {
        await sendNotification(reqData[0].ma_nguoi_yeu_cau, "Thiết bị đã được cấp phát ✓",
           `Yêu cầu của bạn đã được duyệt. Mã phiếu cấp phát: ${id}${ngayDuKienTra ? `. Hạn trả: ${ngayDuKienTra}` : ""}`,
           'success');
      }
    }

    await conn.commit();
    res.json({ success: true, phieu: { maPhieu: id } });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    conn.release();
  }
}

// POST /allocations/:id/extend-request — TK gửi yêu cầu gia hạn
export async function extendRequest(req, res) {
  try {
    const { ngayGiaHan, lyDo } = req.body;
    const { id } = req.params;

    if (!ngayGiaHan || !lyDo) {
      return res.json({ success: false, message: "Cần nhập ngày gia hạn và lý do." });
    }

    const [rows] = await pool.query("SELECT * FROM phieu_cap_phat WHERE ma_phieu = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu." });

    await pool.query(
      "UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'YEU_CAU_TRA', ly_do_gia_han = ? WHERE ma_phieu_cap_phat = ?",
      [`[ĐANG YÊU CẦU GIA HẠN đến ${ngayGiaHan}] ${lyDo}`, id]
    );

    // Thông báo cho NV_KHO
    const [khoStaff] = await pool.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'NV_KHO' AND trang_thai = TRUE");
    for (const kho of khoStaff) {
      await sendNotification(kho.ma_nguoi_dung, `Yêu cầu gia hạn phiếu ${id}`, 
        `Trưởng khoa gửi yêu cầu gia hạn đến ${ngayGiaHan}. Lý do: ${lyDo}`, 'warning');
    }

    res.json({ success: true, message: "Đã gửi yêu cầu gia hạn. Chờ NV Kho xác nhận." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

// PUT /allocations/:id/extend-approve — NV_KHO chấp nhận/từ chối gia hạn
export async function extendApprove(req, res) {
  try {
    const { approved, ngayGiaHan, lyDo } = req.body;
    const { id } = req.params;

    const [rows] = await pool.query("SELECT * FROM phieu_cap_phat WHERE ma_phieu = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu." });

    if (approved) {
      await pool.query(
        "UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'DA_GIA_HAN', ngay_tra_du_kien = ? WHERE ma_phieu_cap_phat = ?",
        [ngayGiaHan, id]
      );
    } else {
      // Khôi phục trạng thái CHUA_TRA
      await pool.query(
        "UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'CHUA_TRA' WHERE ma_phieu_cap_phat = ?",
        [id]
      );
    }

    // Tìm người mượn để thông báo
    const [reqData] = await pool.query(
      "SELECT pyu.ma_nguoi_yeu_cau FROM phieu_cap_phat cp JOIN phieu_yeu_cau pyu ON cp.ma_phieu_yeu_cau = pyu.ma_phieu WHERE cp.ma_phieu = ?",
      [id]
    );
    if (reqData.length > 0) {
      const msg = approved
        ? `Yêu cầu gia hạn phiếu ${id} đã được chấp nhận. Hạn trả mới: ${ngayGiaHan}`
        : `Yêu cầu gia hạn phiếu ${id} bị từ chối. ${lyDo ? "Lý do: " + lyDo : ""}`;
      await sendNotification(reqData[0].ma_nguoi_yeu_cau,
         approved ? "Gia hạn được chấp nhận ✓" : "Gia hạn bị từ chối ✗",
         msg, approved ? "success" : "error");
    }

    res.json({ success: true, message: approved ? "Đã chấp nhận gia hạn." : "Đã từ chối gia hạn." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

// PUT /allocations/:id/consume — TK xác nhận đã khấu trừ vật tư tiêu hao
export async function consumeAllocation(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { maThietBi } = req.body;

    if (!maThietBi) {
       await conn.rollback();
       return res.status(400).json({ success: false, message: "Thiếu mã thiết bị." });
    }

    const [cpRows] = await conn.query("SELECT trang_thai_tra, so_luong FROM chi_tiet_cap_phat WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ? FOR UPDATE", [id, maThietBi]);
    if (cpRows.length === 0 || cpRows[0].trang_thai_tra !== 'CHUA_TRA') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Thiết bị không hợp lệ hoặc đã xử lý." });
    }

    // Tồn kho (so_luong_kho) đã được trừ ngay lúc Thủ kho duyệt cấp phát cho Khoa.
    // Ở đây chỉ cần trừ so_luong_dang_dung (nếu có nhầm lẫn cộng vào trước đây do dữ liệu cũ).
    await conn.query(
      "UPDATE ton_kho SET so_luong_dang_dung = GREATEST(0, so_luong_dang_dung - ?) WHERE ma_thiet_bi = ?",
      [cpRows[0].so_luong, maThietBi]
    );

    // Đánh dấu đã dùng/đã trả
    await conn.query("UPDATE chi_tiet_cap_phat SET trang_thai_tra = 'DA_TRA' WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?", [id, maThietBi]);

    await conn.commit();
    res.json({ success: true, message: "Đã báo sử dụng thành công. Vật tư đã được loại khỏi danh sách." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    conn.release();
  }
}
