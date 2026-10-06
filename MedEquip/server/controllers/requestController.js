import { pool } from "../config/db.js";
import { sendNotification } from "../utils/notificationHelper.js";

function mapRequest(row) {
  return {
    maPhieu: row.ma_phieu,
    loaiDeXuat: row.loai_de_xuat || 'CAP_PHAT',
    maKhoaNhan: row.ma_khoa_nhan || null,
    maCaThe: row.ma_ca_the || null,
    duToanKinhPhi: row.du_toan_kinh_phi ? parseFloat(row.du_toan_kinh_phi) : null,
    mucDoUuTien: row.muc_do_uu_tien || 'BINH_THUONG',
    tenThietBiMoi: row.ten_thiet_bi_moi || null,
    quyCachKyThuat: row.quy_cach_ky_thuat || null,
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
    maPhieuCapPhatCu: row.ma_phieu_cap_phat_cu || null,
    anhMinhChung: row.anh_minh_chung || null
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
        "SELECT ct.*, COALESCE(t.ten_thiet_bi, ct.ten_thiet_bi_moi, ct.ma_thiet_bi) as ten_thiet_bi, t.loai_thiet_bi, t.don_vi_co_so as don_vi_co_so_tb FROM chi_tiet_yeu_cau ct LEFT JOIN thiet_bi t ON ct.ma_thiet_bi = t.ma_thiet_bi WHERE ct.ma_phieu_yeu_cau = ?",
        [row.ma_phieu]
      );

      // Lấy danh sách cá thể máy đã cấp (nếu có)
      const [assignedUnits] = await pool.query(
        `SELECT cpct.ma_thiet_bi, cpct.ma_ca_the, c.serial_number, c.vi_tri_hien_tai
         FROM phieu_cap_phat pcp
         JOIN cap_phat_ca_the cpct ON pcp.ma_phieu = cpct.ma_phieu_cap_phat
         LEFT JOIN ca_the_thiet_bi c ON cpct.ma_ca_the = c.ma_ca_the
         WHERE pcp.ma_phieu_yeu_cau = ?`,
        [row.ma_phieu]
      );

      return {
        ...mapRequest(row),
        items: items.map(i => {
          const units = assignedUnits.filter(u => u.ma_thiet_bi === i.ma_thiet_bi);
          return {
            maThietBi: i.ma_thiet_bi,
            tenThietBi: i.ten_thiet_bi,
            loaiThietBi: i.loai_thiet_bi,
            soLuong: i.so_luong,
            trangThai: i.trang_thai,
            donViTinh: i.don_vi_tinh,
            soLuongCoSo: i.so_luong_co_so,
            donViCoSo: i.don_vi_co_so_tb,
            lyDoTuChoi: i.ly_do_tu_choi || "",
            ngayTraDuKien: i.ngay_tra_du_kien,
            danhSachCaThe: units.map(u => ({
              maCaThe: u.ma_ca_the,
              serialNumber: u.serial_number || ""
            }))
          };
        })
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
    const { 
      maNguoiYeuCau, maKhoa, lyDo, items,
      loaiDeXuat = 'CAP_PHAT', maKhoaNhan, maCaThe, duToanKinhPhi, mucDoUuTien = 'BINH_THUONG',
      tenThietBiMoi, quyCachKyThuat
    } = req.body;

    let prefix = 'YCCF-';
    let defaultStatus = 'CHO_TRUONG_KHOA_DUYET';
    let notifTitle = 'Yêu cầu cấp phát mới';

    if (loaiDeXuat === 'DIEU_CHUYEN') {
      prefix = 'DXDC-';
      notifTitle = 'Đề xuất điều chuyển thiết bị mới';
    } else if (loaiDeXuat === 'MUA_SAM') {
      prefix = 'DXMS-';
      notifTitle = 'Đề xuất mua sắm thiết bị mới';
    } else if (loaiDeXuat === 'BAO_HONG') {
      prefix = 'DXBH-';
      notifTitle = 'Báo hỏng & đề xuất sửa chữa thiết bị';
    }

    const id = prefix + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
    
    // Xử lý danh sách items linh hoạt
    let finalItems = items && Array.isArray(items) && items.length > 0 ? items : [];

    if (finalItems.length === 0) {
      if (loaiDeXuat === 'MUA_SAM') {
        finalItems = [{
          maThietBi: 'NEW_PURCHASE',
          tenThietBi: tenThietBiMoi || 'Thiết bị mua sắm mới',
          soLuong: req.body.soLuong || 1,
          donVi: req.body.donViTinh || 'Cái',
          donGiaDuKien: duToanKinhPhi || 0
        }];
      } else if (loaiDeXuat === 'DIEU_CHUYEN' || loaiDeXuat === 'BAO_HONG') {
        let tbCode = req.body.maThietBi || 'TB-DEVICE';
        if (maCaThe) {
          const [instRows] = await conn.query("SELECT ma_thiet_bi FROM ca_the_thiet_bi WHERE ma_ca_the = ?", [maCaThe]);
          if (instRows.length > 0) tbCode = instRows[0].ma_thiet_bi;
        }
        finalItems = [{
          maThietBi: tbCode,
          maCaThe: maCaThe || null,
          soLuong: 1,
          donVi: 'Cái'
        }];
      } else {
        return res.status(400).json({ success: false, message: "Danh sách thiết bị không hợp lệ." });
      }
    }

    const firstItem = finalItems[0];

    // Thêm phiếu yêu cầu chính
    await conn.query(
      `INSERT INTO phieu_yeu_cau 
        (ma_phieu, loai_de_xuat, ma_khoa_nhan, ma_ca_the, du_toan_kinh_phi, muc_do_uu_tien, ten_thiet_bi_moi, quy_cach_ky_thuat,
         ma_nguoi_yeu_cau, ma_thiet_bi, ma_khoa, so_luong_yeu_cau, ly_do, trang_thai, ma_phieu_cap_phat_cu) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, loaiDeXuat, maKhoaNhan || null, maCaThe || firstItem.maCaThe || null, 
        duToanKinhPhi || null, mucDoUuTien || 'BINH_THUONG', tenThietBiMoi || null, quyCachKyThuat || null,
        maNguoiYeuCau || req.user.userId, firstItem.maThietBi || 'TB', maKhoa, firstItem.soLuong || 1, 
        lyDo || "", defaultStatus, req.body.maPhieuCapPhatCu || null
      ]
    );

    // Thêm chi tiết yêu cầu
    for (const item of finalItems) {
      let donVi = item.donVi || 'Cái';
      let factor = 1;
      if (item.maThietBi && item.maThietBi !== 'NEW_PURCHASE') {
        const [tbRows] = await conn.query("SELECT don_vi_co_so, don_vi_nhap, he_so_quy_doi FROM thiet_bi WHERE ma_thiet_bi = ?", [item.maThietBi]);
        if (tbRows.length > 0) {
          const tb = tbRows[0];
          donVi = item.donVi || tb.don_vi_co_so;
          factor = (donVi === tb.don_vi_nhap) ? (tb.he_so_quy_doi || 1) : 1;
        }
      }
      const soLuongCoSo = (item.soLuong || 1) * factor;

      await conn.query(
        `INSERT INTO chi_tiet_yeu_cau 
          (ma_phieu_yeu_cau, ma_thiet_bi, ma_ca_the, ten_thiet_bi_moi, so_luong, don_vi_tinh, so_luong_co_so, trang_thai, ngay_tra_du_kien) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 'CHO_DUYET', ?)`,
        [id, item.maThietBi || null, item.maCaThe || maCaThe || null, item.tenThietBi || tenThietBiMoi || null, item.soLuong || 1, donVi, soLuongCoSo, item.ngayTraDuKien || null]
      );
    }

    // Thông báo cho Trưởng khoa của phòng ban yêu cầu
    const [receivers] = await conn.query("SELECT ma_nguoi_dung FROM nguoi_dung WHERE vai_tro = 'TRUONG_KHOA' AND ma_khoa = ?", [maKhoa]);
    for (const r of receivers) {
      await sendNotification(r.ma_nguoi_dung, notifTitle, `Trợ lý khoa vừa tạo ${notifTitle.toLowerCase()} mã ${id}.`, 'info');
    }

    await conn.commit();
    res.json({ success: true, maPhieu: id, loaiDeXuat });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi máy chủ: " + err.message });
  } finally {
    conn.release();
  }
}

export async function approveDept(req, res) {
  const conn = await pool.getConnection();
  try {
    let items = req.body.items;
    const phieuId = req.params.id;

    const [reqData] = await conn.query("SELECT ma_nguoi_yeu_cau, ma_thiet_bi, ma_khoa FROM phieu_yeu_cau WHERE ma_phieu = ?", [phieuId]);
    if (reqData.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu" });
    }

    if (!items || !Array.isArray(items)) {
      if (req.body.approved !== undefined) {
        items = [{ maThietBi: reqData[0].ma_thiet_bi || 'TB', approved: !!req.body.approved, lyDo: req.body.lyDo || '' }];
      } else {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
      }
    }

    let approvedCount = 0;
    for (const item of items) {
      if (item.approved) {
        approvedCount++;
      } else {
        await conn.query("UPDATE chi_tiet_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE ma_phieu_yeu_cau = ? AND ma_thiet_bi = ?", [item.lyDo || "", phieuId, item.maThietBi]);
      }
    }

    const isAllRejected = (approvedCount === 0);

    if (isAllRejected) {
      const rejectReason = items[0]?.lyDo || req.body.lyDo || "Bị từ chối bởi Trưởng khoa";
      await conn.query(
        "UPDATE phieu_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ?, nguoi_duyet = ? WHERE ma_phieu = ?",
        [rejectReason, req.user.userId, phieuId]
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
    let items = req.body.items;
    const phieuId = req.params.id;

    const [reqData] = await conn.query("SELECT ma_nguoi_yeu_cau, ma_thiet_bi, ma_khoa FROM phieu_yeu_cau WHERE ma_phieu = ?", [phieuId]);
    if (reqData.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Không tìm thấy phiếu" });
    }

    if (!items || !Array.isArray(items)) {
      if (req.body.approved !== undefined) {
        items = [{ maThietBi: reqData[0].ma_thiet_bi || 'TB', approved: !!req.body.approved, lyDo: req.body.lyDo || '' }];
      } else {
        await conn.rollback();
        return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
      }
    }

    let approvedCount = 0;

    for (const item of items) {
      if (item.approved) {
        approvedCount++;
      } else {
        await conn.query("UPDATE chi_tiet_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ? WHERE ma_phieu_yeu_cau = ? AND ma_thiet_bi = ?", [item.lyDo || "", phieuId, item.maThietBi]);
      }
    }

    const isAllRejected = (approvedCount === 0);

    if (isAllRejected) {
      const rejectReason = items[0]?.lyDo || req.body.lyDo || "Bị từ chối bởi QL Kho";
      await conn.query(
        "UPDATE phieu_yeu_cau SET trang_thai = 'TU_CHOI', ly_do_tu_choi = ?, nguoi_duyet = ? WHERE ma_phieu = ?",
        [rejectReason, req.user.userId, phieuId]
      );
    } else {
      const [pRows] = await conn.query("SELECT loai_de_xuat, ma_khoa_nhan, ma_ca_the FROM phieu_yeu_cau WHERE ma_phieu = ?", [phieuId]);
      const p = pRows[0];

      if (p?.loai_de_xuat === 'DIEU_CHUYEN' && p?.ma_ca_the && p?.ma_khoa_nhan) {
        // Cập nhật vị trí máy sang Khoa nhận
        await conn.query("UPDATE ca_the_thiet_bi SET ma_khoa_hien_tai = ?, trang_thai = 'DANG_SU_DUNG', ngay_cap_nhat = NOW() WHERE ma_ca_the = ?", [p.ma_khoa_nhan, p.ma_ca_the]);
        await conn.query("UPDATE phieu_yeu_cau SET trang_thai = 'HOAN_THANH', ngay_duyet = NOW(), nguoi_duyet = ? WHERE ma_phieu = ?", [req.user.userId, phieuId]);
      } else if (p?.loai_de_xuat === 'BAO_HONG' && p?.ma_ca_the) {
        // Cập nhật máy sang trạng thái đang bảo trì/sửa chữa
        await conn.query("UPDATE ca_the_thiet_bi SET trang_thai = 'DANG_BAO_TRI', ngay_cap_nhat = NOW() WHERE ma_ca_the = ?", [p.ma_ca_the]);
        await conn.query("UPDATE phieu_yeu_cau SET trang_thai = 'HOAN_THANH', ngay_duyet = NOW(), nguoi_duyet = ? WHERE ma_phieu = ?", [req.user.userId, phieuId]);
      } else if (p?.loai_de_xuat === 'MUA_SAM') {
        await conn.query("UPDATE phieu_yeu_cau SET trang_thai = 'DA_DUYET', ngay_duyet = NOW(), nguoi_duyet = ? WHERE ma_phieu = ?", [req.user.userId, phieuId]);
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
      `SELECT ct.*, COALESCE(t.ten_thiet_bi, ct.ten_thiet_bi_moi, ct.ma_thiet_bi) as ten_thiet_bi, t.don_vi_co_so as don_vi_co_so_tb, tk.so_luong_kho 
       FROM chi_tiet_yeu_cau ct 
       LEFT JOIN thiet_bi t ON ct.ma_thiet_bi = t.ma_thiet_bi 
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
    const { items, ghiChu, proofImage } = req.body; // items: [{maThietBi, approved, lyDo}]

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
        approvedDetails.push({ 
          maThietBi: item.maThietBi, 
          soLuong, 
          soLuongCoSo, 
          donViTinh: reqItem.don_vi_tinh, 
          ngayTraDuKien: reqItem.ngay_tra_du_kien,
          selectedInstances: item.selectedInstances || []
        });
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
          await conn.query(
            "UPDATE ca_the_thiet_bi SET ngay_tra_du_kien = ? WHERE ma_phieu_cap_phat_hien_tai = ? AND ma_thiet_bi = ?",
            [det.ngayTraDuKien, request.ma_phieu_cap_phat_cu, det.maThietBi]
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

          // Gắn mã cá thể thiết bị cho thiết bị tái sử dụng
          const [tbInfo] = await conn.query("SELECT loai_thiet_bi FROM thiet_bi WHERE ma_thiet_bi = ?", [det.maThietBi]);
          if (tbInfo[0]?.loai_thiet_bi === 'TAI_SU_DUNG') {
            let instancesToAssign = det.selectedInstances || [];
            // Nếu chưa chọn cụ thể, tự động lấy các máy sẵn sàng trong kho
            if (!instancesToAssign || instancesToAssign.length === 0) {
              const [availRows] = await conn.query(
                "SELECT ma_ca_the FROM ca_the_thiet_bi WHERE ma_thiet_bi = ? AND vi_tri_hien_tai = 'KHO' AND trang_thai = 'SAN_SANG' LIMIT ?",
                [det.maThietBi, det.soLuongCoSo]
              );
              instancesToAssign = availRows.map(r => r.ma_ca_the);
            }

            for (const code of instancesToAssign) {
              await conn.query(`
                UPDATE ca_the_thiet_bi 
                SET vi_tri_hien_tai = 'KHOA_PHONG',
                    ma_khoa_hien_tai = ?,
                    ma_phieu_cap_phat_hien_tai = ?,
                    trang_thai = 'DANG_SU_DUNG',
                    ngay_cap_phat = NOW(),
                    ngay_tra_du_kien = ?
                WHERE ma_ca_the = ?
              `, [request.ma_khoa, cpId, det.ngayTraDuKien || null, code]);

              await conn.query(`
                INSERT INTO cap_phat_ca_the (ma_phieu_cap_phat, ma_thiet_bi, ma_ca_the, trang_thai)
                VALUES (?, ?, ?, 'DANG_SU_DUNG')
              `, [cpId, det.maThietBi, code]);
            }
          }
        }
      }

      await conn.query("UPDATE phieu_yeu_cau SET trang_thai = 'DA_CAP_PHAT', ma_nv_kho_thuc_hien = ?, anh_minh_chung = ? WHERE ma_phieu = ?", [req.user.userId, proofImage || null, id]);
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
