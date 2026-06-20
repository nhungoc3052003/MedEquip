import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { apiCreateUser, apiUpdateUser, apiDeleteUser } from '@/lib/apiSync';
import { NguoiDung, UserRole, ROLE_LABELS, ROLE_COLORS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Pencil, Trash2, Building } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  
  if (currentUser?.vaiTro !== 'ADMIN') {
    return <div className="p-8 text-center text-muted-foreground">Bạn không có quyền truy cập trang này.</div>;
  }

  const [data, setData] = useState(store.getUsers());
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NguoiDung | null>(null);

  const [form, setForm] = useState({ hoTen: '', email: '', matKhau: '123456', vaiTro: 'TRUONG_KHOA' as UserRole, maKhoa: '', trangThai: true });
  const departments = store.getDepartments();
  const [emailError, setEmailError] = useState<string | null>(null);
  const filtered = useMemo(() => data.filter(u => u.hoTen.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search)), [data, search]);

  const openAdd = () => { setEditing(null); setForm({ hoTen: '', email: '', matKhau: '123456', vaiTro: 'TRUONG_KHOA', maKhoa: '', trangThai: true }); setEmailError(null); setDialogOpen(true); };
  const openEdit = (u: NguoiDung) => { setEditing(u); setForm({ hoTen: u.hoTen, email: u.email, matKhau: u.matKhau, vaiTro: u.vaiTro, maKhoa: u.maKhoa || '', trangThai: u.trangThai }); setEmailError(null); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.hoTen || !form.email) { toast({ title: 'Lỗi', description: 'Nhập đầy đủ thông tin', variant: 'destructive' }); return; }
    if (!EMAIL_REGEX.test(form.email)) {
      setEmailError('Email không đúng định dạng (ví dụ: ten@example.com)');
      toast({ title: 'Lỗi', description: 'Email không đúng định dạng', variant: 'destructive' });
      return;
    }
    setEmailError(null);
    try {
      if (editing) {
        const result = await apiUpdateUser(editing.maNguoiDung, form);
        if (result.success) { 
          setData([...store.getUsers()]); 
          toast({ title: 'Cập nhật thành công' }); 
          setDialogOpen(false); 
        }
        else {
          if (result.message?.toLowerCase().includes('email')) {
            setEmailError(result.message);
          }
          toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
        }
      } else {
        const result = await apiCreateUser(form);
        if (result.success) { 
          setData([...store.getUsers()]); 
          toast({ title: 'Thêm thành công' }); 
          setDialogOpen(false); 
        }
        else {
          if (result.message?.toLowerCase().includes('email')) {
            setEmailError(result.message);
          }
          toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (u: NguoiDung) => {
    if (currentUser?.maNguoiDung === u.maNguoiDung) {
      toast({ title: 'Lỗi', description: 'Không thể xóa tài khoản của chính mình', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản ${u.hoTen} không?`)) return;
    try {
      await apiDeleteUser(u.maNguoiDung);
      setData([...store.getUsers()]);
      toast({ title: 'Đã xóa' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tìm người dùng..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={openAdd} className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" /> Thêm tài khoản</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium text-muted-foreground">Mã</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Họ tên</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Vai trò</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Trạng thái</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Thao tác</th>
          </tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.maNguoiDung} className="border-b hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{u.maNguoiDung}</td>
                <td className="p-3 font-medium">{u.hoTen}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.vaiTro]}`}>
                    {ROLE_LABELS[u.vaiTro]} {u.maKhoa && `- ${departments.find(d => d.maKhoa === u.maKhoa)?.tenKhoa || u.maKhoa}`}
                  </span>
                </td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${u.trangThai ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{u.trangThai ? 'Hoạt động' : 'Vô hiệu'}</span></td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                    {currentUser?.maNguoiDung !== u.maNguoiDung && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(u)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Sửa tài khoản' : 'Thêm tài khoản mới'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Họ tên *</Label><Input value={form.hoTen} onChange={e => setForm(f => ({ ...f, hoTen: e.target.value }))} /></div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => {
                  setForm(f => ({ ...f, email: e.target.value }));
                  setEmailError(null);
                }}
                className={emailError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {emailError && <p className="text-xs text-destructive mt-1">{emailError}</p>}
            </div>
            <div><Label>Mật khẩu</Label><Input type="password" value={form.matKhau} onChange={e => setForm(f => ({ ...f, matKhau: e.target.value }))} /></div>
            <div>
              <Label>Vai trò *</Label>
              <Select value={form.vaiTro} onValueChange={v => setForm(f => ({ ...f, vaiTro: v as UserRole, maKhoa: (v === 'TRUONG_KHOA' || v === 'TRO_LY') ? f.maKhoa : '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.vaiTro === 'TRUONG_KHOA' || form.vaiTro === 'TRO_LY') && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <Label className="flex items-center gap-1.5 mb-1.5"><Building className="w-3.5 h-3.5" /> Khoa trực thuộc *</Label>
                <SearchableSelect 
                  options={departments.map(k => ({ value: k.maKhoa, label: k.tenKhoa }))} 
                  value={form.maKhoa} 
                  onValueChange={v => setForm(f => ({ ...f, maKhoa: v }))} 
                  placeholder={form.vaiTro === 'TRO_LY' ? 'Chọn khoa được phân công' : 'Chọn khoa đại diện'}
                />
              </div>
            )}
            {editing && (
              <div>
                <Label>Trạng thái</Label>
                <Select value={form.trangThai ? 'true' : 'false'} onValueChange={v => setForm(f => ({ ...f, trangThai: v === 'true' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Hoạt động</SelectItem>
                    <SelectItem value="false">Ngừng hoạt động</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleSave} className="gradient-primary text-primary-foreground">{editing ? 'Cập nhật' : 'Thêm'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
