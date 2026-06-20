import { pool } from "../config/db.js";

function mapDept(row) {
  return {
    maKhoa: row.ma_khoa,
    tenKhoa: row.ten_khoa,
    moTa: row.mo_ta || "",
    trangThai: !!row.trang_thai
  };
}

export async function getAllDepartments(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM khoa ORDER BY CAST(SUBSTRING(ma_khoa, 3) AS UNSIGNED) ASC"
    );
    res.json(rows.map(mapDept));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createDepartment(req, res) {
  try {
    const { tenKhoa, moTa } = req.body;
    const [existing] = await pool.query("SELECT * FROM khoa WHERE ten_khoa = ?", [tenKhoa]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Tên khoa đã tồn tại." });
    }

    const id = "K-" + String(Date.now()).slice(-6);
    await pool.query(
      "INSERT INTO khoa (ma_khoa, ten_khoa, mo_ta, trang_thai) VALUES (?, ?, ?, TRUE)",
      [id, tenKhoa, moTa]
    );
    const [rows] = await pool.query("SELECT * FROM khoa WHERE ma_khoa = ?", [id]);
    res.json({ success: true, department: mapDept(rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function updateDepartment(req, res) {
  try {
    const { tenKhoa, moTa, trangThai } = req.body;
    const id = req.params.id;

    const [existing] = await pool.query("SELECT * FROM khoa WHERE ten_khoa = ? AND ma_khoa != ?", [tenKhoa, id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Tên khoa bị trùng lặp." });
    }

    if (trangThai === false) {
      const [allocations] = await pool.query("SELECT * FROM phieu_cap_phat WHERE ma_khoa_nhan = ?", [id]);
      if (allocations.length > 0) {
        return res.status(400).json({ success: false, message: "Không thể ngừng hoạt động khoa khi có thiết bị đang sử dụng." });
      }
    }

    const t = trangThai !== undefined ? trangThai : true;
    await pool.query("UPDATE khoa SET ten_khoa = ?, mo_ta = ?, trang_thai = ? WHERE ma_khoa = ?", [tenKhoa, moTa, t, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function deleteDepartment(req, res) {
  try {
    const id = req.params.id;
    const [existing] = await pool.query("SELECT ma_khoa FROM khoa WHERE ma_khoa = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy khoa." });
    }

    // Check if any allocations exist for this department (active usage)
    const [allocations] = await pool.query("SELECT * FROM phieu_cap_phat WHERE ma_khoa_nhan = ?", [id]);
    if (allocations.length > 0) {
      return res.status(400).json({ success: false, message: "Không thể xóa khoa khi có thiết bị đang sử dụng." });
    }

    try {
      await pool.query("DELETE FROM khoa WHERE ma_khoa = ?", [id]);
      return res.json({ success: true, message: "Đã xóa khoa." });
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        await pool.query("UPDATE khoa SET trang_thai = FALSE WHERE ma_khoa = ?", [id]);
        return res.json({ success: true, message: "Khoa đang có dữ liệu liên quan nên đã bị vô hiệu hóa." });
      }
      throw err;
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
