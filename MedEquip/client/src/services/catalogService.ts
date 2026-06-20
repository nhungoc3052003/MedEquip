/**
 * Supplier & Department Service - US-007, US-008
 * Hỗ trợ Mock mode + API mode
 */
import { NhaCungCap, Khoa } from '@/types';
import { store, generateId } from '@/lib/store';
import { fetchApi, delay, isMockMode } from './api';

export async function getSuppliers(): Promise<NhaCungCap[]> {
  if (isMockMode()) return delay(store.getSuppliers());
  return fetchApi<NhaCungCap[]>('/suppliers');
}

export async function createSupplier(data: Omit<NhaCungCap, 'maNhaCungCap' | 'trangThai'>): Promise<{ success: boolean; supplier?: NhaCungCap }> {
  if (isMockMode()) {
    const supplier: NhaCungCap = { maNhaCungCap: generateId('NCC'), ...data, trangThai: true };
    const suppliers = store.getSuppliers(); suppliers.push(supplier); store.setSuppliers(suppliers);
    return delay({ success: true, supplier });
  }
  return fetchApi('/suppliers', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateSupplier(maNhaCungCap: string, updates: Partial<NhaCungCap>): Promise<{ success: boolean }> {
  if (isMockMode()) {
    store.setSuppliers(store.getSuppliers().map(s => s.maNhaCungCap === maNhaCungCap ? { ...s, ...updates } : s));
    return delay({ success: true });
  }
  return fetchApi(`/suppliers/${maNhaCungCap}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function getDepartments(): Promise<Khoa[]> {
  if (isMockMode()) return delay(store.getDepartments());
  return fetchApi<Khoa[]>('/departments');
}

export async function createDepartment(data: Omit<Khoa, 'maKhoa' | 'trangThai'>): Promise<{ success: boolean; department?: Khoa }> {
  if (isMockMode()) {
    const dept: Khoa = { maKhoa: generateId('K'), ...data, trangThai: true };
    const depts = store.getDepartments(); depts.push(dept); store.setDepartments(depts);
    return delay({ success: true, department: dept });
  }
  return fetchApi('/departments', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDepartment(maKhoa: string, updates: Partial<Khoa>): Promise<{ success: boolean }> {
  if (isMockMode()) {
    store.setDepartments(store.getDepartments().map(d => d.maKhoa === maKhoa ? { ...d, ...updates } : d));
    return delay({ success: true });
  }
  return fetchApi(`/departments/${maKhoa}`, { method: 'PUT', body: JSON.stringify(updates) });
}
