import { pool } from "../config/db.js";

function calculateDaysLeft(dueDate) {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// GET /api/instances — Lấy danh sách cá thể thiết bị
export async function getAllInstances(req, res) {
  try {
    let sql = `
      SELECT c.*, tb.ten_thiet_bi, tb.loai_thiet_bi, tb.hinh_anh, tb.don_vi_co_so,
             kp.ten_khoa
      FROM ca_the_thiet_bi c
      JOIN thiet_bi tb ON c.ma_thiet_bi = tb.ma_thiet_bi
      LEFT JOIN khoa kp ON c.ma_khoa_hien_tai = kp.ma_khoa
      WHERE 1=1
    `;
    const params = [];

    if (req.query.maThietBi) {
      sql += " AND c.ma_thiet_bi = ?";
      params.push(req.query.maThietBi);
    }
    if (req.query.viTri) {
      sql += " AND c.vi_tri_hien_tai = ?";
      params.push(req.query.viTri);
    }
    if (req.query.trangThai) {
      sql += " AND c.trang_thai = ?";
      params.push(req.query.trangThai);
    }
    if (req.query.maKhoa) {
      sql += " AND c.ma_khoa_hien_tai = ?";
      params.push(req.query.maKhoa);
    }
    if (req.query.search) {
      const keyword = `%${req.query.search}%`;
      sql += ` AND (c.ma_ca_the LIKE ? OR c.serial_number LIKE ? OR tb.ten_thiet_bi LIKE ? OR kp.ten_khoa LIKE ?)`;
      params.push(keyword, keyword, keyword, keyword);
    }

    sql += " ORDER BY c.ngay_cap_nhat DESC LIMIT 200";

    const [rows] = await pool.query(sql, params);
    const result = rows.map(r => ({
      maCaThe: r.ma_ca_the,
      maThietBi: r.ma_thiet_bi,
      tenThietBi: r.ten_thiet_bi,
      loaiThietBi: r.loai_thiet_bi,
      hinhAnh: r.hinh_anh,
      donViCoSo: r.don_vi_co_so,
      serialNumber: r.serial_number || "",
      viTri: r.vi_tri_hien_tai,
      viTriText: r.vi_tri_hien_tai === 'KHO' ? 'Kho thiết bị' : (r.ten_khoa || r.ma_khoa_hien_tai),
      maKhoa: r.ma_khoa_hien_tai,
      tenKhoa: r.ten_khoa || "",
      trangThai: r.trang_thai,
      maPhieuCapPhat: r.ma_phieu_cap_phat_hien_tai,
      ngayNhap: r.ngay_nhap,
      ngayCapPhat: r.ngay_cap_phat,
      ngayTraDuKien: r.ngay_tra_du_kien,
      soNgayConLai: calculateDaysLeft(r.ngay_tra_du_kien),
      ghiChu: r.ghi_chu || ""
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  }
}

// GET /api/instances/lookup/:code — Tra cứu nhanh bằng mã cá thể / Barcode / QR / Serial
export async function lookupInstance(req, res) {
  try {
    const rawCode = req.params.code ? req.params.code.trim() : "";
    if (!rawCode) {
      return res.status(400).json({ found: false, message: "Mã thiết bị không hợp lệ." });
    }

    const sql = `
      SELECT c.*, tb.ten_thiet_bi, tb.loai_thiet_bi, tb.hinh_anh, tb.don_vi_co_so,
             kp.ten_khoa, u.ho_ten as ten_nguoi_muon, pcp.ngay_cap, pyc.ma_phieu as ma_phieu_yeu_cau
      FROM ca_the_thiet_bi c
      JOIN thiet_bi tb ON c.ma_thiet_bi = tb.ma_thiet_bi
      LEFT JOIN khoa kp ON c.ma_khoa_hien_tai = kp.ma_khoa
      LEFT JOIN phieu_cap_phat pcp ON c.ma_phieu_cap_phat_hien_tai = pcp.ma_phieu
      LEFT JOIN phieu_yeu_cau pyc ON pcp.ma_phieu_yeu_cau = pyc.ma_phieu
      LEFT JOIN nguoi_dung u ON pyc.ma_nguoi_yeu_cau = u.ma_nguoi_dung
      WHERE c.ma_ca_the = ? 
         OR c.serial_number = ? 
         OR c.ma_thiet_bi = ? 
         OR pcp.ma_phieu = ? 
         OR pyc.ma_phieu = ?
         OR tb.ten_thiet_bi LIKE ?
      ORDER BY (c.vi_tri_hien_tai = 'KHOA_PHONG') DESC, c.ma_ca_the ASC
      LIMIT 20
    `;
    const [rows] = await pool.query(sql, [rawCode, rawCode, rawCode, rawCode, rawCode, `%${rawCode}%`]);

    if (rows.length === 0) {
      return res.json({ found: false, message: `Không tìm thấy thiết bị hoặc cá thể nào phù hợp với từ khóa "${rawCode}".` });
    }

    const formatRow = (r) => {
      const daysLeft = calculateDaysLeft(r.ngay_tra_du_kien);
      return {
        maCaThe: r.ma_ca_the,
        maThietBi: r.ma_thiet_bi,
        tenThietBi: r.ten_thiet_bi,
        loaiThietBi: r.loai_thiet_bi,
        hinhAnh: r.hinh_anh,
        donViCoSo: r.don_vi_co_so,
        serialNumber: r.serial_number || "",
        viTri: r.vi_tri_hien_tai,
        viTriText: r.vi_tri_hien_tai === 'KHO' ? 'Kho thiết bị y tế' : (r.ten_khoa || r.ma_khoa_hien_tai),
        maKhoa: r.ma_khoa_hien_tai,
        tenKhoa: r.ten_khoa || "",
        tenNguoiMuon: r.ten_nguoi_muon || "",
        trangThai: r.trang_thai,
        maPhieuCapPhat: r.ma_phieu_cap_phat_hien_tai,
        maPhieuYeuCau: r.ma_phieu_yeu_cau || "",
        ngayNhap: r.ngay_nhap,
        ngayCapPhat: r.ngay_cap_phat || r.ngay_cap,
        ngayTraDuKien: r.ngay_tra_du_kien,
        soNgayConLai: daysLeft,
        tinhTrangHan: daysLeft === null ? "KHONG_XAC_DINH" : (daysLeft < 0 ? "QUA_HAN" : (daysLeft <= 3 ? "SAP_DEN_HAN" : "CON_HAN")),
        ghiChu: r.ghi_chu || ""
      };
    };

    const formattedList = rows.map(formatRow);

    res.json({
      found: true,
      count: formattedList.length,
      isMulti: formattedList.length > 1,
      searchTerm: rawCode,
      instance: formattedList[0],
      instances: formattedList
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ found: false, message: "Lỗi máy chủ: " + err.message });
  }
}

// GET /api/instances/available/:maThietBi — Lấy danh sách máy sẵn sàng trong kho để NV kho cấp phát
export async function getAvailableInstances(req, res) {
  try {
    const maThietBi = req.params.maThietBi;
    const [rows] = await pool.query(`
      SELECT ma_ca_the, serial_number, ghi_chu, ngay_nhap
      FROM ca_the_thiet_bi
      WHERE ma_thiet_bi = ? AND vi_tri_hien_tai = 'KHO' AND trang_thai = 'SAN_SANG'
      ORDER BY ma_ca_the ASC
    `, [maThietBi]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  }
}

// GET /api/instances/department/:maKhoa — Lấy danh sách cá thể thiết bị khoa đang mượn (để trả thiết bị)
export async function getDepartmentInstances(req, res) {
  try {
    const maKhoa = req.params.maKhoa;
    const [rows] = await pool.query(`
      SELECT c.*, tb.ten_thiet_bi, tb.hinh_anh, tb.don_vi_co_so, kp.ten_khoa
      FROM ca_the_thiet_bi c
      JOIN thiet_bi tb ON c.ma_thiet_bi = tb.ma_thiet_bi
      LEFT JOIN khoa kp ON c.ma_khoa_hien_tai = kp.ma_khoa
      WHERE c.ma_khoa_hien_tai = ? AND c.trang_thai = 'DANG_SU_DUNG'
      ORDER BY c.ngay_tra_du_kien ASC, c.ma_ca_the ASC
    `, [maKhoa]);

    const result = rows.map(r => {
      const daysLeft = calculateDaysLeft(r.ngay_tra_du_kien);
      return {
        maCaThe: r.ma_ca_the,
        maThietBi: r.ma_thiet_bi,
        tenThietBi: r.ten_thiet_bi,
        serialNumber: r.serial_number || "",
        hinhAnh: r.hinh_anh,
        donViCoSo: r.don_vi_co_so,
        maKhoa: r.ma_khoa_hien_tai,
        tenKhoa: r.ten_khoa,
        maPhieuCapPhat: r.ma_phieu_cap_phat_hien_tai,
        ngayCapPhat: r.ngay_cap_phat,
        ngayTraDuKien: r.ngay_tra_du_kien,
        soNgayConLai: daysLeft,
        trangThaiHan: daysLeft === null ? "CON_HAN" : (daysLeft < 0 ? "QUA_HAN" : (daysLeft <= 3 ? "SAP_DEN_HAN" : "CON_HAN")),
        ghiChu: r.ghi_chu || ""
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  }
}
