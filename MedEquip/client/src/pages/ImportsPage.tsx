import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { apiDeleteImport } from '@/lib/apiSync';
import { ExcelPreviewRow } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { refreshData } from '@/lib/dataLoader';
import { 
  ChevronDown, ChevronUp, User as UserIcon, Package, Boxes, Wallet, 
  Search, Trash2, Upload, Check, AlertCircle, Box, Plus, FileDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';

export default function ImportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(store.getImports());
  const [searchPhieu, setSearchPhieu] = useState('');
  const [searchThietBi, setSearchThietBi] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ExcelPreviewRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [hinhAnhMinhChung, setHinhAnhMinhChung] = useState<string | null>(null);
  const [viewImageOpen, setViewImageOpen] = useState<string | null>(null);

  const canCreate = user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'QL_KHO';
  const canDelete = user?.vaiTro === 'QL_KHO';
  const isApprover = user?.vaiTro === 'QL_KHO';

  const [rejectingPhieu, setRejectingPhieu] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedPhieu, setSelectedPhieu] = useState<string[]>([]);
  const [deleteMultipleConfirmOpen, setDeleteMultipleConfirmOpen] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const suppliers = store.getSuppliers();
  const users = store.getUsers();

  const filtered = data.filter(d => {
    const matchPhieu = !searchPhieu || d.maPhieu.toLowerCase().includes(searchPhieu.toLowerCase());
    const matchThietBi = !searchThietBi || 
      (d.maThietBi || '').toLowerCase().includes(searchThietBi.toLowerCase()) || 
      (d.tenThietBi || '').toLowerCase().includes(searchThietBi.toLowerCase()) ||
      ((d.tenNhaCungCap || suppliers.find(s => s.maNhaCungCap === d.maNhaCungCap)?.tenNhaCungCap) || '').toLowerCase().includes(searchThietBi.toLowerCase());
    return matchPhieu && matchThietBi;
  });

  const groupedImports = Object.values(
    filtered.reduce((acc, curr) => {
      if (!acc[curr.maPhieu]) {
        acc[curr.maPhieu] = { ...curr, chiTiet: [] };
      }
      if (curr.maThietBi) {
        acc[curr.maPhieu].chiTiet.push(curr);
      }
      return acc;
    }, {} as Record<string, any>)
  ).sort((a: any, b: any) => new Date(b.ngayNhap).getTime() - new Date(a.ngayNhap).getTime());

  const reload = async () => {
    await refreshData('imports');
    await refreshData('inventory');
    await refreshData('equipment');
    await refreshData('suppliers');
    await refreshData('users');
    setData(store.getImports());
  };

  useEffect(() => {
    reload();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      toast({ title: 'Lỗi', description: 'Chỉ chấp nhận file .xlsx', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/imports/from-excel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        body: formData
      });
      const result = await response.json();
      
      if (result.success) {
        setPreviewData(result.preview);
        setSummary(result.summary);
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi đọc file', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  const handlePreConfirmImport = () => {
    if (!hinhAnhMinhChung) {
      toast({ title: 'Lỗi', description: 'Bắt buộc phải tải lên hình ảnh minh chứng.', variant: 'destructive' });
      return;
    }
    setConfirmImportOpen(true);
  };

  const handleConfirmImport = async () => {
    setConfirmImportOpen(false);
    setUploading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/imports/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ rows: previewData, hinhAnhMinhChung })
      });
      const result = await response.json();
      
      if (result.success) {
        await reload();
        setCreateOpen(false);
        setPreviewData([]);
        setSummary(null);
        setHinhAnhMinhChung(null);
        toast({ title: 'Thành công', description: result.message });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi server', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/imports/${deleteConfirmId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Thành công', description: result.message });
        setDeleteConfirmId(null);
        await reload();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteMultiple = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/imports/delete-multiple`, {
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
        setDeleteMultipleConfirmOpen(false);
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

  const toggleSelectRow = (maPhieu: string) => {
    setSelectedPhieu(prev => 
      prev.includes(maPhieu) ? prev.filter(id => id !== maPhieu) : [...prev, maPhieu]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPhieu.length === groupedImports.length) {
      setSelectedPhieu([]);
    } else {
      setSelectedPhieu(groupedImports.map(p => p.maPhieu));
    }
  };

  const isAllSelected = groupedImports.length > 0 && selectedPhieu.length === groupedImports.length;

  const handleApprove = async (maPhieu: string, status: 'DA_DUYET' | 'TU_CHOI', lyDo?: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/imports/approval/${maPhieu}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ status, lyDoTuChoi: lyDo })
      });
      const result = await response.json();
      if (result.success) {
        await reload();
        toast({ title: 'Thành công', description: result.message });
        setRejectingPhieu(null);
        setRejectReason('');
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi kết nối', variant: 'destructive' });
    }
  };

  const [expandedPhieu, setExpandedPhieu] = useState<string[]>([]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" /> Nhập kho bằng Excel
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Upload danh sách thiết bị để tự động cập nhật tồn kho (UPSERT logic)</p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          <input 
            type="file" 
            accept=".xlsx" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
          />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={imageInputRef} 
            onChange={handleImageUpload}
          />
          {canDelete && selectedPhieu.length > 0 && (
            <Button variant="outline" onClick={() => setDeleteMultipleConfirmOpen(true)} className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="w-4 h-4 mr-2" /> Xóa đã chọn ({selectedPhieu.length})
            </Button>
          )}
          {canCreate && (
            <Button 
              className="gradient-primary text-primary-foreground flex-1 sm:flex-none font-semibold shadow-md active:scale-95 transition-transform"
              onClick={() => {
                setPreviewData([]);
                setSummary(null);
                setHinhAnhMinhChung(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" /> Tạo phiếu nhập hàng
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
           <h3 className="font-semibold text-lg">Lịch sử nhập kho</h3>
           {canDelete && groupedImports.length > 0 && (
             <div className="flex items-center gap-2 text-sm bg-muted/50 px-3 py-1.5 rounded-lg border">
               <Checkbox 
                 checked={isAllSelected} 
                 onCheckedChange={toggleSelectAll} 
                 id="select-all" 
               />
               <label htmlFor="select-all" className="cursor-pointer font-medium select-none">Tất cả</label>
             </div>
           )}
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full max-w-2xl">
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
              placeholder="Thiết bị hoặc nhà cung cấp..."
              value={searchThietBi}
              onChange={e => setSearchThietBi(e.target.value)}
              className="pl-10 h-10 shadow-sm transition-all focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {groupedImports.map((phieu: any) => {
          const isExpanded = expandedPhieu.includes(phieu.maPhieu);
          const creatorName = users.find(u => u.maNguoiDung === phieu.maNhanVienKho)?.hoTen || phieu.maNhanVienKho;
          
          return (
            <div key={phieu.maPhieu} className="group border rounded-xl overflow-hidden bg-card hover:border-primary/30 transition-all duration-200 shadow-sm">
              <div 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedPhieu(prev => prev.includes(phieu.maPhieu) ? prev.filter(id => id !== phieu.maPhieu) : [...prev, phieu.maPhieu])}
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
                        {new Date(phieu.ngayNhap).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(phieu.ngayNhap).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <div className="hidden md:flex items-center gap-2 px-4 border-l border-r h-10">
                      <Avatar className="h-8 w-8 border">
                        <AvatarFallback className="bg-primary/5 text-primary">
                          <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-muted-foreground leading-none mb-1 uppercase tracking-wider font-semibold">Người nhập</span>
                        <span className="text-sm font-medium leading-none">{creatorName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "text-[10px] uppercase px-3 py-1 rounded-full font-bold border transition-colors",
                      phieu.trangThai === 'CHO_DUYET' ? 'bg-warning/10 text-warning border-warning/20' :
                      phieu.trangThai === 'DA_DUYET' ? 'bg-success/10 text-success border-success/20' :
                      'bg-destructive/10 text-destructive border-destructive/20'
                    )}>
                      {phieu.trangThai === 'CHO_DUYET' ? 'Chờ duyệt' : phieu.trangThai === 'DA_DUYET' ? 'Đã nhập' : 'Từ chối'}
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
                    <span className="font-bold">
                      {phieu.chiTiet.reduce((sum: number, ct: any) => sum + (ct.soLuongNhap || 0), 0).toLocaleString('vi-VN')} {phieu.chiTiet[0]?.donViTinh || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Tổng giá trị:</span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {new Intl.NumberFormat('vi-VN').format(phieu.chiTiet.reduce((sum: number, ct: any) => sum + (ct.soLuongNhap * (ct.donGia || 0)), 0))} đ
                    </span>
                  </div>
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
                          <th className="text-left p-3 font-medium text-muted-foreground">Nhà cung cấp</th>
                          <th className="text-center p-3 font-medium text-muted-foreground">Lô/HSD</th>
                          <th className="text-right p-3 font-medium text-muted-foreground">Đơn giá</th>
                          <th className="text-right p-3 pr-6 font-medium text-muted-foreground">Số lượng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {phieu.chiTiet.map((ct: any, idx: number) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="p-3 pl-6">
                              <div className="font-medium">{ct.tenThietBi}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{ct.maThietBi}</div>
                            </td>
                            <td className="p-3 text-xs text-muted-foreground italic">
                              {suppliers.find(s => s.maNhaCungCap === ct.maNhaCungCap)?.tenNhaCungCap || phieu.tenNhaCungCap}
                            </td>
                            <td className="p-3 text-center text-xs">
                              {ct.soLo ? <span className="block font-medium">{ct.soLo}</span> : <span className="text-muted-foreground">-</span>}
                              {ct.hanSuDung ? <span className="block text-muted-foreground font-light">{new Date(ct.hanSuDung).toLocaleDateString('vi-VN')}</span> : ''}
                            </td>
                            <td className="p-3 text-right text-xs">
                              {ct.donGia ? ct.donGia.toLocaleString('vi-VN') + ' đ' : '-'}
                            </td>
                            <td className="p-3 pr-6 text-right">
                              <span className="font-bold text-success">+{ct.soLuongNhap.toLocaleString('vi-VN')} {ct.donViTinh}</span>
                              {ct.soLuongCoSo > 0 && ct.donViCoSo && ct.soLuongNhap !== ct.soLuongCoSo && (
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  ({ct.soLuongCoSo.toLocaleString('vi-VN')} {ct.donViCoSo})
                                </div>
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
                      {phieu.trangThai === 'CHO_DUYET' && isApprover ? (
                        <>
                          <Button 
                            className="bg-success hover:bg-success/90 text-white"
                            onClick={() => handleApprove(phieu.maPhieu, 'DA_DUYET')}
                          >
                            Duyệt nhập kho
                          </Button>
                          <Button 
                            variant="destructive"
                            onClick={() => setRejectingPhieu(phieu.maPhieu)}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic ml-3">
                          {phieu.ghiChu && `"${phieu.ghiChu}"`}
                        </span>
                      )}
                      
                      {phieu.chiTiet?.[0]?.hinhAnhMinhChung && (
                         <Button variant="outline" size="sm" className="ml-2 gap-2" onClick={() => setViewImageOpen(phieu.chiTiet[0].hinhAnhMinhChung)}>
                            🖼️ Xem chứng từ
                         </Button>
                      )}
                    </div>
                    {canDelete && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirmId(phieu.maPhieu)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Xóa lịch sử
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {groupedImports.length === 0 && <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">Chưa có lịch sử nhập kho</div>}

      {/* Dialog Tạo phiếu nhập kho */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tạo phiếu nhập kho thiết bị</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 flex-1 overflow-auto">
            {/* Nút chọn Excel và Ảnh */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div 
                 className={cn(
                   "p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer hover:bg-muted/50",
                   previewData.length > 0 ? "border-success/30 bg-success/5" : "border-muted"
                 )}
                 onClick={() => fileInputRef.current?.click()}
               >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileDown className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold">Chọn file Excel nhập hàng</p>
                    <p className="text-xs text-muted-foreground mt-1">Hỗ trợ file .xlsx theo mẫu hệ thống</p>
                  </div>
                  {previewData.length > 0 && (
                    <span className="text-xs font-bold text-success flex items-center gap-1 mt-1">
                      <Check className="w-3 h-3" /> Đã chọn {previewData.length} dòng
                    </span>
                  )}
               </div>

               <div 
                 className={cn(
                   "p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer hover:bg-muted/50",
                   hinhAnhMinhChung ? "border-primary/30 bg-primary/5" : "border-muted"
                 )}
                 onClick={() => imageInputRef.current?.click()}
               >
                  <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold flex items-center justify-center gap-1">
                      Nhập hình ảnh minh chứng <span className="text-destructive">*</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Chụp ảnh hoá đơn hoặc biên bản bàn giao (Bắt buộc)</p>
                  </div>
                  {hinhAnhMinhChung && (
                    <div className="mt-2 w-20 h-10 border rounded overflow-hidden shadow-sm">
                      <img src={hinhAnhMinhChung} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
               </div>
            </div>

            {/* Preview Area */}
            {previewData.length > 0 && (
              <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2">
                <h4 className="font-semibold flex items-center gap-2">
                   <Box className="w-4 h-4" /> Danh sách thiết bị từ file Excel
                </h4>
                
                {summary && (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 shrink-0">
                    <div className="p-3 bg-muted rounded-lg border text-center">
                      <div className="text-lg font-bold">{summary.total}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">Tổng dòng</div>
                    </div>
                    <div className="p-3 bg-success/10 text-success rounded-lg border border-success/20 text-center">
                      <div className="text-lg font-bold">{summary.willCreate}</div>
                      <div className="text-[10px] mt-1">Tạo mới</div>
                    </div>
                    <div className="p-3 bg-primary/10 text-primary rounded-lg border border-primary/20 text-center">
                      <div className="text-lg font-bold">{summary.willUpdate}</div>
                      <div className="text-[10px] mt-1">Cập nhật</div>
                    </div>
                    <div className={`p-3 rounded-lg border text-center ${summary.errors > 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-muted text-muted-foreground'}`}>
                      <div className="text-lg font-bold">{summary.errors}</div>
                      <div className="text-[10px] mt-1">Lỗi</div>
                    </div>
                    <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-lg border border-amber-500/20 text-center font-mono">
                      <div className="text-sm font-bold truncate">
                        {new Intl.NumberFormat('vi-VN').format(previewData.reduce((acc, r) => acc + (r.hasError ? 0 : r.soLuong * (r.donGia || 0)), 0))} đ
                      </div>
                      <div className="text-[10px] mt-1">Tổng giá trị</div>
                    </div>
                  </div>
                )}

                <div className="overflow-auto border rounded-lg max-h-[300px]">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted z-10 shadow-sm">
                      <tr>
                        <th className="p-2 border-r text-center w-8">#</th>
                        <th className="p-2 border-r text-left">Thiết bị</th>
                        <th className="p-2 border-r text-left">Nhà cung cấp</th>
                        <th className="p-2 border-r text-right w-12">SL</th>
                        <th className="p-2 border-r text-right">Đơn giá</th>
                        <th className="p-2 text-left">Lỗi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className={`border-b ${row.hasError ? 'bg-destructive/5' : ''}`}>
                          <td className="p-2 border-r text-center text-muted-foreground">{row.rowIndex}</td>
                          <td className="p-2 border-r">
                            <div className="font-semibold truncate max-w-[150px]">{row.tenThietBi}</div>
                            <div className="text-[9px] text-muted-foreground">{row.maThietBi}</div>
                          </td>
                          <td className="p-2 border-r truncate max-w-[100px]">{row.maNcc}</td>
                          <td className="p-2 border-r text-right font-medium">+{row.soLuong}</td>
                          <td className="p-2 border-r text-right">{row.donGia.toLocaleString('vi-VN')}</td>
                          <td className="p-2 text-destructive">
                            {row.hasError && row.errors[0]}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 mt-4 h-14 border-t pt-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={uploading}>Hủy</Button>
            <Button 
              onClick={handlePreConfirmImport} 
              className="gradient-primary text-primary-foreground" 
              disabled={uploading || previewData.length === 0 || (summary && summary.valid === 0)}
            >
              {uploading ? 'Đang xử lý...' : `Xác nhận nhập kho (${summary?.valid || 0} dòng)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Rejection Reason */}
      <Dialog open={!!rejectingPhieu} onOpenChange={(open) => !open && setRejectingPhieu(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Từ chối phiếu nhập kho</DialogTitle></DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">Vui lòng nhập lý do từ chối cho phiếu <strong>{rejectingPhieu}</strong></p>
            <Input 
              placeholder="Nhập lý do..." 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingPhieu(null)}>Hủy</Button>
            <Button 
              variant="destructive" 
              onClick={() => handleApprove(rejectingPhieu!, 'TU_CHOI', rejectReason)}
              disabled={!rejectReason}
            >
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận xóa */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Xác nhận xóa
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-foreground/80">
            Bạn có chắc chắn muốn xóa lịch sử nhập kho của phiếu <span className="font-bold text-foreground">{deleteConfirmId}</span>? Hành động này sẽ xóa dữ liệu vĩnh viễn và không thể hoàn tác.
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận xóa nhiều */}
      <Dialog open={deleteMultipleConfirmOpen} onOpenChange={setDeleteMultipleConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Xác nhận xóa hàng loạt
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-foreground/80">
            Bạn có chắc chắn muốn xóa <span className="font-bold text-foreground">{selectedPhieu.length}</span> phiếu nhập kho đã chọn? 
            <p className="mt-2 text-xs text-muted-foreground italic">* Lưu ý: Tồn kho của các phiếu đã duyệt sẽ được trừ lại tương ứng.</p>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteMultipleConfirmOpen(false)} disabled={deleting}>Hủy</Button>
            <Button variant="destructive" onClick={handleDeleteMultiple} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog View Image */}
      <Dialog open={!!viewImageOpen} onOpenChange={(open) => !open && setViewImageOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-1 flex">
           {viewImageOpen && <img src={viewImageOpen} alt="Minh chứng" className="max-w-full max-h-[85vh] object-contain mx-auto rounded" />}
        </DialogContent>
      </Dialog>

      {/* Dialog Xác nhận Nhập Kho */}
      <Dialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Check className="w-5 h-5" />
              Xác nhận nhập kho
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-foreground/80">
            Bạn có chắc chắn muốn xác nhận phiếu nhập này với <span className="font-bold text-foreground">{summary?.valid || 0}</span> dòng hợp lệ không?
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setConfirmImportOpen(false)}>Hủy</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleConfirmImport}>Xác nhận</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
