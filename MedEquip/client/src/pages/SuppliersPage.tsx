import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { apiCreateSupplier, apiUpdateSupplier, apiDeleteSupplier } from '@/lib/apiSync';
import { NhaCungCap, LOAI_THIET_BI_LABELS } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Search, Eye, ChevronDown, ChevronUp, Image as ImageIcon, Plus, Pencil, Trash2 } from 'lucide-react';

export default function SuppliersPage() {
  const { user } = useAuth();
  const [data, setData] = useState(store.getSuppliers());
  const [equipment] = useState(store.getEquipment());
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<NhaCungCap | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NhaCungCap | null>(null);
  const [form, setForm] = useState({ tenNhaCungCap: '', diaChi: '', soDienThoai: '', email: '' });

  const canEdit = user?.vaiTro === 'QL_KHO';

  const filtered = useMemo(() =>
    data.filter(s => s.tenNhaCungCap.toLowerCase().includes(search.toLowerCase()) || s.maNhaCungCap.toLowerCase().includes(search.toLowerCase())), [data, search]);

  const openAdd = () => {
    setEditing(null);
    setForm({ tenNhaCungCap: '', diaChi: '', soDienThoai: '', email: '' });
    setDialogOpen(true);
  };

  const openEdit = (s: NhaCungCap) => {
    setEditing(s);
    setForm({ 
      tenNhaCungCap: s.tenNhaCungCap, 
      diaChi: s.diaChi || '', 
      soDienThoai: s.soDienThoai || '', 
      email: s.email || ''
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.tenNhaCungCap.trim()) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập tên nhà cung cấp', variant: 'destructive' });
      return;
    }

    // Kiểm tra Số điện thoại tại Frontend
    if (form.soDienThoai) {
      const phoneRegex = /^\d{10,11}$/;
      if (!phoneRegex.test(form.soDienThoai)) {
        toast({ 
          title: 'Lỗi định dạng', 
          description: 'Số điện thoại phải là chữ số và có độ dài từ 10-11 số', 
          variant: 'destructive' 
        });
        return;
      }
    }

    try {
      if (editing) {
        const resp = await apiUpdateSupplier(editing.maNhaCungCap, form);
        if (!resp.success) throw new Error(resp.message);
        toast({ title: 'Cập nhật thành công' });
      } else {
        const resp = await apiCreateSupplier(form);
        if (!resp.success) throw new Error(resp.message);
        toast({ title: 'Thêm thành công' });
      }
      setData([...store.getSuppliers()]);
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi xử lý', variant: 'destructive' });
    }
  };

  const handleDelete = async (s: NhaCungCap) => {
    // Kiểm tra tất cả thiết bị liên kết (kể cả đã ngừng hoạt động)
    const associatedItems = equipment.filter(e => e.maNhaCungCap === s.maNhaCungCap);
    if (associatedItems.length > 0) {
      toast({ 
        title: 'Không thể xóa', 
        description: `Nhà cung cấp này đang liên kết với ${associatedItems.length} thiết bị. Vui lòng gỡ liên kết trước khi xóa.`, 
        variant: 'destructive' 
      });
      return;
    }

    if (!window.confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp ${s.tenNhaCungCap}?`)) return;

    try {
      const resp = await apiDeleteSupplier(s.maNhaCungCap);
      if (!resp.success) throw new Error(resp.message);
      setData([...store.getSuppliers()]);
      toast({ title: 'Đã xóa nhà cung cấp thành công' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi khi xóa', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tìm nhà cung cấp..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        {canEdit && (
          <Button onClick={openAdd} className="gradient-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Thêm nhà cung cấp
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/30">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-10"></th>
              <th className="text-left p-4 font-medium text-muted-foreground">Mã NCC</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Tên NCC</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Địa chỉ</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Số điện thoại</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <React.Fragment key={s.maNhaCungCap}>
                <tr className={`border-b hover:bg-muted/20 transition-colors cursor-pointer ${expandedId === s.maNhaCungCap ? 'bg-muted/10' : ''}`} onClick={() => setExpandedId(expandedId === s.maNhaCungCap ? null : s.maNhaCungCap)}>
                  <td className="p-4 text-center">
                    {expandedId === s.maNhaCungCap ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </td>
                  <td className="p-4 font-mono text-xs text-muted-foreground">{s.maNhaCungCap}</td>
                  <td className="p-4 font-semibold text-foreground">{s.tenNhaCungCap}</td>
                  <td className="p-4 text-muted-foreground max-w-xs truncate">{s.diaChi || '—'}</td>
                  <td className="p-4">{s.soDienThoai || '—'}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setViewing(s); setViewOpen(true); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                            <Pencil className="w-4 h-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(s)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === s.maNhaCungCap && (
                  <tr>
                    <td colSpan={6} className="bg-muted/10 p-6">
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <h3 className="font-bold text-base flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-primary" /> Danh sách sản phẩm của {s.tenNhaCungCap}
                          </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {equipment.filter(e => e.maNhaCungCap === s.maNhaCungCap).length > 0 ? (
                            equipment.filter(e => e.maNhaCungCap === s.maNhaCungCap).map(e => (
                              <div key={e.maThietBi} className="bg-background rounded-lg border border-border/50 p-3 flex gap-3 group relative hover:shadow-md transition-shadow">
                                <div className="w-16 h-16 rounded border bg-muted flex-shrink-0 overflow-hidden">
                                  {e.hinhAnh ? <img src={e.hinhAnh} className="w-full h-full object-cover" /> : <ImageIcon className="w-8 h-8 text-muted-foreground/30 m-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-sm truncate">{e.tenThietBi}</div>
                                  <div className="text-xs text-muted-foreground">{LOAI_THIET_BI_LABELS[e.loaiThietBi || 'TAI_SU_DUNG']}</div>
                                  <div className="text-xs text-muted-foreground mt-1 font-mono">{e.maThietBi}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-full py-8 text-center text-muted-foreground italic">
                              Chưa có thiết bị nào từ nhà cung cấp này.
                            </div>
                          )}
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
      {filtered.length === 0 && <div className="text-center py-12 text-muted-foreground">Không tìm thấy nhà cung cấp phù hợp</div>}

      {/* Dialog View Detail */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chi tiết Nhà cung cấp</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm py-2">
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Mã định danh:</span> <strong>{viewing.maNhaCungCap}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Chi tiết tên:</span> <strong>{viewing.tenNhaCungCap}</strong></div>
              <div className="space-y-1"><span className="text-muted-foreground">Địa chỉ:</span> <p className="font-medium">{viewing.diaChi || '—'}</p></div>
              <div className="flex justify-between border-b pb-2 pt-2"><span className="text-muted-foreground">SĐT liên hệ:</span> <strong>{viewing.soDienThoai || '—'}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">Email:</span> <strong>{viewing.email || '—'}</strong></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Add/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Tên nhà cung cấp *</Label>
              <Input 
                value={form.tenNhaCungCap} 
                onChange={e => setForm(f => ({ ...f, tenNhaCungCap: e.target.value }))} 
                placeholder="Ví dụ: Công ty Thiết bị Y tế ABC"
              />
            </div>
            <div>
              <Label>Địa chỉ</Label>
              <Textarea 
                value={form.diaChi} 
                onChange={e => setForm(f => ({ ...f, diaChi: e.target.value }))} 
                placeholder="Nhập địa chỉ trụ sở"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Số điện thoại</Label>
                <Input 
                  value={form.soDienThoai} 
                  onChange={e => setForm(f => ({ ...f, soDienThoai: e.target.value }))} 
                  placeholder="098..."
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  value={form.email} 
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                  placeholder="email@ncc.com"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground">
              {editing ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



