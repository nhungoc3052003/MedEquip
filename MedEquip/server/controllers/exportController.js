import { pool } from "../config/db.js";
import * as XLSX from "xlsx";
import { sendNotification, sendNotificationToRoles } from "../utils/notificationHelper.js";

// ──────────────────────────────────────────────
// GET /exports — Lịch sử xuất kho
// ──────────────────────────────────────────────
export async function getAllExports(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.ho_ten as ten_nhan_vien
      FROM phieu_xuat_kho p
      LEFT JOIN nguoi_dung u ON p.ma_nguoi_xuat = u.ma_nguoi_dung
      ORDER BY p.ngay_xuat DESC
    `);
    const result = [];
    for (const row of rows) {
      const [details] = await pool.query(
        `SELECT c.*, COALESCE(t.ten_thiet_bi, c.ma_thiet_bi) as ten_thiet_bi, t.don_vi_co_so as dv_co_so_goc
         FROM chi_tiet_xuat_kho c
         LEFT JOIN thiet_bi t ON c.ma_thiet_bi = t.ma_thiet_bi
         WHERE c.ma_phieu_xuat = ?`,
        [row.ma_phieu]
      );

      if (details.length > 0) {
        for (const d of details) {
          result.push({
            maPhieu: row.ma_phieu,
            maNhanVienKho: row.ma_nguoi_xuat,
            tenNhanVienKho: row.ten_nhan_vien || "",
            ngayXuat: row.ngay_xuat,
            lyDoXuat: row.ly_do || "",
            trangThai: row.trang_thai,
            maThietBi: d.ma_thiet_bi,
            tenThietBi: d.ten_thiet_bi,
            soLuong: d.so_luong_giao_dich || d.so_luong,
            donViTinh: d.don_vi_tinh || d.dv_co_so_goc || "Cái",
            soLuongCoSo: d.so_luong_co_so || d.so_luong,
            donViCoSo: d.dv_co_so_goc || "Cái",
            tongSoLoai: row.tong_so_loai || 0,
            tongSoLuong: row.tong_so_luong || 0,
            tongGiaTri: row.tong_gia_tri || 0,
            hinhAnhMinhChung: row.chung_tu_dinh_kem || null
          });
        }
      } else {
        result.push({
          maPhieu: row.ma_phieu,
          maNhanVienKho: row.ma_nguoi_xuat,
          tenNhanVienKho: row.ten_nhan_vien || "",
          ngayXuat: row.ngay_xuat,
          lyDoXuat: row.ly_do || "",
          trangThai: row.trang_thai,
          maThietBi: "", tenThietBi: "", soLuong: 0, donViTinh: "Cái",
          tongSoLoai: row.tong_so_loai || 0,
          tongSoLuong: row.tong_so_luong || 0,
          tongGiaTri: row.tong_gia_tri || 0,
          hinhAnhMinhChung: row.chung_tu_dinh_kem || null
        });
      }
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

// ──────────────────────────────────────────────
// POST /exports — Tạo phiếu xuất kho thủ công (form UI)
// Body: { lyDo, items: [{maThietBi, soLuong}] }
// ──────────────────────────────────────────────
export async function createExportManual(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { lyDo, items, hinhAnhMinhChung } = req.body || {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Danh sách thiết bị xuất không được để trống." });
    }

    // Validate từng dòng
    const errors = [];
    const processedItems = [];

    for (const item of items) {
      if (!item.maThietBi) { errors.push(`Thiếu mã thiết bị`); continue; }
      const soLuongGD = parseInt(item.soLuong) || 0;
      if (soLuongGD <= 0) { errors.push(`${item.maThietBi}: Số lượng phải > 0`); continue; }

      // Lấy thông tin thiết bị để quy đổi
      const [tbInfo] = await conn.query(
        "SELECT don_vi_co_so, don_vi_nhap, he_so_quy_doi FROM thiet_bi WHERE ma_thiet_bi = ?",
        [item.maThietBi]
      );
      if (tbInfo.length === 0) {
        errors.push(`${item.maThietBi}: Thiết bị không tồn tại`);
        continue;
      }

      const { don_vi_co_so, don_vi_nhap, he_so_quy_doi } = tbInfo[0];
      const selectedUnit = item.donVi || don_vi_co_so;
      
      // Tính số lượng cơ sở
      let soLuongCoSo = soLuongGD;
      if (selectedUnit === don_vi_nhap && don_vi_nhap !== don_vi_co_so) {
        soLuongCoSo = soLuongGD * (he_so_quy_doi || 1);
      }

      const [inv] = await conn.query(
        "SELECT so_luong_kho FROM ton_kho WHERE ma_thiet_bi = ?",
        [item.maThietBi]
      );
      
      if (inv.length === 0) {
        errors.push(`${item.maThietBi}: Không tìm thấy trong kho`);
      } else if (inv[0].so_luong_kho < soLuongCoSo) {
        errors.push(`${item.maThietBi}: Không đủ tồn kho (Hiện có: ${inv[0].so_luong_kho} ${don_vi_co_so}, Yêu cầu: ${soLuongCoSo} ${don_vi_co_so})`);
      }

      processedItems.push({
        ...item,
        donVi: selectedUnit,
        soLuongGiaoDich: soLuongGD,
        soLuongCoSo: soLuongCoSo
      });
    }

    if (errors.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }

    const userId = req.user.userId;
    const userRole = req.user.vaiTro;
    const phieuId = "XK-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);

    // Tính toán tổng hợp
    const tongSoLoai = processedItems.length;
    let tongSoLuong = 0;
    for (const item of processedItems) {
        tongSoLuong += item.soLuongCoSo;
    }

    // Xác định trạng thái dựa trên vai trò
    // Admin và QL_KHO được tự động duyệt
    const autoApprove = (userRole === 'ADMIN' || userRole === 'QL_KHO');
    const trangThai = autoApprove ? 'DA_XUAT' : 'DA_LAP';

    await conn.query(
      "INSERT INTO phieu_xuat_kho (ma_phieu, ma_nguoi_xuat, ngay_xuat, ly_do, trang_thai, tong_so_loai, tong_so_luong, chung_tu_dinh_kem) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?)",
      [phieuId, userId, lyDo || "Xuất kho", trangThai, tongSoLoai, tongSoLuong, hinhAnhMinhChung || null]
    );

    // Lấy tên người gửi (phòng trường hợp token cũ không có hoTen)
    let senderName = req.user.hoTen || "Nhân viên";
    if (!req.user.hoTen) {
        const [uRows] = await conn.query("SELECT ho_ten FROM nguoi_dung WHERE ma_nguoi_dung = ?", [userId]);
        if (uRows.length > 0) senderName = uRows[0].ho_ten;
    }

    // Thông báo
    if (autoApprove) {
        await sendNotification(userId, "Xuất kho thành công", `Phiếu xuất ${phieuId} đã được tạo và tự động duyệt.`, 'success');
    } else {
        await sendNotificationToRoles(['ADMIN', 'QL_KHO'], "Yêu cầu xuất kho mới", `Nhân viên ${senderName} đã tạo phiếu xuất ${phieuId} chờ phê duyệt.`, 'info');
    }

    for (const item of processedItems) {
      // Nếu được tự động duyệt, trừ tồn kho ngay
      if (autoApprove) {
        await conn.query(
          "UPDATE ton_kho SET so_luong_kho = so_luong_kho - ? WHERE ma_thiet_bi = ?",
          [item.soLuongCoSo, item.maThietBi]
        );
      }

      // Ghi chi tiết phiếu xuất
      await conn.query(
        "INSERT INTO chi_tiet_xuat_kho (ma_phieu_xuat, ma_thiet_bi, don_vi_tinh, so_luong_giao_dich, so_luong_co_so, so_luong) VALUES (?, ?, ?, ?, ?, ?)",
        [phieuId, item.maThietBi, item.donVi, item.soLuongGiaoDich, item.soLuongCoSo, item.soLuongCoSo]
      );
    }

    await conn.commit();
    res.json({
      success: true,
      message: autoApprove 
        ? `Đã tạo phiếu xuất kho thành công. Mã phiếu: ${phieuId}`
        : `Đã gửi yêu cầu xuất kho. Chờ Admin/Quản lý kho phê duyệt. Mã phiếu: ${phieuId}`,
      maPhieu: phieuId,
      trangThai
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    conn.release();
  }
}

// ──────────────────────────────────────────────
// POST /exports/excel — Xuất lịch sử xuất kho ra file Excel
// ──────────────────────────────────────────────
export async function exportToExcel(req, res) {
  try {
    const { ids } = req.body || {};
    
    let query = `
      SELECT px.ma_phieu, px.ngay_xuat, 
             COALESCE(cx.so_luong_giao_dich, cx.so_luong) as so_luong_gd,
             COALESCE(cx.don_vi_tinh, tb.don_vi_co_so, 'Cái') as dv_tinh,
             COALESCE(tb.ten_thiet_bi, cx.ma_thiet_bi) as ten_thiet_bi,
             px.ly_do, nd.ho_ten as nguoi_lap, px.trang_thai
      FROM phieu_xuat_kho px
      LEFT JOIN chi_tiet_xuat_kho cx ON px.ma_phieu = cx.ma_phieu_xuat
      LEFT JOIN thiet_bi tb ON cx.ma_thiet_bi = tb.ma_thiet_bi
      LEFT JOIN nguoi_dung nd ON px.ma_nguoi_xuat = nd.ma_nguoi_dung
    `;
    const params = [];
    
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      query += ` WHERE px.ma_phieu IN (${placeholders})`;
      params.push(...ids);
    }
    
    query += ` ORDER BY px.ngay_xuat DESC`;

    const [rows] = await pool.query(query, params);

    const data = rows.map(r => ({
      "Mã phiếu": r.ma_phieu,
      "Ngày xuất": r.ngay_xuat ? new Date(r.ngay_xuat).toLocaleString("vi-VN") : "",
      "Thiết bị": r.ten_thiet_bi,
      "Số lượng": r.so_luong_gd,
      "Đơn vị": r.dv_tinh,
      "Lý do": r.ly_do || "",
      "Người lập": r.nguoi_lap || "",
      "Trạng thái": r.trang_thai || ""
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 18 }, { wch: 20 }, { wch: 25 },
      { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lịch sử xuất kho");

    // Dùng type:"array" để tránh bug ESM
    const arrayBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const buffer = Buffer.from(new Uint8Array(arrayBuf));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=lich_su_xuat_kho.xlsx");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi xuất file" });
  }
}

// ──────────────────────────────────────────────
// POST /exports/delete-multiple — Xóa nhiều phiếu xuất kho (Admin)
// ──────────────────────────────────────────────
export async function deleteMultipleExports(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Danh sách phiếu xóa không được để trống." });
    }
    
    const placeholders = ids.map(() => '?').join(',');
    
    // Deleting from detail table
    await conn.query(`DELETE FROM chi_tiet_xuat_kho WHERE ma_phieu_xuat IN (${placeholders})`, ids);
    // Deleting from main table
    await conn.query(`DELETE FROM phieu_xuat_kho WHERE ma_phieu IN (${placeholders})`, ids);
    
    await conn.commit();
    res.json({ success: true, message: `Đã xóa thành công ${ids.length} phiếu xuất kho.` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi xóa phiếu xuất." });
  } finally {
    conn.release();
  }
}

// ──────────────────────────────────────────────
// PUT /exports/approval/:id — Duyệt xuất kho (Admin/QL_KHO)
// ──────────────────────────────────────────────
export async function approveExport(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { status } = req.body; // status: 'DA_XUAT' | 'DA_HUY'
    const reviewerId = req.user.userId;

    if (!['DA_XUAT', 'DA_HUY'].includes(status)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Trạng thái mới không hợp lệ." });
    }

    // Kiểm tra phiếu hiện tại
    const [phieu] = await conn.query("SELECT * FROM phieu_xuat_kho WHERE ma_phieu = ?", [id]);
    if (phieu.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu xuất." });
    }

    if (phieu[0].trang_thai !== 'DA_LAP') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Phiếu này đã được xử lý trước đó." });
    }

    // Lấy chi tiết phiếu
    const [details] = await conn.query("SELECT * FROM chi_tiet_xuat_kho WHERE ma_phieu_xuat = ?", [id]);

    if (status === 'DA_XUAT') {
      // Kiểm tra lại tồn kho trước khi trừ
      for (const d of details) {
        const [inv] = await conn.query("SELECT so_luong_kho FROM ton_kho WHERE ma_thiet_bi = ?", [d.ma_thiet_bi]);
        const soLuongCoSo = d.so_luong_co_so || d.so_luong;
        if (inv.length === 0 || inv[0].so_luong_kho < soLuongCoSo) {
          await conn.rollback();
          return res.status(400).json({ 
            success: false, 
            message: `Thiết bị ${d.ma_thiet_bi} không đủ tồn kho để xuất (Hiện có: ${inv[0]?.so_luong_kho || 0}, Cần: ${soLuongCoSo}).` 
          });
        }
      }

      // Trừ tồn kho
      for (const d of details) {
        const soLuongCoSo = d.so_luong_co_so || d.so_luong;
        await conn.query(
          "UPDATE ton_kho SET so_luong_kho = so_luong_kho - ? WHERE ma_thiet_bi = ?",
          [soLuongCoSo, d.ma_thiet_bi]
        );
      }
    }

    // Cập nhật trạng thái phiếu
    await conn.query(
      "UPDATE phieu_xuat_kho SET trang_thai = ?, nguoi_duyet = ?, ngay_duyet = NOW() WHERE ma_phieu = ?",
      [status, reviewerId, id]
    );

    await conn.commit();

    // Thông báo cho người tạo phiếu
    const title = status === 'DA_XUAT' ? "Phiếu xuất đã được duyệt" : "Phiếu xuất bị hủy";
    const content = status === 'DA_XUAT' 
        ? `Phiếu xuất ${id} của bạn đã được phê duyệt.` 
        : `Phiếu xuất ${id} của bạn đã bị hủy/từ chối.`;
    const type = status === 'DA_XUAT' ? 'success' : 'error';
    
    await sendNotification(phieu[0].ma_nguoi_xuat, title, content, type);

    res.json({ success: true, message: status === 'DA_XUAT' ? "Đã duyệt và trừ kho." : "Đã hủy phiếu xuất." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    conn.release();
  }
}
