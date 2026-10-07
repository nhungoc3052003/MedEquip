import { pool } from "../config/db.js";
import { sendNotification } from "../utils/notificationHelper.js";

export async function getAllNeeds(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT 
        n.ma_nhu_cau as maNhuCau,
        n.ma_khoa_yeu_cau as maKhoaYeuCau,
        n.ma_nguoi_dang as maNguoiDang,
        n.ma_thiet_bi as maThietBi,
        n.ten_thiet_bi as tenThietBi,
        n.so_luong_can as soLuongCan,
        n.so_luong_da_dap_ung as soLuongDaDapUng,
        n.muc_do_uu_tien as mucDoUuTien,
        n.ly_do as lyDo,
        n.trang_thai as trangThai,
        n.ngay_tao as ngayTao,
        k.ten_khoa as tenKhoaYeuCau,
        u.ho_ten as tenNguoiDang,
        t.ten_thiet_bi as tenThietBiGoc
      FROM nhu_cau_thiet_bi n
      LEFT JOIN khoa k ON n.ma_khoa_yeu_cau = k.ma_khoa
      LEFT JOIN nguoi_dung u ON n.ma_nguoi_dang = u.ma_nguoi_dung
      LEFT JOIN thiet_bi t ON n.ma_thiet_bi = t.ma_thiet_bi
      ORDER BY 
        CASE WHEN n.trang_thai = 'DANG_TIM_KIEM' THEN 0 ELSE 1 END,
        CASE WHEN n.muc_do_uu_tien = 'KHAN_CAP' THEN 0 ELSE 1 END,
        n.ngay_tao DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching equipment needs:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi lấy danh sách nhu cầu thiết bị." });
  }
}

export async function createNeed(req, res) {
  try {
    const { maKhoaYeuCau, maThietBi, tenThietBi, soLuongCan, mucDoUuTien, lyDo } = req.body;
    const maNguoiDang = req.user.userId;

    if (!maKhoaYeuCau || !tenThietBi) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn khoa và tên thiết bị." });
    }

    const id = "NC-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
    const qty = parseInt(soLuongCan) || 1;
    const priority = mucDoUuTien === 'KHAN_CAP' ? 'KHAN_CAP' : 'BINH_THUONG';

    await pool.query(`
      INSERT INTO nhu_cau_thiet_bi 
        (ma_nhu_cau, ma_khoa_yeu_cau, ma_nguoi_dang, ma_thiet_bi, ten_thiet_bi, so_luong_can, so_luong_da_dap_ung, muc_do_uu_tien, ly_do, trang_thai)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'DANG_TIM_KIEM')
    `, [id, maKhoaYeuCau, maNguoiDang, maThietBi || null, tenThietBi, qty, priority, lyDo || '']);

    // Lấy thông tin khoa để gửi thông báo
    const [deptRows] = await pool.query("SELECT ten_khoa FROM khoa WHERE ma_khoa = ?", [maKhoaYeuCau]);
    const deptName = deptRows[0]?.ten_khoa || maKhoaYeuCau;

    // Gửi thông báo đến tất cả Trợ lý, Trưởng khoa và Quản lý kho để biết
    const [users] = await pool.query(`
      SELECT ma_nguoi_dung FROM nguoi_dung 
      WHERE vai_tro IN ('TRO_LY', 'TRUONG_KHOA', 'QL_KHO') AND ma_nguoi_dung != ?
    `, [maNguoiDang]);

    const title = priority === 'KHAN_CAP' ? '🚨 [KHẨN CẤP] Nhu cầu thiết bị nội viện' : '📢 Nhu cầu thiết bị nội viện';
    const notifMsg = `${deptName} đang cần ${qty} ${tenThietBi} (${priority === 'KHAN_CAP' ? 'Mức độ khẩn cấp' : 'Bình thường'}). Khoa nào có thiết bị dư xin hỗ trợ điều chuyển.`;

    for (const u of users) {
      await sendNotification(u.ma_nguoi_dung, title, notifMsg, priority === 'KHAN_CAP' ? 'warning' : 'info');
    }

    res.json({ success: true, maNhuCau: id, message: "Đã đăng thông báo nhu cầu thiết bị thành công." });
  } catch (err) {
    console.error("Error creating need:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi tạo nhu cầu thiết bị." });
  }
}

export async function closeNeed(req, res) {
  try {
    const { id } = req.params;
    await pool.query("UPDATE nhu_cau_thiet_bi SET trang_thai = 'DA_DONG' WHERE ma_nhu_cau = ?", [id]);
    res.json({ success: true, message: "Đã đóng tin nhu cầu thiết bị." });
  } catch (err) {
    console.error("Error closing need:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi đóng nhu cầu thiết bị." });
  }
}

export async function reopenNeed(req, res) {
  try {
    const { id } = req.params;
    await pool.query("UPDATE nhu_cau_thiet_bi SET trang_thai = 'DANG_TIM_KIEM' WHERE ma_nhu_cau = ?", [id]);
    res.json({ success: true, message: "Đã kích hoạt tìm kiếm lại nhu cầu thiết bị." });
  } catch (err) {
    console.error("Error reopening need:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ khi mở lại nhu cầu thiết bị." });
  }
}

