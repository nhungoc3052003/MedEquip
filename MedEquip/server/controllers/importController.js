import { pool } from "../config/db.js";
import * as XLSX from "xlsx";
import { sendNotification, sendNotificationToRoles } from "../utils/notificationHelper.js";

// ──────────────────────────────────────────────
// GET /imports — Lịch sử nhập kho
// ──────────────────────────────────────────────
export async function getAllImports(req, res) {
  try {
    let sql = `
      SELECT DISTINCT p.*, n.ten_nha_cung_cap, u.ho_ten as ten_nhan_vien
      FROM phieu_nhap_kho p
      LEFT JOIN chi_tiet_nhap_kho c ON p.ma_phieu = c.ma_phieu_nhap
      LEFT JOIN thiet_bi t ON c.ma_thiet_bi = t.ma_thiet_bi
      LEFT JOIN nha_cung_cap n ON p.ma_nha_cung_cap = n.ma_nha_cung_cap
      LEFT JOIN nguoi_dung u ON p.ma_nguoi_nhap = u.ma_nguoi_dung
      WHERE 1=1
    `;
    const params = [];
    if (req.query.fromDate) { sql += " AND p.ngay_nhap >= ?"; params.push(req.query.fromDate); }
    if (req.query.toDate) { sql += " AND p.ngay_nhap <= ?"; params.push(req.query.toDate); }
    if (req.query.maNhaCungCap) { sql += " AND p.ma_nha_cung_cap = ?"; params.push(req.query.maNhaCungCap); }

    if (req.query.search) {
      const keyword = `%${req.query.search}%`;
      sql += ` AND (
        p.ma_phieu LIKE ? OR 
        t.ten_thiet_bi LIKE ? OR 
        n.ten_nha_cung_cap LIKE ? OR 
        u.ho_ten LIKE ?
      )`;
      params.push(keyword, keyword, keyword, keyword);
    }

    // Sort DESC (newest first)
    sql += " ORDER BY p.ngay_nhap DESC, p.ma_phieu DESC";
    const [rows] = await pool.query(sql, params);

    const result = [];
    for (const row of rows) {
      const [details] = await pool.query(
        `SELECT c.*, COALESCE(t.ten_thiet_bi, c.ma_thiet_bi) as ten_thiet_bi, t.don_vi_co_so
         FROM chi_tiet_nhap_kho c
         LEFT JOIN thiet_bi t ON c.ma_thiet_bi = t.ma_thiet_bi
         WHERE c.ma_phieu_nhap = ?`,
        [row.ma_phieu]
      );
      for (const d of details) {
        result.push({
          maPhieu: row.ma_phieu,
          maNhaCungCap: row.ma_nha_cung_cap,
          tenNhaCungCap: row.ten_nha_cung_cap || "",
          maNhanVienKho: row.ma_nguoi_nhap,
          tenNhanVienKho: row.ten_nhan_vien || "",
          ngayNhap: row.ngay_nhap,
          ghiChu: row.ghi_chu || "",
          maThietBi: d.ma_thiet_bi,
          tenThietBi: d.ten_thiet_bi || d.ma_thiet_bi,
          soLuongNhap: d.so_luong_giao_dich || d.so_luong_co_so || 0,
          donViTinh: d.don_vi_giao_dich || "Cái",
          donViCoSo: d.don_vi_co_so || "Cái",
          soLuongCoSo: d.so_luong_co_so || 0,
          donGia: d.don_gia || 0,
          soLo: d.so_lo || "",
          hanSuDung: d.han_su_dung || null,
          urlAnh: d.url_anh || "",
          trangThai: row.trang_thai || "DA_DUYET",
          nguoiDuyet: row.nguoi_duyet || "",
          lyDoTuChoi: row.ly_do_tu_choi || "",
          ngayDuyet: row.ngay_duyet || null,
          hinhAnhMinhChung: row.chung_tu_dinh_kem || null,
        });
      }
      if (details.length === 0) {
        result.push({
          maPhieu: row.ma_phieu,
          maNhaCungCap: row.ma_nha_cung_cap,
          tenNhaCungCap: row.ten_nha_cung_cap || "",
          maNhanVienKho: row.ma_nguoi_nhap,
          tenNhanVienKho: row.ten_nhan_vien || "",
          ngayNhap: row.ngay_nhap,
          ghiChu: row.ghi_chu || "",
          maThietBi: "", tenThietBi: "", soLuongNhap: 0,
          trangThai: row.trang_thai || "DA_DUYET",
          hinhAnhMinhChung: row.chung_tu_dinh_kem || null,
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
// POST /imports/from-excel — Parse file Excel, trả về preview (KHÔNG ghi DB)
// ──────────────────────────────────────────────
export async function parseExcelPreview(req, res) {
  try {
    if (!req.file) return res.json({ success: false, message: "Vui lòng chọn file Excel (.xlsx)" });

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.json({ success: false, message: "File Excel không có sheet nào hợp lệ." });
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    console.log(`[DEBUG] Parsing Excel. Rows found: ${rows.length}`);
    if (rows.length > 0) {
      console.log("[DEBUG] First row keys:", Object.keys(rows[0]));
    }

    if (rows.length === 0) {
      return res.json({ success: false, message: "File Excel không có dữ liệu (Row count = 0)." });
    }

    // Lấy danh sách NCC để validate
    const [nccList] = await pool.query("SELECT ma_nha_cung_cap FROM nha_cung_cap WHERE trang_thai = TRUE");
    const nccSet = new Set(nccList.map(n => n.ma_nha_cung_cap));

    // Lấy danh sách thiết bị hiện có
    const [tbList] = await pool.query("SELECT ma_thiet_bi, ten_thiet_bi FROM thiet_bi");
    const tbMap = {};
    for (const tb of tbList) tbMap[tb.ma_thiet_bi] = tb.ten_thiet_bi;

    const preview = rows.map((row, idx) => {
      const errors = [];
      const maThietBi = String(row.ma_thiet_bi || "").trim();
      const tenThietBi = String(row.ten_thiet_bi || "").trim();
      const loai = String(row.loai || "").trim();
      const soLuong = parseInt(row.so_luong) || 0;
      const donViNhap = String(row.don_vi_nhap || row.don_vi_tinh || "Cái").trim();
      const donViNhapLower = donViNhap.toLowerCase();
      
      // Mặc định đơn vị cơ sở nếu không có trong Excel
      let donViCoSo = String(row.don_vi_co_so || "").trim();
      let heSoQuyDoi = parseInt(row.he_so_quy_doi) || 1;

      if (!donViCoSo) {
        if (donViNhapLower === 'thùng' || donViNhapLower === 'hộp') {
          donViCoSo = 'Cái'; // Mặc định là Cái nếu nhập Thùng/Hộp mà không ghi đơn vị cơ sở
        } else {
          donViCoSo = donViNhap; // Các loại khác (Chai, Bình, Bộ, Cái) thì giữ nguyên
        }
      }

      const donViCoSoLower = donViCoSo.toLowerCase();

      // Nếu đơn vị nhập trùng khớp với đơn vị cơ sở (VD: Chai -> Chai, Bình -> Bình, Bộ -> Bộ, Cái -> Cái)
      // thì ép cứng hệ số quy đổi = 1 trừ khi là Thùng/Hộp (thường Thùng -> Cái vẫn có thể là 1:1 nếu user muốn, nhưng ưu tiên user nhập)
      if (donViNhapLower === donViCoSoLower && 
          ['bình', 'chai', 'bộ', 'cái'].includes(donViNhapLower)) {
        heSoQuyDoi = 1;
      }

      const donGia = parseFloat(row.don_gia) || 0;
      const soLo = String(row.so_lo || "").trim();
      const hanSuDung = String(row.han_su_dung || "").trim();
      const serialNumber = String(row.serial_number || "").trim();
      const maNcc = String(row.ma_ncc || "").trim();
      const nguongCanhBao = parseInt(row.nguong_canh_bao) || 10;
      const urlAnh = String(row.url_anh || "").trim();
      const ghiChu = String(row.ghi_chu || "").trim();

      if (!maThietBi) errors.push("Thiếu mã thiết bị");
      if (!tenThietBi) errors.push("Thiếu tên thiết bị");
      if (!["VAT_TU_TIEU_HAO", "TAI_SU_DUNG"].includes(loai)) errors.push("Loại phải là VAT_TU_TIEU_HAO hoặc TAI_SU_DUNG");
      if (soLuong <= 0) errors.push("Số lượng phải > 0");
      if (!donViNhap) errors.push("Thiếu đơn vị nhập");
      if (!maNcc) errors.push("Thiếu mã NCC");
      if (maNcc && !nccSet.has(maNcc)) errors.push(`Nhà cung cấp "${maNcc}" không tồn tại trong hệ thống`);
      if (loai === "VAT_TU_TIEU_HAO") {
        if (!soLo) errors.push("Vật tư tiêu hao cần có số lô");
        if (!hanSuDung) errors.push("Vật tư tiêu hao cần có hạn sử dụng");
      }

      const isNew = maThietBi && !tbMap[maThietBi];
      const action = isNew ? "CREATE" : "UPDATE";

      return {
        rowIndex: idx + 2, // Dòng trong Excel (1-indexed, header ở dòng 1)
        maThietBi, tenThietBi, loai, soLuong, donViCoSo, donViNhap, heSoQuyDoi,
        donGia, soLo, hanSuDung, serialNumber, maNcc, nguongCanhBao,
        urlAnh, ghiChu,
        action, // CREATE (mới) | UPDATE (cộng thêm)
        errors,
        hasError: errors.length > 0
      };
    });

    const totalErrors = preview.filter(r => r.hasError).length;
    res.json({
      success: true,
      preview,
      summary: {
        total: preview.length,
        errors: totalErrors,
        valid: preview.length - totalErrors,
        willCreate: preview.filter(r => !r.hasError && r.action === "CREATE").length,
        willUpdate: preview.filter(r => !r.hasError && r.action === "UPDATE").length,
      }
    });
  } catch (err) {
    console.error("DEBUG: Error in parseExcelPreview:", err);
    res.status(500).json({ success: false, message: "Lỗi đọc file Excel: " + err.message });
  }
}

// ──────────────────────────────────────────────
// POST /imports/confirm — Xác nhận nhập kho từ preview (UPSERT vào DB)
// ──────────────────────────────────────────────
export async function confirmImportFromExcel(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { rows, maNhaCungCap, hinhAnhMinhChung } = req.body || {};
    if (!rows || !Array.isArray(rows)) {
      try { await conn.rollback(); } catch (e) {}
      return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
    }
    // rows: mảng từ preview, chỉ lấy các row không có lỗi
    const validRows = rows.filter(r => !r.hasError);
    if (validRows.length === 0) {
      try { await conn.rollback(); } catch (e) {}
      return res.json({ success: false, message: "Không có dòng hợp lệ để nhập." });
    }

    const userId = req.user.userId;
    const phieuId = "NK-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
    const autoApprove = (req.user.vaiTro === 'ADMIN' || req.user.vaiTro === 'QL_KHO');
    const trangThai = autoApprove ? 'DA_DUYET' : 'CHO_DUYET';

    // Nếu frontend không gửi maNhaCungCap, lấy từ dòng đầu tiên hợp lệ
    const nccId = maNhaCungCap || (validRows.length > 0 ? validRows[0].maNcc : null);

    // Tính toán tổng hợp
    const tongSoLoai = validRows.length;
    let tongSoLuong = 0;
    let tongGiaTri = 0;
    for (const row of validRows) {
      tongSoLuong += (row.soLuong * (row.heSoQuyDoi || 1));
      tongGiaTri += (row.soLuong * (row.donGia || 0));
    }

    // Tạo phiếu nhập kho
    await conn.query(
      "INSERT INTO phieu_nhap_kho (ma_phieu, ma_nguoi_nhap, ma_nha_cung_cap, ngay_nhap, ghi_chu, trang_thai, tong_so_loai, tong_so_luong, tong_gia_tri, chung_tu_dinh_kem) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)",
      [phieuId, userId, nccId, `Nhập kho từ Excel (${validRows.length} dòng)`, trangThai, tongSoLoai, tongSoLuong, tongGiaTri, hinhAnhMinhChung || null]
    );

    // Lấy tên người gửi (phòng trường hợp token cũ không có hoTen)
    let senderName = req.user.hoTen || "Nhân viên";
    if (!req.user.hoTen) {
      const [uRows] = await conn.query("SELECT ho_ten FROM nguoi_dung WHERE ma_nguoi_dung = ?", [userId]);
      if (uRows.length > 0) senderName = uRows[0].ho_ten;
    }

    // Thông báo
    if (autoApprove) {
      await sendNotification(userId, "Nhập kho thành công", `Phiếu nhập ${phieuId} đã được tạo và tự động duyệt.`, 'success');
    } else {
      await sendNotificationToRoles(['ADMIN', 'QL_KHO'], "Yêu cầu nhập kho mới", `Nhân viên ${senderName} đã tạo phiếu nhập ${phieuId} chờ phê duyệt.`, 'info');
    }

    // Xử lý từng dòng dữ liệu Excel
    for (const row of validRows) {
      const { maThietBi, tenThietBi, loai, soLuong, donViCoSo, donViNhap, heSoQuyDoi,
        donGia, soLo, hanSuDung, serialNumber, maNcc, nguongCanhBao, urlAnh } = row;

      const soLuongCoSo = soLuong * heSoQuyDoi;

      // 1. Luôn đảm bảo thiết bị tồn tại trong danh mục (UPSERT thiet_bi)
      const [existing] = await conn.query("SELECT ma_thiet_bi FROM thiet_bi WHERE ma_thiet_bi = ?", [maThietBi]);
      if (existing.length === 0) {
        // INSERT thiết bị mới
        await conn.query(
          `INSERT INTO thiet_bi (ma_thiet_bi, ten_thiet_bi, loai_thiet_bi, don_vi_co_so, don_vi_nhap, he_so_quy_doi,
           ma_nha_cung_cap, hinh_anh, trang_thai)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [maThietBi, tenThietBi, loai, donViCoSo, donViNhap, heSoQuyDoi, maNcc, urlAnh || ""]
        );
        // Tạo bản ghi tồn kho trống nếu chưa có
        const tkId = "TK-" + maThietBi;
        await conn.query(
          "INSERT IGNORE INTO ton_kho (ma_ton_kho, ma_thiet_bi, so_luong_kho, so_luong_hu, so_luong_dang_dung) VALUES (?, ?, 0, 0, 0)",
          [tkId, maThietBi]
        );
      } else if (urlAnh) {
        // Cập nhật thông tin bổ sung nếu cần
        await conn.query("UPDATE thiet_bi SET hinh_anh = ? WHERE ma_thiet_bi = ? AND (hinh_anh IS NULL OR hinh_anh = '')", [urlAnh, maThietBi]);
      }

      // 2. Nếu được tự động duyệt, cập nhật số lượng tồn kho ngay lập tức
      if (autoApprove) {
        await conn.query(
          "UPDATE ton_kho SET so_luong_kho = so_luong_kho + ? WHERE ma_thiet_bi = ?",
          [soLuongCoSo, maThietBi]
        );
      }

      // 3. Xử lý định dạng ngày hạn sử dụng
      let hanSuDungDate = null;
      if (hanSuDung) {
        const parts = hanSuDung.split("/");
        if (parts.length === 3) hanSuDungDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        else hanSuDungDate = hanSuDung;
      }

      // 4. Ghi chi tiết phiếu nhập (Lúc này chắc chắn maThietBi đã tồn tại trong thiet_bi)
      await conn.query(
        `INSERT INTO chi_tiet_nhap_kho
         (ma_phieu_nhap, ma_thiet_bi, so_luong_giao_dich, so_luong_co_so, don_gia, don_vi_giao_dich, so_lo, han_su_dung)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [phieuId, maThietBi, soLuong, soLuongCoSo, donGia, donViNhap, soLo || null, hanSuDungDate]
      );
    }

    await conn.commit();
    res.json({
      success: true,
      message: autoApprove
        ? `Đã nhập kho thành công ${validRows.length} dòng. Mã phiếu: ${phieuId}`
        : `Đã gửi yêu cầu nhập kho (${validRows.length} dòng). Chờ Admin/Quản lý kho phê duyệt. Mã phiếu: ${phieuId}`,
      maPhieu: phieuId,
      trangThai
    });
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (e) { console.error("Rollback error:", e); }
    }
    console.error("DEBUG: Error in confirmImportFromExcel:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
    }
  } finally {
    if (conn) {
      try { conn.release(); } catch (e) { console.error("Release error:", e); }
    }
  }
}

// ──────────────────────────────────────────────
// GET /imports/template — Tải file Excel mẫu
// ──────────────────────────────────────────────
export async function downloadTemplate(req, res) {
  try {
    const wb = XLSX.utils.book_new();
    const headers = [
      "ma_thiet_bi", "ten_thiet_bi", "loai", "so_luong", "don_vi_co_so", "don_vi_nhap",
      "he_so_quy_doi", "don_gia", "so_lo", "han_su_dung", "serial_number",
      "ma_ncc", "nguong_canh_bao", "url_anh", "ghi_chu"
    ];
    const huongDan = [
      "Mã thiết bị (bắt buộc, VD: TB-001)",
      "Tên thiết bị (bắt buộc)",
      "TAI_SU_DUNG hoặc VAT_TU_TIEU_HAO",
      "Số lượng nhập (bắt buộc, > 0)",
      "Đơn vị cơ sở (VD: Cái)",
      "Đơn vị nhập (VD: Thùng, Hộp)",
      "Hệ số quy đổi (1 Đơn vị nhập = N Cơ sở, VD: 50)",
      "Đơn giá (VND)",
      "Số lô (bắt buộc với VTTH)",
      "Hạn sử dụng DD/MM/YYYY (bắt buộc với VTTH)",
      "Số serial (chỉ cho TAI_SU_DUNG)",
      "Mã nhà cung cấp (bắt buộc, VD: NCC-001)",
      "Ngưỡng cảnh báo tồn kho (mặc định 10)",
      "URL hình ảnh (không bắt buộc)",
      "Ghi chú (không bắt buộc)"
    ];
    const example = [
      "TB-001", "Máy đo huyết áp", "TAI_SU_DUNG", 5, "Cái", "Hộp",
      1, 2500000, "", "", "SN-001",
      "NCC-001", 2, "https://example.com/image.jpg", "Thiết bị tái sử dụng"
    ];
    const example2 = [
      "VT-001", "Kim tiêm 5ml", "VAT_TU_TIEU_HAO", 20, "Cái", "Thùng",
      1000, 120000, "LOT-2026-001", "31/12/2028", "",
      "NCC-002", 5, "https://example.com/needle.jpg", "1 thùng = 1000 cái"
    ];

    // Dòng 1: headers, Dòng 2: hướng dẫn, Dòng 3-4: ví dụ thực tế
    const ws = XLSX.utils.aoa_to_sheet([headers, huongDan, example, example2]);

    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 22 }));

    XLSX.utils.book_append_sheet(wb, ws, "Nhập kho");

    // Dùng type:"array" để tránh bug ESM của xlsx@0.18.x
    const arrayBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const finalBuffer = Buffer.from(new Uint8Array(arrayBuf));

    console.log(`[DEBUG] Template generated. Size: ${finalBuffer.length} bytes`);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=template_nhap_kho.xlsx");
    res.setHeader("Content-Length", finalBuffer.length);
    res.setHeader("X-Content-Type-Options", "nosniff");

    return res.status(200).send(finalBuffer);
  } catch (err) {
    console.error("[ERROR] downloadTemplate:", err);
    return res.status(500).json({ success: false, message: "Lỗi tạo file mẫu: " + err.message });
  }
}

// ──────────────────────────────────────────────
// DELETE /imports/:id — Xóa lịch sử nhập kho (Admin)
// ──────────────────────────────────────────────
export async function deleteImport(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;

    // 1. Kiểm tra trạng thái phiếu
    const [phieu] = await conn.query("SELECT trang_thai FROM phieu_nhap_kho WHERE ma_phieu = ?", [id]);

    await conn.query("DELETE FROM chi_tiet_nhap_kho WHERE ma_phieu_nhap = ?", [id]);
    await conn.query("DELETE FROM phieu_nhap_kho WHERE ma_phieu = ?", [id]);
    await conn.commit();
    res.json({ success: true, message: "Đã xóa lịch sử nhập kho." });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    try { conn.release(); } catch (e) {}
  }
}

// ──────────────────────────────────────────────
// POST /imports/delete-multiple — Xóa nhiều phiếu nhập kho (Admin/QL_KHO)
// ──────────────────────────────────────────────
export async function deleteMultipleImports(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      try { await conn.rollback(); } catch (e) {}
      return res.status(400).json({ success: false, message: "Danh sách ID không hợp lệ." });
    }

    for (const id of ids) {
      const [phieu] = await conn.query("SELECT trang_thai FROM phieu_nhap_kho WHERE ma_phieu = ?", [id]);
      await conn.query("DELETE FROM chi_tiet_nhap_kho WHERE ma_phieu_nhap = ?", [id]);
      await conn.query("DELETE FROM phieu_nhap_kho WHERE ma_phieu = ?", [id]);
    }

    await conn.commit();
    res.json({ success: true, message: `Đã xóa ${ids.length} phiếu nhập kho.` });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    try { conn.release(); } catch (e) {}
  }
}

// ──────────────────────────────────────────────
// PUT /imports/approval/:id — Duyệt nhập kho (Admin/QL_KHO)
// ──────────────────────────────────────────────
export async function approveImport(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { status, lyDoTuChoi } = req.body; // status: 'DA_DUYET' | 'TU_CHOI'
    const reviewerId = req.user.userId;

    if (!['DA_DUYET', 'TU_CHOI'].includes(status)) {
      try { await conn.rollback(); } catch (e) {}
      return res.status(400).json({ success: false, message: "Trạng thái mới không hợp lệ." });
    }

    // Kiểm tra phiếu hiện tại
    const [phieu] = await conn.query("SELECT * FROM phieu_nhap_kho WHERE ma_phieu = ?", [id]);
    if (phieu.length === 0) {
      try { await conn.rollback(); } catch (e) {}
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu nhập." });
    }

    if (phieu[0].trang_thai !== 'CHO_DUYET') {
      try { await conn.rollback(); } catch (e) {}
      return res.status(400).json({ success: false, message: "Phiếu này đã được xử lý trước đó." });
    }

    // Cập nhật trạng thái phiếu
    await conn.query(
      "UPDATE phieu_nhap_kho SET trang_thai = ?, nguoi_duyet = ?, ngay_duyet = NOW(), ly_do_tu_choi = ? WHERE ma_phieu = ?",
      [status, reviewerId, lyDoTuChoi || null, id]
    );

    if (status === 'DA_DUYET') {
      // Lấy chi tiết phiếu để cập nhật tồn kho
      const [details] = await conn.query("SELECT * FROM chi_tiet_nhap_kho WHERE ma_phieu_nhap = ?", [id]);
      for (const d of details) {
        // Cập nhật hoặc tạo mới tồn kho
        const [existing] = await conn.query("SELECT ma_ton_kho FROM ton_kho WHERE ma_thiet_bi = ?", [d.ma_thiet_bi]);
        if (existing.length === 0) {
          const tkId = "TK-" + d.ma_thiet_bi;
          await conn.query(
            "INSERT INTO ton_kho (ma_ton_kho, ma_thiet_bi, so_luong_kho, so_luong_hu, so_luong_dang_dung) VALUES (?, ?, ?, 0, 0)",
            [tkId, d.ma_thiet_bi, d.so_luong_co_so]
          );
        } else {
          await conn.query(
            "UPDATE ton_kho SET so_luong_kho = so_luong_kho + ? WHERE ma_thiet_bi = ?",
            [d.so_luong_co_so, d.ma_thiet_bi]
          );
        }
      }
    }

    await conn.commit();

    // Thông báo cho người tạo phiếu
    const title = status === 'DA_DUYET' ? "Phiếu nhập đã được duyệt" : "Phiếu nhập bị từ chối";
    const content = status === 'DA_DUYET'
      ? `Phiếu nhập ${id} của bạn đã được phê duyệt.`
      : `Phiếu nhập ${id} của bạn đã bị từ chối. Lý do: ${lyDoTuChoi || 'Không có'}`;
    const type = status === 'DA_DUYET' ? 'success' : 'error';

    await sendNotification(phieu[0].ma_nguoi_nhap, title, content, type);

    res.json({ success: true, message: status === 'DA_DUYET' ? "Đã duyệt và cập nhật kho." : "Đã từ chối phiếu nhập." });
  } catch (err) {
    try { await conn.rollback(); } catch (e) {}
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    try { conn.release(); } catch (e) {}
  }
}
