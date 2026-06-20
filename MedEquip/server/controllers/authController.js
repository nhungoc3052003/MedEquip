import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { generateToken } from "../middleware/auth.js";

export function mapUser(row) {
  return {
    maNguoiDung: row.ma_nguoi_dung,
    hoTen: row.ho_ten,
    email: row.email,
    vaiTro: row.vai_tro,
    trangThai: !!row.trang_thai,
    ngayTao: row.ngay_tao,
    ngayCapNhat: row.ngay_cap_nhat,
    soDienThoai: row.so_dien_thoai || "",
    diaChi: row.dia_chi || "",
    maKhoa: row.ma_khoa || ""
  };
}

// US-001: Đăng nhập
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Vui lòng nhập email và mật khẩu." });

    const [rows] = await pool.query("SELECT * FROM nguoi_dung WHERE email = ?", [email]);
    if (rows.length === 0) return res.json({ success: false, message: "Email hoặc mật khẩu không đúng!" });

    const user = rows[0];

    if (!user.trang_thai) return res.json({ success: false, message: "Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên." });

    const isMatch = await bcrypt.compare(password, user.mat_khau);
    if (!isMatch) {
      return res.json({ success: false, message: "Email hoặc mật khẩu không đúng!" });
    }

    // Reset failed attempts (just in case)
    await pool.query("UPDATE nguoi_dung SET so_lan_dang_nhap_sai = 0, khoa_den = NULL WHERE ma_nguoi_dung = ?", [user.ma_nguoi_dung]);

    const token = generateToken({ 
      userId: user.ma_nguoi_dung, 
      vaiTro: user.vai_tro, 
      email: user.email, 
      maKhoa: user.ma_khoa,
      hoTen: user.ho_ten
    });

    res.json({ success: true, user: mapUser(user), token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

// US-002: Đăng xuất
export function logout(req, res) {
  res.json({ success: true });
}

// US-003: Đổi mật khẩu
export async function changePassword(req, res) {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    const [rows] = await pool.query("SELECT * FROM nguoi_dung WHERE ma_nguoi_dung = ?", [userId]);
    if (rows.length === 0) return res.json({ success: false, message: "Không tìm thấy người dùng." });

    const isMatch = await bcrypt.compare(currentPassword, rows[0].mat_khau);
    if (!isMatch) return res.json({ success: false, message: "Mật khẩu hiện tại không đúng!" });

    if (newPassword.length < 8) return res.json({ success: false, message: "Mật khẩu phải có ít nhất 8 ký tự." });
    if (!/[A-Z]/.test(newPassword)) return res.json({ success: false, message: "Mật khẩu phải có ít nhất 1 chữ hoa." });
    if (!/[0-9]/.test(newPassword)) return res.json({ success: false, message: "Mật khẩu phải có ít nhất 1 chữ số." });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE nguoi_dung SET mat_khau = ? WHERE ma_nguoi_dung = ?", [hash, userId]);

    res.json({ success: true, message: "Đổi mật khẩu thành công!" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
