/**
 * API Service Layer
 * 
 * Kết nối với backend Node.js/MySQL qua REST API.
 * Khi backend chưa chạy, tự động fallback về mock data (localStorage).
 * 
 * Cấu hình:
 * - VITE_API_BASE_URL: URL backend (mặc định: http://localhost:5000/api)
 * - VITE_USE_MOCK: "true" để dùng mock data (mặc định: "true")
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'; // default true

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Gọi API thật. Khi backend không khả dụng, throw error.
 */
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(errorData.message || `API Error: ${res.status}`);
  }

  return res.json();
}

/**
 * Helper mock delay - dùng khi fallback về localStorage
 */
const MOCK_DELAY = 300;
export function delay<T>(data: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(data), MOCK_DELAY));
}

/**
 * Kiểm tra có đang dùng mock mode không
 */
export function isMockMode(): boolean {
  return USE_MOCK;
}

export { API_BASE };
