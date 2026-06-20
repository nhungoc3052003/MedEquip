import { pool } from "../config/db.js";

function mapSupplier(row) {
  return {
    maNhaCungCap: row.ma_nha_cung_cap,
    tenNhaCungCap: row.ten_nha_cung_cap,
    diaChi: row.dia_chi || "",
    soDienThoai: row.so_dien_thoai || "",
    email: row.email || "",
    trangThai: !!row.trang_thai
  };
}

export async function getAllSuppliers(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM nha_cung_cap ORDER BY ngay_tao DESC");
    res.json(rows.map(mapSupplier));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createSupplier(req, res) {
  try {
    const { tenNhaCungCap, diaChi, soDienThoai, email } = req.body;
    
    if (!tenNhaCungCap) return res.json({ success: false, message: "Tên nhà cung cấp là bắt buộc." });
    
    // Kiểm tra Số điện thoại: chỉ số, 10-11 ký tự
    if (soDienThoai) {
      if (!/^\d{10,11}$/.test(soDienThoai)) {
        return res.json({ success: false, message: "Số điện thoại phải là chữ số và có độ dài từ 10-11 số." });
      }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ success: false, message: "Email không hợp lệ." });

    const [dupName] = await pool.query("SELECT ma_nha_cung_cap FROM nha_cung_cap WHERE ten_nha_cung_cap = ?", [tenNhaCungCap]);
    if (dupName.length > 0) return res.json({ success: false, message: "Tên nhà cung cấp đã tồn tại." });

    const id = "NCC-" + String(Date.now()).slice(-6);
    await pool.query(
      "INSERT INTO nha_cung_cap (ma_nha_cung_cap, ten_nha_cung_cap, dia_chi, so_dien_thoai, email, trang_thai) VALUES (?, ?, ?, ?, ?, TRUE)",
      [id, tenNhaCungCap, diaChi || "", soDienThoai || "", email || ""]
    );
    const [rows] = await pool.query("SELECT * FROM nha_cung_cap WHERE ma_nha_cung_cap = ?", [id]);
    res.json({ success: true, supplier: mapSupplier(rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function updateSupplier(req, res) {
  try {
    const { tenNhaCungCap, diaChi, soDienThoai, email, trangThai } = req.body;
    const id = req.params.id;

    if (!tenNhaCungCap) return res.json({ success: false, message: "Tên nhà cung cấp là bắt buộc." });
    
    // Kiểm tra Số điện thoại: chỉ số, 10-11 ký tự
    if (soDienThoai) {
      if (!/^\d{10,11}$/.test(soDienThoai)) {
        return res.json({ success: false, message: "Số điện thoại phải là chữ số và có độ dài từ 10-11 số." });
      }
    }

    const [dupName] = await pool.query("SELECT ma_nha_cung_cap FROM nha_cung_cap WHERE ten_nha_cung_cap = ? AND ma_nha_cung_cap != ?", [tenNhaCungCap, id]);
    if (dupName.length > 0) return res.json({ success: false, message: "Tên nhà cung cấp đã tồn tại." });

    const t = trangThai !== undefined ? trangThai : true;
    await pool.query(
      "UPDATE nha_cung_cap SET ten_nha_cung_cap = ?, dia_chi = ?, so_dien_thoai = ?, email = ?, trang_thai = ? WHERE ma_nha_cung_cap = ?",
      [tenNhaCungCap, diaChi, soDienThoai, email, t, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function deleteSupplier(req, res) {
  try {
    const { id } = req.params;
    
    // Kiểm tra xem có bất kỳ thiết bị nào liên kết không (kể cả thiết bị đã ngừng hoạt động)
    const [equipment] = await pool.query("SELECT ma_thiet_bi FROM thiet_bi WHERE ma_nha_cung_cap = ?", [id]);
    if (equipment.length > 0) {
      return res.json({ 
        success: false, 
        message: `Không thể xóa nhà cung cấp này vì hiện đang có ${equipment.length} thiết bị liên kết trong hệ thống.` 
      });
    }

    try {
      await pool.query("DELETE FROM nha_cung_cap WHERE ma_nha_cung_cap = ?", [id]);
      res.json({ success: true, message: "Đã xóa nhà cung cấp thành công." });
    } catch (dbErr) {
      return res.json({ success: false, message: "Không thể xóa do có dữ liệu liên quan khác trong hệ thống." });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

