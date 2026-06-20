export type UserRole = 'ADMIN' | 'NV_KHO' | 'TRUONG_KHOA' | 'QL_KHO' | 'TRO_LY';

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
}

// v4: ThietBi với loai ENUM và các trường mới
export interface ThietBi {
  maThietBi: string;
  tenThietBi: string;
  loaiThietBi: 'VAT_TU_TIEU_HAO' | 'TAI_SU_DUNG';
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

export interface PhieuYeuCauCapPhat {
  maPhieu: string;
  maNguoiYeuCau: string;
  maThietBi: string;
  maKhoa: string;
  soLuongYeuCau: number;
  lyDo: string;
  trangThai: 'CHO_DUYET' | 'DA_DUYET' | 'CHO_TRUONG_KHOA_DUYET' | 'CHO_QL_KHO_DUYET' | 'DA_QL_KHO_DUYET' | 'TU_CHOI' | 'DA_CAP_PHAT' | 'DA_HUY';
  ngayTao: string;
  ngayDuyet?: string;
  nguoiDuyet?: string;
  lyDoTuChoi?: string;
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
