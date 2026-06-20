import { pool } from "../config/db.js";

function mapInventory(row) {
  return {
    maTonKho: row.ma_ton_kho,
    maThietBi: row.ma_thiet_bi,
    soLuongKho: row.so_luong_kho,
    soLuongDangDung: row.so_luong_dang_dung,
    soLuongHu: row.so_luong_hu || 0,
    ngayCapNhat: row.ngay_cap_nhat,
    ...(row.don_gia !== undefined ? { donGia: row.don_gia } : {})
  };
}

export async function getAllInventory(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT tk.*, 
             (SELECT ctnk.don_gia 
              FROM chi_tiet_nhap_kho ctnk 
              WHERE ctnk.ma_thiet_bi = tk.ma_thiet_bi 
              ORDER BY ctnk.id DESC LIMIT 1) as don_gia 
      FROM ton_kho tk
    `);
    res.json(rows.map(mapInventory));
  } catch (err) {
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

// GET /inventory/low-stock — thiết bị tồn kho thấp hơn ngưỡng cảnh báo
export async function getLowStock(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT tk.*, tb.ten_thiet_bi, tb.loai_thiet_bi, tb.don_vi_co_so, tb.nguong_canh_bao,
             (SELECT ctnk.don_gia 
              FROM chi_tiet_nhap_kho ctnk 
              WHERE ctnk.ma_thiet_bi = tk.ma_thiet_bi 
              ORDER BY ctnk.id DESC LIMIT 1) as don_gia
      FROM ton_kho tk
      JOIN thiet_bi tb ON tk.ma_thiet_bi = tb.ma_thiet_bi
      WHERE tk.so_luong_kho < tb.nguong_canh_bao AND tb.trang_thai = TRUE
      ORDER BY (tk.so_luong_kho / tb.nguong_canh_bao) ASC
    `);
    res.json(rows.map(row => ({
      ...mapInventory(row),
      tenThietBi: row.ten_thiet_bi,
      loaiThietBi: row.loai_thiet_bi,
      donViTinh: row.don_vi_co_so,
      nguongCanhBao: row.nguong_canh_bao
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}
