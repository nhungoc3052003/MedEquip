export type UserRole = 'ADMIN' | 'NV_KHO' | 'TRUONG_KHOA' | 'QL_KHO' | 'TRO_LY';

export interface FileHoSo {
  tenFile: string;
  duongDan: string;
  dungLuong?: number;
}

export interface NguoiDung {
  maNguoiDung: string;
  hoTen: string;
  email: string;
  matKhau: string;
  vaiTro: UserRole;
  trangThai: boolean;
  ngayTao: string;
  ngayCapNhat: string;
  soDienThoai?: string;
  diaChi?: string;
  maKhoa?: string;
  tenKhoa?: string;
  cccd?: string;
  ngaySinh?: string;
  chucDanh?: string;
  fileHoSo?: FileHoSo[];
  yeuCauDoiMatKhau?: boolean;
}

export interface YeuCauCapTaiKhoan {
  maYeuCau: string;
  nguoiYeuCau: string;
  tenNguoiYeuCau?: string;
  maKhoa: string;
  tenKhoa?: string;
  hoTen: string;
  email: string;
  soDienThoai?: string;
  cccd?: string;
  ngaySinh?: string;
  chucDanh?: string;
  vaiTro: UserRole;
  fileDinhKem: FileHoSo[];
  ghiChu?: string;
  trangThai: 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI';
  lyDoTuChoi?: string;
  maNguoiDungTao?: string;
  nguoiDuyet?: string;
  tenNguoiDuyet?: string;
  ngayDuyet?: string;
  ngayTao: string;
}

export type NhomThietBi = 'KHAM_BENH' | 'PHAU_THUAT' | 'CAP_CUU' | 'VAT_TU_TIEU_HAO' | 'KHAC';

// v4: ThietBi với loai ENUM và các trường mới
export interface ThietBi {
  maThietBi: string;
  tenThietBi: string;
  loaiThietBi: 'VAT_TU_TIEU_HAO' | 'TAI_SU_DUNG';
  nhomThietBi?: NhomThietBi;
  donViCoSo: string;
  donViNhap: string;
  heSoQuyDoi: number;
  serialNumber?: string;
  nguongCanhBao: number;
  moTa: string;
  maNhaCungCap: string;
  trangThai: boolean;
  ngayTao: string;
  hinhAnh?: string;
  // tồn kho (JOIN từ backend)
  soLuongKho?: number;
  chuKyBaoTri?: number;
  ngayBaoTriGanNhat?: string;
  ngayBaoTriTiepTheo?: string;
  trangThaiBaoTri?: 'BINH_THUONG' | 'SAP_DEN_HAN' | 'DANG_BAO_TRI' | 'QUA_HAN';
}

export interface TonKho {
  maTonKho: string;
  maThietBi: string;
  soLuongKho: number;
  soLuongDangDung: number;
  soLuongHu: number;
  ngayCapNhat: string;
  // low-stock join fields
  tenThietBi?: string;
  loaiThietBi?: string;
  donViCoSo?: string;
  nguongCanhBao?: number;
  donGia?: number;
}

export interface NhaCungCap {
  maNhaCungCap: string;
  tenNhaCungCap: string;
  diaChi: string;
  soDienThoai: string;
  email: string;
  trangThai: boolean;
}

export interface Khoa {
  maKhoa: string;
  tenKhoa: string;
  moTa: string;
  trangThai: boolean;
}

export type LoaiDeXuat = 'CAP_PHAT' | 'DIEU_CHUYEN' | 'MUA_SAM' | 'BAO_HONG' | 'DE_XUAT_THEM';

export interface PhieuYeuCauCapPhat {
  maPhieu: string;
  loaiDeXuat?: LoaiDeXuat;
  maKhoaNhan?: string;
  maCaThe?: string;
  duToanKinhPhi?: number;
  mucDoUuTien?: 'BINH_THUONG' | 'KHAN_CAP';
  tenThietBiMoi?: string;
  quyCachKyThuat?: string;
  maNguoiYeuCau: string;
  maThietBi: string;
  maKhoa: string;
  soLuongYeuCau: number;
  lyDo: string;
  trangThai: 'CHO_DUYET' | 'DA_DUYET' | 'CHO_TRUONG_KHOA_DUYET' | 'CHO_QL_KHO_DUYET' | 'DA_QL_KHO_DUYET' | 'CHO_KHOA_NHAN_TEST' | 'TU_CHOI' | 'DA_CAP_PHAT' | 'DA_HUY' | 'HOAN_THANH';
  ngayTao: string;
  ngayDuyet?: string;
  nguoiDuyet?: string;
  lyDoTuChoi?: string;
  anhMinhChung?: string;
  items?: any[];
  checklistKyThuat?: {
    nguonPin: boolean;
    manHinhPhim: boolean;
    camBienDayDo: boolean;
    khuKhuan: boolean;
    ngoaiQuan: boolean;
    ghiChu?: string;
  };
  maNguoiNhanTest?: string;
  ngayTiepNhan?: string;
  maNhuCau?: string;
}

export interface NhuCauThietBi {
  maNhuCau: string;
  maKhoaYeuCau: string;
  maNguoiDang: string;
  maThietBi?: string;
  tenThietBi: string;
  soLuongCan: number;
  soLuongDaDapUng: number;
  mucDoUuTien: 'BINH_THUONG' | 'KHAN_CAP';
  lyDo?: string;
  trangThai: 'DANG_TIM_KIEM' | 'HOAN_THANH' | 'DA_DONG';
  ngayTao: string;
  tenKhoaYeuCau?: string;
  tenNguoiDang?: string;
  tenThietBiGoc?: string;
}

// v4: PhieuCapPhat với ngày hạn trả và trạng thái trả
export interface PhieuCapPhat {
  maPhieu: string;
  maPhieuYeuCau: string;
  maNhanVienKho: string;
  maThietBi: string;
  tenThietBi?: string;
  loaiThietBi?: string;
  donViTinh?: string; // Thêm trường đơn vị tính khi cấp phát
  donViCoSo?: string;
  soLuongCoSo?: number; // Thêm số lượng theo đơn vị cơ sở
  maNguoiMuon: string;
  maKhoa: string;
  soLuongCapPhat: number;
  ngayCapPhat: string;
  ngayDuKienTra?: string;
  trangThaiTra: 'CHUA_TRA' | 'YEU_CAU_TRA' | 'DA_TRA' | 'DA_GIA_HAN';
  lyDoGiaHan?: string;
  ghiChu: string;
}

// v4: PhieuNhapKho với trangThai
export interface PhieuNhapKho {
  maPhieu: string;
  maNhaCungCap: string;
  tenNhaCungCap?: string;
  maThietBi: string;
  tenThietBi?: string;
  soLuongNhap: number;
  donViCoSo?: string;
  donViNhap?: string;
  donGia?: number;
  soLo?: string;
  hanSuDung?: string;
  urlAnh?: string;
  ngayNhap: string;
  maNhanVienKho: string;
  ghiChu: string;
  trangThai?: 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI';
}

// v4: Excel preview row
export interface ExcelPreviewRow {
  rowIndex: number;
  maThietBi: string;
  tenThietBi: string;
  loai: 'VAT_TU_TIEU_HAO' | 'TAI_SU_DUNG';
  soLuong: number;
  donViCoSo: string;
  donViNhap: string;
  heSoQuyDoi: number;
  donGia: number;
  soLo: string;
  hanSuDung: string;
  serialNumber: string;
  maNcc: string;
  nguongCanhBao: number;
  urlAnh: string;
  ghiChu: string;
  chuKyBaoTri?: number | null;
  ngayBaoTriDauTien?: string | null;
  action: 'CREATE' | 'UPDATE';
  errors: string[];
  hasError: boolean;
}

export interface PhieuXuatKho {
  maPhieu: string;
  maNhanVienKho: string;
  tenNguoiXuat?: string;
  chiTiet: {
    maThietBi: string;
    tenThietBi?: string;
    soLuong: number;
    donViCoSo?: string;
  }[];
  trangThai: 'DA_LAP' | 'DA_XUAT' | 'DA_HUY';
  ngayXuat: string;
  ghiChu: string;
  lyDoXuat: string;
  maKhoaNhan?: string;
  tenKhoaNhan?: string;
}

export interface PhieuBaoHuHong {
  maPhieu: string;
  maNguoiBao: string;
  maThietBi: string;
  maKhoa: string;
  soLuongHu: number;
  moTaHuHong: string;
  trangThai: 'CHO_XU_LY' | 'DA_XU_LY';
  ngayBao: string;
  ngayXuLy?: string;
  ghiChu?: string;
}

// v4: Phiếu trả thiết bị (mới)
export interface ChiTietPhieuTra {
  maPhieuCapPhat: string; // Thêm mã phiếu cấp phát gốc
  maThietBi: string;
  tenThietBi?: string;
  soLuong: number;
  donViTinh?: string;   // Thêm đơn vị tính
  donViCoSo?: string;   // Đơn vị cơ sở
  soLuongCoSo?: number; // Số lượng theo đơn vị cơ sở
  tinhTrangKhiTra: 'NGUYEN_SEAL' | 'DA_BOC_SEAL' | 'HONG';
  anhMinhChung?: string; // Ảnh minh chứng
}

export interface PhieuTraThietBi {
  id: number;
  maPhieuTra: string;
  maPhieuCapPhat: string;
  maTruongKhoa: string;
  tenTruongKhoa?: string;
  ngayTao: string;
  trangThai: 'CHO_TRUONG_KHOA_DUYET' | 'CHO_QL_KHO_DUYET' | 'CHO_XAC_NHAN' | 'DA_TRA' | 'TU_CHOI' | 'HUY';
  ghiChu?: string;
  qrData?: string;
  anhMinhChung?: string;
  chiTiet: ChiTietPhieuTra[];
}

export interface ThongBao {
  id: string;
  tieuDe: string;
  noiDung: string;
  loai: 'info' | 'success' | 'warning' | 'error';
  nguoiNhan: string;
  daDoc: boolean;
  ngayTao: string;
}

export interface ChiTietTra {
  maThietBi: string;
  soLuongTra: number;
}

export interface PhieuTra {
  maPhieu: string;
  maNguoiTra: string;
  maKhoa: string;
  trangThai: 'CHO_NHAN' | 'DA_NHAN' | 'TU_CHOI';
  ngayTao: string;
  chiTiet: ChiTietTra[];
  qrCode?: string;
}

export interface NhatKy {
  maNhatKy: string;
  maNguoiDung: string;
  hanhDong: string;
  thoiGian: string;
  chiTiet: string;
}

export interface PhieuYeuCauNhap {
  maPhieu: string;
  tenThietBi: string;
  loaiThietBi: 'VAT_TU_TIEU_HAO' | 'TAI_SU_DUNG';
  donViTinh: string;
  soLuong: number;
  donGia: number;
  maNhaCungCap?: string;
  maNguoiYeuCau: string;
  trangThai: 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI';
  ngayTao: string;
  ngayDuyet?: string;
  nguoiDuyet?: string;
  lyDoTuChoi?: string;
  moTa?: string;
  mucDichSuDung?: string;
  hinhAnh?: string;
}

// ──────── Constants ────────
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  QL_KHO: 'Quản lý Kho',
  NV_KHO: 'Nhân viên Kho',
  TRUONG_KHOA: 'Trưởng Khoa',
  TRO_LY: 'Trợ lý Khoa',
};

export function getUserRoleWithDept(user?: Partial<NguoiDung> | null, deptName?: string): string {
  if (!user || !user.vaiTro) return '';
  const dName = (deptName || user.tenKhoa || '').trim();
  if (user.vaiTro === 'TRO_LY') {
    if (dName) {
      return dName.toLowerCase().startsWith('khoa') ? `Trợ lý ${dName}` : `Trợ lý Khoa ${dName}`;
    }
    return 'Trợ lý Khoa';
  }
  if (user.vaiTro === 'TRUONG_KHOA') {
    if (dName) {
      return dName.toLowerCase().startsWith('khoa') ? `Trưởng ${dName}` : `Trưởng khoa ${dName}`;
    }
    return 'Trưởng Khoa';
  }
  return ROLE_LABELS[user.vaiTro] || user.vaiTro;
}

export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-destructive/10 text-destructive',
  QL_KHO: 'bg-indigo-100 text-indigo-700',
  NV_KHO: 'bg-primary/10 text-primary',
  TRUONG_KHOA: 'bg-warning/10 text-warning',
  TRO_LY: 'bg-teal-100 text-teal-700',
};

export const LOAI_THIET_BI_LABELS: Record<string, string> = {
  VAT_TU_TIEU_HAO: 'Vật tư tiêu hao',
  TAI_SU_DUNG: 'Tái sử dụng',
};

export const LOAI_THIET_BI_COLORS: Record<string, string> = {
  VAT_TU_TIEU_HAO: 'bg-orange-100 text-orange-700',
  TAI_SU_DUNG: 'bg-blue-100 text-blue-700',
};

export const TINH_TRANG_TRA_LABELS: Record<string, string> = {
  NGUYEN_SEAL: 'Nguyên seal',
  DA_BOC_SEAL: 'Đã bóc seal (dùng tốt)',
  HONG: 'Hỏng',
};

export const TRANG_THAI_TRA_LABELS: Record<string, string> = {
  CHUA_TRA: 'Chưa trả',
  YEU_CAU_TRA: 'Yêu cầu trả',
  DA_TRA: 'Đã trả',
  DA_GIA_HAN: 'Đã gia hạn',
};

export const TRANG_THAI_PHIEU_TRA_LABELS: Record<string, string> = {
  CHO_TRUONG_KHOA_DUYET: 'Chờ TK duyệt',
  CHO_QL_KHO_DUYET: 'Chờ QL duyệt',
  CHO_XAC_NHAN: 'Chờ nhận thiết bị',
  DA_TRA: 'Đã nhập kho',
  TU_CHOI: 'Bị từ chối',
  HUY: 'Đã hủy',
};

export interface MaintenanceItem {
  maThietBi: string;
  tenThietBi: string;
  loaiThietBi: 'TAI_SU_DUNG';
  donViCoSo: string;
  serialNumber: string;
  chuKyBaoTri: number;
  ngayBaoTriGanNhat: string | null;
  ngayBaoTriTiepTheo: string | null;
  trangThaiBaoTri: 'BINH_THUONG' | 'SAP_DEN_HAN' | 'DANG_BAO_TRI' | 'QUA_HAN' | 'HONG_CHO_SUA';
  soNgayConLai: number | null;
  soLuongKho: number;
  soLuongDangDung: number;
  soLuongTaiKhoa?: number;
  viTriHienTai: string;
  dangSuDung: boolean;
  tenNhaCungCap: string;
  hinhAnh?: string;
}

export interface MaintenanceHistoryRecord {
  id: number;
  maPhieuBaoTri: string;
  maThietBi: string;
  tenThietBi?: string;
  loaiThietBi?: string;
  serialNumber?: string;
  chuKyBaoTri?: number;
  ngayBatDau: string;
  ngayHoanThanh: string;
  nguoiThucHien: string;
  loaiBaoTri: string;
  noiDung: string;
  ketQua: 'DAT' | 'KHONG_DAT';
  chiPhi: number;
  anhMinhChung?: string;
  ghiChu?: string;
  ngayTao: string;
}

export const TRANG_THAI_BAO_TRI_LABELS: Record<string, string> = {
  BINH_THUONG: 'Bình thường',
  SAP_DEN_HAN: 'Sắp đến hạn',
  DANG_BAO_TRI: 'Đang bảo trì',
  QUA_HAN: 'Quá hạn bảo trì',
  HONG_CHO_SUA: 'Hỏng / Chờ sửa',
};

export const NHOM_THIET_BI_MAP: Record<NhomThietBi, { label: string; shortLabel: string; color: string; badgeClass: string }> = {
  KHAM_BENH: {
    label: 'Khám & Chẩn đoán',
    shortLabel: 'Khám & Chẩn đoán',
    color: 'text-sky-600',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800'
  },
  PHAU_THUAT: {
    label: 'Phẫu thuật & Ngoại khoa',
    shortLabel: 'Phẫu thuật',
    color: 'text-violet-600',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
  },
  CAP_CUU: {
    label: 'Cấp cứu & Hồi sức (ICU)',
    shortLabel: 'Cấp cứu - Hồi sức',
    color: 'text-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
  },
  VAT_TU_TIEU_HAO: {
    label: 'Vật tư y tế tiêu hao',
    shortLabel: 'Vật tư tiêu hao',
    color: 'text-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
  },
  KHAC: {
    label: 'Khác / Dụng cụ phụ trợ',
    shortLabel: 'Khác',
    color: 'text-slate-600',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
  }
};

export function detectNhomThietBiFrontend(tb?: Partial<ThietBi> | null): NhomThietBi {
  if (!tb) return 'KHAC';
  if (tb.nhomThietBi && ['KHAM_BENH', 'PHAU_THUAT', 'CAP_CUU', 'VAT_TU_TIEU_HAO', 'KHAC'].includes(tb.nhomThietBi)) {
    return tb.nhomThietBi;
  }
  if (tb.loaiThietBi === 'VAT_TU_TIEU_HAO') {
    return 'VAT_TU_TIEU_HAO';
  }
  const name = (tb.tenThietBi || '').toLowerCase();
  if (/(phẫu thuật|dao mổ|kẹp|forceps|scalpel|hút dịch phẫu thuật|tiểu phẫu|phong mổ)/i.test(name)) {
    return 'PHAU_THUAT';
  }
  if (/(thở|ventilator|phá rung|sốc tim|aed|monitor|theo dõi|bơm tiêm điện|oxy|giường bệnh|hồi sức|cấp cứu)/i.test(name)) {
    return 'CAP_CUU';
  }
  if (/(khám|siêu âm|x-quang|điện tim|ecg|huyết áp|ống nghe|nội soi|chẩn đoán|thân nhiệt)/i.test(name)) {
    return 'KHAM_BENH';
  }
  return 'KHAC';
}

