import { useState, useMemo, useEffect } from 'react';
import { store } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Package, FileInput, FileOutput, Trash2, Pencil, X, Eye, Plus, 
  Image as ImageIcon, QrCode, Printer, Building2, Warehouse, Download, Tag,
  Clock, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Cpu
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { apiCreateEquipment, apiUpdateEquipment, apiDeleteEquipment } from '@/lib/apiSync';
import { ThietBi, PhieuCapPhat } from '@/types';
import ImportsPage from './ImportsPage';
import ExportsPage from './ExportsPage';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeCanvas as QRCodeComponent } from 'qrcode.react';
import { fetchApi } from '@/services/api';

function StockView({ onRefresh }: { onRefresh: () => void }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortOption, setSortOption] = useState('nameAsc');
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Quản lý mã cá thể (Serial / Barcode)
  const [instancesDialogOpen, setInstancesDialogOpen] = useState(false);
  const [selectedEquipmentForInstances, setSelectedEquipmentForInstances] = useState<any>(null);
  const [instancesList, setInstancesList] = useState<any[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [instanceSearch, setInstanceSearch] = useState('');
  const [instanceFilter, setInstanceFilter] = useState<'ALL' | 'KHO' | 'KHOA_PHONG' | 'OTHER'>('ALL');
  const [qrModalItem, setQrModalItem] = useState<any>(null);

  const isTrưởngKhoa = user?.vaiTro === 'TRUONG_KHOA' || user?.vaiTro === 'TRO_LY';
  const isAdmin = user?.vaiTro === 'ADMIN';
  const canEdit = !isTrưởngKhoa && !isAdmin;

  // Xác định mã khoa an toàn (có fallback thông minh theo tên / email nếu phiên đăng nhập thiếu trường)
  const targetDept = user?.maKhoa || (
    user?.email === 'khoanoi@benhvien.vn' || user?.hoTen?.includes('Nội') ? 'K-001' :
    user?.hoTen?.includes('Ngoại') ? 'K-002' :
    user?.hoTen?.includes('Sản') ? 'K-003' : 'K-001'
  );

  // State phản ứng đồng bộ từ API và Store
  const [allocations, setAllocations] = useState<any[]>(() => store.getAllocations() || []);
  const [equipment, setEquipment] = useState<any[]>(() => store.getEquipment() || []);
  const [inventory, setInventory] = useState<any[]>(() => store.getInventory() || []);
  const [suppliers, setSuppliers] = useState<any[]>(() => store.getSuppliers() || []);
  const [deptInstances, setDeptInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allocRes, eqRes, invRes, supRes] = await Promise.all([
        fetchApi<any[]>('/allocations').catch(() => store.getAllocations()),
        fetchApi<any[]>('/equipment').catch(() => store.getEquipment()),
        fetchApi<any[]>('/inventory').catch(() => store.getInventory()),
        fetchApi<any[]>('/suppliers').catch(() => store.getSuppliers()),
      ]);

      if (Array.isArray(allocRes) && allocRes.length > 0) {
        setAllocations(allocRes);
        store.setAllocations(allocRes);
      } else {
        setAllocations(store.getAllocations());
      }

      if (Array.isArray(eqRes) && eqRes.length > 0) {
        setEquipment(eqRes);
        store.setEquipment(eqRes);
      } else {
        setEquipment(store.getEquipment());
      }

      if (Array.isArray(invRes)) {
        setInventory(invRes);
        store.setInventory(invRes);
      }

      if (Array.isArray(supRes)) {
        setSuppliers(supRes);
        store.setSuppliers(supRes);
      }

      if (targetDept) {
        try {
          const instRes = await fetchApi<any[]>(`/instances/department/${targetDept}`);
          if (Array.isArray(instRes)) {
            setDeptInstances(instRes);
          }
        } catch (e) {
          console.error('Fetch dept instances error:', e);
        }
      }
    } catch (err) {
      console.error('Fetch stock data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      setAllocations(store.getAllocations());
      setEquipment(store.getEquipment());
      setInventory(store.getInventory());
      setSuppliers(store.getSuppliers());
    };

    window.addEventListener('store_allocations_changed', handleUpdate);
    window.addEventListener('store_equipment_changed', handleUpdate);
    window.addEventListener('store_inventory_changed', handleUpdate);
    window.addEventListener('store_data_updated', handleUpdate);

    return () => {
      window.removeEventListener('store_allocations_changed', handleUpdate);
      window.removeEventListener('store_equipment_changed', handleUpdate);
      window.removeEventListener('store_inventory_changed', handleUpdate);
      window.removeEventListener('store_data_updated', handleUpdate);
    };
  }, [targetDept]);

  const openInstancesModal = async (tb: any) => {
    if (!tb) return;
    setSelectedEquipmentForInstances(tb);
    setInstancesDialogOpen(true);
    setLoadingInstances(true);
    setInstanceSearch('');
    setInstanceFilter(isTrưởngKhoa ? 'KHOA_PHONG' : 'ALL');
    try {
      const data = await fetchApi<any[]>(`/instances?maThietBi=${tb.maThietBi}`);
      setInstancesList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: 'Không thể tải danh sách cá thể máy: ' + err.message, variant: 'destructive' });
      setInstancesList([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  const filteredInstances = useMemo(() => {
    return instancesList.filter(inst => {
      if (instanceFilter === 'KHO' && inst.viTri !== 'KHO') return false;
      if (instanceFilter === 'KHOA_PHONG') {
        if (inst.viTri !== 'KHOA_PHONG') return false;
        if (isTrưởngKhoa && inst.maKhoa && inst.maKhoa !== targetDept) return false;
      }
      if (instanceFilter === 'OTHER' && (inst.viTri === 'KHO' || inst.viTri === 'KHOA_PHONG')) return false;
      if (instanceSearch) {
        const q = instanceSearch.toLowerCase().trim();
        return (
          inst.maCaThe?.toLowerCase().includes(q) ||
          inst.serialNumber?.toLowerCase().includes(q) ||
          inst.tenKhoa?.toLowerCase().includes(q) ||
          inst.ghiChu?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [instancesList, instanceFilter, instanceSearch, isTrưởngKhoa, targetDept]);

  const [form, setForm] = useState<{
    tenThietBi: string; loaiThietBi: 'VAT_TU_TIEU_HAO' | 'TAI_SU_DUNG'; donViCoSo: string; donViNhap: string;
    heSoQuyDoi: number; serialNumber: string; nguongCanhBao: number;
    moTa: string; maNhaCungCap: string; hinhAnh: string;
  }>({
    tenThietBi: '', loaiThietBi: 'TAI_SU_DUNG', donViCoSo: 'Cái', donViNhap: 'Hộp',
    heSoQuyDoi: 1, serialNumber: '', nguongCanhBao: 10,
    moTa: '', maNhaCungCap: '', hinhAnh: ''
  });

  const data = useMemo(() => {
    let result: any[] = [];
    if (isTrưởngKhoa) {
      result = allocations
        .filter(a => {
          const matchDept = (a.maKhoa === targetDept) || (a.maKhoaNhan === targetDept);
          const notReturned = a.trangThaiTra !== 'DA_TRA';
          return matchDept && notReturned;
        })
        .map((a, idx) => {
          const eq = equipment.find(e => e.maThietBi === a.maThietBi) || {
            maThietBi: a.maThietBi,
            tenThietBi: a.tenThietBi || a.maThietBi,
            loaiThietBi: a.loaiThietBi || 'TAI_SU_DUNG',
            donViCoSo: a.donViTinh || 'Cái',
            moTa: ''
          };
          return {
            ...a,
            thietBi: eq,
            soLuongKho: 0, 
            soLuongDangDung: a.soLuongCapPhat,
            soLuongHu: 0,
            maTonKho: `${a.maPhieu}-${a.maThietBi || 'item'}-${a.id || idx}`,
            donGia: 0
          };
        })
        .filter(d => {
          const matchSearch = String(d.thietBi?.tenThietBi || d.tenThietBi || '').toLowerCase().includes(search.toLowerCase()) ||
                              String(d.maThietBi || '').toLowerCase().includes(search.toLowerCase()) ||
                              String(d.maPhieu || '').toLowerCase().includes(search.toLowerCase());
          if (!matchSearch) return false;

          if (filterStatus === 'CHUA_TRA') return d.trangThaiTra === 'CHUA_TRA';
          if (filterStatus === 'YEU_CAU_TRA') return d.trangThaiTra === 'YEU_CAU_TRA';
          if (filterStatus === 'DA_GIA_HAN') return d.trangThaiTra === 'DA_GIA_HAN';

          return true;
        });
    } else {
      result = inventory.map(inv => ({
        ...inv,
        thietBi: equipment.find(e => e.maThietBi === inv.maThietBi),
      })).filter(d => {
        const matchSearch = String(d.thietBi?.tenThietBi || '').toLowerCase().includes(search.toLowerCase()) ||
                            String(d.maThietBi || '').toLowerCase().includes(search.toLowerCase());
        if (!matchSearch) return false;
        
        if (filterStatus === 'TRONG_KHO') return d.soLuongKho > 0;
        if (filterStatus === 'DANG_DUNG') return d.soLuongDangDung > 0;
        if (filterStatus === 'HU_HONG') return d.soLuongHu > 0;
        if (filterStatus === 'HET_HANG') return (d.soLuongKho === 0 && d.soLuongDangDung === 0 && d.soLuongHu === 0);
        
        return true;
      });
    }

    result.sort((a, b) => {
      const nameA = String(a.thietBi?.tenThietBi || a.maThietBi).toLowerCase();
      const nameB = String(b.thietBi?.tenThietBi || b.maThietBi).toLowerCase();
      const qtyA = (a.soLuongKho || 0) + (a.soLuongDangDung || 0) + (a.soLuongHu || 0);
      const qtyB = (b.soLuongKho || 0) + (b.soLuongDangDung || 0) + (b.soLuongHu || 0);
      const valA = (a.donGia || 0) * qtyA;
      const valB = (b.donGia || 0) * qtyB;

      switch(sortOption) {
        case 'nameAsc': return nameA.localeCompare(nameB);
        case 'nameDesc': return nameB.localeCompare(nameA);
        case 'qtyAsc': return qtyA - qtyB;
        case 'qtyDesc': return qtyB - qtyA;
        case 'valAsc': return valA - valB;
        case 'valDesc': return valB - valA;
        default: return nameA.localeCompare(nameB);
      }
    });

    return result;
  }, [inventory, equipment, allocations, search, filterStatus, sortOption, isTrưởngKhoa, targetDept]);

  // Thống kê nhanh cho Trưởng khoa
  const statsTrưởngKhoa = useMemo(() => {
    if (!isTrưởngKhoa) return null;
    const myAllocs = allocations.filter(a => ((a.maKhoa === targetDept) || (a.maKhoaNhan === targetDept)) && a.trangThaiTra !== 'DA_TRA');
    return {
      total: myAllocs.length,
      using: myAllocs.filter(a => a.trangThaiTra === 'CHUA_TRA').length,
      returning: myAllocs.filter(a => a.trangThaiTra === 'YEU_CAU_TRA').length,
      extended: myAllocs.filter(a => a.trangThaiTra === 'DA_GIA_HAN').length,
      instancesCount: deptInstances.length
    };
  }, [isTrưởngKhoa, allocations, targetDept, deptInstances]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'CHUA_TRA':
        return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20 font-medium">Đang sử dụng</Badge>;
      case 'YEU_CAU_TRA':
        return <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/20 font-medium">Chờ duyệt trả</Badge>;
      case 'DA_GIA_HAN':
        return <Badge className="bg-purple-500/10 text-purple-700 border-purple-500/30 hover:bg-purple-500/20 font-medium">Đã gia hạn</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openAdd = () => {
    setSelectedItem(null);
    setForm({
      tenThietBi: '', loaiThietBi: 'TAI_SU_DUNG', donViCoSo: 'Cái', donViNhap: 'Hộp',
      heSoQuyDoi: 1, serialNumber: '', nguongCanhBao: 10,
      moTa: '', maNhaCungCap: '', hinhAnh: ''
    });
    setEditOpen(true);
  };

  const openEdit = (tb: ThietBi) => {
    setSelectedItem(tb);
    setForm({
      tenThietBi: tb.tenThietBi, loaiThietBi: tb.loaiThietBi, donViCoSo: tb.donViCoSo || '', donViNhap: tb.donViNhap || '',
      heSoQuyDoi: tb.heSoQuyDoi || 1, serialNumber: tb.serialNumber || '', nguongCanhBao: tb.nguongCanhBao || 10,
      moTa: tb.moTa || '', maNhaCungCap: tb.maNhaCungCap || '', hinhAnh: tb.hinhAnh || ''
    });
    setEditOpen(true);
    setDetailOpen(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setForm(f => ({ ...f, hinhAnh: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.tenThietBi || !form.loaiThietBi) {
      toast({ title: 'Lỗi', description: 'Nhập đầy đủ thông tin', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      let res;
      if (selectedItem) res = await apiUpdateEquipment(selectedItem.maThietBi, form);
      else res = await apiCreateEquipment(form as any);
      
      if (res.success) {
        toast({ title: 'Thành công', description: selectedItem ? 'Đã cập nhật' : 'Đã thêm mới' });
        setEditOpen(false);
        onRefresh();
      } else toast({ title: 'Lỗi', description: res.message, variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (maThietBi: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const inv = inventory.find(i => i.maThietBi === maThietBi);
    if (inv && (inv.soLuongKho > 0 || inv.soLuongDangDung > 0)) {
      toast({ title: 'Lỗi', description: 'Thiết bị đang có tồn kho, không thể xóa.', variant: 'destructive' }); return;
    }
    if (!window.confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) return;
    try {
      const res = await apiDeleteEquipment(maThietBi);
      if (res.success) {
        toast({ title: 'Đã xóa' });
        onRefresh();
      }
      else toast({ title: 'Lỗi', description: res.message, variant: 'destructive' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Thống kê nhanh cho Trưởng khoa */}
      {isTrưởngKhoa && statsTrưởngKhoa && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tổng thiết bị</span>
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div className="text-2xl font-bold mt-1 text-foreground">{statsTrưởngKhoa.total}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Mục đang mượn</div>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700">Đang sử dụng</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold mt-1 text-emerald-700">{statsTrưởngKhoa.using}</div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5">Hoạt động bình thường</div>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700">Chờ duyệt trả</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold mt-1 text-amber-700">{statsTrưởngKhoa.returning}</div>
            <div className="text-[11px] text-amber-600/80 mt-0.5">Đã gửi yêu cầu trả</div>
          </div>

          <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-purple-700">Đã gia hạn</span>
              <AlertTriangle className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-bold mt-1 text-purple-700">{statsTrưởngKhoa.extended}</div>
            <div className="text-[11px] text-purple-600/80 mt-0.5">Gia hạn thời gian</div>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700">Máy cá thể</span>
              <Cpu className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl font-bold mt-1 text-blue-700">{statsTrưởngKhoa.instancesCount}</div>
            <div className="text-[11px] text-blue-600/80 mt-0.5">Máy vật lý tại khoa</div>
          </div>
        </div>
      )}

      {/* Toolbar bộ lọc */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={isTrưởngKhoa ? "Tìm tên, mã thiết bị, mã phiếu cấp..." : "Tìm tên, mã thiết bị..."} 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              className="pl-10 w-full" 
            />
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Lọc trạng thái" />
            </SelectTrigger>
            <SelectContent>
              {isTrưởngKhoa ? (
                <>
                  <SelectItem value="ALL">Tất cả thiết bị mượn</SelectItem>
                  <SelectItem value="CHUA_TRA">Đang sử dụng</SelectItem>
                  <SelectItem value="YEU_CAU_TRA">Đang yêu cầu trả</SelectItem>
                  <SelectItem value="DA_GIA_HAN">Đã gia hạn</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="ALL">Tất cả thiết bị</SelectItem>
                  <SelectItem value="TRONG_KHO">Đang có trong kho</SelectItem>
                  <SelectItem value="DANG_DUNG">Đang được sử dụng</SelectItem>
                  <SelectItem value="HU_HONG">Có thiết bị hư hỏng</SelectItem>
                  <SelectItem value="HET_HANG">Đã hết sạch hàng</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sắp xếp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nameAsc">Tên TB A → Z</SelectItem>
              <SelectItem value="nameDesc">Tên TB Z → A</SelectItem>
              <SelectItem value="qtyAsc">Số lượng tăng dần</SelectItem>
              <SelectItem value="qtyDesc">Số lượng giảm dần</SelectItem>
              {!isTrưởngKhoa && (
                <>
                  <SelectItem value="valAsc">Giá trị tăng dần</SelectItem>
                  <SelectItem value="valDesc">Giá trị giảm dần</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="icon" 
            title="Tải lại dữ liệu"
            onClick={() => loadData()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          </Button>
        </div>
      </div>

      {!isTrưởngKhoa && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center shadow-sm">
           <div>
             <h3 className="text-sm text-primary font-semibold mb-1">Tổng giá trị tài sản hệ thống</h3>
             <p className="text-xs text-muted-foreground">Dựa trên đơn giá lô nhập gần nhất</p>
           </div>
           <div className="text-2xl font-bold font-mono text-primary">
              {new Intl.NumberFormat('vi-VN').format(
                data.reduce((sum, d) => sum + ((d.donGia || 0) * (d.soLuongKho + d.soLuongDangDung + d.soLuongHu)), 0)
              )} đ
           </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-card/40 gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Đang tải danh sách thiết bị...</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-4 font-medium text-muted-foreground">Thiết bị</th>
                {isTrưởngKhoa ? (
                  <>
                    <th className="text-left p-4 font-medium text-muted-foreground">Mã phiếu cấp</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Số lượng mượn</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Ngày cấp</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Hạn trả (Dự kiến)</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Trạng thái</th>
                    <th className="text-right p-4 font-medium text-muted-foreground">Thao tác</th>
                  </>
                ) : (
                  <>
                    <th className="text-center p-4 font-medium text-muted-foreground">Trong kho</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Đang dùng</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Hư hỏng</th>
                    <th className="text-center p-4 font-medium text-muted-foreground">Tổng cộng SL</th>
                    <th className="text-right p-4 font-medium text-muted-foreground w-36">Tổng trị giá</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map(d => (
                <tr 
                  key={d.maTonKho} 
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => { setSelectedItem(d.thietBi); setDetailOpen(true); }}
                >
                  <td className="p-4">
                    <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {d.thietBi?.tenThietBi || d.tenThietBi || 'Thiết bị không xác định'}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-muted-foreground">{d.maThietBi}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                        {d.thietBi?.loaiThietBi === 'VAT_TU_TIEU_HAO' ? 'Tiêu hao' : 'Tái sử dụng'}
                      </span>
                    </div>
                    {d.thietBi?.loaiThietBi === 'TAI_SU_DUNG' && (
                      <div className="mt-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2 py-0 border-primary/30 text-primary hover:bg-primary/10 gap-1 rounded-full font-normal shadow-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInstancesModal(d.thietBi);
                          }}
                        >
                          <QrCode className="w-3 h-3" /> Xem mã máy cá thể & QR
                        </Button>
                      </div>
                    )}
                  </td>
                  
                  {isTrưởngKhoa ? (
                    <>
                      <td className="p-4">
                        <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                          {d.maPhieu}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-md bg-primary/10 text-primary font-semibold text-xs">
                          {d.soLuongCapPhat} {d.thietBi?.donViCoSo || d.donViTinh || ''}
                        </span>
                      </td>
                      <td className="p-4 text-center text-muted-foreground text-xs">
                        {d.ngayCapPhat ? new Date(d.ngayCapPhat).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs ${d.ngayDuKienTra && new Date(d.ngayDuKienTra) < new Date() ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                          {d.ngayDuKienTra ? new Date(d.ngayDuKienTra).toLocaleDateString('vi-VN') : '—'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {renderStatusBadge(d.trangThaiTra)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => { setSelectedItem(d.thietBi); setDetailOpen(true); }}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Chi tiết
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold">
                          {d.soLuongKho} <span className="text-[10px] ml-1">{d.thietBi?.donViCoSo}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-md bg-secondary/10 text-secondary-foreground font-semibold">
                          {d.soLuongDangDung} <span className="text-[10px] ml-1">{d.thietBi?.donViCoSo}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-md bg-warning/10 text-warning font-semibold">
                          {d.soLuongHu} <span className="text-[10px] ml-1">{d.thietBi?.donViCoSo}</span>
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-base font-bold text-foreground">
                          {d.soLuongKho + d.soLuongDangDung + d.soLuongHu} <span className="text-xs font-normal text-muted-foreground">{d.thietBi?.donViCoSo}</span>
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-semibold text-primary">
                        {d.donGia ? new Intl.NumberFormat('vi-VN').format(d.donGia * (d.soLuongKho + d.soLuongDangDung + d.soLuongHu)) + ' đ' : '-'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Chi tiết thiết bị</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-2">
              <div className="aspect-video rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                {selectedItem.hinhAnh ? (
                  <img src={selectedItem.hinhAnh} alt={selectedItem.tenThietBi} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Tên thiết bị:</span>
                  <span className="font-semibold">{selectedItem.tenThietBi}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Loại:</span>
                  <span>{selectedItem.loaiThietBi}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Nhà cung cấp:</span>
                  <span>{suppliers.find(s => s.maNhaCungCap === selectedItem.maNhaCungCap)?.tenNhaCungCap || '—'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <span className={selectedItem.trangThai ? 'text-success font-medium' : 'text-destructive font-medium'}>
                    {selectedItem.trangThai ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                  </span>
                </div>
                <div className="pt-2">
                  <span className="text-muted-foreground block mb-1">Mô tả chức năng:</span>
                  <p className="text-foreground leading-relaxed italic">{selectedItem.moTa || 'Chưa có mô tả'}</p>
                </div>
              </div>
              {selectedItem.loaiThietBi === 'TAI_SU_DUNG' && (
                <div className="pt-2 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => {
                      setDetailOpen(false);
                      openInstancesModal(selectedItem);
                    }}
                  >
                    <QrCode className="w-4 h-4" /> Xem danh sách mã máy cá thể & In tem QR
                  </Button>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                {canEdit && (
                  <Button className="flex-1 gradient-primary text-white" onClick={() => openEdit(selectedItem)}>
                    <Pencil className="w-4 h-4 mr-2" /> Sửa thông tin
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => setDetailOpen(false)}>Thoát</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DANH SÁCH MÃ CÁ THỂ THIẾT BỊ (SERIAL / BARCODE) */}
      <Dialog open={instancesDialogOpen} onOpenChange={setInstancesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <QrCode className="w-5 h-5 text-primary" />
                  Danh sách mã cá thể máy: {selectedEquipmentForInstances?.tenThietBi}
                </DialogTitle>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span>Mã danh mục: <strong className="font-mono text-foreground">{selectedEquipmentForInstances?.maThietBi}</strong></span>
                  <span>•</span>
                  <span>Tổng số lượng: <strong className="text-primary">{instancesList.length} máy</strong></span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <Button
                  type="button"
                  size="sm"
                  variant={instanceFilter === 'ALL' ? 'default' : 'ghost'}
                  className="text-xs h-8"
                  onClick={() => setInstanceFilter('ALL')}
                >
                  Tất cả ({instancesList.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={instanceFilter === 'KHO' ? 'default' : 'ghost'}
                  className="text-xs h-8 text-emerald-600 dark:text-emerald-400"
                  onClick={() => setInstanceFilter('KHO')}
                >
                  Tại kho ({instancesList.filter(i => i.viTri === 'KHO').length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={instanceFilter === 'KHOA_PHONG' ? 'default' : 'ghost'}
                  className="text-xs h-8 text-blue-600 dark:text-blue-400"
                  onClick={() => setInstanceFilter('KHOA_PHONG')}
                >
                  Khoa phòng mượn ({instancesList.filter(i => i.viTri === 'KHOA_PHONG').length})
                </Button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Tìm mã máy, số serial..."
                  value={instanceSearch}
                  onChange={e => setInstanceSearch(e.target.value)}
                  className="h-8 text-xs pl-8 font-normal"
                />
              </div>
            </div>

            {/* Content Table */}
            {loadingInstances ? (
              <div className="text-center py-12 text-muted-foreground">
                Đang tải danh sách cá thể máy...
              </div>
            ) : filteredInstances.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
                Không tìm thấy máy nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-medium">Mã cá thể (Mã máy)</th>
                      <th className="text-left p-3 font-medium">Số Serial</th>
                      <th className="text-left p-3 font-medium">Vị trí hiện tại</th>
                      <th className="text-center p-3 font-medium">Trạng thái</th>
                      <th className="text-right p-3 font-medium">Tem nhãn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInstances.map(inst => (
                      <tr key={inst.maCaThe} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">
                            {inst.maCaThe}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {inst.serialNumber || '---'}
                        </td>
                        <td className="p-3">
                          {inst.viTri === 'KHO' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              <Warehouse className="w-3.5 h-3.5" /> Kho thiết bị
                            </span>
                          ) : (
                            <div className="text-xs">
                              <span className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold">
                                <Building2 className="w-3.5 h-3.5" /> {inst.tenKhoa || inst.maKhoa || 'Khoa phòng'}
                              </span>
                              {inst.maPhieuCapPhat && (
                                <div className="text-[10px] text-muted-foreground font-mono">
                                  Phiếu: {inst.maPhieuCapPhat}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inst.trangThai === 'SAN_SANG'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : inst.trangThai === 'DANG_SU_DUNG'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : inst.trangThai === 'DANG_BAO_TRI'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}>
                            {inst.trangThai === 'SAN_SANG' ? 'Sẵn sàng'
                              : inst.trangThai === 'DANG_SU_DUNG' ? 'Đang mượn'
                              : inst.trangThai === 'DANG_BAO_TRI' ? 'Bảo trì'
                              : 'Hư hỏng'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => setQrModalItem(inst)}
                          >
                            <QrCode className="w-3.5 h-3.5" /> Xem tem
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setInstancesDialogOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL XEM & IN TEM QR CODE CHO CÁ THỂ MÁY */}
      <Dialog open={!!qrModalItem} onOpenChange={(open) => !open && setQrModalItem(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-center gap-2">
              <Tag className="w-5 h-5 text-primary" /> Tem mã thiết bị y tế
            </DialogTitle>
          </DialogHeader>

          {qrModalItem && (
            <div className="space-y-4 py-2">
              <div id="printable-qr-sticker" className="p-4 bg-white text-black rounded-xl border shadow-sm mx-auto w-full max-w-[280px]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 border-b pb-1 mb-3">
                  BỆNH VIỆN ĐA KHOA
                </div>
                <div className="flex justify-center p-2 bg-white">
                  <QRCodeComponent
                    value={qrModalItem.maCaThe}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="mt-3 text-center">
                  <div className="font-mono font-black text-lg tracking-widest text-black">
                    {qrModalItem.maCaThe}
                  </div>
                  <div className="text-xs font-semibold text-neutral-800 line-clamp-1 mt-0.5">
                    {qrModalItem.tenThietBi}
                  </div>
                  {qrModalItem.serialNumber && (
                    <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      Serial: {qrModalItem.serialNumber}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1 gradient-primary text-white gap-2"
                  onClick={() => {
                    window.print();
                  }}
                >
                  <Printer className="w-4 h-4" /> In tem nhãn
                </Button>
                <Button variant="outline" onClick={() => setQrModalItem(null)}>Đóng</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Add Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selectedItem ? 'Sửa thiết bị' : 'Thêm thiết bị mới'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Tên thiết bị *</Label><Input value={form.tenThietBi} onChange={e => setForm(f => ({ ...f, tenThietBi: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Loại thiết bị *</Label>
                <Select value={form.loaiThietBi} onValueChange={v => setForm(f => ({ ...f, loaiThietBi: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAI_SU_DUNG">Tái sử dụng</SelectItem>
                    <SelectItem value="VAT_TU_TIEU_HAO">Vật tư tiêu hao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>ĐVT cơ sở *</Label><Input value={form.donViCoSo} onChange={e => setForm(f => ({ ...f, donViCoSo: e.target.value }))} /></div>
                <div><Label>ĐVT nhập *</Label><Input value={form.donViNhap} onChange={e => setForm(f => ({ ...f, donViNhap: e.target.value }))} /></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Hệ số quy đổi (1 Nhập = N Cơ sở)</Label><Input type="number" value={form.heSoQuyDoi} onChange={e => setForm(f => ({ ...f, heSoQuyDoi: parseInt(e.target.value) || 1 }))} /></div>
              <div><Label>Ngưỡng cảnh báo tồn</Label><Input type="number" value={form.nguongCanhBao} onChange={e => setForm(f => ({ ...f, nguongCanhBao: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            {form.loaiThietBi === 'TAI_SU_DUNG' && (
              <div><Label>Serial Number</Label><Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} /></div>
            )}
            <div>
              <Label>Nhà cung cấp</Label>
              <Select value={form.maNhaCungCap} onValueChange={v => setForm(f => ({ ...f, maNhaCungCap: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn NCC" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => <SelectItem key={s.maNhaCungCap} value={s.maNhaCungCap}>{s.tenNhaCungCap}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Mô tả chức năng</Label><Textarea value={form.moTa} onChange={e => setForm(f => ({ ...f, moTa: e.target.value }))} /></div>
            <div>
              <Label>Hình ảnh</Label>
              <div className="flex items-center gap-4 mt-1">
                {form.hinhAnh && <div className="w-16 h-16 rounded border overflow-hidden"><img src={form.hinhAnh} className="w-full h-full object-cover" /></div>}
                <Input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white">{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {data.length === 0 && !loading && (
        <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
          <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">
            {isTrưởngKhoa 
              ? 'Khoa hiện tại chưa có thiết bị nào đang mượn hoặc không có mục nào khớp bộ lọc' 
              : 'Không tìm thấy dữ liệu tồn kho phù hợp'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(prev => prev + 1);

  const isTrưởngKhoa = user?.vaiTro === 'TRUONG_KHOA' || user?.vaiTro === 'TRO_LY';
  const isAdmin = user?.vaiTro === 'ADMIN';
  const canEdit = !isTrưởngKhoa && !isAdmin;

  return (
    <div key={refreshKey} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {isTrưởngKhoa ? 'Thiết bị đang mượn' : 'Quản lý kho'}
        </h1>
        <p className="text-muted-foreground">
          {isTrưởngKhoa 
            ? 'Danh sách thiết bị mà khoa đang mượn và quản lý.' 
            : 'Theo dõi tồn kho, quản lý nhập xuất và thiết bị.'}
        </p>
      </div>

      <Tabs defaultValue="stock" className="w-full space-y-6">
        <TabsList className={`${isTrưởngKhoa ? 'inline-flex w-auto' : 'grid w-full grid-cols-2 md:grid-cols-4 lg:max-w-2xl'} bg-muted/40 p-1 rounded-xl`}>
          <TabsTrigger value="stock" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">
            <Package className="w-4 h-4 mr-2" />
            {isTrưởngKhoa ? 'Thiết bị của khoa' : 'Tồn kho'}
          </TabsTrigger>
          {!isTrưởngKhoa && (
            <>
              <TabsTrigger value="imports" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <FileInput className="w-4 h-4 mr-2" />
                Nhập kho
              </TabsTrigger>
              <TabsTrigger value="exports" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <FileOutput className="w-4 h-4 mr-2" />
                Xuất kho
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="stock" className="outline-none">
          <StockView onRefresh={triggerRefresh} />
        </TabsContent>
        
        {!isTrưởngKhoa && (
          <>
            <TabsContent value="imports" className="outline-none">
              <ImportsPage />
            </TabsContent>

            <TabsContent value="exports" className="outline-none">
              <ExportsPage />
            </TabsContent>
          </>
        )}

        {/* Removed requests content */}
      </Tabs>
    </div>
  );
}
