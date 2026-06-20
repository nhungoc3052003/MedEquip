/**
 * Equipment & Inventory Service - US-006, US-009, US-010
 * Hỗ trợ Mock mode + API mode
 */
import { ThietBi, TonKho, PhieuNhapKho } from '@/types';
import { store, generateId } from '@/lib/store';
import { fetchApi, delay, isMockMode } from './api';

export async function createEquipment(data: Omit<ThietBi, 'maThietBi' | 'trangThai' | 'ngayTao'>): Promise<{ success: boolean; equipment?: ThietBi; message?: string }> {
  if (isMockMode()) {
    const equipment = store.getEquipment();
    if (equipment.some(e => e.tenThietBi === data.tenThietBi)) return delay({ success: false, message: 'Thiết bị đã tồn tại.' });
    const newItem: ThietBi = { maThietBi: generateId('TB'), ...data, trangThai: true, ngayTao: new Date().toISOString() };
    equipment.push(newItem);
    store.setEquipment(equipment);
    const inv = store.getInventory();
    inv.push({ maTonKho: generateId('TK'), maThietBi: newItem.maThietBi, soLuongKho: 0, soLuongHu: 0, soLuongDangDung: 0, ngayCapNhat: new Date().toISOString() });
    store.setInventory(inv);
    return delay({ success: true, equipment: newItem });
  }
  return fetchApi('/equipment', { method: 'POST', body: JSON.stringify(data) });
}

export async function deactivateEquipment(maThietBi: string): Promise<{ success: boolean; message?: string }> {
  if (isMockMode()) {
    const inv = store.getInventory().find(i => i.maThietBi === maThietBi);
    if (inv && inv.soLuongKho > 0) return delay({ success: false, message: `Không thể ngừng khi còn ${inv.soLuongKho} đơn vị trong kho.` });
    const equipment = store.getEquipment().map(e => e.maThietBi === maThietBi ? { ...e, trangThai: false } : e);
    store.setEquipment(equipment);
    return delay({ success: true });
  }
  return fetchApi(`/equipment/${maThietBi}/deactivate`, { method: 'PUT' });
}

export async function getEquipment(): Promise<ThietBi[]> {
  if (isMockMode()) return delay(store.getEquipment());
  return fetchApi<ThietBi[]>('/equipment');
}

export async function getInventory(): Promise<TonKho[]> {
  if (isMockMode()) return delay(store.getInventory());
  return fetchApi<TonKho[]>('/inventory');
}

export async function createImport(data: Omit<PhieuNhapKho, 'maPhieu'>): Promise<{ success: boolean; phieu?: PhieuNhapKho; warnings?: string[] }> {
  if (isMockMode()) {
    const phieu: PhieuNhapKho = { maPhieu: generateId('NK'), ...data };
    const imports = store.getImports();
    imports.push(phieu);
    store.setImports(imports);
    const inv = store.getInventory();
    const idx = inv.findIndex(i => i.maThietBi === data.maThietBi);
    if (idx >= 0) { inv[idx].soLuongKho += data.soLuongNhap; inv[idx].ngayCapNhat = new Date().toISOString(); store.setInventory(inv); }
    return delay({ success: true, phieu });
  }
  return fetchApi('/imports', { method: 'POST', body: JSON.stringify(data) });
}

export async function getImports(filters?: { fromDate?: string; toDate?: string; maNhaCungCap?: string }): Promise<PhieuNhapKho[]> {
  if (isMockMode()) {
    let imports = store.getImports();
    if (filters?.maNhaCungCap) imports = imports.filter(i => i.maNhaCungCap === filters.maNhaCungCap);
    if (filters?.fromDate) imports = imports.filter(i => i.ngayNhap >= filters.fromDate!);
    if (filters?.toDate) imports = imports.filter(i => i.ngayNhap <= filters.toDate!);
    return delay(imports.sort((a, b) => b.ngayNhap.localeCompare(a.ngayNhap)));
  }
  const params = new URLSearchParams();
  if (filters?.fromDate) params.append('fromDate', filters.fromDate);
  if (filters?.toDate) params.append('toDate', filters.toDate);
  if (filters?.maNhaCungCap) params.append('maNhaCungCap', filters.maNhaCungCap);
  const query = params.toString();
  return fetchApi<PhieuNhapKho[]>(`/imports${query ? `?${query}` : ''}`);
}
