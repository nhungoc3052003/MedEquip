import React, { useState, useMemo } from 'react';//file gd chính 
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { apiCreateDepartment, apiUpdateDepartment, apiDeleteDepartment } from '@/lib/apiSync';
import { Khoa } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, Package, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(store.getDepartments());
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Khoa | null>(null);

  const canEdit = user?.vaiTro === 'QL_KHO';
  const allocations = store.getAllocations();

  const [form, setForm] = useState({ tenKhoa: '', moTa: '', trangThai: true });

  const filtered = useMemo(() => data.filter(k =>
    k.tenKhoa.toLowerCase().includes(search.toLowerCase()) ||
    k.maKhoa.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  const openAdd = () => { setEditing(null); setForm({ tenKhoa: '', moTa: '', trangThai: true }); setDialogOpen(true); };
  const openEdit = (k: Khoa) => { setEditing(k); setForm({ tenKhoa: k.tenKhoa, moTa: k.moTa, trangThai: k.trangThai }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.tenKhoa.trim()) { toast({ title: 'Lỗi', description: 'Vui lòng nhập tên khoa', variant: 'destructive' }); return; }

    const isDuplicate = data.some(k => k.tenKhoa.toLowerCase() === form.tenKhoa.trim().toLowerCase() && k.maKhoa !== editing?.maKhoa);
    if (isDuplicate) {
      toast({ title: 'Lỗi', description: 'Tên khoa đã tồn tại', variant: 'destructive' });
      return;
    }

    try {
      if (editing) {
        const resp = await apiUpdateDepartment(editing.maKhoa, { ...form, tenKhoa: form.tenKhoa.trim() });
        if (!resp.success) throw new Error(resp.message);
        toast({ title: 'Cập nhật thành công' });
      } else {
        const resp = await apiCreateDepartment({ ...form, tenKhoa: form.tenKhoa.trim() });
        if (!resp.success) throw new Error(resp.message);
        toast({ title: 'Thêm thành công' });
      }
      const depts = store.getDepartments();
      setData([...depts]);
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi xử lý', variant: 'destructive' });
    }
  };

  const handleDelete = async (k: Khoa) => {
    const hasItems = allocations.some(a => a.maKhoa === k.maKhoa && a.trangThaiTra !== 'DA_TRA');
    if (hasItems) {
      toast({ title: 'Không thể xóa', description: 'Khoa đang có thiết bị đang mượn', variant: 'destructive' });
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa khoa ${k.tenKhoa} hay không?`)) return;

    try {
      const result = await apiDeleteDepartment(k.maKhoa);
      if (result.success) {
        const depts = store.getDepartments();
        setData([...depts]);
        toast({ title: 'Đã xóa' });
      } else {
        toast({ title: 'Lỗi', description: result.message || 'Không thể xóa', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi khi xóa', variant: 'destructive' });
    }
  };

  const handleExportDepartmentExcel = (k: Khoa) => {
    const deptAllocations = allocations.filter(a => a.maKhoa === k.maKhoa && a.trangThaiTra !== 'DA_TRA');
    if (deptAllocations.length === 0) {
      toast({ title: 'Lỗi', description: 'Khoa này hiện không có thiết bị nào đang mượn.', variant: 'destructive' });
      return;
    }

    const excelData = deptAllocations.map(a => ({
      "Mã Phiếu": a.maPhieu,
      "Tên Thiết bị": a.tenThietBi || a.maThietBi,
      "Mã Thiết bị": a.maThietBi,
      "Số lượng mượn": a.soLuongCapPhat,
      "Đơn vị": a.donViTinh || "Cái",
      "Ngày cấp": new Date(a.ngayCapPhat).toLocaleDateString('vi-VN'),
      "Hạn trả dự kiến": a.ngayDuKienTra ? new Date(a.ngayDuKienTra).toLocaleDateString('vi-VN') : "Vĩnh viễn",
      "Ghi chú": a.ghiChu || ""
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    ws["!cols"] = Object.keys(excelData[0]).map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `DanhSachMuon_${k.maKhoa}`);

    XLSX.writeFile(wb, `DS_ThietBi_DangMuon_${k.tenKhoa}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tìm khoa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        {canEdit && <Button onClick={openAdd} className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" /> Thêm Khoa</Button>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="w-10"></th>
            <th className="text-left p-4 font-medium text-muted-foreground">Mã Khoa</th>
            <th className="text-left p-4 font-medium text-muted-foreground">Tên Khoa</th>
            <th className="text-left p-4 font-medium text-muted-foreground">Mô tả</th>
            <th className="text-center p-4 font-medium text-muted-foreground">Trạng thái</th>
            <th className="text-right p-4 font-medium text-muted-foreground">Thao tác</th>
          </tr></thead>
          <tbody>
            {filtered.map(k => (
              <React.Fragment key={k.maKhoa}>
                <tr
                  className={`border-b hover:bg-muted/20 transition-colors cursor-pointer ${expandedId === k.maKhoa ? 'bg-muted/10' : ''}`}
                  onClick={() => setExpandedId(expandedId === k.maKhoa ? null : k.maKhoa)}
                >
                  <td className="p-4 text-center">
                    {expandedId === k.maKhoa ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{k.maKhoa}</td>
                  <td className="p-4 font-semibold text-foreground">{k.tenKhoa}</td>
                  <td className="p-4 text-muted-foreground max-w-xs truncate">{k.moTa || '—'}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${k.trangThai ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {k.trangThai ? 'HOẠT ĐỘNG' : 'TẠM DỪNG'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(k)}><Pencil className="w-4 h-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(k)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
                {expandedId === k.maKhoa && (
                  <tr>
                    <td colSpan={6} className="bg-muted/10 p-4 lg:p-6 border-b">
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center border-b border-border/50 pb-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-primary" />
                            <h3 className="font-bold text-sm">Danh sách Thiết bị Khoa đang quản lý (chưa trả)</h3>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleExportDepartmentExcel(k)} className="h-8">
                            <FileDown className="w-4 h-4 mr-2 text-primary" /> Xuất Excel
                          </Button>
                        </div>

                        <div className="bg-card border rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="p-2 text-left">Mã Phiếu</th>
                                <th className="p-2 text-left">Thiết bị</th>
                                <th className="p-2 text-center">SL</th>
                                <th className="p-2 text-left">Ngày cấp</th>
                                <th className="p-2 text-left">Hạn trả</th>
                                <th className="p-2 text-center">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody>
                              {allocations
                                .filter(a => a.maKhoa === k.maKhoa && a.trangThaiTra !== 'DA_TRA')
                                .map((a, idx) => (
                                  <tr key={idx} className="border-t hover:bg-muted/20">
                                    <td className="p-2 font-mono text-primary">{a.maPhieu}</td>
                                    <td className="p-2 font-medium">{a.tenThietBi || a.maThietBi}</td>
                                    <td className="p-2 text-center">{a.soLuongCapPhat} {a.donViTinh || 'Cái'}</td>
                                    <td className="p-2 text-muted-foreground">{new Date(a.ngayCapPhat).toLocaleDateString('vi-VN')}</td>
                                    <td className="p-2">
                                      {a.ngayDuKienTra ? (
                                        <span className={new Date(a.ngayDuKienTra) < new Date() ? 'text-destructive font-semibold' : ''}>
                                          {new Date(a.ngayDuKienTra).toLocaleDateString('vi-VN')}
                                        </span>
                                      ) : 'Vĩnh viễn'}
                                    </td>
                                    <td className="p-2 text-center">
                                      <span className="px-2 py-0.5 rounded bg-warning/10 text-warning text-[10px]">Đang mượn</span>
                                    </td>
                                  </tr>
                                ))
                              }
                              {allocations.filter(a => a.maKhoa === k.maKhoa && a.trangThaiTra !== 'DA_TRA').length === 0 && (
                                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground italic">Khoa không có thiết bị nào đang mượn.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Không tìm thấy khoa</div>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Sửa Khoa' : 'Thêm Khoa mới'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Tên Khoa *</Label><Input value={form.tenKhoa} onChange={e => setForm(f => ({ ...f, tenKhoa: e.target.value }))} /></div>
            <div><Label>Mô tả</Label><Textarea value={form.moTa} onChange={e => setForm(f => ({ ...f, moTa: e.target.value }))} /></div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="trangThai"
                  checked={form.trangThai}
                  onChange={e => setForm(f => ({ ...f, trangThai: e.target.checked }))}
                />
                <Label htmlFor="trangThai">{form.trangThai ? 'Đang hoạt động' : 'Tạm dừng hoạt động'}</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground">{editing ? 'Cập nhật' : 'Thêm Khoa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
