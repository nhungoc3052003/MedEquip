import { pool } from "../config/db.js";

/**
 * Gửi thông báo cho người dùng
 * @param {string} userId - ID người nhận
 * @param {string} title - Tiêu đề thông báo
 * @param {string} content - Nội dung thông báo
 * @param {string} type - Loại thông báo ('info', 'warning', 'success', 'error')
 */
export async function sendNotification(userId, title, content, type = 'info') {
    try {
        if (!userId) return;
        
        await pool.query(
            "INSERT INTO thong_bao (tieu_de, noi_dung, loai, nguoi_nhan, da_doc, ngay_tao) VALUES (?, ?, ?, ?, FALSE, NOW())",
            [title, content, type, userId]
        );
        console.log(`[Notification] Sent to ${userId}: ${title}`);
    } catch (err) {
        console.error("[Notification Error]", err);
    }
}

/**
 * Gửi thông báo cho tất cả người dùng có vai trò cụ thể
 * @param {string[]} roles - Danh sách vai trò nhận thông báo
 * @param {string} title 
 * @param {string} content 
 * @param {string} type 
 */
export async function sendNotificationToRoles(roles, title, content, type = 'info') {
    try {
        const [users] = await pool.query(
            "SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro IN (?)",
            [roles]
        );
        
        for (const user of users) {
            await sendNotification(user.ma_nguoi_dung, title, content, type);
        }
    } catch (err) {
        console.error("[Notification Roles Error]", err);
    }
}
