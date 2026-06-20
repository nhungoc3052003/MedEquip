import { NguoiDung, ThietBi, TonKho, NhaCungCap, Khoa, ThongBao, PhieuYeuCauCapPhat, PhieuXuatKho, PhieuNhapKho, PhieuCapPhat, PhieuBaoHuHong, PhieuTraThietBi, PhieuYeuCauNhap } from '@/types';

const defaultUsers: NguoiDung[] = [
  { maNguoiDung: 'ND-001', hoTen: 'Nguyễn Văn Admin', email: 'admin@benhvien.vn', matKhau: '123456', vaiTro: 'ADMIN', trangThai: true, ngayTao: '2026-01-01', ngayCapNhat: '2026-01-01' },
  { maNguoiDung: 'ND-002', hoTen: 'Trần Thị Kho', email: 'kho@benhvien.vn', matKhau: '123456', vaiTro: 'NV_KHO', trangThai: true, ngayTao: '2026-01-01', ngayCapNhat: '2026-01-01' },
  { maNguoiDung: 'ND-003', hoTen: 'Lê Minh Khoa', email: 'truongkhoa@benhvien.vn', matKhau: '123456', vaiTro: 'TRUONG_KHOA', trangThai: true, ngayTao: '2026-01-01', ngayCapNhat: '2026-01-01' },
  { maNguoiDung: 'ND-004', hoTen: 'Nguyễn Thị Lan', email: 'lan@benhvien.vn', matKhau: '123456', vaiTro: 'TRUONG_KHOA', trangThai: true, ngayTao: '2026-01-01', ngayCapNhat: '2026-01-01' },
];

const defaultEquipment: ThietBi[] = [
  { maThietBi: 'TB-001', tenThietBi: 'Máy đo huyết áp', loaiThietBi: 'TAI_SU_DUNG', donViCoSo: 'Cái', donViNhap: 'Hộp', heSoQuyDoi: 1, nguongCanhBao: 5, moTa: 'Máy đo huyết áp tự động', maNhaCungCap: 'NCC-001', trangThai: true, ngayTao: '2026-01-01', hinhAnh: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Vital_signs_monitor.jpg/320px-Vital_signs_monitor.jpg' },
  { maThietBi: 'TB-002', tenThietBi: 'Ống nghe y khoa', loaiThietBi: 'TAI_SU_DUNG', donViCoSo: 'Cái', donViNhap: 'Hộp', heSoQuyDoi: 1, nguongCanhBao: 3, moTa: 'Ống nghe chuyên khoa nội', maNhaCungCap: 'NCC-001', trangThai: true, ngayTao: '2026-01-01' },
  { maThietBi: 'TB-003', tenThietBi: 'Kim tiêm 5ml', loaiThietBi: 'VAT_TU_TIEU_HAO', donViCoSo: 'Cái', donViNhap: 'Thùng', heSoQuyDoi: 1000, nguongCanhBao: 5, moTa: 'Kim tiêm 5ml vô trùng', maNhaCungCap: 'NCC-002', trangThai: true, ngayTao: '2026-01-01' },
];

const defaultInventory: TonKho[] = [
  { maTonKho: 'TK-001', maThietBi: 'TB-001', soLuongKho: 8, soLuongHu: 0, soLuongDangDung: 2, ngayCapNhat: '2026-03-20' },
  { maTonKho: 'TK-002', maThietBi: 'TB-002', soLuongKho: 15, soLuongHu: 0, soLuongDangDung: 3, ngayCapNhat: '2026-03-20' },
  { maTonKho: 'TK-003', maThietBi: 'TB-003', soLuongKho: 20, soLuongHu: 0, soLuongDangDung: 0, ngayCapNhat: '2026-03-20' },
];

const defaultSuppliers: NhaCungCap[] = [
  { maNhaCungCap: 'NCC-001', tenNhaCungCap: 'Công ty TNHH Thiết bị Y tế Phương Nam', diaChi: '123 Nguyễn Văn Linh, Đà Nẵng', soDienThoai: '0283-999-1111', email: 'phuongnam@medtech.vn', trangThai: true },
  { maNhaCungCap: 'NCC-002', tenNhaCungCap: 'Công ty CP Vật tư Bệnh viện Việt', diaChi: '456 Lê Lợi, TP.HCM', soDienThoai: '0244-888-2222', email: 'vietmedical@supply.vn', trangThai: true },
];

const defaultDepartments: Khoa[] = [
  { maKhoa: 'K-001', tenKhoa: 'Khoa Nội', moTa: 'Khoa Nội tổng hợp', trangThai: true },
  { maKhoa: 'K-002', tenKhoa: 'Khoa Ngoại', moTa: 'Khoa Ngoại tổng hợp', trangThai: true },
  { maKhoa: 'K-003', tenKhoa: 'Khoa Sản', moTa: 'Khoa Sản phụ khoa', trangThai: true },
  { maKhoa: 'K-004', tenKhoa: 'Khoa Nhi', moTa: 'Khoa Nhi đồng', trangThai: true },
  { maKhoa: 'K-005', tenKhoa: 'Khoa Cấp cứu', moTa: 'Khoa Cấp cứu và hồi sức', trangThai: true },
];

const defaultNotifications: ThongBao[] = [
  { id: 'TB-N-001', tieuDe: 'Hệ thống đã nâng cấp lên v4', noiDung: 'MedEquip v4: Upload Excel nhập kho, Trả thiết bị, Gia hạn, QR code.', loai: 'info', nguoiNhan: 'ND-001', daDoc: false, ngayTao: '2026-04-13T10:00:00' },
  { id: 'TB-N-002', tieuDe: 'Hướng dẫn nạp dữ liệu ban đầu', noiDung: 'Tạo NCC trước, sau đó upload 3 file Excel nhập kho tại trang Nhập kho.', loai: 'warning', nguoiNhan: 'ND-002', daDoc: false, ngayTao: '2026-04-13T10:00:00' },
  { id: 'TB-N-003', tieuDe: 'Yêu cầu cấp phát mới', noiDung: 'Có một yêu cầu cấp phát mới cần được duyệt.', loai: 'info', nguoiNhan: 'ND-001', daDoc: false, ngayTao: '2026-04-14T10:00:00' },
  { id: 'TB-N-004', tieuDe: 'Yêu cầu trả thiết bị', noiDung: 'Trưởng khoa vừa tạo yêu cầu trả thiết bị.', loai: 'info', nguoiNhan: 'ND-001', daDoc: false, ngayTao: '2026-04-14T11:00:00' },
];

const defaultRequests: PhieuYeuCauCapPhat[] = [];

// In-memory cache for API mode
let memoryCache: Record<string, any[]> = {};

function getStore<T>(key: string, defaults: T[]): T[] {
  if (memoryCache[key]) return memoryCache[key] as T[];
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(key, JSON.stringify(defaults));
  return defaults;
}

function setStore<T>(key: string, data: T[]) {
  memoryCache[key] = data;
  localStorage.setItem(key, JSON.stringify(data));
}

export const store = {
  getUsers: () => getStore<NguoiDung>('kho_users', defaultUsers),
  setUsers: (d: NguoiDung[]) => setStore('kho_users', d),

  getEquipment: () => getStore<ThietBi>('kho_equipment', defaultEquipment),
  setEquipment: (d: ThietBi[]) => setStore('kho_equipment', d),

  getInventory: () => getStore<TonKho>('kho_inventory', defaultInventory),
  setInventory: (d: TonKho[]) => setStore('kho_inventory', d),

  getSuppliers: () => getStore<NhaCungCap>('kho_suppliers', defaultSuppliers),
  setSuppliers: (d: NhaCungCap[]) => setStore('kho_suppliers', d),

  getDepartments: () => getStore<Khoa>('kho_departments', defaultDepartments),
  setDepartments: (d: Khoa[]) => setStore('kho_departments', d),

  getNotifications: () => getStore<ThongBao>('kho_notifications', defaultNotifications),
  setNotifications: (d: ThongBao[]) => {
    setStore('kho_notifications', d);
    window.dispatchEvent(new Event('store_notifications_changed'));
  },

  getRequests: () => getStore<PhieuYeuCauCapPhat>('kho_requests', defaultRequests),
  setRequests: (d: PhieuYeuCauCapPhat[]) => setStore('kho_requests', d),

  getExports: () => getStore<PhieuXuatKho>('kho_exports', []),
  setExports: (d: PhieuXuatKho[]) => setStore('kho_exports', d),

  getImports: () => getStore<PhieuNhapKho>('kho_imports', []),
  setImports: (d: PhieuNhapKho[]) => setStore('kho_imports', d),

  getAllocations: () => getStore<PhieuCapPhat>('kho_allocations', []),
  setAllocations: (d: PhieuCapPhat[]) => setStore('kho_allocations', d),

  getDamageReports: () => getStore<PhieuBaoHuHong>('kho_damage_reports', []),
  setDamageReports: (d: PhieuBaoHuHong[]) => setStore('kho_damage_reports', d),

  getReturns: () => getStore<PhieuTraThietBi>('kho_returns', []),
  setReturns: (d: PhieuTraThietBi[]) => setStore('kho_returns', d),

  getImportRequests: () => getStore<PhieuYeuCauNhap>('kho_import_reqs', []),
  setImportRequests: (d: PhieuYeuCauNhap[]) => setStore('kho_import_reqs', d),

  // Initialize store from API data
  initFromApi: (data: {
    users?: NguoiDung[];
    equipment?: ThietBi[];
    inventory?: TonKho[];
    suppliers?: NhaCungCap[];
    departments?: Khoa[];
    notifications?: ThongBao[];
    requests?: PhieuYeuCauCapPhat[];
    exports?: PhieuXuatKho[];
    imports?: PhieuNhapKho[];
    allocations?: PhieuCapPhat[];
    damageReports?: PhieuBaoHuHong[];
    returns?: PhieuTraThietBi[];
  }) => {
    if (data.users) setStore('kho_users', data.users);
    if (data.equipment) setStore('kho_equipment', data.equipment);
    if (data.inventory) setStore('kho_inventory', data.inventory);
    if (data.suppliers) setStore('kho_suppliers', data.suppliers);
    if (data.departments) setStore('kho_departments', data.departments);
    if (data.notifications) setStore('kho_notifications', data.notifications);
    if (data.requests) setStore('kho_requests', data.requests);
    if (data.exports) setStore('kho_exports', data.exports);
    if (data.imports) setStore('kho_imports', data.imports);
    if (data.allocations) setStore('kho_allocations', data.allocations);
    if (data.damageReports) setStore('kho_damage_reports', data.damageReports);
    if (data.returns) setStore('kho_returns', data.returns);
    if ((data as any).importRequests) setStore('kho_import_reqs', (data as any).importRequests);
  },

  clearCache: () => { memoryCache = {}; },
};

let counters: Record<string, number> = {};
export function generateId(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `${prefix}-${date}`;
  if (!counters[key]) counters[key] = 0;
  counters[key]++;
  return `${prefix}-${date}-${String(counters[key]).padStart(3, '0')}`;
}
