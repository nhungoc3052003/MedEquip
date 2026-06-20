/**
 * Damage Report & Notification Service
 * Hỗ trợ Mock mode + API mode
 */
import { PhieuBaoHuHong, ThongBao } from '@/types';
import { store, generateId } from '@/lib/store';
import { fetchApi, delay, isMockMode } from './api';

export async function createDamageReport(data: Omit<PhieuBaoHuHong, 'maPhieu' | 'trangThai' | 'ngayBao'>): Promise<{ success: boolean; report?: PhieuBaoHuHong }> {
  if (isMockMode()) {
    const report: PhieuBaoHuHong = { maPhieu: generateId('BH'), ...data, trangThai: 'CHO_XU_LY', ngayBao: new Date().toISOString() };
    const reports = store.getDamageReports(); reports.push(report); store.setDamageReports(reports);
    const inv = store.getInventory();
    const idx = inv.findIndex(i => i.maThietBi === data.maThietBi);
    if (idx >= 0) { inv[idx].soLuongDangDung = Math.max(0, inv[idx].soLuongDangDung - data.soLuongHu); inv[idx].soLuongHu += data.soLuongHu; inv[idx].ngayCapNhat = new Date().toISOString(); store.setInventory(inv); }
    const notifications = store.getNotifications();
    notifications.push({ id: generateId('TB-N'), tieuDe: 'Báo hư hỏng mới', noiDung: `Có báo cáo hư hỏng mới ${report.maPhieu}`, loai: 'warning', nguoiNhan: 'ND-002', daDoc: false, ngayTao: new Date().toISOString() });
    store.setNotifications(notifications);
    return delay({ success: true, report });
  }
  return fetchApi('/damage-reports', { method: 'POST', body: JSON.stringify(data) });
}

export async function resolveDamageReport(maPhieu: string, ghiChu: string): Promise<{ success: boolean }> {
  if (isMockMode()) {
    store.setDamageReports(store.getDamageReports().map(r => r.maPhieu === maPhieu ? { ...r, trangThai: 'DA_XU_LY' as const, ngayXuLy: new Date().toISOString(), ghiChu } : r));
    return delay({ success: true });
  }
  return fetchApi(`/damage-reports/${maPhieu}/resolve`, { method: 'PUT', body: JSON.stringify({ ghiChu }) });
}

export async function getDamageReports(): Promise<PhieuBaoHuHong[]> {
  if (isMockMode()) return delay(store.getDamageReports());
  return fetchApi<PhieuBaoHuHong[]>('/damage-reports');
}

export async function getNotifications(userId: string): Promise<ThongBao[]> {
  if (isMockMode()) return delay(store.getNotifications().filter(n => n.nguoiNhan === userId));
  return fetchApi<ThongBao[]>(`/notifications?userId=${userId}`);
}

export async function markAsRead(notificationId: string): Promise<{ success: boolean }> {
  if (isMockMode()) {
    store.setNotifications(store.getNotifications().map(n => n.id === notificationId ? { ...n, daDoc: true } : n));
    return delay({ success: true });
  }
  return fetchApi(`/notifications/${notificationId}/read`, { method: 'PUT' });
}

export async function markAllAsRead(userId: string): Promise<{ success: boolean }> {
  if (isMockMode()) {
    store.setNotifications(store.getNotifications().map(n => n.nguoiNhan === userId ? { ...n, daDoc: true } : n));
    return delay({ success: true });
  }
  return fetchApi('/notifications/read-all', { method: 'PUT', body: JSON.stringify({ userId }) });
}
