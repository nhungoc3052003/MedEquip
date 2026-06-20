/**
 * Request Service - US-011 ~ US-015
 * Hỗ trợ Mock mode + API mode
 */
import { PhieuYeuCauCapPhat, PhieuCapPhat, PhieuXuatKho } from '@/types';
import { store, generateId } from '@/lib/store';
import { fetchApi, delay, isMockMode } from './api';

export type RequestStatus = 'CHO_TRUONG_KHOA' | 'CHO_QUAN_LY' | 'CHO_THU_KHO' | 'DA_DUYET' | 'TU_CHOI' | 'DA_NHAN';

export interface ApprovalResult { success: boolean; newStatus?: string; message?: string; }

export async function createRequest(data: Omit<PhieuYeuCauCapPhat, 'maPhieu' | 'trangThai' | 'ngayTao'>): Promise<{ success: boolean; phieu?: PhieuYeuCauCapPhat; message?: string }> {
  if (isMockMode()) {
    const estimatedValue = data.soLuongYeuCau * 100000;
    const trangThai: PhieuYeuCauCapPhat['trangThai'] = 'CHO_DUYET';
    const phieu: PhieuYeuCauCapPhat = { maPhieu: generateId('YCCF'), ...data, trangThai, ngayTao: new Date().toISOString() };
    const requests = store.getRequests(); requests.push(phieu); store.setRequests(requests);
    const notifications = store.getNotifications();
    notifications.push({ id: generateId('TB-N'), tieuDe: 'Yêu cầu cấp phát mới', noiDung: `Có yêu cầu cấp phát mới ${phieu.maPhieu}`, loai: 'info', nguoiNhan: estimatedValue < 500000 ? 'ND-002' : 'ND-003', daDoc: false, ngayTao: new Date().toISOString() });
    store.setNotifications(notifications);
    return delay({ success: true, phieu });
  }
  return fetchApi('/requests', { method: 'POST', body: JSON.stringify(data) });
}

export async function approveByDeptHead(maPhieu: string, approved: boolean, lyDo?: string): Promise<ApprovalResult> {
  if (isMockMode()) {
    const requests = store.getRequests();
    const idx = requests.findIndex(r => r.maPhieu === maPhieu);
    if (idx === -1) return delay({ success: false, message: 'Không tìm thấy phiếu.' });
    if (approved) {
      const val = requests[idx].soLuongYeuCau * 100000;
      if (val > 5000000) { requests[idx].trangThai = 'CHO_DUYET'; requests[idx].ngayDuyet = new Date().toISOString(); store.setRequests(requests); return delay({ success: true, newStatus: 'CHO_QUAN_LY', message: 'Đã duyệt. Chuyển Quản lý.' }); }
      requests[idx].trangThai = 'DA_DUYET'; requests[idx].ngayDuyet = new Date().toISOString(); store.setRequests(requests); return delay({ success: true, newStatus: 'CHO_THU_KHO', message: 'Đã duyệt. Chuyển thủ kho.' });
    }
    requests[idx].trangThai = 'TU_CHOI'; requests[idx].lyDoTuChoi = lyDo; store.setRequests(requests); return delay({ success: true, newStatus: 'TU_CHOI', message: 'Đã từ chối.' });
  }
  return fetchApi(`/requests/${maPhieu}/approve-dept`, { method: 'PUT', body: JSON.stringify({ approved, lyDo }) });
}

export async function approveByManager(maPhieu: string, approved: boolean, lyDo?: string): Promise<ApprovalResult> {
  if (isMockMode()) {
    const requests = store.getRequests();
    const idx = requests.findIndex(r => r.maPhieu === maPhieu);
    if (idx === -1) return delay({ success: false, message: 'Không tìm thấy phiếu.' });
    if (approved) { requests[idx].trangThai = 'DA_DUYET'; requests[idx].ngayDuyet = new Date().toISOString(); store.setRequests(requests); return delay({ success: true, newStatus: 'CHO_THU_KHO', message: 'Đã duyệt.' }); }
    requests[idx].trangThai = 'TU_CHOI'; requests[idx].lyDoTuChoi = lyDo; store.setRequests(requests); return delay({ success: true, newStatus: 'TU_CHOI', message: 'Đã từ chối.' });
  }
  return fetchApi(`/requests/${maPhieu}/approve-mgr`, { method: 'PUT', body: JSON.stringify({ approved, lyDo }) });
}

export async function processExport(maPhieuYeuCau: string, data: { soLuongCapPhat: number; maNhanVienKho: string; ghiChu: string; }): Promise<{ success: boolean; message?: string }> {
  if (isMockMode()) {
    const requests = store.getRequests();
    const request = requests.find(r => r.maPhieu === maPhieuYeuCau);
    if (!request) return delay({ success: false, message: 'Không tìm thấy phiếu yêu cầu.' });
    const inv = store.getInventory();
    const invIdx = inv.findIndex(i => i.maThietBi === request.maThietBi);
    if (invIdx === -1 || inv[invIdx].soLuongKho < data.soLuongCapPhat) return delay({ success: false, message: `Không đủ tồn kho. Hiện có: ${inv[invIdx]?.soLuongKho || 0}` });
    const allocation: PhieuCapPhat = { maPhieu: generateId('CP'), maPhieuYeuCau: maPhieuYeuCau, maNhanVienKho: data.maNhanVienKho, maThietBi: request.maThietBi, maNguoiMuon: request.maNguoiYeuCau, maKhoa: request.maKhoa, soLuongCapPhat: data.soLuongCapPhat, ngayCapPhat: new Date().toISOString(), ghiChu: data.ghiChu };
    const allocations = store.getAllocations(); allocations.push(allocation); store.setAllocations(allocations);
    inv[invIdx].soLuongKho -= data.soLuongCapPhat; inv[invIdx].soLuongDangDung += data.soLuongCapPhat; inv[invIdx].ngayCapNhat = new Date().toISOString(); store.setInventory(inv);
    return delay({ success: true, message: 'Đã xuất kho thành công.' });
  }
  return fetchApi(`/requests/${maPhieuYeuCau}/process`, { method: 'POST', body: JSON.stringify(data) });
}

export async function confirmReceived(maPhieuCapPhat: string): Promise<{ success: boolean; message?: string }> {
  if (isMockMode()) return delay({ success: true, message: 'Đã xác nhận nhận hàng.' });
  return fetchApi(`/requests/${maPhieuCapPhat}/confirm`, { method: 'PUT' });
}

export async function getRequests(filters?: { maKhoa?: string; trangThai?: string }): Promise<PhieuYeuCauCapPhat[]> {
  if (isMockMode()) {
    let requests = store.getRequests();
    if (filters?.maKhoa) requests = requests.filter(r => r.maKhoa === filters.maKhoa);
    if (filters?.trangThai) requests = requests.filter(r => r.trangThai === filters.trangThai);
    return delay(requests);
  }
  const params = new URLSearchParams();
  if (filters?.maKhoa) params.append('maKhoa', filters.maKhoa);
  if (filters?.trangThai) params.append('trangThai', filters.trangThai);
  const query = params.toString();
  return fetchApi<PhieuYeuCauCapPhat[]>(`/requests${query ? `?${query}` : ''}`);
}

export async function createExport(data: Omit<PhieuXuatKho, 'maPhieu'>): Promise<{ success: boolean; phieu?: PhieuXuatKho }> {
  if (isMockMode()) {
    const phieu: PhieuXuatKho = { maPhieu: generateId('XK'), ...data };
    const exports = store.getExports(); exports.push(phieu); store.setExports(exports);
    return delay({ success: true, phieu });
  }
  return fetchApi('/exports', { method: 'POST', body: JSON.stringify(data) });
}

export async function confirmExport(maPhieu: string): Promise<{ success: boolean }> {
  if (isMockMode()) {
    const exports = store.getExports();
    const phieu = exports.find(e => e.maPhieu === maPhieu);
    if (!phieu) return delay({ success: false });
    store.setExports(exports.map(e => e.maPhieu === maPhieu ? { ...e, trangThai: 'DA_XUAT' as const } : e));
    const inv = store.getInventory();
    const idx = inv.findIndex(i => i.maThietBi === phieu.maThietBi);
    if (idx >= 0) { inv[idx].soLuongKho -= Math.min(phieu.soLuong, inv[idx].soLuongKho); inv[idx].ngayCapNhat = new Date().toISOString(); store.setInventory(inv); }
    return delay({ success: true });
  }
  return fetchApi(`/exports/${maPhieu}/confirm`, { method: 'PUT' });
}
