import { pool } from "../config/db.js";

export async function getDashboard(req, res) {
  try {
    const [[{ totalEquipment }]] = await pool.query("SELECT COUNT(*) as totalEquipment FROM thiet_bi WHERE trang_thai = TRUE");
    const [[{ totalLowStock }]] = await pool.query("SELECT COUNT(*) as totalLowStock FROM ton_kho WHERE so_luong_kho < 10");
    const [[{ pendingRequests }]] = await pool.query("SELECT COUNT(*) as pendingRequests FROM phieu_yeu_cau WHERE trang_thai = 'CHO_DUYET'");
    const [[{ totalDamage }]] = await pool.query("SELECT COUNT(*) as totalDamage FROM phieu_bao_hu_hong WHERE trang_thai = 'CHO_XU_LY'");
    const [[{ totalDepartments }]] = await pool.query("SELECT COUNT(*) as totalDepartments FROM khoa WHERE trang_thai = TRUE");
    const [[{ totalSuppliers }]] = await pool.query("SELECT COUNT(*) as totalSuppliers FROM nha_cung_cap WHERE trang_thai = TRUE");

    res.json({ totalEquipment, totalLowStock, pendingRequests, totalDamage, totalDepartments, totalSuppliers });
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function getInventoryReport(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT tk.*, tb.ten_thiet_bi, tb.loai_thiet_bi, tb.don_vi_tinh
      FROM ton_kho tk
      JOIN thiet_bi tb ON tk.ma_thiet_bi = tb.ma_thiet_bi
      WHERE tb.trang_thai = TRUE
      ORDER BY tk.so_luong_kho ASC
    `);
    res.json(rows.map(r => ({
      maThietBi: r.ma_thiet_bi,
      tenThietBi: r.ten_thiet_bi,
      loaiThietBi: r.loai_thiet_bi,
      donViTinh: r.don_vi_tinh,
      soLuongKho: r.so_luong_kho,
      soLuongHu: r.so_luong_hu,
      soLuongDangDung: r.so_luong_dang_dung
    })));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}
