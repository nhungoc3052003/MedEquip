import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from "xlsx";
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { refreshData } from '@/lib/dataLoader';
import { Combobox } from '@/components/ui/Combobox';
import { 
  Search, FileDown, Plus, Trash2, Box, PackageMinus, 
  ChevronDown, ChevronUp, User as UserIcon, Package, Boxes, Wallet,
  AlertCircle, Upload
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';

interface ExportItem {
  maThietBi: string;
  soLuong: number;
  donVi: string;
}

export default function ExportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(store.getExports());
  const [searchPhieu, setSearchPhieu] = useState('');
  const [searchThietBi, setSearchThietBi] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedPhieu, setSelectedPhieu] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);

  // Form state
  const [lyDo, setLyDo] = useState('');
  const [items, setItems] = useState<ExportItem[]>([{ maThietBi: '', soLuong: 1, donVi: '' }]);
  const [hinhAnhMinhChung, setHinhAnhMinhChung] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [viewImageOpen, setViewImageOpen] = useState<string | null>(null);

  const canCreate = user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'QL_KHO';
  const canDelete = user?.vaiTro === 'QL_KHO';
  const isApprover = user?.vaiTro === 'QL_KHO';

  const departments = store.getDepartments();
  const equipment = store.getEquipment();
  const inventory = store.getInventory();
  const users = store.getUsers();

  const equipmentOptions = React.useMemo(() => equipment.map(e => ({
    value: e.maThietBi,
    label: e.tenThietBi
  })), [equipment]);

  useEffect(() => {
    reload();
  }, []);

  const reload = async () => {
    await refreshData('exports');
    await refreshData('inventory');
    await refreshData('equipment');
    await refreshData('departments');
    await refreshData('users');
    setData(store.getExports());
  };

  // Lấy tồn kho của thiết bị
  const getTonKho = (maThietBi: string) => {
    const inv = inventory.find(i => i.maThietBi === maThietBi);
    return inv?.soLuongKho ?? null;
  };

  const getEquipmentName = (maThietBi: string) => {
    return equipment.find(e => e.maThietBi === maThietBi)?.tenThietBi || '';
  };

  // Thêm dòng thiết bị
  const addItem = () => {
    setItems(prev => [...prev, { maThietBi: '', soLuong: 1, donVi: '' }]);
  };

  // Xóa dòng thiết bị
  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Cập nhật dòng
  const updateItem = (idx: number, field: keyof ExportItem, value: string | number) => {
    const newItems = [...items];
    (newItems[idx] as any)[field] = value;

    // Tự động điền đơn vị khi chọn thiết bị
    if (field === 'maThietBi') {
      const tb = equipment.find(e => e.maThietBi === value);
      if (tb) newItems[idx].donVi = tb.donViCoSo;
    }

    setItems(newItems);
  };

  const resetForm = () => {
    setLyDo('');
    setItems([{ maThietBi: '', soLuong: 1, donVi: '' }]);
    setHinhAnhMinhChung(null);
    if (excelInputRef.current) excelInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Lỗi', description: 'Chỉ chấp nhận file hình ảnh', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setHinhAnhMinhChung(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const dataRows: any[] = XLSX.utils.sheet_to_json(ws);

        if (dataRows.length === 0) {
          toast({ title: 'Lỗi', description: 'File Excel không có dữ liệu.', variant: 'destructive' });
          return;
        }

        const newItems: ExportItem[] = dataRows
          .filter(row => row.ma_thiet_bi && row.so_luong)
          .map(row => {
            const tb = equipment.find(e => e.maThietBi === String(row.ma_thiet_bi).trim());
            return {
              maThietBi: String(row.ma_thiet_bi).trim(),
              soLuong: parseInt(row.so_luong) || 1,
              donVi: row.don_vi || row.don_vi_tinh || tb?.donViCoSo || 'Cái'
            };
          });

        if (newItems.length > 0) {
          setItems(newItems);
          toast({ title: 'Thành công', description: `Đã nhập ${newItems.length} thiết bị từ file Excel.` });
        } else {
          toast({ title: 'Lỗi', description: 'Không tìm thấy dữ liệu hợp lệ (cần cột ma_thiet_bi và so_luong).', variant: 'destructive' });
        }
      } catch (err) {
        toast({ title: 'Lỗi', description: 'Không thể đọc file Excel.', variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    if (excelInputRef.current) excelInputRef.current.value = '';
  };

  // Tạo phiếu xuất kho
  const handlePreCreate = () => {
    const validItems = items.filter(i => i.maThietBi && i.soLuong > 0);
    if (validItems.length === 0) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn ít nhất một thiết bị với số lượng hợp lệ.', variant: 'destructive' });
      return;
    }

    if (!hinhAnhMinhChung) {
      toast({ title: 'Lỗi', description: 'Bắt buộc phải tải lên hình ảnh minh chứng.', variant: 'destructive' });
      return;
    }
    
    setConfirmExportOpen(true);
  };

  const handleCreate = async () => {
    setConfirmExportOpen(false);
    const validItems = items.filter(i => i.maThietBi && i.soLuong > 0);
    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/exports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ lyDo, items: validItems, hinhAnhMinhChung })
      });

      let result: any;
      try {
        result = await response.json();
      } catch {
        throw new Error('Phản hồi từ server không hợp lệ.');
      }

      if (result.success) {
        await reload();
        setCreateOpen(false);
        resetForm();
        toast({ title: '✅ Thành công', description: result.message });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi kết nối', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Xuất lịch sử ra Excel
  const handleExportExcel = async () => {
    if (selectedPhieu.length === 0) {
      toast({ title: 'Thông báo', description: 'Vui lòng chọn ít nhất một phiếu để xuất Excel.' });
      return;
    }
    setExporting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/exports/excel`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}` 
        },
        body: JSON.stringify({ ids: selectedPhieu })
      });
      if (!response.ok) throw new Error('Không thể xuất file');
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('File xuất bị trống.');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lich_su_xuat_kho.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast({ title: 'Thành công', description: 'Đã xuất file Excel lịch sử xuất kho.' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const openDeleteConfirm = () => {
    if (selectedPhieu.length === 0) {
      toast({ title: 'Thông báo', description: 'Vui lòng chọn ít nhất một phiếu để xóa.' });
      return;
    }
    setDeleteConfirmOpen(true);
  };

  const handleDeleteMultiple = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/exports/delete-multiple`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}` 
        },
        body: JSON.stringify({ ids: selectedPhieu })
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Thành công', description: result.message });
        setSelectedPhieu([]);
        await reload();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi kết nối', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // Duyệt xuất kho
  const handleApprove = async (maPhieu: string, status: 'DA_XUAT' | 'DA_HUY') => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/exports/approval/${maPhieu}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      if (result.success) {
        await reload();
        toast({ title: 'Thành công', description: result.message });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi kết nối', variant: 'destructive' });
    }
  };

  // Nhóm theo phiếu xuất để hiển thị
  const filtered = data.filter(d => {
    const matchPhieu = !searchPhieu || d.maPhieu.toLowerCase().includes(searchPhieu.toLowerCase());
    const matchThietBi = !searchThietBi || 
      (d.maThietBi || '').toLowerCase().includes(searchThietBi.toLowerCase()) || 
      (d.tenThietBi || '').toLowerCase().includes(searchThietBi.toLowerCase());
    return matchPhieu && matchThietBi;
  });

  const groupedExports = Object.values(
    filtered.reduce((acc, curr) => {
      if (!acc[curr.maPhieu]) {
        acc[curr.maPhieu] = { ...curr, chiTiet: [] };
      }
      if (curr.maThietBi) {
        (acc[curr.maPhieu] as any).chiTiet.push(curr);
      }
      return acc;
    }, {} as Record<string, any>)
  ).sort((a: any, b: any) => new Date(b.ngayXuat).getTime() - new Date(a.ngayXuat).getTime());

  const allPhieuIds = groupedExports.map((p: any) => p.maPhieu);
  const isAllSelected = selectedPhieu.length > 0 && selectedPhieu.length === allPhieuIds.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedPhieu([]);
    } else {
      setSelectedPhieu([...allPhieuIds]);
    }
  };

  const toggleSelectRow = (maPhieu: string) => {
    setSelectedPhieu(prev => 
      prev.includes(maPhieu) ? prev.filter(id => id !== maPhieu) : [...prev, maPhieu]
    );
  };

  const [expandedPhieu, setExpandedPhieu] = useState<string[]>([]);
  const toggleExpand = (maPhieu: string) => {
    setExpandedPhieu(prev => prev.includes(maPhieu) ? prev.filter(id => id !== maPhieu) : [...prev, maPhieu]);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PackageMinus className="w-5 h-5 text-primary" /> Xuất kho
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Tạo phiếu xuất kho, chọn thiết bị và số lượng cần xuất.</p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {canDelete && (
            <Button variant="outline" onClick={openDeleteConfirm} disabled={deleting || selectedPhieu.length === 0} className="text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0">
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          )}
          <Button variant="outline" onClick={handleExportExcel} disabled={exporting || selectedPhieu.length === 0} className="shrink-0">
            <FileDown className="w-4 h-4 mr-2" />
            {exporting ? 'Đang xuất...' : 'Xuất Excel'}
          </Button>
          {canCreate && (
            <Button className="gradient-primary text-primary-foreground" onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Tạo phiếu xuất
            </Button>
          )}
        </div>
      </div>

      {/* Search & list */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <h3 className="font-semibold text-lg">Lịch sử xuất kho</h3>
          {canDelete && groupedExports.length > 0 && (
            <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-1.5 rounded-lg border">
              <Checkbox 
                checked={isAllSelected} 
                onCheckedChange={toggleSelectAll} 
                id="select-all" 
              />
              <label htmlFor="select-all" className="cursor-pointer font-medium select-none">Tất cả</label>
              {(selectedPhieu.length > 0) && <span className="text-primary font-bold text-xs">({selectedPhieu.length})</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Mã phiếu..."
              value={searchPhieu}
              onChange={e => setSearchPhieu(e.target.value)}
              className="pl-10 h-10 shadow-sm transition-all focus:ring-primary/20"
            />
          </div>
          <div className="relative flex-[1.5]">
            <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Mã hoặc tên thiết bị..."
              value={searchThietBi}
              onChange={e => setSearchThietBi(e.target.value)}
              className="pl-10 h-10 shadow-sm transition-all focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      {/* Danh sách phiếu xuất */}
      <div className="space-y-3">
        {groupedExports.map((phieu: any) => {
          const isExpanded = expandedPhieu.includes(phieu.maPhieu);
          const creatorName = phieu.tenNhanVienKho || users.find(u => u.maNguoiDung === phieu.maNhanVienKho)?.hoTen || phieu.maNhanVienKho;
          const totalQty = phieu.chiTiet.reduce((sum: number, ct: any) => sum + (ct.soLuong || 0), 0);

          return (
            <div key={phieu.maPhieu} className="group border rounded-xl overflow-hidden bg-card hover:border-primary/30 transition-all duration-200 shadow-sm">
              {/* Card Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(phieu.maPhieu)}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {canDelete && (
                      <div className="flex items-center gap-3 mt-1" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={selectedPhieu.includes(phieu.maPhieu)}
                          onCheckedChange={() => toggleSelectRow(phieu.maPhieu)}
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg w-fit">
                        {phieu.maPhieu}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 ml-1">
                        {new Date(phieu.ngayXuat).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(phieu.ngayXuat).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <div className="hidden md:flex items-center gap-2 px-4 border-l border-r h-10">
                      <Avatar className="h-8 w-8 border">
                        <AvatarFallback className="bg-primary/5 text-primary">
                          <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground leading-none mb-1 uppercase tracking-wider font-semibold">Người xuất</span>
                        <span className="text-sm font-medium leading-none">{creatorName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "text-[10px] uppercase px-3 py-1 rounded-full font-bold border transition-colors",
                      phieu.trangThai === 'DA_LAP' ? 'bg-warning/10 text-warning border-warning/20' :
                      phieu.trangThai === 'DA_XUAT' ? 'bg-success/10 text-success border-success/20' :
                      'bg-destructive/10 text-destructive border-destructive/20'
                    )}>
                      {phieu.trangThai === 'DA_LAP' ? 'Chờ duyệt' : phieu.trangThai === 'DA_XUAT' ? 'Đã xuất' : 'Đã hủy'}
                    </div>
                    
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </div>

                {/* Summary Info */}
                <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-6 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Boxes className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Thiết bị:</span>
                    <span className="font-bold">{phieu.chiTiet.length} loại</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Tổng SL:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      -{totalQty.toLocaleString('vi-VN')} {phieu.chiTiet[0]?.donViTinh || phieu.chiTiet[0]?.donViCoSo || ''}
                    </span>
                  </div>
                  {phieu.lyDoXuat && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground italic text-xs">
                        Lý do: "{phieu.lyDoXuat}"
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible Details */}
              {isExpanded && (
                <div className="border-t animate-in slide-in-from-top-2 duration-200">
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/20">
                          <th className="text-left p-3 pl-6 font-medium text-muted-foreground whitespace-nowrap">Thiết bị</th>
                          <th className="text-right p-3 pr-6 font-medium text-muted-foreground">Số lượng xuất</th>
                        </tr>
                      </thead>
                      <tbody>
                        {phieu.chiTiet.map((ct: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="p-3 pl-6">
                              <div className="font-medium">{ct.tenThietBi}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{ct.maThietBi}</div>
                            </td>
                            <td className="p-3 pr-6 text-right">
                              <span className="font-bold text-orange-600 dark:text-orange-400">-{ct.soLuong.toLocaleString('vi-VN')} {ct.donViTinh}</span>
                              {ct.donViTinh !== ct.donViCoSo && (
                                <div className="text-[10px] text-muted-foreground italic">= {ct.soLuongCoSo} {ct.donViCoSo}</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Actions for Approver */}
                  <div className="p-3 bg-muted/20 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {phieu.trangThai === 'DA_LAP' && isApprover ? (
                        <>
                          <Button 
                            className="bg-success hover:bg-success/90 text-white"
                            onClick={() => handleApprove(phieu.maPhieu, 'DA_XUAT')}
                          >
                            Duyệt xuất kho
                          </Button>
                          <Button 
                            variant="destructive"
                            onClick={() => handleApprove(phieu.maPhieu, 'DA_HUY')}
                          >
                            Hủy phiếu
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic ml-3">
                          {phieu.ghiChu && `"${phieu.ghiChu}"`}
                        </span>
                      )}

                      {phieu.hinhAnhMinhChung && (
                         <Button variant="outline" size="sm" className="ml-2 gap-2 h-8" onClick={() => setViewImageOpen(phieu.hinhAnhMinhChung)}>
                            🖼️ Xem chứng từ
                         </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {groupedExports.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border rounded-xl border-dashed">
          <Box className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Chưa có lịch sử xuất kho</p>
          <p className="text-sm mt-1">Nhấn "Tạo phiếu xuất" để bắt đầu</p>
        </div>
      )}

      {/* Dialog Tạo phiếu xuất */}
      <Dialog open={createOpen} onOpenChange={open => { if (!submitting) { setCreateOpen(open); if (!open) resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageMinus className="w-5 h-5 text-primary" />
              Tạo phiếu xuất kho
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4 py-2 pr-1">
            {/* Thông tin chung */}
            <div className="grid grid-cols-1 sm:grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Lý do xuất kho <span className="text-muted-foreground">(không bắt buộc)</span></label>
                <Input
                  placeholder="VD: Chuyển khỏi bệnh viện, hỗ trợ..."
                  value={lyDo}
                  onChange={e => setLyDo(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Danh sách thiết bị xuất */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Danh sách thiết bị xuất <span className="text-destructive">*</span></label>
                <div className="flex gap-2">
                  <input type="file" accept=".xlsx" className="hidden" ref={excelInputRef} onChange={handleExcelImport} />
                  <Button type="button" variant="outline" size="sm" onClick={() => excelInputRef.current?.click()} className="h-7 text-xs bg-success/5 text-success border-success/20 hover:bg-success/10 transition-colors">
                    <FileDown className="w-3 h-3 mr-1" /> Nhập từ Excel
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Thêm thiết bị
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 bg-muted/50 border-b">
                  <div className="p-2 px-3 text-xs font-medium text-muted-foreground">Thiết bị</div>
                  <div className="p-2 px-3 text-xs font-medium text-muted-foreground text-center w-20">Tồn kho</div>
                  <div className="p-2 px-3 text-xs font-medium text-muted-foreground text-center w-24">Số lượng</div>
                  <div className="p-2 px-3 text-xs font-medium text-muted-foreground text-center w-24">Đơn vị</div>
                  <div className="p-2 px-3 w-10"></div>
                </div>

                {items.map((item, idx) => {
                  const tb = equipment.find(e => e.maThietBi === item.maThietBi);
                  const tonKhoCoSo = item.maThietBi ? getTonKho(item.maThietBi) : null;
                  
                  // Tính toán tồn kho quy đổi để hiển thị
                  let soLuongXuatCoSo = item.soLuong;
                  if (tb && item.donVi === tb.donViNhap && tb.donViNhap !== tb.donViCoSo) {
                      soLuongXuatCoSo = item.soLuong * (tb.heSoQuyDoi || 1);
                  }
                  
                  const isOverStock = tonKhoCoSo !== null && soLuongXuatCoSo > tonKhoCoSo;
                  
                  return (
                    <div key={idx} className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 border-b last:border-0 items-center ${isOverStock ? 'bg-destructive/5' : ''}`}>
                      {/* Chọn thiết bị */}
                      <div className="p-2 px-3">
                        <Combobox
                          options={equipmentOptions}
                          value={item.maThietBi}
                          onValueChange={(val) => updateItem(idx, 'maThietBi', val)}
                          placeholder="Mã hoặc tên thiết bị..."
                        />
                        {item.maThietBi && getEquipmentName(item.maThietBi) && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 pl-1">{getEquipmentName(item.maThietBi)}</p>
                        )}
                      </div>

                      {/* Tồn kho */}
                      <div className="p-2 px-3 text-center w-20">
                        {tonKhoCoSo !== null ? (
                          <div className="flex flex-col">
                            <span className={`text-sm font-bold ${isOverStock ? 'text-destructive' : 'text-success'}`}>
                                {tonKhoCoSo}
                            </span>
                            <span className="text-[8px] text-muted-foreground uppercase">{tb?.donViCoSo}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>

                      {/* Số lượng */}
                      <div className="p-2 px-3 w-24">
                        <Input
                          type="number"
                          min={1}
                          value={item.soLuong}
                          onChange={e => updateItem(idx, 'soLuong', parseInt(e.target.value) || 1)}
                          className={`h-8 text-center text-sm ${isOverStock ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                        />
                      </div>

                      {/* Đơn vị */}
                      <div className="p-2 px-3 w-24">
                        <Select
                          value={item.donVi}
                          onValueChange={v => updateItem(idx, 'donVi', v)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-transparent border-none focus:ring-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             {tb && <SelectItem value={tb.donViCoSo}>{tb.donViCoSo}</SelectItem>}
                             {tb?.donViNhap && tb.donViNhap !== tb.donViCoSo && (
                                <SelectItem value={tb.donViNhap}>{tb.donViNhap}</SelectItem>
                             )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Xóa dòng */}
                      <div className="p-2 px-3 w-10">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {items.some(item => {
                  const tb = equipment.find(e => e.maThietBi === item.maThietBi);
                  const tonKhoCoSo = item.maThietBi ? getTonKho(item.maThietBi) : null;
                  let soLuongXuatCoSo = item.soLuong;
                  if (tb && item.donVi === tb.donViNhap && tb.donViNhap !== tb.donViCoSo) {
                      soLuongXuatCoSo = item.soLuong * (tb.heSoQuyDoi || 1);
                  }
                  return tonKhoCoSo !== null && soLuongXuatCoSo > tonKhoCoSo;
                }) && (
                <p className="text-xs text-destructive flex items-center gap-1 pl-1">
                  <AlertCircle className="w-3 h-3" /> Một số thiết bị vượt quá tồn kho hiện có. Vui lòng điều chỉnh số lượng.
                </p>
              )}
            </div>

            {/* Hình ảnh minh chứng */}
            <div className="bg-muted/30 p-3 rounded-lg border space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center">
                Hình ảnh minh chứng hoá đơn <span className="text-destructive ml-1">*</span>
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex gap-2">
                    <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
                    <Button variant="outline" size="sm" className="h-8" onClick={() => imageInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" /> Chọn hình ảnh
                    </Button>
                    {hinhAnhMinhChung && (
                      <Button variant="ghost" size="sm" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => setHinhAnhMinhChung(null)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Bỏ chọn
                      </Button>
                    )}
                  </div>
                </div>
                {hinhAnhMinhChung && (
                  <div className="shrink-0 w-20 h-12 border rounded overflow-hidden bg-black/5 shadow-sm">
                    <img src={hinhAnhMinhChung} alt="Minh chứng" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            {/* Tóm tắt */}
            {items.filter(i => i.maThietBi && i.soLuong > 0).length > 0 && (
              <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1.5">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">Tóm tắt phiếu xuất</p>
                {items.filter(i => i.maThietBi && i.soLuong > 0).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{getEquipmentName(item.maThietBi) || item.maThietBi}</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">-{item.soLuong} {item.donVi}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 shrink-0">
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }} disabled={submitting}>
              Hủy
            </Button>
            <Button
              className="gradient-primary text-white"
              onClick={handlePreCreate}
              disabled={submitting || items.filter(i => i.maThietBi && i.soLuong > 0).length === 0}
            >
              {submitting ? 'Đang xử lý...' : `Xác nhận xuất kho (${items.filter(i => i.maThietBi && i.soLuong > 0).length} thiết bị)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận xóa nhiều */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Xác nhận xóa
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-foreground/80">
            Bạn có chắc chắn muốn xóa <span className="font-bold text-foreground">{(selectedPhieu?.length || 0)}</span> phiếu xuất kho đã chọn? Hành động này sẽ xóa dữ liệu vĩnh viễn và không thể hoàn tác.
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteMultiple}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận Xuất Kho */}
      <Dialog open={confirmExportOpen} onOpenChange={setConfirmExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <PackageMinus className="w-5 h-5" />
              Xác nhận xuất kho
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-foreground/80">
            Bạn có chắc chắn muốn xác nhận phiếu xuất kho này gồm <span className="font-bold text-foreground">{items.filter(i => i.maThietBi && i.soLuong > 0).length}</span> thiết bị không?
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmExportOpen(false)}>Hủy</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleCreate}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog View Image */}
      <Dialog open={!!viewImageOpen} onOpenChange={(open) => !open && setViewImageOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-1 flex items-center justify-center bg-black/5 border-none shadow-2xl">
           {viewImageOpen && <img src={viewImageOpen} alt="Minh chứng" className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
