import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { mapUser } from "./authController.js";
import { sendNotification, sendNotificationToRoles } from "../utils/notificationHelper.js";
import { sendAccountProvisioningEmail } from "../services/emailService.js";

function generateTempPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz";
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const specials = "@#$!";
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return "Med" + rand(specials) + rand(uppers) + rand(digits) + rand(digits) + rand(chars) + rand(chars);
}

// 1. Lấy danh sách yêu cầu cấp tài khoản
export async function getAllAccountRequests(req, res) {
  try {
    const user = req.user;
    let query = `
      SELECT 
        y.*,
        k.ten_khoa,
        u.ho_ten AS ten_nguoi_yeu_cau,
        duyet.ho_ten AS ten_nguoi_duyet
      FROM yeu_cau_cap_tai_khoan y
      LEFT JOIN khoa k ON y.ma_khoa = k.ma_khoa
      LEFT JOIN nguoi_dung u ON y.nguoi_yeu_cau = u.ma_nguoi_dung
      LEFT JOIN nguoi_dung duyet ON y.nguoi_duyet = duyet.ma_nguoi_dung
    `;
    const params = [];

    if (user.vaiTro !== "ADMIN") {
      // Chỉ nhân sự trực tiếp tạo đề xuất mới thấy đề xuất của mình
      query += " WHERE y.nguoi_yeu_cau = ?";
      params.push(user.userId);
    }

    query += " ORDER BY y.ngay_tao DESC";

    const [rows] = await pool.query(query, params);

    res.json(rows.map(r => ({
      maYeuCau: r.ma_yeu_cau,
      nguoiYeuCau: r.nguoi_yeu_cau,
      tenNguoiYeuCau: r.ten_nguoi_yeu_cau || r.nguoi_yeu_cau,
      maKhoa: r.ma_khoa,
      tenKhoa: r.ten_khoa || r.ma_khoa,
      hoTen: r.ho_ten,
      email: r.email,
      soDienThoai: r.so_dien_thoai || "",
      cccd: r.cccd || "",
      ngaySinh: r.ngay_sinh ? r.ngay_sinh.toISOString().slice(0, 10) : "",
      chucDanh: r.chuc_danh || "",
      vaiTro: r.vai_tro,
      fileDinhKem: r.file_dinh_kem ? JSON.parse(r.file_dinh_kem) : [],
      ghiChu: r.ghi_chu || "",
      trangThai: r.trang_thai,
      lyDoTuChoi: r.ly_do_tu_choi || "",
      maNguoiDungTao: r.ma_nguoi_dung_tao || null,
      nguoiDuyet: r.nguoi_duyet || null,
      tenNguoiDuyet: r.ten_nguoi_duyet || "",
      ngayDuyet: r.ngay_duyet,
      ngayTao: r.ngay_tao,
    })));
  } catch (err) {
    console.error("Lỗi getAllAccountRequests:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách yêu cầu cấp tài khoản." });
  }
}

// 2. Tạo yêu cầu cấp tài khoản mới (Dành cho Trợ lý khoa / Trưởng khoa)
export async function createAccountRequest(req, res) {
  try {
    const { hoTen, email, soDienThoai, cccd, ngaySinh, chucDanh, vaiTro, maKhoa, ghiChu } = req.body;
    const nguoiYeuCau = req.user.userId;
    const khoaId = maKhoa || req.user.maKhoa;

    if (!hoTen || !email || !vaiTro || !khoaId) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ các thông tin bắt buộc (Họ tên, Email, Vai trò, Khoa)." });
    }

    // Kiểm tra email trong bảng người dùng
    const [existingUsers] = await pool.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, message: "Email này đã được sử dụng bởi một tài khoản khác trong hệ thống." });
    }

    // Kiểm tra xem đã có yêu cầu nào đang chờ duyệt với email này chưa
    const [existingReqs] = await pool.query(
      "SELECT ma_yeu_cau FROM yeu_cau_cap_tai_khoan WHERE email = ? AND trang_thai = 'CHO_DUYET'",
      [email]
    );
    if (existingReqs.length > 0) {
      return res.status(400).json({ success: false, message: "Đã có một yêu cầu cấp tài khoản cho email này đang chờ Admin phê duyệt." });
    }

    // Xử lý file đính kèm nếu có upload
    let fileDinhKem = [];
    if (req.files && req.files.length > 0) {
      fileDinhKem = req.files.map(f => ({
        tenFile: f.originalname,
        duongDan: `/uploads/profiles/${f.filename}`,
        dungLuong: f.size,
      }));
    } else if (req.body.fileDinhKem) {
      try {
        fileDinhKem = typeof req.body.fileDinhKem === "string" ? JSON.parse(req.body.fileDinhKem) : req.body.fileDinhKem;
      } catch (e) {
        fileDinhKem = [];
      }
    }

    const maYeuCau = "YC-TK-" + String(Date.now()).slice(-6);

    await pool.query(
      `INSERT INTO yeu_cau_cap_tai_khoan 
      (ma_yeu_cau, nguoi_yeu_cau, ma_khoa, ho_ten, email, so_dien_thoai, cccd, ngay_sinh, chuc_danh, vai_tro, file_dinh_kem, ghi_chu, trang_thai) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET')`,
      [
        maYeuCau,
        nguoiYeuCau,
        khoaId,
        hoTen.trim(),
        email.trim().toLowerCase(),
        soDienThoai || null,
        cccd || null,
        ngaySinh || null,
        chucDanh || null,
        vaiTro,
        JSON.stringify(fileDinhKem),
        ghiChu || null,
      ]
    );

    // Gửi thông báo cho Ban Quản trị (Admin)
    const [khoaRow] = await pool.query("SELECT ten_khoa FROM khoa WHERE ma_khoa = ?", [khoaId]);
    const tenKhoa = khoaRow[0]?.ten_khoa || khoaId;

    await sendNotificationToRoles(
      ["ADMIN"],
      "Yêu cầu cấp tài khoản mới",
      `Trợ lý ${req.user.hoTen || ""} (${tenKhoa}) vừa gửi đề xuất cấp tài khoản cho ${hoTen} (${email}).`,
      "info"
    );

    res.json({
      success: true,
      message: "Đề xuất cấp tài khoản đã được gửi đến Ban Quản trị thành công!",
      maYeuCau,
    });
  } catch (err) {
    console.error("Lỗi createAccountRequest:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo đề xuất cấp tài khoản." });
  }
}

// 3. Phê duyệt yêu cầu và khởi tạo tài khoản (Dành cho Admin)
export async function approveAccountRequest(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    const [reqs] = await pool.query("SELECT * FROM yeu_cau_cap_tai_khoan WHERE ma_yeu_cau = ?", [id]);
    if (reqs.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu cấp tài khoản." });
    }

    const reqData = reqs[0];
    if (reqData.trang_thai !== "CHO_DUYET") {
      return res.status(400).json({ success: false, message: `Yêu cầu này đã ở trạng thái: ${reqData.trang_thai}` });
    }

    // Kiểm tra xem email đã tồn tại hay chưa
    const [existing] = await pool.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE email = ?", [reqData.email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Email này đã được sử dụng bởi một tài khoản khác trong hệ thống." });
    }

    // Sinh mật khẩu tạm thời ngẫu nhiên
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    const newUserId = "ND-" + String(Date.now()).slice(-6);

    // Tạo tài khoản người dùng mới với cờ yeu_cau_doi_mat_khau = 1
    await pool.query(
      `INSERT INTO nguoi_dung 
      (ma_nguoi_dung, ho_ten, email, mat_khau, vai_tro, ma_khoa, trang_thai, yeu_cau_doi_mat_khau, so_dien_thoai, cccd, ngay_sinh, chuc_danh, file_ho_so) 
      VALUES (?, ?, ?, ?, ?, ?, TRUE, 1, ?, ?, ?, ?, ?)`,
      [
        newUserId,
        reqData.ho_ten,
        reqData.email,
        hash,
        reqData.vai_tro,
        reqData.ma_khoa,
        reqData.so_dien_thoai,
        reqData.cccd,
        reqData.ngay_sinh,
        reqData.chuc_danh,
        reqData.file_dinh_kem,
      ]
    );

    // Cập nhật trạng thái phiếu yêu cầu
    await pool.query(
      `UPDATE yeu_cau_cap_tai_khoan 
      SET trang_thai = 'DA_DUYET', ma_nguoi_dung_tao = ?, nguoi_duyet = ?, ngay_duyet = NOW() 
      WHERE ma_yeu_cau = ?`,
      [newUserId, adminId, id]
    );

    // Lấy tên khoa để hiển thị trong email
    const [khoaRow] = await pool.query("SELECT ten_khoa FROM khoa WHERE ma_khoa = ?", [reqData.ma_khoa]);
    const tenKhoa = khoaRow[0]?.ten_khoa || reqData.ma_khoa;

    const ROLE_NAMES = {
      ADMIN: "Quản trị viên",
      QL_KHO: "Quản lý kho",
      NV_KHO: "Nhân viên kho",
      TRUONG_KHOA: "Trưởng khoa",
      TRO_LY: "Trợ lý khoa",
    };

    // Gửi email chứa thông tin tài khoản và mật khẩu tạm
    const emailResult = await sendAccountProvisioningEmail({
      toEmail: reqData.email,
      fullName: reqData.ho_ten,
      username: reqData.email,
      tempPassword,
      roleName: ROLE_NAMES[reqData.vai_tro] || reqData.vai_tro,
      departmentName: tenKhoa,
    });

    // Thông báo cho Trợ lý khoa (người gửi yêu cầu)
    await sendNotification(
      reqData.nguoi_yeu_cau,
      "Yêu cầu cấp tài khoản đã được phê duyệt",
      `Đề xuất cấp tài khoản cho ${reqData.ho_ten} (${reqData.email}) đã được Admin phê duyệt và gửi email bàn giao.`,
      "success"
    );

    const [newUserRows] = await pool.query("SELECT * FROM nguoi_dung WHERE ma_nguoi_dung = ?", [newUserId]);

    res.json({
      success: true,
      message: "Phê duyệt và cấp tài khoản thành công!",
      tempPassword,
      emailSent: emailResult.sent,
      emailMode: emailResult.mode || "SMTP",
      user: mapUser(newUserRows[0]),
    });
  } catch (err) {
    console.error("Lỗi approveAccountRequest:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi phê duyệt yêu cầu cấp tài khoản." });
  }
}

// 4. Từ chối yêu cầu cấp tài khoản (Dành cho Admin)
export async function rejectAccountRequest(req, res) {
  try {
    const { id } = req.params;
    const { lyDoTuChoi } = req.body;
    const adminId = req.user.userId;

    const [reqs] = await pool.query("SELECT * FROM yeu_cau_cap_tai_khoan WHERE ma_yeu_cau = ?", [id]);
    if (reqs.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy yêu cầu cấp tài khoản." });
    }

    const reqData = reqs[0];
    if (reqData.trang_thai !== "CHO_DUYET") {
      return res.status(400).json({ success: false, message: "Yêu cầu này đã được xử lý trước đó." });
    }

    await pool.query(
      `UPDATE yeu_cau_cap_tai_khoan 
      SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ?, nguoi_duyet = ?, ngay_duyet = NOW() 
      WHERE ma_yeu_cau = ?`,
      [lyDoTuChoi || "Hồ sơ chưa đạt yêu cầu.", adminId, id]
    );

    // Gửi thông báo cho Trợ lý khoa biết lý do
    await sendNotification(
      reqData.nguoi_yeu_cau,
      "Yêu cầu cấp tài khoản bị từ chối",
      `Yêu cầu cấp tài khoản cho ${reqData.ho_ten} đã bị từ chối. Lý do: ${lyDoTuChoi || "Hồ sơ chưa đạt yêu cầu."}`,
      "warning"
    );

    res.json({
      success: true,
      message: "Đã từ chối yêu cầu cấp tài khoản.",
    });
  } catch (err) {
    console.error("Lỗi rejectAccountRequest:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi từ chối yêu cầu cấp tài khoản." });
  }
}

// 5. Cấp lại mật khẩu tạm và gửi email cho người dùng hiện tại (Dành cho Admin)
export async function resendUserCredentials(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query("SELECT * FROM nguoi_dung WHERE ma_nguoi_dung = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    const user = rows[0];
    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);

    // Cập nhật lại mật khẩu tạm và đặt cờ bắt buộc đổi mật khẩu
    await pool.query(
      "UPDATE nguoi_dung SET mat_khau = ?, yeu_cau_doi_mat_khau = 1 WHERE ma_nguoi_dung = ?",
      [hash, id]
    );

    // Lấy thông tin khoa
    const [khoaRow] = await pool.query("SELECT ten_khoa FROM khoa WHERE ma_khoa = ?", [user.ma_khoa]);
    const tenKhoa = khoaRow[0]?.ten_khoa || user.ma_khoa;

    const ROLE_NAMES = {
      ADMIN: "Quản trị viên",
      QL_KHO: "Quản lý kho",
      NV_KHO: "Nhân viên kho",
      TRUONG_KHOA: "Trưởng khoa",
      TRO_LY: "Trợ lý khoa",
    };

    const emailResult = await sendAccountProvisioningEmail({
      toEmail: user.email,
      fullName: user.ho_ten,
      username: user.email,
      tempPassword,
      roleName: ROLE_NAMES[user.vai_tro] || user.vai_tro,
      departmentName: tenKhoa,
    });

    res.json({
      success: true,
      message: "Đã cấp mật khẩu tạm mới và gửi thông tin đến email nhân sự!",
      tempPassword,
      emailSent: emailResult.sent,
      emailMode: emailResult.mode || "SMTP",
    });
  } catch (err) {
    console.error("Lỗi resendUserCredentials:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi cấp lại thông tin đăng nhập." });
  }
}
