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

    // Quét cảnh báo bảo trì thiết bị
    const maintResult = await checkAndSendMaintenanceNotifications();
    sentCount += (maintResult.sentCount || 0);

    return { totalChecked: allocRows.length, sentCount };
  } catch (err) {
    console.error("[DueNotificationChecker Error]", err);
    return { error: err.message };
  }
}

/**
 * Quét các thiết bị tái sử dụng đến hạn / quá hạn bảo trì và gửi thông báo
 */
export async function checkAndSendMaintenanceNotifications() {
  try {
    const [tbList] = await pool.query(`
      SELECT ma_thiet_bi, ten_thiet_bi, serial_number, ngay_bao_tri_tiep_theo, trang_thai_bao_tri
      FROM thiet_bi
      WHERE loai_thiet_bi = 'TAI_SU_DUNG' 
        AND trang_thai = TRUE 
        AND ngay_bao_tri_tiep_theo IS NOT NULL
    `);

    if (!tbList || tbList.length === 0) return { totalChecked: 0, sentCount: 0 };

    let sentCount = 0;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Lấy danh sách NV Kho và Quản lý kho
    const [managers] = await pool.query(`
      SELECT ma_nguoi_dung FROM nguoi_dung 
      WHERE vai_tro IN ('ADMIN', 'QL_KHO', 'NV_KHO') AND trang_thai = TRUE
    `);

    for (const tb of tbList) {
      if (tb.trang_thai_bao_tri === 'DANG_BAO_TRI') continue;

      const nextDate = new Date(tb.ngay_bao_tri_tiep_theo);
      const nextStart = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate()).getTime();
      const diffDays = Math.round((nextStart - todayStart) / (1000 * 60 * 60 * 24));
      const formattedDate = nextDate.toLocaleDateString('vi-VN');

      let tieuDe = "";
      let noiDung = "";
      let loai = "info";

      if (diffDays < 0) {
        tieuDe = `Quá hạn bảo trì: ${tb.ten_thiet_bi} (${tb.ma_thiet_bi})`;
        noiDung = `Thiết bị ${tb.ten_thiet_bi} (${tb.ma_thiet_bi}) đã quá hạn bảo trì ${Math.abs(diffDays)} ngày (Hạn kiểm định: ${formattedDate}). Vui lòng tiến hành kiểm tra, bảo dưỡng ngay.`;
        loai = "danger";
      } else if (diffDays === 0) {
        tieuDe = `Đến hạn bảo trì hôm nay: ${tb.ten_thiet_bi} (${tb.ma_thiet_bi})`;
        noiDung = `Hôm nay (${formattedDate}) là ngày đến hạn bảo trì định kỳ của thiết bị ${tb.ten_thiet_bi}.`;
        loai = "warning";
      } else if (diffDays <= 7) {
        tieuDe = `Sắp đến hạn bảo trì: ${tb.ten_thiet_bi} (còn ${diffDays} ngày)`;
        noiDung = `Thiết bị ${tb.ten_thiet_bi} (${tb.ma_thiet_bi}) sẽ đến hạn bảo trì vào ngày ${formattedDate} (còn ${diffDays} ngày).`;
        loai = "warning";
      } else if (diffDays <= 15) {
        tieuDe = `Nhắc nhở bảo trì: ${tb.ten_thiet_bi} (${formattedDate})`;
        noiDung = `Thiết bị ${tb.ten_thiet_bi} sẽ đến hạn bảo trì trong ${diffDays} ngày tới (${formattedDate}).`;
        loai = "info";
      } else {
        continue;
      }

      // Gửi cho NV Kho / Quản lý kho
      for (const m of managers) {
        const [already] = await pool.query(`
          SELECT 1 FROM thong_bao 
          WHERE nguoi_nhan = ? 
            AND tieu_de = ? 
            AND DATE(ngay_tao) = CURDATE()
          LIMIT 1
        `, [m.ma_nguoi_dung, tieuDe]);

        if (already.length === 0) {
          await sendNotification(m.ma_nguoi_dung, tieuDe, noiDung, loai);
          sentCount++;
        }
      }

      // Kiểm tra nếu thiết bị đang được khoa nào mượn, gửi cho Trưởng khoa & Trợ lý khoa đó
      const [allocations] = await pool.query(`
        SELECT DISTINCT p.ma_khoa_nhan 
        FROM chi_tiet_cap_phat c 
        JOIN phieu_cap_phat p ON c.ma_phieu_cap_phat = p.ma_phieu 
        WHERE c.ma_thiet_bi = ? AND c.trang_thai_tra != 'DA_TRA'
      `, [tb.ma_thiet_bi]);

      for (const a of allocations) {
        const [deptStaff] = await pool.query(`
          SELECT ma_nguoi_dung FROM nguoi_dung 
          WHERE ma_khoa = ? AND vai_tro IN ('TRUONG_KHOA', 'TRO_LY') AND trang_thai = TRUE
        `, [a.ma_khoa_nhan]);

        for (const s of deptStaff) {
          const [already] = await pool.query(`
            SELECT 1 FROM thong_bao 
            WHERE nguoi_nhan = ? AND tieu_de = ? AND DATE(ngay_tao) = CURDATE()
            LIMIT 1
          `, [s.ma_nguoi_dung, tieuDe]);

          if (already.length === 0) {
            await sendNotification(s.ma_nguoi_dung, tieuDe, noiDung, loai);
            sentCount++;
          }
        }
      }
    }

    return { totalChecked: tbList.length, sentCount };
  } catch (err) {
    console.error("[MaintenanceNotificationChecker Error]", err);
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
