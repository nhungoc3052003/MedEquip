/**
 * API Sync - Wrapper functions that sync store mutations to API
 * When in API mode, these call the API and then refresh store
 * When in mock mode, they just update store directly
 */
import { isMockMode, fetchApi } from '@/services/api';
import { store, generateId } from './store';
import { refreshData } from './dataLoader';
import { NguoiDung, ThietBi, NhaCungCap, Khoa, PhieuYeuCauCapPhat, PhieuNhapKho, PhieuXuatKho, PhieuCapPhat, PhieuBaoHuHong, UserRole, PhieuYeuCauNhap, PhieuTraThietBi } from '@/types';

// ---- Users ----
export async function apiCreateUser(data: { hoTen: string; email: string; matKhau: string; vaiTro: UserRole }) {
  if (isMockMode()) {
    const users = store.getUsers();
    if (users.some(u => u.email === data.email)) return { success: false, message: 'Email đã tồn tại' };
    const newUser: NguoiDung = { maNguoiDung: generateId('ND'), ...data, trangThai: true, ngayTao: new Date().toISOString(), ngayCapNhat: new Date().toISOString() };
    users.push(newUser);
    store.setUsers(users);
    return { success: true, user: newUser };
  }
  const result = await fetchApi<any>('/users', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) await refreshData('users');
  return result;
}

export async function apiUpdateUser(userId: string, updates: Partial<NguoiDung>) {
  if (isMockMode()) {
    const users = store.getUsers();
    store.setUsers(users.map(u => u.maNguoiDung === userId ? { ...u, ...updates, ngayCapNhat: new Date().toISOString() } : u));
    return { success: true };
  }
  const result = await fetchApi<any>(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
  if (result.success) await refreshData('users');
  return result;
}

export async function apiDeleteUser(userId: string) {
  if (isMockMode()) {
    store.setUsers(store.getUsers().filter(u => u.maNguoiDung !== userId));
    return { success: true };
  }
  const result = await fetchApi<any>(`/users/${userId}`, { method: 'DELETE' });
  if (result.success) await refreshData('users');
  return result;
}

export async function apiChangePassword(userId: string, currentPassword: string, newPassword: string) {
  if (isMockMode()) {
    const users = store.getUsers();
    const user = users.find(u => u.maNguoiDung === userId);
    if (!user) return { success: false, message: 'Không tìm thấy người dùng.' };
    if (user.matKhau !== currentPassword) return { success: false, message: 'Mật khẩu hiện tại không đúng!' };
    store.setUsers(users.map(u => u.maNguoiDung === userId ? { ...u, matKhau: newPassword, ngayCapNhat: new Date().toISOString() } : u));
    return { success: true, message: 'Đổi mật khẩu thành công!' };
  }
  return fetchApi<any>('/auth/change-password', { method: 'PUT', body: JSON.stringify({ userId, currentPassword, newPassword }) });
}

// ---- Equipment ----
export async function apiCreateEquipment(data: Omit<ThietBi, 'maThietBi' | 'trangThai' | 'ngayTao'>) {
  if (isMockMode()) {
    const equipment = store.getEquipment();
    if (equipment.some(e => e.tenThietBi === data.tenThietBi)) return { success: false, message: 'Thiết bị đã tồn tại' };
    const newItem: ThietBi = { maThietBi: generateId('TB'), ...data, trangThai: true, ngayTao: new Date().toISOString() };
    equipment.push(newItem);
    store.setEquipment(equipment);
    const inv = store.getInventory();
    inv.push({
      maTonKho: generateId('TK'),
      maThietBi: newItem.maThietBi,
      soLuongKho: 0,
      soLuongDangDung: 0,
      soLuongHu: 0,
      ngayCapNhat: new Date().toISOString()
    });
    store.setInventory(inv);
    return { success: true, equipment: newItem };
  }
  const result = await fetchApi<any>('/equipment', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) {
    await refreshData('equipment');
    await refreshData('inventory');
  }
  return result;
}

export async function apiDeleteEquipment(maThietBi: string) {
  if (isMockMode()) {
    const inv = store.getInventory().find(i => i.maThietBi === maThietBi);
    if (inv && (inv.soLuongDangDung > 0 || inv.soLuongKho > 0 || inv.soLuongHu > 0)) {
      return { success: false, message: 'Thiết bị đang có tồn kho hoặc đang báo hỏng, không thể xóa' };
    }
    store.setEquipment(store.getEquipment().filter(e => e.maThietBi !== maThietBi));
    store.setInventory(store.getInventory().filter(i => i.maThietBi !== maThietBi));
    return { success: true };
  }
  const result = await fetchApi<any>(`/equipment/${maThietBi}`, { method: 'DELETE' });
  if (result.success) {
    await refreshData('equipment');
    await refreshData('inventory');
  }
  return result;
}

export async function apiUpdateEquipment(maThietBi: string, data: Partial<Omit<ThietBi, 'maThietBi' | 'ngayTao'>>) {
  if (isMockMode()) {
    store.setEquipment(store.getEquipment().map(e => e.maThietBi === maThietBi ? { ...e, ...data } as ThietBi : e));
    return { success: true };
  }
  const result = await fetchApi<any>(`/equipment/${maThietBi}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result.success) await refreshData('equipment');
  return result;
}

// ---- Suppliers ----
export async function apiCreateSupplier(data: Omit<NhaCungCap, 'maNhaCungCap' | 'trangThai'>) {
  if (isMockMode()) {
    const ncc: NhaCungCap = { maNhaCungCap: generateId('NCC'), ...data, trangThai: true };
    const suppliers = store.getSuppliers();
    suppliers.push(ncc);
    store.setSuppliers(suppliers);
    return { success: true, supplier: ncc };
  }
  const result = await fetchApi<any>('/suppliers', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) await refreshData('suppliers');
  return result;
}

export async function apiUpdateSupplier(id: string, data: Partial<NhaCungCap>) {
  if (isMockMode()) {
    store.setSuppliers(store.getSuppliers().map(s => s.maNhaCungCap === id ? { ...s, ...data } : s));
    return { success: true };
  }
  const result = await fetchApi<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result.success) await refreshData('suppliers');
  return result;
}

export async function apiDeleteSupplier(id: string) {
  if (isMockMode()) {
    const equipment = store.getEquipment();
    if (equipment.some(e => e.maNhaCungCap === id)) {
      return { success: false, message: 'Không thể xóa nhà cung cấp đang có thiết bị liên kết' };
    }
    store.setSuppliers(store.getSuppliers().filter(s => s.maNhaCungCap !== id));
    return { success: true };
  }
  const result = await fetchApi<any>(`/suppliers/${id}`, { method: 'DELETE' });
  if (result.success) await refreshData('suppliers');
  return result;
}

// ---- Departments ----
export async function apiCreateDepartment(data: Omit<Khoa, 'maKhoa' | 'trangThai'>) {
  if (isMockMode()) {
    const depts = store.getDepartments();
    const duplicate = depts.some(d => d.tenKhoa.trim().toLowerCase() === data.tenKhoa.trim().toLowerCase());
    if (duplicate) return { success: false, message: 'Khoa đã tồn tại.' };

    const nextIdNum = depts
      .map(d => {
        const match = d.maKhoa.match(/^K-(\d{3})$/);
        return match ? Number(match[1]) : null;
      })
      .filter((n): n is number => n !== null)
      .reduce((max, value) => Math.max(max, value), 0) + 1;

    const dept: Khoa = {
      maKhoa: `K-${String(nextIdNum).padStart(3, '0')}`,
      ...data,
      trangThai: true,
    };
    depts.push(dept);
    store.setDepartments(depts);
    return { success: true, department: dept };
  }
  const result = await fetchApi<any>('/departments', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) await refreshData('departments');
  return result;
}

export async function apiUpdateDepartment(id: string, data: Partial<Khoa>) {
  if (isMockMode()) {
    if (data.trangThai === false) {
      const allocations = store.getAllocations();
      if (allocations.some(a => a.maKhoa === id && a.trangThaiTra !== 'DA_TRA')) {
        return { success: false, message: 'Không thể ngừng hoạt động khoa khi có thiết bị đang trong quá trình sử dụng' };
      }
    }
    store.setDepartments(store.getDepartments().map(d => d.maKhoa === id ? { ...d, ...data } : d));
    return { success: true };
  }
  const result = await fetchApi<any>(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  if (result.success) await refreshData('departments');
  return result;
}

export async function apiDeleteDepartment(id: string) {
  if (isMockMode()) {
    const allocations = store.getAllocations();
    if (allocations.some(a => a.maKhoa === id && a.trangThaiTra !== 'DA_TRA')) {
      return { success: false, message: 'Không thể xóa khoa khi có thiết bị đang trong quá trình sử dụng' };
    }
    store.setDepartments(store.getDepartments().filter(d => d.maKhoa !== id));
    return { success: true };
  }
  const result = await fetchApi<any>(`/departments/${id}`, { method: 'DELETE' });
  if (result.success) await refreshData('departments');
  return result;
}

// ---- Requests ----
export async function apiCreateRequest(data: { maNguoiYeuCau?: string; maKhoa: string; lyDo: string; items: { maThietBi: string; soLuong: number }[] }) {
  if (isMockMode()) {
    if (!data.items || data.items.length === 0) return { success: false, message: 'Danh sách thiết bị trống' };
    const phieu: PhieuYeuCauCapPhat = {
      maPhieu: generateId('YCCF'),
      maNguoiYeuCau: data.maNguoiYeuCau || 'ND001',
      maKhoa: data.maKhoa,
      lyDo: data.lyDo,
      maThietBi: data.items[0].maThietBi,
      soLuongYeuCau: data.items[0].soLuong,
      trangThai: 'CHO_TRUONG_KHOA_DUYET',
      ngayTao: new Date().toISOString()
    };
    const requests = store.getRequests();
    requests.push(phieu);
    store.setRequests(requests);
    return { success: true, phieu };
  }
  const result = await fetchApi<any>('/requests', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) await refreshData('requests');
  return result;
}

export async function apiScanRequest(maPhieu: string) {
  if (isMockMode()) {
    const req = store.getRequests().find(r => r.maPhieu === maPhieu);
    if (!req) return { success: false, message: 'Không tìm thấy phiếu' };
    const equipment = store.getEquipment();
    const inventory = store.getInventory();

    // In mock mode, we assume the items are just the one in the request for simplicity, 
    // unless we refactor mock storage too. For now let's just return the single item.
    return {
      success: true,
      request: req,
      items: [{
        maThietBi: req.maThietBi,
        tenThietBi: equipment.find(e => e.maThietBi === req.maThietBi)?.tenThietBi || req.maThietBi,
        soLuong: req.soLuongYeuCau,
        trangThai: req.trangThai === 'DA_CAP_PHAT' ? 'DA_DUYET' : 'CHO_DUYET',
        donViTinh: equipment.find(e => e.maThietBi === req.maThietBi)?.donViCoSo || 'Cái',
        tonKho: inventory.find(i => i.maThietBi === req.maThietBi)?.soLuongKho || 0
      }]
    };
  }
  return fetchApi<any>(`/requests/${maPhieu}/scan`);
}

export async function apiProcessRequestItems(maPhieu: string, data: { items: { maThietBi: string; approved: boolean; lyDo?: string }[]; ghiChu?: string }) {
  if (isMockMode()) {
    // Mock implementation for processing items
    const requests = store.getRequests();
    const reqIndex = requests.findIndex(r => r.maPhieu === maPhieu);
    if (reqIndex === -1) return { success: false, message: 'Không tìm thấy phiếu' };

    const approvedCount = data.items.filter(i => i.approved).length;
    if (approvedCount > 0) {
      requests[reqIndex].trangThai = 'DA_CAP_PHAT';
      // In mock mode, we'd need to update inventory here too.
    } else {
      requests[reqIndex].trangThai = 'TU_CHOI';
    }
    store.setRequests([...requests]);
    return { success: true, message: approvedCount > 0 ? "Đã xuất kho thành công." : "Đã từ chối tất cả thiết bị." };
  }
  const result = await fetchApi<any>(`/requests/${maPhieu}/process-items`, { method: 'POST', body: JSON.stringify(data) });
  if (result.success) {
    await refreshData('requests');
    await refreshData('allocations');
    await refreshData('inventory');
  }
  return result;
}

export async function apiApproveRequest(maPhieu: string, approved: boolean, lyDo?: string) {
  if (isMockMode()) {
    const requests = store.getRequests();
    store.setRequests(requests.map(r => r.maPhieu === maPhieu ? {
      ...r,
      trangThai: approved ? 'DA_DUYET' as const : 'TU_CHOI' as const,
      ngayDuyet: new Date().toISOString(),
      lyDoTuChoi: lyDo
    } : r));
    return { success: true };
  }
  const result = await fetchApi<any>(`/requests/${maPhieu}/approve-dept`, { method: 'PUT', body: JSON.stringify({ approved, lyDo }) });
  if (result.success) await refreshData('requests');
  return result;
}

export async function apiDeleteRequest(maPhieu: string) {
  if (isMockMode()) {
    store.setRequests(store.getRequests().filter(r => r.maPhieu !== maPhieu));
    return { success: true };
  }
  const result = await fetchApi<any>(`/requests/${maPhieu}`, { method: 'DELETE' });
  if (result.success) await refreshData('requests');
  return result;
}

// ---- Import Requests ----
export async function apiCreateImportRequest(data: Omit<PhieuYeuCauNhap, 'maPhieu' | 'trangThai' | 'ngayTao' | 'ngayDuyet' | 'nguoiDuyet' | 'lyDoTuChoi'>) {
  if (isMockMode()) {
    const phieu: PhieuYeuCauNhap = { maPhieu: generateId('YCN'), ...data, trangThai: 'CHO_DUYET', ngayTao: new Date().toISOString() };
    const requests = store.getImportRequests();
    requests.push(phieu);
    store.setImportRequests(requests);
    return { success: true, phieu };
  }
  const result = await fetchApi<any>('/import-requests', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) await refreshData('importRequests');
  return result;
}

export async function apiApproveImportRequest(maPhieu: string, approved: boolean, lyDo?: string) {
  if (isMockMode()) {
    const requests = store.getImportRequests();
    const reqIndex = requests.findIndex(r => r.maPhieu === maPhieu);
    if (reqIndex === -1) return { success: false, message: 'Không tìm thấy phiếu' };

    const request = requests[reqIndex];

    if (approved) {
      // Create Equipment automatically
      const equipment = store.getEquipment();
      const newMaThietBi = generateId('TB');
      const newItem: ThietBi = {
        maThietBi: newMaThietBi,
        tenThietBi: request.tenThietBi,
        loaiThietBi: request.loaiThietBi,
        donViCoSo: request.donViTinh,
        donViNhap: request.donViTinh,
        heSoQuyDoi: 1,
        nguongCanhBao: 5,
        moTa: request.moTa || request.mucDichSuDung || '',
        maNhaCungCap: request.maNhaCungCap || 'NCC001', // Fallback
        hinhAnh: request.hinhAnh,
        trangThai: true,
        ngayTao: new Date().toISOString()
      };
      equipment.push(newItem);
      store.setEquipment(equipment);

      // Create Inventory automatically
      const inv = store.getInventory();
      inv.push({
        maTonKho: generateId('TK'),
        maThietBi: newMaThietBi,
        soLuongKho: request.soLuong,
        soLuongDangDung: 0,
        soLuongHu: 0,
        ngayCapNhat: new Date().toISOString()
      });
      store.setInventory(inv);
    }

    store.setImportRequests(requests.map(r => r.maPhieu === maPhieu ? {
      ...r,
      trangThai: approved ? 'DA_DUYET' as const : 'TU_CHOI' as const,
      ngayDuyet: new Date().toISOString(),
      lyDoTuChoi: lyDo,
      nguoiDuyet: 'MOCK_ADMIN'
    } : r));

    return { success: true };
  }
  const result = await fetchApi<any>(`/imports/approval/${maPhieu}`, { method: 'PUT', body: JSON.stringify({ approved, lyDo }) });
  if (result.success) {
    await refreshData('importRequests');
    if (approved) {
      await refreshData('equipment');
      await refreshData('inventory');
    }
  }
  return result;
}

export async function apiDeleteImportRequest(maPhieu: string) {
  if (isMockMode()) {
    store.setImportRequests(store.getImportRequests().filter(r => r.maPhieu !== maPhieu));
    return { success: true };
  }
  const result = await fetchApi<any>(`/import-requests/${maPhieu}`, { method: 'DELETE' });
  if (result.success) await refreshData('importRequests');
  return result;
}

// ---- Imports ----
export async function apiCreateImport(data: { maThietBi: string; maNhaCungCap: string; soLuongNhap: number; maNhanVienKho: string; ghiChu: string }) {
  if (isMockMode()) {
    const phieu: PhieuNhapKho = { maPhieu: generateId('NK'), ...data, ngayNhap: new Date().toISOString() };
    const imports = store.getImports();
    imports.push(phieu);
    store.setImports(imports);
    const inv = store.getInventory();
    const idx = inv.findIndex(i => i.maThietBi === data.maThietBi);
    if (idx >= 0) { inv[idx].soLuongKho += data.soLuongNhap; inv[idx].ngayCapNhat = new Date().toISOString(); store.setInventory(inv); }
    return { success: true, phieu };
  }
  const result = await fetchApi<any>('/imports', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) {
    await refreshData('imports');
    await refreshData('inventory');
  }
  return result;
}

export async function apiDeleteImport(maPhieu: string) {
  if (isMockMode()) {
    store.setImports(store.getImports().filter(i => i.maPhieu !== maPhieu));
    return { success: true };
  }
  const result = await fetchApi<any>(`/imports/${maPhieu}`, { method: 'DELETE' });
  if (result.success) await refreshData('imports');
  return result;
}

// ---- Exports ----
export async function apiCreateExport(data: { maThietBi: string; soLuong: number; lyDoXuat: string; maNhanVienKho: string; ghiChu: string }) {
  if (isMockMode()) {
    const phieu: PhieuXuatKho = {
      maPhieu: generateId('XK'),
      maNhanVienKho: data.maNhanVienKho,
      trangThai: 'DA_LAP',
      ngayXuat: new Date().toISOString(),
      ghiChu: data.ghiChu,
      lyDoXuat: data.lyDoXuat,
      chiTiet: [{
        maThietBi: data.maThietBi,
        soLuong: data.soLuong
      }]
    };
    const exports = store.getExports();
    exports.push(phieu);
    store.setExports(exports);
    return { success: true, phieu };
  }
  const result = await fetchApi<any>('/exports', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) await refreshData('exports');
  return result;
}

export async function apiConfirmExport(maPhieu: string) {
  if (isMockMode()) {
    const exports = store.getExports();
    const phieu = exports.find(e => e.maPhieu === maPhieu);
    if (!phieu) return { success: false };
    store.setExports(exports.map(e => e.maPhieu === maPhieu ? { ...e, trangThai: 'DA_XUAT' as const } : e));
    const inv = store.getInventory();
    for (const item of phieu.chiTiet) {
      const idx = inv.findIndex(i => i.maThietBi === item.maThietBi);
      if (idx >= 0) {
        inv[idx].soLuongKho = Math.max(0, inv[idx].soLuongKho - item.soLuong);
        inv[idx].ngayCapNhat = new Date().toISOString();
      }
    }
    store.setInventory(inv);
    return { success: true };
  }
  const result = await fetchApi<any>(`/exports/approval/${maPhieu}`, { method: 'PUT', body: JSON.stringify({ approved: true }) });
  if (result.success) {
    await refreshData('exports');
    await refreshData('inventory');
  }
  return result;
}

// ---- Allocations ----
export async function apiCreateAllocation(data: { maPhieuYeuCau: string; maNhanVienKho: string; maThietBi: string; maNguoiMuon: string; maKhoa: string; soLuongCapPhat: number; ghiChu: string }) {
  if (isMockMode()) {
    const phieu: PhieuCapPhat = {
      maPhieu: generateId('CP'),
      ...data,
      trangThaiTra: 'CHUA_TRA',
      ngayCapPhat: new Date().toISOString()
    };
    const allocations = store.getAllocations();
    allocations.push(phieu);
    store.setAllocations(allocations);

    // Update Request status to DA_CAP_PHAT
    const requests = store.getRequests();
    store.setRequests(requests.map(r => r.maPhieu === data.maPhieuYeuCau ? { ...r, trangThai: 'DA_CAP_PHAT' as const } : r));

    const inv = store.getInventory();
    const idx = inv.findIndex(i => i.maThietBi === data.maThietBi);
    if (idx >= 0) {
      inv[idx].soLuongKho = Math.max(0, inv[idx].soLuongKho - data.soLuongCapPhat);
      inv[idx].soLuongDangDung += data.soLuongCapPhat;
      inv[idx].ngayCapNhat = new Date().toISOString();
      store.setInventory(inv);
    }
    return { success: true, phieu };
  }
  const result = await fetchApi<any>('/allocations', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) {
    await refreshData('allocations');
    await refreshData('inventory');
    await refreshData('requests');
  }
  return result;
}

// ---- Damage Reports ----
export async function apiCreateDamageReport(data: { maNguoiBao: string; maThietBi: string; maKhoa: string; soLuongHu: number; moTaHuHong: string }) {
  if (isMockMode()) {
    const report: PhieuBaoHuHong = { maPhieu: generateId('BHH'), ...data, trangThai: 'CHO_XU_LY', ngayBao: new Date().toISOString() };
    const reports = store.getDamageReports();
    reports.push(report);
    store.setDamageReports(reports);
    const inv = store.getInventory();
    const idx = inv.findIndex(i => i.maThietBi === data.maThietBi);
    if (idx >= 0) {
      const moveQty = Math.min(data.soLuongHu, inv[idx].soLuongDangDung);
      inv[idx].soLuongDangDung -= moveQty;
      inv[idx].soLuongHu = (inv[idx].soLuongHu || 0) + moveQty;
      inv[idx].ngayCapNhat = new Date().toISOString();
      store.setInventory(inv);
    }
    return { success: true, report };
  }
  const result = await fetchApi<any>('/damage-reports', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) {
    await refreshData('damageReports');
    await refreshData('inventory');
  }
  return result;
}

export async function apiResolveDamageReport(maPhieu: string) {
  if (isMockMode()) {
    store.setDamageReports(store.getDamageReports().map(r => r.maPhieu === maPhieu ? { ...r, trangThai: 'DA_XU_LY' as const, ngayXuLy: new Date().toISOString() } : r));
    return { success: true };
  }
  const result = await fetchApi<any>(`/damage-reports/${maPhieu}/resolve`, { method: 'PUT', body: JSON.stringify({ ghiChu: '' }) });
  if (result.success) await refreshData('damageReports');
  return result;
}

// ---- Notifications ----
export async function apiMarkAsRead(notificationId: string) {
  if (isMockMode()) {
    store.setNotifications(store.getNotifications().map(n => n.id === notificationId ? { ...n, daDoc: true } : n));
    return { success: true };
  }
  return fetchApi<any>(`/notifications/${notificationId}/read`, { method: 'PUT' });
}

export async function apiMarkAllAsRead(userId: string) {
  if (isMockMode()) {
    store.setNotifications(store.getNotifications().map(n => n.nguoiNhan === userId ? { ...n, daDoc: true } : n));
    return { success: true };
  }
  return fetchApi<any>('/notifications/read-all', { method: 'PUT', body: JSON.stringify({ userId }) });
}

// ---- Returns ----
export async function apiCreateReturn(data: { ghiChu?: string; chiTiet: { maPhieuCapPhat: string; maThietBi: string; soLuong: number; tinhTrangKhiTra: string; anhMinhChung?: string }[] }) {
  if (isMockMode()) {
    const maPhieu = generateId('TRA');
    const phieu: any = {
      maPhieuTra: maPhieu,
      ...data,
      trangThai: 'CHO_TRUONG_KHOA_DUYET',
      ngayTao: new Date().toISOString(),
      qrData: maPhieu,
    };
    const returns = store.getReturns();
    returns.push(phieu);
    store.setReturns(returns);
    return { success: true, maPhieuTra: maPhieu, message: 'Đã tạo phiếu trả thành công.' };
  }
  const result = await fetchApi<any>('/returns/create', { method: 'POST', body: JSON.stringify(data) });
  if (result.success) await refreshData('returns');
  return result;
}

export async function apiAcceptReturn(maPhieuTra: string, approved: boolean, lyDo?: string) {
  if (isMockMode()) {
    const returns = store.getReturns();
    const phieu = returns.find(r => r.maPhieuTra === maPhieuTra);
    if (!phieu) return { success: false, message: 'Không tìm thấy phiếu trả.' };
    if (phieu.trangThai !== 'CHO_XAC_NHAN') return { success: false, message: 'Phiếu này đã được xử lý.' };

    const inv = store.getInventory();
    const allocations = store.getAllocations();

    for (const ct of phieu.chiTiet) {
      const idx = inv.findIndex(i => i.maThietBi === ct.maThietBi);
      if (idx >= 0) {
        if (approved) {
          inv[idx].soLuongKho += ct.soLuong;
          inv[idx].soLuongDangDung = Math.max(0, inv[idx].soLuongDangDung - ct.soLuong);

          // Cập nhật trạng thái phiếu cấp phát tương ứng
          const allocIdx = allocations.findIndex(a => a.maPhieu === ct.maPhieuCapPhat && a.maThietBi === ct.maThietBi);
          if (allocIdx >= 0) {
            allocations[allocIdx].trangThaiTra = 'DA_TRA';
          }
        }
        inv[idx].ngayCapNhat = new Date().toISOString();
      }
    }

    store.setInventory(inv);
    store.setAllocations(allocations);
    store.setReturns(returns.map(r => r.maPhieuTra === maPhieuTra ? { ...r, trangThai: approved ? 'DA_TRA' : 'TU_CHOI' } : r));
    return { success: true, message: approved ? "Đã xác nhận nhận hàng trả." : "Đã từ chối phiếu trả." };
  }
  const result = await fetchApi<any>(`/returns/${maPhieuTra}/confirm`, { method: 'PUT', body: JSON.stringify({ approved, lyDo }) });
  if (result.success) {
    await refreshData('returns');
    await refreshData('inventory');
    await refreshData('allocations');
  }
  return result;
}

export async function apiApproveReturnDept(maPhieuTra: string, approved: boolean, lyDo?: string) {
  if (isMockMode()) {
    const returns = store.getReturns();
    const phieu = returns.find(r => r.maPhieuTra === maPhieuTra);
    if (!phieu || phieu.trangThai !== 'CHO_TRUONG_KHOA_DUYET') return { success: false, message: 'Lỗi phiếu.' };
    store.setReturns(returns.map(r => r.maPhieuTra === maPhieuTra ? { ...r, trangThai: approved ? 'CHO_QL_KHO_DUYET' : 'TU_CHOI' } : r));
    return { success: true, message: approved ? "Đã duyệt." : "Đã từ chối." };
  }
  const result = await fetchApi<any>(`/returns/${maPhieuTra}/approve-dept`, { method: 'PUT', body: JSON.stringify({ approved, lyDo }) });
  if (result.success) {
    await refreshData('returns');
    await refreshData('allocations');
  }
  return result;
}

export async function apiApproveReturnManager(maPhieuTra: string, approved: boolean, lyDo?: string) {
  if (isMockMode()) {
    const returns = store.getReturns();
    const phieu = returns.find(r => r.maPhieuTra === maPhieuTra);
    if (!phieu || phieu.trangThai !== 'CHO_QL_KHO_DUYET') return { success: false, message: 'Lỗi phiếu.' };
    store.setReturns(returns.map(r => r.maPhieuTra === maPhieuTra ? { ...r, trangThai: approved ? 'CHO_XAC_NHAN' : 'TU_CHOI' } : r));
    return { success: true, message: approved ? "Đã duyệt." : "Đã từ chối." };
  }
  const result = await fetchApi<any>(`/returns/${maPhieuTra}/approve-mgr`, { method: 'PUT', body: JSON.stringify({ approved, lyDo }) });
  if (result.success) {
    await refreshData('returns');
    await refreshData('allocations');
  }
  return result;
}

export async function apiDeleteReturn(id: string) {
  if (isMockMode()) {
    store.setReturns(store.getReturns().filter(r => r.maPhieuTra !== id));
    return { success: true, message: 'Đã xóa phiếu trả thành công.' };
  }
  const result = await fetchApi<any>(`/returns/${id}`, { method: 'DELETE' });
  if (result.success) await refreshData('returns');
  return result;
}

export async function apiCancelReturn(id: string) {
  if (isMockMode()) {
    const returns = store.getReturns();
    store.setReturns(returns.map(r => r.maPhieuTra === id ? { ...r, trangThai: 'HUY' } : r));
    return { success: true, message: 'Đã hủy yêu cầu trả thành công.' };
  }
  const result = await fetchApi<any>(`/returns/${id}/cancel`, { method: 'POST' });
  if (result.success) {
    await refreshData('returns');
    await refreshData('allocations');
  }
  return result;
}
