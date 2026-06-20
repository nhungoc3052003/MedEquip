import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { NguoiDung } from '@/types';
import { loginApi, logoutApi, LoginResponse } from '@/services/authService';
import { loadAllData } from '@/lib/dataLoader';
import { store } from '@/lib/store';

interface AuthContextType {
  user: NguoiDung | null;
  login: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  isLoggedIn: boolean;
  dataLoaded: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<NguoiDung | null>(() => {
    const saved = localStorage.getItem('kho_currentUser');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      // Bảo vệ: Nếu vai trò cũ (như NV_BV) không còn tồn tại, ép đăng xuất
      const validRoles = ['ADMIN', 'NV_KHO', 'TRUONG_KHOA', 'QL_KHO', 'TRO_LY'];
      if (!parsed.vaiTro || !validRoles.includes(parsed.vaiTro)) {
        localStorage.removeItem('kho_currentUser');
        localStorage.removeItem('auth_token');
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  // Load data on initial mount if user exists
  React.useEffect(() => {
    if (user) {
      loadAllData(user.maNguoiDung).then(() => setDataLoaded(true));
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResponse> => {
    const result = await loginApi({ email, password });
    if (result.success && result.user) {
      setUser(result.user);
      localStorage.setItem('kho_currentUser', JSON.stringify(result.user));
      if (result.token) {
        localStorage.setItem('auth_token', result.token);
      }
      // Load all data from API after login
      await loadAllData(result.user.maNguoiDung);
      setDataLoaded(true);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await logoutApi().catch(() => {});
    setUser(null);
    setDataLoaded(false);
    localStorage.removeItem('kho_currentUser');
    localStorage.removeItem('auth_token');
    store.clearCache();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user, dataLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
