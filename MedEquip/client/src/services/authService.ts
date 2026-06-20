/**
 * Auth Service - US-001, US-002, US-003
 * Xác thực, đăng xuất, đổi mật khẩu
 * 
 * Hỗ trợ 2 mode:
 * - Mock mode (VITE_USE_MOCK=true): dùng localStorage
 * - API mode (VITE_USE_MOCK=false): gọi REST API backend
 */
import { NguoiDung } from '@/types';
import { store } from '@/lib/store';
import { fetchApi, delay, isMockMode } from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: NguoiDung;
  token?: string;
  message?: string;
  failedAttempts?: number;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Mock state
const loginAttempts: Record<string, { count: number; lockedUntil?: number }> = {};

function mockLogin(req: LoginRequest): Promise<LoginResponse> {
  const users = store.getUsers();
  const user = users.find(u => u.email === req.email);
  if (!user) return delay({ success: false, message: 'Email hoặc mật khẩu không đúng!' });
  if (!user.trangThai) return delay({ success: false, message: 'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.' });

  const attempts = loginAttempts[req.email] || { count: 0 };
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    const remainingMin = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    return delay({ success: false, message: `Tài khoản bị khóa. Vui lòng thử lại sau ${remainingMin} phút.` });
  }

  if (user.matKhau !== req.password) {
    attempts.count += 1;
    if (attempts.count >= 5) {
      attempts.lockedUntil = Date.now() + 15 * 60 * 1000;
      loginAttempts[req.email] = attempts;
      return delay({ success: false, message: 'Tài khoản bị khóa 15 phút do nhập sai quá nhiều lần.', failedAttempts: 5 });
    }
    loginAttempts[req.email] = attempts;
    return delay({ success: false, message: 'Email hoặc mật khẩu không đúng!', failedAttempts: attempts.count });
  }

  loginAttempts[req.email] = { count: 0 };
  const token = btoa(JSON.stringify({ userId: user.maNguoiDung, role: user.vaiTro, exp: Date.now() + 30 * 60000 }));
  return delay({ success: true, user, token });
}

// US-001: Đăng nhập
export async function loginApi(req: LoginRequest): Promise<LoginResponse> {
  if (isMockMode()) return mockLogin(req);
  return fetchApi<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(req) });
}

// US-002: Đăng xuất
export async function logoutApi(): Promise<{ success: boolean }> {
  if (isMockMode()) return delay({ success: true });
  return fetchApi('/auth/logout', { method: 'POST' });
}

// US-003: Đổi mật khẩu
export async function changePasswordApi(userId: string, req: ChangePasswordRequest): Promise<{ success: boolean; message: string }> {
  if (isMockMode()) {
    const users = store.getUsers();
    const user = users.find(u => u.maNguoiDung === userId);
    if (!user || user.matKhau !== req.currentPassword) return delay({ success: false, message: 'Mật khẩu hiện tại không đúng!' });
    if (req.newPassword.length < 8) return delay({ success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
    if (!/[A-Z]/.test(req.newPassword)) return delay({ success: false, message: 'Mật khẩu phải có ít nhất 1 chữ hoa.' });
    if (!/[0-9]/.test(req.newPassword)) return delay({ success: false, message: 'Mật khẩu phải có ít nhất 1 chữ số.' });
    const updated = users.map(u => u.maNguoiDung === userId ? { ...u, matKhau: req.newPassword, ngayCapNhat: new Date().toISOString() } : u);
    store.setUsers(updated);
    return delay({ success: true, message: 'Đổi mật khẩu thành công!' });
  }
  return fetchApi(`/auth/change-password`, { method: 'PUT', body: JSON.stringify({ userId, ...req }) });
}
