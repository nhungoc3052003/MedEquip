import { pool } from "../config/db.js";
import { sendNotification } from "../utils/notificationHelper.js";

function mapRequest(row) {
  return {
    maPhieu: row.ma_phieu,
    maNguoiYeuCau: row.ma_nguoi_yeu_cau,
    maThietBi: row.ma_thiet_bi,
    maKhoa: row.ma_khoa,
    soLuongYeuCau: row.so_luong_yeu_cau,
    lyDo: row.ly_do || "",
    trangThai: row.trang_thai,
    ngayTao: row.ngay_tao,
    ngayDuyet: row.ngay_duyet,
    nguoiDuyet: row.nguoi_duyet,
    lyDoTuChoi: row.ly_do_tu_choi || "",
    maPhieuCapPhatCu: row.ma_phieu_cap_phat_cu || null
  };
}

export async function getAllRequests(req, res) {
  try {
    let sql = "SELECT * FROM phieu_yeu_cau WHERE 1=1";
    const params = [];
    if (req.query.maKhoa) { sql += " AND ma_khoa = ?"; params.push(req.query.maKhoa); }
    if (req.query.trangThai) { sql += " AND trang_thai = ?"; params.push(req.query.trangThai); }
    sql += " ORDER BY ngay_tao DESC";
    const [rows] = await pool.query(sql, params);

    // Lấy danh sách thiết bị cho từng yêu cầu
    const requestsWithItems = await Promise.all(rows.map(async (row) => {
      const [items] = await pool.query(
        "SELECT ct.*, t.ten_thiet_bi, t.don_vi_co_so as don_vi_co_so_tb FROM chi_tiet_yeu_cau ct JOIN thiet_bi t ON ct.ma_thiet_bi = t.ma_thiet_bi WHERE ct.ma_phieu_yeu_cau = ?",
        [row.ma_phieu]
      );
      return {
        ...mapRequest(row),
        items: items.map(i => ({
          maThietBi: i.ma_thiet_bi,
          tenThietBi: i.ten_thiet_bi,
          soLuong: i.so_luong,
          trangThai: i.trang_thai,
          donViTinh: i.don_vi_tinh,
          soLuongCoSo: i.so_luong_co_so,
          donViCoSo: i.don_vi_co_so_tb,
          lyDoTuChoi: i.ly_do_tu_choi || "",
          ngayTraDuKien: i.ngay_tra_du_kien
        }))
      };
    }));

    res.json(requestsWithItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
}

export async function createRequest(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { maNguoiYeuCau, maKhoa, lyDo, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Danh sách thiết bị không hợp lệ." });
    }

    const id = "YCCF-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
    const firstItem = items[0];

    // Thêm phiếu yêu cầu chính (đảm bảo tương thích ngược với ma_thiet_bi và so_luong_yeu_cau)
    await conn.query(
      "INSERT INTO phieu_yeu_cau (ma_phieu, ma_nguoi_yeu_cau, ma_thiet_bi, ma_khoa, so_luong_yeu_cau, ly_do, trang_thai, ma_phieu_cap_phat_cu) VALUES (?, ?, ?, ?, ?, ?, 'CHO_TRUONG_KHOA_DUYET', ?)",
      [id, maNguoiYeuCau || req.user.userId, firstItem.maThietBi, maKhoa, firstItem.soLuong, lyDo || "", req.body.maPhieuCapPhatCu || null]
    );

    // Thêm tất cả các thiết bị chi tiết
    for (const item of items) {
      const [tbRows] = await conn.query("SELECT don_vi_co_so, don_vi_nhap, he_so_quy_doi FROM thiet_bi WHERE ma_thiet_bi = ?", [item.maThietBi]);
      const tb = tbRows[0] || { don_vi_co_so: 'Cái', he_so_quy_doi: 1 };
      
      const donVi = item.donVi || tb.don_vi_co_so;
      const factor = (donVi === tb.don_vi_nhap) ? (tb.he_so_quy_doi || 1) : 1;
      const soLuongCoSo = item.soLuong * factor;

      await conn.query(
        "INSERT INTO chi_tiet_yeu_cau (ma_phieu_yeu_cau, ma_thiet_bi, so_luong, don_vi_tinh, so_luong_co_so, trang_thai, ngay_tra_du_kien) VALUES (?, ?, ?, ?, ?, 'CHO_DUYET', ?)",
        [id, item.maThietBi, item.soLuong, donVi, soLuongCoSo, item.ngayTraDuKien || null]
      );
    }

    // Thông báo cho Trưởng khoa của phòng ban yêu cầu
    const [receivers] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'TRUONG_KHOA' AND ma_khoa = ?", [maKhoa]);
    for (const r of receivers) {
      await sendNotification(r.ma_nguoi_dung, "Yêu cầu cấp phát mới", `Trợ lý ${maNguoiYeuCau || req.user.userId} vừa tạo yêu cầu cấp phát mới mã ${id} với ${items.length} hạng mục.`, 'info');
    }

    await conn.commit();
    res.json({ success: true, maPhieu: id });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    conn.release();
  }
}

export async function approveDept(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { items } = req.body;
    const phieuId = req.params.id;

    if (!items || !Array.isArray(items)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
    }

    let approvedCount = 0;

    for (const item of items) {
      if (item.approved) {
        approvedCount++;
      } else {
        await conn.query("UPDATE chi_tiet_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE ma_phieu_yeu_cau = ? AND ma_thiet_bi = ?", [item.lyDo || "", phieuId, item.maThietBi]);
      }
    }

    const [reqData] = await conn.query("SELECT ma_nguoi_yeu_cau, ma_thiet_bi FROM phieu_yeu_cau WHERE ma_phieu = ?", [phieuId]);
    if (reqData.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu" });
    }

    const isAllRejected = (approvedCount === 0);

    if (isAllRejected) {
      await conn.query(
        "UPDATE phieu_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ?, nguoi_duyet = ? WHERE ma_phieu = ?",
        ["Tất cả thiết bị bị từ chối bởi Trưởng khoa", req.user.userId, phieuId]
      );
    } else {
      await conn.query(
        "UPDATE phieu_yeu_cau SET trang_thai = 'CHO_QL_KHO_DUYET', ngay_duyet = NOW(), nguoi_duyet = ? WHERE ma_phieu = ?",
        [req.user.userId, phieuId]
      );
      
      const [qlKho] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'QL_KHO'");
      for(const ql of qlKho) {
        await sendNotification(ql.ma_nguoi_dung, "Yêu cầu cần duyệt", `Có yêu cầu cấp phát ${phieuId} đã được Trưởng khoa duyệt ${approvedCount} thiết bị, đang chờ bạn xử lý.`, "info");
      }
    }

    const msg = isAllRejected ? `Yêu cầu cấp phát ${phieuId} của bạn đã bị từ chối hoàn toàn.` : `Yêu cầu cấp phát ${phieuId} của bạn đã được Trưởng khoa phê duyệt ${approvedCount} thiết bị, chờ QL Kho duyệt.`;
    await sendNotification(reqData[0].ma_nguoi_yeu_cau, isAllRejected ? "Yêu cầu bị từ chối" : "Yêu cầu được chấp nhận", msg, isAllRejected ? "error" : "success");

    await conn.commit();
    res.json({ success: true, newStatus: isAllRejected ? "TU_CHOI" : "CHO_QL_KHO_DUYET", message: isAllRejected ? "Đã từ chối tất cả." : "Đã duyệt." });
  } catch (err) {
    try { await conn.rollback(); } catch(e) {}
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    try { conn.release(); } catch(e) {}
  }
}

export async function approveManager(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { items } = req.body;
    const phieuId = req.params.id;

    if (!items || !Array.isArray(items)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
    }

    let approvedCount = 0;

    for (const item of items) {
      if (item.approved) {
        approvedCount++;
      } else {
        await conn.query("UPDATE chi_tiet_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE ma_phieu_yeu_cau = ? AND ma_thiet_bi = ?", [item.lyDo || "", phieuId, item.maThietBi]);
      }
    }

    const [reqData] = await conn.query("SELECT ma_nguoi_yeu_cau, ma_khoa FROM phieu_yeu_cau WHERE ma_phieu = ?", [phieuId]);
    if (reqData.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu" });
    }

    const isAllRejected = (approvedCount === 0);

    if (isAllRejected) {
      await conn.query(
        "UPDATE phieu_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE ma_phieu = ?",
        ["Tất cả thiết bị bị từ chối bởi QL Kho", phieuId]
      );
    } else {
      await conn.query(
        "UPDATE phieu_yeu_cau SET trang_thai = 'DA_QL_KHO_DUYET' WHERE ma_phieu = ?",
        [phieuId]
      );
      
      const [nvKho] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'NV_KHO'");
      for(const nv of nvKho) {
        await sendNotification(nv.ma_nguoi_dung, "Yêu cầu cấp phát mới", `Yêu cầu cấp phát ${phieuId} đã được QL Kho duyệt ${approvedCount} thiết bị, chờ bạn thực hiện cấp phát.`, "info");
      }
    }

    const msg = isAllRejected ? `Yêu cầu cấp phát ${phieuId} đã bị từ chối hoàn toàn bởi QL Kho.` : `Yêu cầu cấp phát ${phieuId} đã được Quản lý Kho phê duyệt ${approvedCount} thiết bị, chờ NV Kho thực hiện.`;
    await sendNotification(reqData[0].ma_nguoi_yeu_cau, isAllRejected ? "Yêu cầu bị từ chối" : "Yêu cầu được chấp nhận", msg, isAllRejected ? "error" : "success");

    const [tkData] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE ma_khoa = ? AND vai_tro = 'TRUONG_KHOA'", [reqData[0].ma_khoa]);
    for (const tk of tkData) {
      if (tk.ma_nguoi_dung !== reqData[0].ma_nguoi_yeu_cau) {
        await sendNotification(tk.ma_nguoi_dung, isAllRejected ? "Yêu cầu của Khoa bị từ chối" : "Yêu cầu của Khoa được chấp nhận", msg, isAllRejected ? "error" : "success");
      }
    }

    await conn.commit();
    res.json({ success: true, newStatus: isAllRejected ? "TU_CHOI" : "DA_QL_KHO_DUYET", message: isAllRejected ? "Đã từ chối tất cả." : "Quản lý đã duyệt." });
  } catch (err) {
    try { await conn.rollback(); } catch(e) {}
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    try { conn.release(); } catch(e) {}
  }
}

export async function scanRequest(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM phieu_yeu_cau WHERE ma_phieu = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu." });

    const request = mapRequest(rows[0]);
    const [items] = await pool.query(
      `SELECT ct.*, t.ten_thiet_bi, t.don_vi_co_so as don_vi_co_so_tb, tk.so_luong_kho 
       FROM chi_tiet_yeu_cau ct 
       JOIN thiet_bi t ON ct.ma_thiet_bi = t.ma_thiet_bi 
       LEFT JOIN ton_kho tk ON ct.ma_thiet_bi = tk.ma_thiet_bi
       WHERE ct.ma_phieu_yeu_cau = ?`,
      [id]
    );

    res.json({
      success: true,
      request,
      items: items.map(i => ({
        maThietBi: i.ma_thiet_bi,
        tenThietBi: i.ten_thiet_bi,
        soLuong: i.so_luong,
        trangThai: i.trang_thai,
        donViTinh: i.don_vi_tinh,
        soLuongCoSo: i.so_luong_co_so,
        tonKho: i.so_luong_kho || 0,
        donViCoSo: i.don_vi_co_so_tb,
        lyDoTuChoi: i.ly_do_tu_choi || "",
        ngayTraDuKien: i.ngay_tra_du_kien
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function processRequestItems(req, res) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { items, ghiChu } = req.body; // items: [{maThietBi, approved, lyDo}]

    const [reqRows] = await conn.query("SELECT * FROM phieu_yeu_cau WHERE ma_phieu = ?", [id]);
    if (reqRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu." });
    }
    const request = reqRows[0];

    let approvedCount = 0;
    const approvedDetails = [];

    for (const item of items) {
      if (item.approved) {
        // Kiểm tra tồn kho
        const [inv] = await conn.query("SELECT so_luong_kho FROM ton_kho WHERE ma_thiet_bi = ?", [item.maThietBi]);
        const [reqItems] = await conn.query("SELECT so_luong, so_luong_co_so, don_vi_tinh, ngay_tra_du_kien FROM chi_tiet_yeu_cau WHERE ma_phieu_yeu_cau = ? AND ma_thiet_bi = ?", [id, item.maThietBi]);

        if (reqItems.length === 0) continue;
        const reqItem = reqItems[0];
        const soLuong = reqItem.so_luong;
        const soLuongCoSo = reqItem.so_luong_co_so;

        if (inv.length === 0 || inv[0].so_luong_kho < soLuongCoSo) {
          await conn.rollback();
          return res.json({ success: false, message: `Không đủ tồn kho cho thiết bị ${item.maThietBi}. Hiện có: ${inv[0]?.so_luong_kho || 0} đơn vị cơ sở.` });
        }

        // Cập nhật trạng thái thiết bị
        await conn.query(
          "UPDATE chi_tiet_yeu_cau SET trang_thai = 'DA_DUYET' WHERE ma_phieu_yeu_cau = ? AND ma_thiet_bi = ?",
          [id, item.maThietBi]
        );

        // Cập nhật tồn kho (Logic tích hợp cho thiết bị dùng lại và vật tư tiêu hao)
        const [tbRows] = await conn.query("SELECT loai_thiet_bi FROM thiet_bi WHERE ma_thiet_bi = ?", [item.maThietBi]);
        const isTieuHao = (tbRows[0]?.loai_thiet_bi === 'VAT_TU_TIEU_HAO');

        if (isTieuHao) {
          await conn.query(
            "UPDATE ton_kho SET so_luong_kho = so_luong_kho - ? WHERE ma_thiet_bi = ?",
            [soLuongCoSo, item.maThietBi]
          );
        } else {
          await conn.query(
            "UPDATE ton_kho SET so_luong_kho = so_luong_kho - ?, so_luong_dang_dung = so_luong_dang_dung + ? WHERE ma_thiet_bi = ?",
            [soLuongCoSo, soLuongCoSo, item.maThietBi]
          );
        }

        approvedCount++;
        approvedDetails.push({ maThietBi: item.maThietBi, soLuong, soLuongCoSo, donViTinh: reqItem.don_vi_tinh, ngayTraDuKien: reqItem.ngay_tra_du_kien });
      } else {
        // Từ chối thiết bị
        await conn.query(
          "UPDATE chi_tiet_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE ma_phieu_yeu_cau = ? AND ma_thiet_bi = ?",
          [item.lyDo || "", id, item.maThietBi]
        );
      }
    }

    if (approvedCount > 0) {
      if (request.ma_phieu_cap_phat_cu) {
        // GIA HẠN: Cập nhật lại phiếu cũ
        for (const det of approvedDetails) {
          await conn.query(
            "UPDATE chi_tiet_cap_phat SET ngay_tra_du_kien = ?, trang_thai_tra = 'DA_GIA_HAN', ly_do_gia_han = ? WHERE ma_phieu_cap_phat = ? AND ma_thiet_bi = ?",
            [det.ngayTraDuKien, `Đã gia hạn theo phiếu ${id}`, request.ma_phieu_cap_phat_cu, det.maThietBi]
          );
        }
      } else {
        // CẤP PHÁT MỚI
        const cpId = "CP-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
        await conn.query(
          "INSERT INTO phieu_cap_phat (ma_phieu, ma_phieu_yeu_cau, ma_nguoi_cap, ma_khoa_nhan, ghi_chu) VALUES (?, ?, ?, ?, ?)",
          [cpId, id, req.user.userId, request.ma_khoa, ghiChu || ""]
        );

        for (const det of approvedDetails) {
          await conn.query(
            "INSERT INTO chi_tiet_cap_phat (ma_phieu_cap_phat, ma_thiet_bi, so_luong, don_vi_tinh, so_luong_co_so, ngay_tra_du_kien, trang_thai_tra) VALUES (?, ?, ?, ?, ?, ?, 'CHUA_TRA')",
            [cpId, det.maThietBi, det.soLuong, det.donViTinh, det.soLuongCoSo, det.ngayTraDuKien || null]
          );
        }
      }

      await conn.query("UPDATE phieu_yeu_cau SET trang_thai = 'DA_CAP_PHAT', ma_nv_kho_thuc_hien = ? WHERE ma_phieu = ?", [req.user.userId, id]);
    } else {
      await conn.query("UPDATE phieu_yeu_cau SET trang_thai = 'TU_CHOI', ma_nv_kho_thuc_hien = ? WHERE ma_phieu = ?", [req.user.userId, id]);
    }

    // Thông báo cho người yêu cầu
    await sendNotification(request.ma_nguoi_yeu_cau, 
        approvedCount > 0 ? "Thiết bị đã sẵn sàng" : "Yêu cầu bị từ chối",
        approvedCount > 0 ? `Yêu cầu ${id} đã được cấp phát ${approvedCount} thiết bị.` : `Yêu cầu ${id} của bạn đã bị từ chối hoàn toàn.`,
        approvedCount > 0 ? 'success' : 'error'
    );

    // Tìm Trưởng khoa của khoa này để thông báo (nếu Trưởng khoa khác với người yêu cầu)
    const [tkData] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE ma_khoa = ? AND vai_tro = 'TRUONG_KHOA'", [request.ma_khoa]);
    for (const tk of tkData) {
      if (tk.ma_nguoi_dung !== request.ma_nguoi_yeu_cau) {
        await sendNotification(tk.ma_nguoi_dung, 
          approvedCount > 0 ? "Thiết bị cho Khoa đã sẵn sàng" : "Yêu cầu của Khoa bị từ chối", 
          approvedCount > 0 ? `Yêu cầu ${id} đã được cấp phát ${approvedCount} thiết bị.` : `Yêu cầu ${id} của Khoa đã bị từ chối hoàn toàn.`, 
          approvedCount > 0 ? 'success' : 'error'
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: approvedCount > 0 ? "Đã xuất kho thành công." : "Đã từ chối tất cả thiết bị." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  } finally {
    conn.release();
  }
}

export async function confirmReceived(req, res) {
  try {
    res.json({ success: true, message: "Đã xác nhận nhận hàng." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}

export async function cancelRequest(req, res) {
  try {
    const { id } = req.params;

    // Chỉ cho phép vai trò TRO_LY hủy phiếu
    if (req.user.vaiTro !== 'TRO_LY' && req.user.vaiTro !== 'ADMIN') {
      return res.status(403).json({ success: false, message: "Chỉ Trợ lý mới có quyền hủy phiếu yêu cầu." });
    }

    const [rows] = await pool.query("SELECT * FROM phieu_yeu_cau WHERE ma_phieu = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy phiếu." });

    if (rows[0].trang_thai !== 'CHO_TRUONG_KHOA_DUYET' && rows[0].trang_thai !== 'CHO_DUYET') {
      return res.status(400).json({ success: false, message: "Chỉ có thể hủy phiếu đang chờ Trưởng khoa duyệt." });
    }

    // Kiểm tra thời hạn 30 phút kể từ khi tạo phiếu
    const createdAt = new Date(rows[0].ngay_tao);
    const now = new Date();
    const diffMinutes = (now - createdAt) / (1000 * 60);
    if (diffMinutes > 30 && req.user.vaiTro !== 'ADMIN') {
      return res.status(400).json({ success: false, message: "Đã quá 30 phút kể từ khi tạo phiếu. Không thể hủy phiếu này nữa." });
    }

    // Chỉ người tạo phiếu (hoặc ADMIN) mới được hủy
    if (rows[0].ma_nguoi_yeu_cau !== req.user.userId && req.user.vaiTro !== 'ADMIN') {
      return res.status(403).json({ success: false, message: "Bạn không có quyền hủy phiếu này." });
    }

    await pool.query(
      "UPDATE phieu_yeu_cau SET trang_thai = 'DA_HUY', ly_do_tu_choi = 'Phiếu yêu cầu đã bị hủy bởi người yêu cầu' WHERE ma_phieu = ?",
      [id]
    );

    await pool.query(
      "UPDATE chi_tiet_yeu_cau SET trang_thai = 'DA_HUY', ly_do_tu_choi = 'Phiếu yêu cầu đã bị hủy bởi người yêu cầu' WHERE ma_phieu_yeu_cau = ?",
      [id]
    );

    res.json({ success: true, message: "Đã hủy phiếu yêu cầu." });
  } catch (err) {
    console.error("Cancel Request Error:", err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ." });
  }
}



export async function deleteRequest(req, res) {
  try {
    const { id } = req.params;

    // Kiểm tra xem phiếu yêu cầu có đang được tham chiếu trong bảng cấp phát không
    const [allocations] = await pool.query("SELECT * FROM phieu_cap_phat WHERE ma_phieu_yeu_cau = ?", [id]);
    if (allocations.length > 0) {
      return res.status(400).json({ success: false, message: "Không thể xóa phiếu yêu cầu đã được cấp phát." });
    }

    await pool.query("DELETE FROM chi_tiet_yeu_cau WHERE ma_phieu_yeu_cau = ?", [id]);
    await pool.query("DELETE FROM phieu_yeu_cau WHERE ma_phieu = ?", [id]);
    res.json({ success: true, message: "Đã xóa phiếu yêu cầu." });
  } catch (err) {
    console.error("Delete Request Error:", err);
    res.status(500).json({ success: false, message: `Lỗi máy chủ: ${err.message}` });
  }
}
