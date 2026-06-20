/**
 * Data Loader - Tải dữ liệu từ API vào store
 * Gọi sau khi đăng nhập thành công
 */
import { store } from './store';
import { isMockMode, fetchApi } from '@/services/api';
import { NguoiDung, ThietBi, TonKho, NhaCungCap, Khoa, ThongBao, PhieuYeuCauCapPhat, PhieuXuatKho, PhieuNhapKho, PhieuCapPhat, PhieuBaoHuHong, PhieuTraThietBi } from '@/types';

export async function loadAllData(userId?: string): Promise<void> {
  if (isMockMode()) return; // Mock mode uses localStorage defaults

  try {
    const [equipment, inventory, suppliers, departments, requests, imports, exports, allocations, damageReports, returns] = await Promise.all([
      fetchApi<ThietBi[]>('/equipment').catch(() => []),
      fetchApi<TonKho[]>('/inventory').catch(() => []),
      fetchApi<NhaCungCap[]>('/suppliers').catch(() => []),
      fetchApi<Khoa[]>('/departments').catch(() => []),
      fetchApi<PhieuYeuCauCapPhat[]>('/requests').catch(() => []),
      fetchApi<PhieuNhapKho[]>('/imports').catch(() => []),
      fetchApi<PhieuXuatKho[]>('/exports').catch(() => []),
      fetchApi<PhieuCapPhat[]>('/allocations').catch(() => []),
      fetchApi<PhieuBaoHuHong[]>('/damage-reports').catch(() => []),
      fetchApi<PhieuTraThietBi[]>('/returns').catch(() => []),
    ]);

    // Optionally load users (admin only) and notifications
    let users: NguoiDung[] = [];
    let notifications: ThongBao[] = [];
    try { users = await fetchApi<NguoiDung[]>('/users'); } catch {}
    if (userId) {
      try { notifications = await fetchApi<ThongBao[]>(`/notifications?userId=${userId}`); } catch {}
    }

    store.initFromApi({
      users, equipment, inventory, suppliers, departments,
      notifications, requests, imports, exports, allocations, damageReports, returns
    });

    console.log('✅ Data loaded from API');
  } catch (err) {
    console.error('❌ Failed to load data from API:', err);
  }
}

/**
 * Refresh a specific data type from API
 */
export async function refreshData(type: string, userId?: string): Promise<void> {
  if (isMockMode()) return;

  try {
    switch (type) {
      case 'equipment': store.setEquipment(await fetchApi('/equipment')); break;
      case 'inventory': store.setInventory(await fetchApi('/inventory')); break;
      case 'suppliers': store.setSuppliers(await fetchApi('/suppliers')); break;
      case 'departments': store.setDepartments(await fetchApi('/departments')); break;
      case 'requests': store.setRequests(await fetchApi('/requests')); break;
      case 'imports': store.setImports(await fetchApi('/imports')); break;
      case 'exports': store.setExports(await fetchApi('/exports')); break;
      case 'allocations': store.setAllocations(await fetchApi('/allocations')); break;
      case 'damageReports': store.setDamageReports(await fetchApi('/damage-reports')); break;
      case 'returns': store.setReturns(await fetchApi('/returns')); break;
      case 'notifications':
        if (userId) store.setNotifications(await fetchApi(`/notifications?userId=${userId}`));
        break;
      case 'users': store.setUsers(await fetchApi('/users')); break;
    }
  } catch (err) {
    console.error(`Failed to refresh ${type}:`, err);
  }
}
