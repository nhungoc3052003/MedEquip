import { pool } from "../config/db.js";

function mapEquipment(row) {
  return {
    maThietBi: row.ma_thiet_bi,
    tenThietBi: row.ten_thiet_bi,
    loaiThietBi: row.loai_thiet_bi,
    donViCoSo: row.don_vi_co_so,
    donViNhap: row.don_vi_nhap,
    heSoQuyDoi: row.he_so_quy_doi || 1,
    serialNumber: row.serial_number || "",
    nguongCanhBao: row.nguong_canh_bao || 10,
    moTa: row.mo_ta || "",
    maNhaCungCap: row.ma_nha_cung_cap || "",
    hinhAnh: row.hinh_anh || "",
    trangThai: !!row.trang_thai,
    ngayTao: row.ngay_tao
  };
}

export async function getAllEquipment(req, res) {
  try {
    let sql = `
      SELECT tb.*, tk.so_luong_kho
      FROM thiet_bi tb
      LEFT JOIN ton_kho tk ON tb.ma_thiet_bi = tk.ma_thiet_bi
      WHERE tb.trang_thai = TRUE
    `;
    const params = [];

    // Filter by loai
    if (req.query.loai && ["VAT_TU_TIEU_HAO", "TAI_SU_DUNG"].includes(req.query.loai)) {
      sql += " AND tb.loai_thiet_bi = ?";
      params.push(req.query.loai);
    }

    // Sort
    const sortMap = {
      ton_kho_asc: "tk.so_luong_kho ASC",
      ton_kho_desc: "tk.so_luong_kho DESC",
      ngay_nhap_asc: "tb.ngay_tao ASC",
      ngay_nhap_desc: "tb.ngay_tao DESC",
    };
    const sortKey = sortMap[req.query.sort] || "tb.ngay_tao DESC";
    sql += ` ORDER BY ${sortKey}`;

    const [rows] = await pool.query(sql, params);
    res.json(rows.map(mapEquipment));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createEquipment(req, res) {
  try {
    const { tenThietBi, loaiThietBi, donViCoSo, donViNhap, heSoQuyDoi, serialNumber, nguongCanhBao, moTa, maNhaCungCap, hinhAnh } = req.body;

    if (!tenThietBi || !loaiThietBi) {
      return res.json({ success: false, message: "Tên thiết bị và loại là bắt buộc." });
    }

    const [existing] = await pool.query("SELECT ma_thiet_bi FROM thiet_bi WHERE ten_thiet_bi = ?", [tenThietBi]);
    if (existing.length > 0) return res.json({ success: false, message: "Thiết bị đã tồn tại." });

    const id = "TB-" + String(Date.now()).slice(-6);
    await pool.query(
      "INSERT INTO thiet_bi (ma_thiet_bi, ten_thiet_bi, loai_thiet_bi, don_vi_co_so, don_vi_nhap, he_so_quy_doi, serial_number, nguong_canh_bao, mo_ta, ma_nha_cung_cap, hinh_anh, trang_thai) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)",
      [id, tenThietBi, loaiThietBi || "TAI_SU_DUNG", donViCoSo || "Cái", donViNhap || "Hộp", heSoQuyDoi || 1,
       loaiThietBi === "TAI_SU_DUNG" ? (serialNumber || null) : null,
       nguongCanhBao || 10, moTa || "", maNhaCungCap || null, hinhAnh || ""]
    );

    const tkId = "TK-" + String(Date.now()).slice(-6);
    await pool.query(
      "INSERT INTO ton_kho (ma_ton_kho, ma_thiet_bi, so_luong_kho, so_luong_hu, so_luong_dang_dung) VALUES (?, ?, 0, 0, 0)",
      [tkId, id]
    );

    const [rows] = await pool.query("SELECT tb.*, tk.so_luong_kho FROM thiet_bi tb LEFT JOIN ton_kho tk ON tb.ma_thiet_bi = tk.ma_thiet_bi WHERE tb.ma_thiet_bi = ?", [id]);
    res.json({ success: true, equipment: mapEquipment(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function deleteEquipment(req, res) {
  try {
    const id = req.params.id;
    const [inv] = await pool.query("SELECT * FROM ton_kho WHERE ma_thiet_bi = ?", [id]);
    if (inv.length > 0 && (inv[0].so_luong_kho > 0 || inv[0].so_luong_hu > 0 || inv[0].so_luong_dang_dung > 0)) {
      return res.json({ success: false, message: "Không thể xóa thiết bị đang có số lượng tồn kho hoặc đang sử dụng." });
    }

    // Soft-delete: cập nhật trang_thai = FALSE
    await pool.query("UPDATE thiet_bi SET trang_thai = FALSE WHERE ma_thiet_bi = ?", [id]);
    await pool.query("DELETE FROM ton_kho WHERE ma_thiet_bi = ?", [id]);

    res.json({ success: true, message: "Đã xóa thiết bị." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function updateEquipment(req, res) {
  try {
    const { tenThietBi, loaiThietBi, donViCoSo, donViNhap, heSoQuyDoi, serialNumber, nguongCanhBao, moTa, maNhaCungCap, hinhAnh, trangThai } = req.body;
    const id = req.params.id;

    const [existing] = await pool.query("SELECT * FROM thiet_bi WHERE ma_thiet_bi = ?", [id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy thiết bị." });

    const newTrangThai = trangThai !== undefined ? trangThai : existing[0].trang_thai;
    const newSerial = loaiThietBi === "TAI_SU_DUNG" ? (serialNumber || null) : null;

    await pool.query(
      "UPDATE thiet_bi SET ten_thiet_bi=?, loai_thiet_bi=?, don_vi_co_so=?, don_vi_nhap=?, he_so_quy_doi=?, serial_number=?, nguong_canh_bao=?, mo_ta=?, ma_nha_cung_cap=?, hinh_anh=?, trang_thai=? WHERE ma_thiet_bi=?",
      [tenThietBi, loaiThietBi || "TAI_SU_DUNG", donViCoSo || "Cái", donViNhap || "Hộp", heSoQuyDoi || 1,
       newSerial, nguongCanhBao || 10, moTa || "", maNhaCungCap || null, hinhAnh || "", newTrangThai, id]
    );

    const [rows] = await pool.query("SELECT tb.*, tk.so_luong_kho FROM thiet_bi tb LEFT JOIN ton_kho tk ON tb.ma_thiet_bi = tk.ma_thiet_bi WHERE tb.ma_thiet_bi = ?", [id]);
    res.json({ success: true, equipment: mapEquipment(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
