import { pool } from "../config/db.js";
import { sendNotification } from "../utils/notificationHelper.js";

let lastCheckTime = 0;

/**
 * Kiểm tra các thiết bị đang mượn và tự động gửi thông báo:
 * 1. Trước 1 ngày đến hạn trả (còn 1 ngày nữa đến hạn)
 * 2. Đến hạn trả (hôm nay đến hạn)
 * 3. Quá hạn trả (đã trễ hạn X ngày)
 * 
 * Đối tượng nhận: Cả Trợ lý (TRO_LY) và Trưởng khoa (TRUONG_KHOA) của khoa đang mượn thiết bị đó.
 * Cơ chế chống spam: Mỗi thiết bị + trạng thái chỉ gửi tối đa 1 lần/ngày cho mỗi người nhận.
 */
export async function checkAndSendDueNotifications() {
  try {
    // 1. Lấy danh sách chi tiết cấp phát đang mượn có hạn trả
    const [allocRows] = await pool.query(`
      SELECT 
        c.ma_phieu_cap_phat,
        c.ma_thiet_bi,
        COALESCE(t.ten_thiet_bi, c.ma_thiet_bi) AS ten_thiet_bi,
        c.ngay_tra_du_kien,
        c.so_luong,
        c.don_vi_tinh,
        c.trang_thai_tra,
        p.ma_khoa_nhan,
        p.ngay_cap
      FROM chi_tiet_cap_phat c
      JOIN phieu_cap_phat p ON c.ma_phieu_cap_phat = p.ma_phieu
      LEFT JOIN thiet_bi t ON c.ma_thiet_bi = t.ma_thiet_bi
      WHERE c.trang_thai_tra IN ('CHUA_TRA', 'DA_GIA_HAN')
        AND c.ngay_tra_du_kien IS NOT NULL
    `);

    if (!allocRows || allocRows.length === 0) {
      return { totalChecked: 0, sentCount: 0 };
    }

    let sentCount = 0;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    for (const alloc of allocRows) {
      const dueDate = new Date(alloc.ngay_tra_du_kien);
      const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
      const diffDays = Math.round((todayStart - dueStart) / (1000 * 60 * 60 * 24));
      const formattedDate = dueDate.toLocaleDateString('vi-VN');

      // diffDays < -1: còn 2 ngày trở lên -> chưa đến thời điểm báo (trước 1 ngày)
      if (diffDays < -1) {
        continue;
      }

      // Kiểm tra xem phiếu này có đang có yêu cầu gia hạn chờ duyệt không
      const [pendingExtensions] = await pool.query(`
        SELECT 1 FROM phieu_yeu_cau 
        WHERE ma_phieu_cap_phat_cu = ? 
          AND trang_thai IN ('CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_CAP_PHAT')
        LIMIT 1
      `, [alloc.ma_phieu_cap_phat]);

      if (pendingExtensions.length > 0) {
        // Đang chờ duyệt gia hạn -> bỏ qua không gửi cảnh báo hạn
        continue;
      }

      // Xác định thông báo theo 3 mốc:
      let tieuDe = "";
      let noiDung = "";
      let loai = "info";

      if (diffDays === -1) {
        // Mốc 1: Trước 1 ngày đến ngày hạn trả (còn 1 ngày nữa)
        tieuDe = "Nhắc nhở: Thiết bị còn 1 ngày đến hạn trả";
        noiDung = `Thiết bị "${alloc.ten_thiet_bi}" (Mã CP: ${alloc.ma_phieu_cap_phat}) còn 1 ngày nữa là đến hạn trả (${formattedDate}). Vui lòng chuẩn bị hoàn trả hoặc gửi yêu cầu gia hạn.`;
        loai = "warning";
      } else if (diffDays === 0) {
        // Mốc 2: Đến hạn trả hôm nay
        tieuDe = "Thông báo: Thiết bị đến hạn trả hôm nay";
        noiDung = `Thiết bị "${alloc.ten_thiet_bi}" (Mã CP: ${alloc.ma_phieu_cap_phat}) đến hạn trả vào hôm nay (${formattedDate}). Vui lòng hoàn trả thiết bị về kho hoặc gửi yêu cầu gia hạn.`;
        loai = "warning";
      } else if (diffDays > 0) {
        // Mốc 3: Đã quá hạn trả
        tieuDe = "Cảnh báo: Thiết bị quá hạn trả";
        noiDung = `Thiết bị "${alloc.ten_thiet_bi}" (Mã CP: ${alloc.ma_phieu_cap_phat}) đã quá hạn trả ${diffDays} ngày (Hạn trả: ${formattedDate}). Vui lòng khẩn trương hoàn trả thiết bị về kho.`;
        loai = "error";
      }

      // Tìm tất cả Trợ lý (TRO_LY) và Trưởng khoa (TRUONG_KHOA) của khoa đang mượn thiết bị này
      const [recipients] = await pool.query(`
        SELECT ma_nguoi_dung, ho_ten, vai_tro FROM nguoi_dung 
        WHERE vai_tro IN ('TRO_LY', 'TRUONG_KHOA') 
          AND ma_khoa = ?
      `, [alloc.ma_khoa_nhan]);

      for (const rec of recipients) {
        // Kiểm tra xem đã gửi thông báo loại này cho thiết bị này trong ngày hôm nay chưa (tránh spam)
        const [alreadySent] = await pool.query(`
          SELECT id FROM thong_bao 
          WHERE nguoi_nhan = ? 
            AND tieu_de = ?
            AND noi_dung LIKE ?
            AND DATE(ngay_tao) = CURRENT_DATE()
          LIMIT 1
        `, [
          rec.ma_nguoi_dung, 
          tieuDe, 
          `%${alloc.ma_phieu_cap_phat}%`
        ]);

        if (alreadySent.length === 0) {
          await sendNotification(rec.ma_nguoi_dung, tieuDe, noiDung, loai);
          sentCount++;
          console.log(`[AutoDueNotif] Sent to ${rec.vai_tro} (${rec.ma_nguoi_dung}) of khoa ${alloc.ma_khoa_nhan}: ${tieuDe} for ${alloc.ma_phieu_cap_phat}`);
        }
      }
    }

    return { totalChecked: allocRows.length, sentCount };
  } catch (err) {
    console.error("[DueNotificationChecker Error]", err);
    return { error: err.message };
  }
}

/**
 * Phiên bản throttled để gọi an toàn trong request handler (tối đa 1 lần mỗi 60 giây)
 */
export async function checkAndSendDueNotificationsThrottled() {
  const now = Date.now();
  if (now - lastCheckTime > 60 * 1000) {
    lastCheckTime = now;
    return await checkAndSendDueNotifications();
  }
  return { throttled: true };
}
