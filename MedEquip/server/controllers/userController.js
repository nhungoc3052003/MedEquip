import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { mapUser } from "./authController.js";
import { sendAccountProvisioningEmail } from "../services/emailService.js";

function generateTempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz";
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const specials = "@#$!";
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return "Med" + rand(specials) + rand(uppers) + rand(digits) + rand(digits) + rand(chars) + rand(chars);
}

export async function getAllUsers(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT nd.*, k.ten_khoa 
      FROM nguoi_dung nd 
      LEFT JOIN khoa k ON nd.ma_khoa = k.ma_khoa 
      ORDER BY nd.ngay_tao DESC
    `);
    res.json(rows.map(mapUser));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function getUserById(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT nd.*, k.ten_khoa 
      FROM nguoi_dung nd 
      LEFT JOIN khoa k ON nd.ma_khoa = k.ma_khoa 
      WHERE nd.ma_nguoi_dung = ?
    `, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "Không tìm thấy người dùng." });
    res.json(mapUser(rows[0]));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createUser(req, res) {
  try {
    const { hoTen, email, matKhau, vaiTro, maKhoa, soDienThoai, diaChi, cccd, ngaySinh, chucDanh, fileHoSo } = req.body;

    const [existing] = await pool.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE email = ?", [email]);
    if (existing.length > 0) return res.json({ success: false, message: "Email đã tồn tại và yêu cầu nhập email khác." });

    const rawPassword = matKhau && matKhau.trim() !== "" ? matKhau : generateTempPassword();
    const hash = await bcrypt.hash(rawPassword, 10);
    const id = "ND-" + String(Date.now()).slice(-6);

    let filesArr = [];
    if (req.files && req.files.length > 0) {
      filesArr = req.files.map(f => ({
        tenFile: f.originalname,
        duongDan: `/uploads/profiles/${f.filename}`,
        dungLuong: f.size,
      }));
    } else if (fileHoSo) {
      try {
        filesArr = typeof fileHoSo === "object" ? fileHoSo : JSON.parse(fileHoSo);
      } catch (e) {
        filesArr = [];
      }
    }
    const serializedFiles = filesArr.length > 0 ? JSON.stringify(filesArr) : null;

    await pool.query(
      `INSERT INTO nguoi_dung 
      (ma_nguoi_dung, ho_ten, email, mat_khau, vai_tro, ma_khoa, trang_thai, yeu_cau_doi_mat_khau, so_dien_thoai, dia_chi, cccd, ngay_sinh, chuc_danh, file_ho_so) 
      VALUES (?, ?, ?, ?, ?, ?, TRUE, 1, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        hoTen,
        email,
        hash,
        vaiTro,
        maKhoa || null,
        soDienThoai || null,
        diaChi || null,
        cccd || null,
        ngaySinh || null,
        chucDanh || null,
        serializedFiles,
      ]
    );

    // Lấy tên khoa để gửi email
    let tenKhoa = "";
    if (maKhoa) {
      const [kRows] = await pool.query("SELECT ten_khoa FROM khoa WHERE ma_khoa = ?", [maKhoa]);
      tenKhoa = kRows[0]?.ten_khoa || maKhoa;
    }

    const ROLE_NAMES = {
      ADMIN: "Quản trị viên",
      QL_KHO: "Quản lý kho",
      NV_KHO: "Nhân viên kho",
      TRUONG_KHOA: "Trưởng khoa",
      TRO_LY: "Trợ lý khoa",
    };

    // Gửi email cấp tài khoản
    const emailResult = await sendAccountProvisioningEmail({
      toEmail: email,
      fullName: hoTen,
      username: email,
      tempPassword: rawPassword,
      roleName: ROLE_NAMES[vaiTro] || vaiTro,
      departmentName: tenKhoa,
    });

    const [rows] = await pool.query(`
      SELECT nd.*, k.ten_khoa 
      FROM nguoi_dung nd 
      LEFT JOIN khoa k ON nd.ma_khoa = k.ma_khoa 
      WHERE nd.ma_nguoi_dung = ?
    `, [id]);
    res.json({
      success: true,
      user: mapUser(rows[0]),
      tempPassword: rawPassword,
      emailSent: emailResult.sent,
      emailMode: emailResult.mode || "SMTP",
    });
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
    if (updates.cccd !== undefined) { fields.push("cccd = ?"); values.push(updates.cccd); }
    if (updates.ngaySinh !== undefined) { fields.push("ngay_sinh = ?"); values.push(updates.ngaySinh || null); }
    if (updates.chucDanh !== undefined) { fields.push("chuc_danh = ?"); values.push(updates.chucDanh); }
    if (updates.fileHoSo !== undefined) {
      const serialized = typeof updates.fileHoSo === "object" ? JSON.stringify(updates.fileHoSo) : updates.fileHoSo;
      fields.push("file_ho_so = ?");
      values.push(serialized);
    }

    if (fields.length === 0) return res.json({ success: true });

    values.push(req.params.id);
    await pool.query(`UPDATE nguoi_dung SET ${fields.join(", ")} WHERE ma_nguoi_dung = ?`, values);

    const [rows] = await pool.query(`
      SELECT nd.*, k.ten_khoa 
      FROM nguoi_dung nd 
      LEFT JOIN khoa k ON nd.ma_khoa = k.ma_khoa 
      WHERE nd.ma_nguoi_dung = ?
    `, [req.params.id]);
    res.json({ success: true, user: mapUser(rows[0]) });
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
