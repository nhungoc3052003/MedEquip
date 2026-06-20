import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { mapUser } from "./authController.js";

export async function getAllUsers(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM nguoi_dung ORDER BY ngay_tao DESC");
    res.json(rows.map(mapUser));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function getUserById(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM nguoi_dung WHERE ma_nguoi_dung = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "Không tìm thấy người dùng." });
    res.json(mapUser(rows[0]));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createUser(req, res) {
  try {
    const { hoTen, email, matKhau, vaiTro, maKhoa, soDienThoai, diaChi } = req.body;

    const [existing] = await pool.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE email = ?", [email]);
    if (existing.length > 0) return res.json({ success: false, message: "Email đã tồn tại và yêu cầu nhập email khác." });

    const hash = await bcrypt.hash(matKhau, 10);
    const id = "ND-" + String(Date.now()).slice(-6);

    await pool.query(
      "INSERT INTO nguoi_dung (ma_nguoi_dung, ho_ten, email, mat_khau, vai_tro, ma_khoa, trang_thai, so_dien_thoai, dia_chi) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?, ?)",
      [id, hoTen, email, hash, vaiTro, maKhoa || null, soDienThoai || null, diaChi || null]
    );

    const [rows] = await pool.query("SELECT * FROM nguoi_dung WHERE ma_nguoi_dung = ?", [id]);
    res.json({ success: true, user: mapUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function updateUser(req, res) {
  try {
    const updates = req.body;
    const fields = [];
    const values = [];

    if (updates.hoTen) { fields.push("ho_ten = ?"); values.push(updates.hoTen); }
    if (updates.email) {
      const [existing] = await pool.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE email = ? AND ma_nguoi_dung != ?", [updates.email, req.params.id]);
      if (existing.length > 0) return res.json({ success: false, message: "Email đã tồn tại và yêu cầu nhập email khác." });
      fields.push("email = ?"); values.push(updates.email);
    }
    if (updates.soDienThoai !== undefined) { fields.push("so_dien_thoai = ?"); values.push(updates.soDienThoai); }
    if (updates.diaChi !== undefined) { fields.push("dia_chi = ?"); values.push(updates.diaChi); }
    if (updates.vaiTro) { fields.push("vai_tro = ?"); values.push(updates.vaiTro); }
    if (updates.maKhoa !== undefined) { fields.push("ma_khoa = ?"); values.push(updates.maKhoa || null); }
    if (typeof updates.trangThai === "boolean") { fields.push("trang_thai = ?"); values.push(updates.trangThai); }

    if (fields.length === 0) return res.json({ success: true });

    values.push(req.params.id);
    await pool.query(`UPDATE nguoi_dung SET ${fields.join(", ")} WHERE ma_nguoi_dung = ?`, values);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function deactivateUser(req, res) {
  try {
    await pool.query("UPDATE nguoi_dung SET trang_thai = FALSE WHERE ma_nguoi_dung = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function activateUser(req, res) {
  try {
    await pool.query("UPDATE nguoi_dung SET trang_thai = TRUE WHERE ma_nguoi_dung = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function changeUserRole(req, res) {
  try {
    await pool.query("UPDATE nguoi_dung SET vai_tro = ? WHERE ma_nguoi_dung = ?", [req.body.vaiTro, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function deleteUser(req, res) {
  try {
    const requesterId = req.user?.userId;
    if (requesterId === req.params.id) {
      return res.json({ success: false, message: "Không thể xóa tài khoản của chính mình." });
    }
    const [rows] = await pool.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE ma_nguoi_dung = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    await pool.query("DELETE FROM nguoi_dung WHERE ma_nguoi_dung = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
