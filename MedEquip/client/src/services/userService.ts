/**
 * User Service - US-004, US-005
 * Hỗ trợ Mock mode + API mode
 */
import { NguoiDung, UserRole } from '@/types';
import { store, generateId } from '@/lib/store';
import { fetchApi, delay, isMockMode } from './api';

export interface CreateUserRequest {
  hoTen: string;
  email: string;
  matKhau: string;
  vaiTro: UserRole;
  soDienThoai?: string;
  diaChi?: string;
}

export async function createUser(req: CreateUserRequest): Promise<{ success: boolean; user?: NguoiDung; message?: string }> {
  if (isMockMode()) {
    const users = store.getUsers();
    if (users.some(u => u.email === req.email)) return delay({ success: false, message: 'Email đã được sử dụng.' });
    const newUser: NguoiDung = { maNguoiDung: generateId('ND'), ...req, trangThai: true, ngayTao: new Date().toISOString(), ngayCapNhat: new Date().toISOString() };
    users.push(newUser);
    store.setUsers(users);
    return delay({ success: true, user: newUser });
  }
  return fetchApi('/users', { method: 'POST', body: JSON.stringify(req) });
}

export async function updateUser(userId: string, updates: Partial<NguoiDung>): Promise<{ success: boolean; message?: string }> {
  if (isMockMode()) {
    const users = store.getUsers();
    const idx = users.findIndex(u => u.maNguoiDung === userId);
    if (idx === -1) return delay({ success: false, message: 'Không tìm thấy người dùng.' });
    if (updates.email && updates.email !== users[idx].email && users.some(u => u.email === updates.email)) {
      return delay({ success: false, message: 'Email đã được sử dụng.' });
    }
    users[idx] = { ...users[idx], ...updates, ngayCapNhat: new Date().toISOString() };
    store.setUsers(users);
    return delay({ success: true });
  }
  return fetchApi(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
}

export async function deactivateUser(userId: string): Promise<{ success: boolean; message?: string }> {
  if (isMockMode()) return updateUser(userId, { trangThai: false });
  return fetchApi(`/users/${userId}/deactivate`, { method: 'PUT' });
}

export async function activateUser(userId: string): Promise<{ success: boolean; message?: string }> {
  if (isMockMode()) return updateUser(userId, { trangThai: true });
  return fetchApi(`/users/${userId}/activate`, { method: 'PUT' });
}

export async function changeRole(userId: string, newRole: UserRole): Promise<{ success: boolean; message?: string }> {
  if (isMockMode()) return updateUser(userId, { vaiTro: newRole });
  return fetchApi(`/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ vaiTro: newRole }) });
}

export async function getUsers(): Promise<NguoiDung[]> {
  if (isMockMode()) return delay(store.getUsers());
  return fetchApi<NguoiDung[]>('/users');
}

export async function getUserById(userId: string): Promise<NguoiDung | undefined> {
  if (isMockMode()) return delay(store.getUsers().find(u => u.maNguoiDung === userId));
  return fetchApi<NguoiDung>(`/users/${userId}`);
}
