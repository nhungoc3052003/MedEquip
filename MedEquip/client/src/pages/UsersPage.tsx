import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { apiCreateUser, apiUpdateUser, apiDeleteUser, apiResendUserCredentials } from '@/lib/apiSync';
import { NguoiDung, UserRole, ROLE_LABELS, ROLE_COLORS, FileHoSo } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { 
  Plus, Search, Pencil, Trash2, Building, Mail, KeyRound, 
  Upload, CheckCircle2, XCircle, AlertCircle, Copy, Eye, 
  ShieldCheck, RefreshCw, Paperclip, FileText, UserCheck 
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

export default function UsersPage() {
  const { user: currentUser } = useAuth();

  if (currentUser?.vaiTro !== 'ADMIN') {
    return (
      <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
        <ShieldCheck className="w-10 h-10 text-muted-foreground/50" />
        <p className="font-medium text-base">Bạn không có quyền truy cập trang quản lý tài khoản.</p>
        <p className="text-xs">Chỉ Quản trị viên (Admin) mới có quyền quản lý tài khoản và hồ sơ nhân sự.</p>
      </div>
    );
  }

  const [users, setUsers] = useState<NguoiDung[]>(store.getUsers());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<NguoiDung | null>(null);
  const [dialogFilesOpen, setDialogFilesOpen] = useState(false);
  const [viewingFiles, setViewingFiles] = useState<{ title: string; files: FileHoSo[] } | null>(null);

  // Modal bàn giao thông tin đăng nhập sau khi tạo hoặc cấp lại mật khẩu
  const [credentialModal, setCredentialModal] = useState<{
    open: boolean;
    fullName: string;
    email: string;
    tempPassword: string;
    emailSent: boolean;
  }>({
    open: false,
    fullName: '',
    email: '',
    tempPassword: '',
    emailSent: false,
  });

  // Form thêm / sửa người dùng
  const [form, setForm] = useState({
    hoTen: '',
    email: '',
    matKhau: '',
    vaiTro: 'TRUONG_KHOA' as UserRole,
    maKhoa: '',
    soDienThoai: '',
    diaChi: '',
    cccd: '',
    ngaySinh: '',
    chucDanh: '',
    trangThai: true,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departments = store.getDepartments();

  // Lọc danh sách người dùng
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.hoTen.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.cccd && u.cccd.includes(search)) ||
        (u.chucDanh && u.chucDanh.toLowerCase().includes(search.toLowerCase()));

      const matchRole = roleFilter === 'ALL' || u.vaiTro === roleFilter;
      const matchDept = deptFilter === 'ALL' || u.maKhoa === deptFilter;

      return matchSearch && matchRole && matchDept;
    });
  }, [users, search, roleFilter, deptFilter]);

  // Mở modal thêm người dùng mới
  const openAdd = () => {
    setEditingUser(null);
    setForm({
      hoTen: '',
      email: '',
      matKhau: '',
      vaiTro: 'TRUONG_KHOA',
      maKhoa: departments[0]?.maKhoa || '',
      soDienThoai: '',
      diaChi: '',
      cccd: '',
      ngaySinh: '',
      chucDanh: '',
      trangThai: true,
    });
    setSelectedFiles([]);
    setEmailError(null);
    setDialogOpen(true);
  };

  // Mở modal sửa thông tin người dùng
  const openEdit = (u: NguoiDung) => {
    setEditingUser(u);
    setForm({
      hoTen: u.hoTen,
      email: u.email,
      matKhau: '',
      vaiTro: u.vaiTro,
      maKhoa: u.maKhoa || '',
      soDienThoai: u.soDienThoai || '',
      diaChi: u.diaChi || '',
      cccd: u.cccd || '',
      ngaySinh: u.ngaySinh || '',
      chucDanh: u.chucDanh || '',
      trangThai: u.trangThai,
    });
    setSelectedFiles([]);
    setEmailError(null);
    setDialogOpen(true);
  };

  // Lưu thông tin người dùng (Thêm mới hoặc Cập nhật)
  const handleSave = async () => {
    if (!form.hoTen || !form.email) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập Họ tên và Email.', variant: 'destructive' });
      return;
    }
    if (!EMAIL_REGEX.test(form.email)) {
      setEmailError('Email không đúng định dạng (ví dụ: ten@example.com)');
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('hoTen', form.hoTen);
      formData.append('email', form.email);
      formData.append('vaiTro', form.vaiTro);
      formData.append('maKhoa', form.vaiTro === 'TRUONG_KHOA' || form.vaiTro === 'TRO_LY' ? form.maKhoa : '');
      formData.append('soDienThoai', form.soDienThoai);
      formData.append('diaChi', form.diaChi);
      formData.append('cccd', form.cccd);
      formData.append('ngaySinh', form.ngaySinh);
      formData.append('chucDanh', form.chucDanh);
      formData.append('trangThai', String(form.trangThai));

      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });

      if (editingUser) {
        const result = await apiUpdateUser(editingUser.maNguoiDung, formData);
        if (result.success) {
          setUsers([...store.getUsers()]);
          toast({ title: 'Cập nhật thông tin thành công!' });
          setDialogOpen(false);
        } else {
          toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
        }
      } else {
        const result = await apiCreateUser(formData);
        if (result.success) {
          setUsers([...store.getUsers()]);
          setDialogOpen(false);
          // Mở modal hiển thị mật khẩu tạm và thông báo email
          setCredentialModal({
            open: true,
            fullName: form.hoTen,
            email: form.email,
            tempPassword: result.tempPassword || 'Med@123456',
            emailSent: !!result.emailSent,
          });
        } else {
          toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Lỗi máy chủ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cấp lại mật khẩu tạm & gửi email cho nhân sự
  const handleResendCredentials = async (u: NguoiDung) => {
    if (!window.confirm(`Xác nhận cấp lại mật khẩu tạm thời và gửi email thông báo cho ${u.hoTen} (${u.email})?`)) return;

    try {
      const res = await apiResendUserCredentials(u.maNguoiDung);
      if (res.success) {
        setUsers([...store.getUsers()]);
        setCredentialModal({
          open: true,
          fullName: u.hoTen,
          email: u.email,
          tempPassword: res.tempPassword,
          emailSent: !!res.emailSent,
        });
      } else {
        toast({ title: 'Lỗi', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  // Xóa tài khoản
  const handleDelete = async (u: NguoiDung) => {
    if (currentUser?.maNguoiDung === u.maNguoiDung) {
      toast({ title: 'Lỗi', description: 'Không thể xóa tài khoản của chính mình.', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản ${u.hoTen} (${u.email}) không?`)) return;

    try {
      await apiDeleteUser(u.maNguoiDung);
      setUsers([...store.getUsers()]);
      toast({ title: 'Đã xóa tài khoản thành công.' });
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  // Mở modal xem danh sách file hồ sơ
  const openViewFiles = (title: string, files?: FileHoSo[]) => {
    if (!files || files.length === 0) {
      toast({ title: 'Thông báo', description: 'Chưa có tệp hồ sơ nào được đính kèm.' });
      return;
    }
    setViewingFiles({ title, files });
    setDialogFilesOpen(true);
  };

  // Sao chép mật khẩu vào clipboard
  const handleCopyPassword = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Đã sao chép mật khẩu vào bộ nhớ tạm!' });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header & Tiêu đề */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Quản lý Tài khoản & Hồ sơ Nhân sự
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quản lý nhân sự toàn viện (Trưởng khoa, Trợ lý, Nhân viên kho), lưu trữ hồ sơ giấy tờ scan và tự động cấp thông tin đăng nhập qua Gmail.
          </p>
        </div>

        <Button onClick={openAdd} className="gradient-primary text-primary-foreground shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Thêm tài khoản mới
        </Button>
      </div>

      {/* Thanh tìm kiếm & bộ lọc */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-3 rounded-lg border">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo họ tên, email, CCCD, chức danh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Lọc theo Vai trò */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36 text-xs h-9">
              <SelectValue placeholder="Tất cả vai trò" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả vai trò</SelectItem>
              <SelectItem value="TRUONG_KHOA">Trưởng khoa</SelectItem>
              <SelectItem value="TRO_LY">Trợ lý khoa</SelectItem>
              <SelectItem value="QL_KHO">Quản lý kho</SelectItem>
              <SelectItem value="NV_KHO">Nhân viên kho</SelectItem>
              <SelectItem value="ADMIN">Quản trị viên</SelectItem>
            </SelectContent>
          </Select>

          {/* Lọc theo Khoa */}
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-40 text-xs h-9">
              <SelectValue placeholder="Tất cả khoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tất cả khoa</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.maKhoa} value={d.maKhoa}>
                  {d.tenKhoa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setUsers(store.getUsers())}
            title="Tải lại danh sách"
            className="h-9 px-2.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Bảng danh sách tài khoản */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/60 font-semibold text-muted-foreground text-left">
                <th className="p-3">Mã NV</th>
                <th className="p-3">Họ tên & Chức danh</th>
                <th className="p-3">Email & SĐT</th>
                <th className="p-3">Số CCCD & Ngày sinh</th>
                <th className="p-3">Khoa & Vai trò</th>
                <th className="p-3 text-center">Hồ sơ đính kèm</th>
                <th className="p-3 text-center">Trạng thái</th>
                <th className="p-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Không tìm thấy nhân sự nào theo tiêu chí tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const dept = departments.find((d) => d.maKhoa === u.maKhoa);
                  const hasFiles = u.fileHoSo && u.fileHoSo.length > 0;
                  return (
                    <tr key={u.maNguoiDung} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3 font-mono font-medium text-foreground">{u.maNguoiDung}</td>
                      <td className="p-3">
                        <div className="font-semibold text-foreground text-sm">{u.hoTen}</div>
                        {u.chucDanh ? (
                          <div className="text-muted-foreground text-[11px]">{u.chucDanh}</div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">Chưa cập nhật chức danh</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 font-medium text-foreground">
                          <Mail className="w-3 h-3 text-muted-foreground" /> {u.email}
                        </div>
                        {u.soDienThoai && <div className="text-muted-foreground text-[11px] mt-0.5">{u.soDienThoai}</div>}
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-foreground font-medium">{u.cccd || '—'}</div>
                        {u.ngaySinh && <div className="text-muted-foreground text-[11px] mt-0.5">{u.ngaySinh}</div>}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${ROLE_COLORS[u.vaiTro]}`}>
                          {ROLE_LABELS[u.vaiTro]}
                        </span>
                        {dept && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                            <Building className="w-3 h-3" /> {dept.tenKhoa}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {hasFiles ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openViewFiles(`Hồ sơ: ${u.hoTen}`, u.fileHoSo)}
                            className="h-7 text-[11px] gap-1 text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Paperclip className="w-3 h-3" /> {u.fileHoSo?.length} tệp
                          </Button>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">Chưa đính kèm</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              u.trangThai ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                            }`}
                          >
                            {u.trangThai ? 'Hoạt động' : 'Tạm khóa'}
                          </span>
                          {u.yeuCauDoiMatKhau && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/15 text-amber-700 font-medium">
                              Chưa đổi MK
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1 items-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Cấp lại mật khẩu tạm & gửi email"
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            onClick={() => handleResendCredentials(u)}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Chỉnh sửa thông tin"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {currentUser?.maNguoiDung !== u.maNguoiDung && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Xóa tài khoản"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(u)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DIALOG THÊM / SỬA TÀI KHOẢN & HỒ SƠ (ADMIN) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              {editingUser ? 'Cập nhật thông tin nhân sự' : 'Thêm tài khoản & hồ sơ nhân sự mới'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingUser
                ? 'Chỉnh sửa thông tin hồ sơ cán bộ y tế và trạng thái tài khoản.'
                : 'Khởi tạo tài khoản trực tiếp. Hệ thống sẽ tự động sinh mật khẩu tạm thời và gửi email thông báo cho nhân sự.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Họ và tên *</Label>
              <Input
                placeholder="Ví dụ: BS. Nguyễn Văn An"
                value={form.hoTen}
                onChange={(e) => setForm({ ...form, hoTen: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Email nhận tài khoản *</Label>
              <Input
                type="email"
                placeholder="nguyenvanan@gmail.com"
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setEmailError(null);
                }}
                className={`mt-1 text-xs ${emailError ? 'border-destructive' : ''}`}
              />
              {emailError && <p className="text-[11px] text-destructive mt-1">{emailError}</p>}
            </div>

            <div>
              <Label className="text-xs font-semibold">Số CCCD / Hộ chiếu</Label>
              <Input
                value={form.cccd}
                onChange={(e) => setForm({ ...form, cccd: e.target.value })}
                placeholder="00120000xxxx"
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Ngày sinh</Label>
              <Input
                type="date"
                value={form.ngaySinh}
                onChange={(e) => setForm({ ...form, ngaySinh: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Số điện thoại</Label>
              <Input
                placeholder="0912 345 678"
                value={form.soDienThoai}
                onChange={(e) => setForm({ ...form, soDienThoai: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Chức danh chuyên môn</Label>
              <Input
                value={form.chucDanh}
                onChange={(e) => setForm({ ...form, chucDanh: e.target.value })}
                placeholder="Bác sĩ CKI, Điều dưỡng, KTV..."
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Vai trò trên hệ thống *</Label>
              <Select
                value={form.vaiTro}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    vaiTro: v as UserRole,
                    maKhoa: v === 'TRUONG_KHOA' || v === 'TRO_LY' ? form.maKhoa : '',
                  })
                }
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRUONG_KHOA">Trưởng khoa / Bác sĩ duyệt</SelectItem>
                  <SelectItem value="TRO_LY">Trợ lý khoa / Điều dưỡng trưởng</SelectItem>
                  <SelectItem value="QL_KHO">Quản lý kho thiết bị</SelectItem>
                  <SelectItem value="NV_KHO">Nhân viên thủ kho</SelectItem>
                  <SelectItem value="ADMIN">Quản trị viên (Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(form.vaiTro === 'TRUONG_KHOA' || form.vaiTro === 'TRO_LY') && (
              <div>
                <Label className="text-xs font-semibold">Khoa trực thuộc *</Label>
                <SearchableSelect
                  options={departments.map((k) => ({ value: k.maKhoa, label: k.tenKhoa }))}
                  value={form.maKhoa}
                  onValueChange={(v) => setForm({ ...form, maKhoa: v })}
                  placeholder="Chọn khoa phân công"
                />
              </div>
            )}

            {/* UPLOAD TỆP HỒ SƠ ĐÍNH KÈM */}
            <div className="sm:col-span-2 space-y-2 p-3 bg-muted/40 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Paperclip className="w-3.5 h-3.5 text-primary" />
                    Đính kèm tệp hồ sơ nhân sự
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Bản scan CCCD, Chứng chỉ hành nghề y tế, Quyết định tiếp nhận/bổ nhiệm (PDF, JPG, PNG).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 text-xs gap-1"
                >
                  <Upload className="w-3 h-3" /> Chọn tệp
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      setSelectedFiles(Array.from(e.target.files));
                    }
                  }}
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-background rounded border text-[11px]"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="font-medium truncate">{file.name}</span>
                        <span className="text-muted-foreground text-[10px]">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editingUser && (
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold">Trạng thái tài khoản</Label>
                <Select
                  value={form.trangThai ? 'true' : 'false'}
                  onValueChange={(v) => setForm({ ...form, trangThai: v === 'true' })}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Đang hoạt động</SelectItem>
                    <SelectItem value="false">Tạm khóa / Vô hiệu hóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting}
              className="gradient-primary text-primary-foreground font-semibold"
            >
              {isSubmitting
                ? 'Đang lưu & gửi email...'
                : editingUser
                ? 'Cập nhật'
                : 'Khởi tạo & Gửi email bàn giao'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG XEM TỆP HỒ SƠ ĐÍNH KÈM */}
      <Dialog open={dialogFilesOpen} onOpenChange={setDialogFilesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-primary" />
              {viewingFiles?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            {viewingFiles?.files.map((file, idx) => {
              const fullUrl = file.duongDan.startsWith('http') ? file.duongDan : `http://localhost:5000${file.duongDan}`;
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border text-xs">
                  <div className="flex items-center gap-2.5 truncate max-w-[260px]">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-medium truncate">{file.tenFile}</span>
                  </div>
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 font-medium text-xs transition-colors"
                  >
                    <Eye className="w-3 h-3" /> Mở xem
                  </a>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFilesOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG BÀN GIAO MẬT KHẨU TẠM THỜI (CREDENTIALS MODAL) */}
      <Dialog open={credentialModal.open} onOpenChange={(open) => setCredentialModal((prev) => ({ ...prev, open }))}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-left space-y-1.5">
            <div className="w-10 h-10 rounded-full bg-success/15 text-success flex items-center justify-center mb-1">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Khởi tạo tài khoản thành công!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Tài khoản đã sẵn sàng hoạt động. Dưới đây là thông tin đăng nhập tạm thời để bàn giao cho nhân sự:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/60 rounded-lg space-y-2 border">
              <div>
                <span className="text-muted-foreground">Nhân sự:</span>{' '}
                <strong className="text-foreground">{credentialModal.fullName}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Tên đăng nhập (Email):</span>{' '}
                <strong className="text-primary font-mono">{credentialModal.email}</strong>
              </div>
              <div className="pt-1">
                <span className="text-muted-foreground">Mật khẩu tạm thời:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 p-2 bg-background border rounded font-mono text-sm font-bold text-destructive tracking-wider">
                    {credentialModal.tempPassword}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyPassword(credentialModal.tempPassword)}
                    className="gap-1 h-9"
                  >
                    <Copy className="w-3.5 h-3.5" /> Sao chép
                  </Button>
                </div>
              </div>
            </div>

            {/* Trạng thái gửi Gmail */}
            <div
              className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                credentialModal.emailSent
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-amber-500/10 border-amber-300 text-amber-800'
              }`}
            >
              {credentialModal.emailSent ? (
                <>
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Đã gửi Gmail thông báo thành công!</div>
                    <div className="text-[11px] opacity-90">
                      Hệ thống đã tự động gửi email bàn giao kèm mật khẩu tạm đến hộp thư cá nhân của nhân sự.
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Thông tin bàn giao nội bộ</div>
                    <div className="text-[11px] opacity-90">
                      Bạn có thể sao chép mật khẩu tạm ở trên để gửi trực tiếp cho nhân sự đăng nhập.
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="p-2.5 bg-blue-500/10 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
              💡 <strong>Lưu ý:</strong> Khi nhân sự đăng nhập lần đầu tiên bằng mật khẩu tạm này, hệ thống sẽ <strong>bắt buộc thiết lập mật khẩu cá nhân mới</strong> mới cho phép sử dụng.
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setCredentialModal((prev) => ({ ...prev, open: false }))}
              className="w-full gradient-primary text-primary-foreground font-semibold"
            >
              Hoàn tất & Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
