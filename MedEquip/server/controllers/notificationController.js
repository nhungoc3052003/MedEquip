import { pool } from "../config/db.js";

export async function getUserNotifications(req, res) {
  try {
    const userId = req.query.userId || req.user.userId;
    const [rows] = await pool.query(
      "SELECT * FROM thong_bao WHERE nguoi_nhan = ? ORDER BY ngay_tao DESC",
      [userId]
    );
    res.json(rows.map(r => ({
      id: r.id,
      tieuDe: r.tieu_de,
      noiDung: r.noi_dung || "",
      loai: r.loai,
      nguoiNhan: r.nguoi_nhan,
      daDoc: !!r.da_doc,
      ngayTao: r.ngay_tao
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function markAsRead(req, res) {
  try {
    await pool.query("UPDATE thong_bao SET da_doc = TRUE WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function markAllAsRead(req, res) {
  try {
    const userId = req.body.userId || req.user.userId;
    await pool.query("UPDATE thong_bao SET da_doc = TRUE WHERE nguoi_nhan = ?", [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
