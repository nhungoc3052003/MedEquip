import { pool } from "../config/db.js";

function mapDamageReport(row) {
  return {
    maPhieu: row.ma_phieu,
    maNguoiBao: row.ma_nguoi_bao,
    maThietBi: row.ma_thiet_bi,
    maKhoa: row.ma_khoa || "",
    soLuongHu: row.so_luong_hu || 1,
    moTaHuHong: row.mo_ta,
    mucDo: row.muc_do,
    trangThai: row.trang_thai,
    hinhAnh: row.hinh_anh || "",
    ngayBao: row.ngay_tao,
    ngayXuLy: row.ngay_xu_ly,
    nguoiXuLy: row.nguoi_xu_ly || "",
    ketQuaXuLy: row.ket_qua_xu_ly || "",
    ghiChu: row.ket_qua_xu_ly || ""
  };
}

export async function getAllDamageReports(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM phieu_bao_hu_hong ORDER BY ngay_tao DESC");
    res.json(rows.map(mapDamageReport));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createDamageReport(req, res) {
  try {
    const { maNguoiBao, maThietBi, maKhoa, moTaHuHong, soLuongHu, mucDo, hinhAnh } = req.body;
    const id = "BHH-" + new Date().toISOString().slice(0,10).replace(/-/g,"") + "-" + String(Date.now()).slice(-4);

    await pool.query(
      "INSERT INTO phieu_bao_hu_hong (ma_phieu, ma_nguoi_bao, ma_thiet_bi, ma_khoa, mo_ta, so_luong_hu, muc_do, trang_thai, hinh_anh) VALUES (?, ?, ?, ?, ?, ?, ?, 'CHO_XU_LY', ?)",
      [id, maNguoiBao || req.user.userId, maThietBi, maKhoa || null, moTaHuHong, soLuongHu || 1, mucDo || "TRUNG_BINH", hinhAnh || ""]
    );

    // Update inventory
    if (maThietBi && soLuongHu) {
      await pool.query(
        "UPDATE ton_kho SET so_luong_dang_dung = GREATEST(0, so_luong_dang_dung - ?), so_luong_hu = so_luong_hu + ? WHERE ma_thiet_bi = ?",
        [soLuongHu, soLuongHu, maThietBi]
      );
    }

    const [rows] = await pool.query("SELECT * FROM phieu_bao_hu_hong WHERE ma_phieu = ?", [id]);
    res.json({ success: true, report: mapDamageReport(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function resolveDamageReport(req, res) {
  try {
    const { nguoiXuLy, ketQuaXuLy, ghiChu } = req.body;
    await pool.query(
      "UPDATE phieu_bao_hu_hong SET trang_thai = 'DA_XU_LY', ngay_xu_ly = NOW(), nguoi_xu_ly = ?, ket_qua_xu_ly = ? WHERE ma_phieu = ?",
      [nguoiXuLy || req.user.userId, ketQuaXuLy || ghiChu || "", req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}
