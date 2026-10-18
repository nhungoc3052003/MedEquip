import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { generateToken } from "../middleware/auth.js";

export function mapUser(row) {
  let fileHoSo = [];
  if (row.file_ho_so) {
    try {
      fileHoSo = typeof row.file_ho_so === "string" ? JSON.parse(row.file_ho_so) : row.file_ho_so;
    } catch (e) {
      fileHoSo = [{ tenFile: "Hồ sơ đính kèm", duongDan: row.file_ho_so }];
    }
  }

  let formattedNgaySinh = "";
  if (row.ngay_sinh) {
    if (typeof row.ngay_sinh === "string") {
      formattedNgaySinh = row.ngay_sinh.slice(0, 10);
    } else if (row.ngay_sinh instanceof Date) {
      formattedNgaySinh = row.ngay_sinh.toISOString().slice(0, 10);
    }
  }

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
    maKhoa: row.ma_khoa || "",
    tenKhoa: row.ten_khoa || "",
    cccd: row.cccd || "",
    ngaySinh: formattedNgaySinh,
    chucDanh: row.chuc_danh || "",
    fileHoSo,
    yeuCauDoiMatKhau: !!row.yeu_cau_doi_mat_khau,
  };
}

// US-001: Đăng nhập
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Vui lòng nhập email và mật khẩu." });

    const [rows] = await pool.query(
      `SELECT nd.*, k.ten_khoa 
       FROM nguoi_dung nd 
       LEFT JOIN khoa k ON nd.ma_khoa = k.ma_khoa 
       WHERE nd.email = ?`,
      [email]
    );
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

// Lấy thông tin tài khoản hiện tại
export async function getMe(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT nd.*, k.ten_khoa 
       FROM nguoi_dung nd 
       LEFT JOIN khoa k ON nd.ma_khoa = k.ma_khoa 
       WHERE nd.ma_nguoi_dung = ?`,
      [req.user.userId]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    res.json({ success: true, user: mapUser(rows[0]) });
  } catch (err) {
    console.error("GetMe error:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
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
    await pool.query("UPDATE nguoi_dung SET mat_khau = ?, yeu_cau_doi_mat_khau = 0 WHERE ma_nguoi_dung = ?", [hash, userId]);

    res.json({ success: true, message: "Đổi mật khẩu thành công!" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
