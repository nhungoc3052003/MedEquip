import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { ROLE_LABELS, getUserRoleWithDept } from '@/types';
import { apiUpdateUser, apiChangePassword } from '@/lib/apiSync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { User, Mail, Phone, MapPin, Shield, Calendar, Save, KeyRound, Eye, EyeOff, Building, Briefcase, CreditCard, Paperclip } from 'lucide-react';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^[0-9]{10,11}$/;

export default function ProfilePage() {
  const { user } = useAuth();
  const departments = store.getDepartments();
  const dept = departments.find(d => d.maKhoa === user?.maKhoa);
  const departmentName = (dept?.tenKhoa || user?.tenKhoa || (user?.maKhoa ? `Khoa ${user.maKhoa}` : '')).trim();
  const roleDisplay = getUserRoleWithDept(user, departmentName);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    hoTen: user?.hoTen || '',
    email: user?.email || '',
    soDienThoai: user?.soDienThoai || '',
    diaChi: user?.diaChi || '',
    cccd: user?.cccd || '',
    chucDanh: user?.chucDanh || '',
  });
  const [formErrors, setFormErrors] = useState<{ email?: string; soDienThoai?: string }>({});
  const [passwordForm, setPasswordForm] = useState({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!user) return null;

  const validateForm = () => {
    const errors: { email?: string; soDienThoai?: string } = {};
    if (!EMAIL_REGEX.test(form.email)) {
      errors.email = 'Email không đúng định dạng (ví dụ: ten@example.com)';
    }
    if (form.soDienThoai && !PHONE_REGEX.test(form.soDienThoai)) {
      errors.soDienThoai = 'Số điện thoại phải có 10–11 chữ số, không chứa ký tự đặc biệt hoặc chữ cái';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!form.hoTen || !form.email) {
      toast({ title: 'Lỗi', description: 'Họ tên và email không được để trống', variant: 'destructive' }); return;
    }
    if (!validateForm()) {
      toast({ title: 'Lỗi', description: 'Vui lòng kiểm tra lại các trường thông tin', variant: 'destructive' }); return;
    }
    try {
      const result = await apiUpdateUser(user.maNguoiDung, {
        hoTen: form.hoTen,
        email: form.email,
        soDienThoai: form.soDienThoai,
        diaChi: form.diaChi,
        cccd: form.cccd,
        chucDanh: form.chucDanh,
      });
      if (result.success) {
        localStorage.setItem('kho_currentUser', JSON.stringify({ ...user, ...form }));
        setEditing(false);
        toast({ title: 'Thành công', description: 'Đã cập nhật thông tin cá nhân' });
        window.location.reload();
      } else {
        toast({ title: 'Lỗi', description: result.message || 'Cập nhật thất bại', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.matKhauCu) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập mật khẩu cũ', variant: 'destructive' }); return;
    }
    if (!passwordForm.matKhauMoi) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập mật khẩu mới', variant: 'destructive' }); return;
    }
    if (passwordForm.matKhauMoi.length < 8) {
      toast({ title: 'Lỗi', description: 'Mật khẩu mới phải có ít nhất 8 ký tự', variant: 'destructive' }); return;
    }
    if (passwordForm.matKhauCu === passwordForm.matKhauMoi) {
      toast({ title: 'Lỗi', description: 'Mật khẩu mới không được trùng với mật khẩu cũ', variant: 'destructive' }); return;
    }
    if (!passwordForm.xacNhan) {
      toast({ title: 'Lỗi', description: 'Vui lòng xác nhận mật khẩu mới', variant: 'destructive' }); return;
    }
    if (passwordForm.matKhauMoi !== passwordForm.xacNhan) {
      toast({ title: 'Lỗi', description: 'Mật khẩu xác nhận không khớp', variant: 'destructive' }); return;
    }
    
    try {
      const result = await apiChangePassword(user.maNguoiDung, passwordForm.matKhauCu, passwordForm.matKhauMoi);
      if (result.success) {
        setChangingPw(false);
        setPasswordForm({ matKhauCu: '', matKhauMoi: '', xacNhan: '' });
        toast({ title: 'Thành công', description: 'Đã đổi mật khẩu' });
      } else {
        toast({ title: 'Lỗi', description: result.message || 'Đổi mật khẩu thất bại', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-md">
              {user.hoTen.charAt(0)}
            </div>
            <div>
              <CardTitle className="text-xl font-bold">{user.hoTen}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-sm font-semibold text-primary">
                  {roleDisplay}
                </span>
                {departmentName && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                    <Building className="w-3.5 h-3.5" /> {departmentName}
                  </span>
                )}
                {user.chucDanh && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full border">
                    <Briefcase className="w-3.5 h-3.5" /> {user.chucDanh}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <div className="space-y-3">
              <div><Label>Họ tên</Label><Input value={form.hoTen} onChange={e => setForm(f => ({ ...f, hoTen: e.target.value }))} /></div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => {
                    setForm(f => ({ ...f, email: e.target.value }));
                    setFormErrors(err => ({ ...err, email: undefined }));
                  }}
                  className={formErrors.email ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {formErrors.email && <p className="text-xs text-destructive mt-1">{formErrors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Số CCCD / Hộ chiếu</Label>
                  <Input value={form.cccd} onChange={e => setForm(f => ({ ...f, cccd: e.target.value }))} placeholder="00120000xxxx" />
                </div>
                <div>
                  <Label>Chức danh chuyên môn</Label>
                  <Input value={form.chucDanh} onChange={e => setForm(f => ({ ...f, chucDanh: e.target.value }))} placeholder="Bác sĩ, Điều dưỡng..." />
                </div>
              </div>
              <div>
                <Label>Số điện thoại</Label>
                <Input
                  value={form.soDienThoai}
                  inputMode="numeric"
                  onChange={e => {
                    const onlyDigits = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                    setForm(f => ({ ...f, soDienThoai: onlyDigits }));
                    setFormErrors(err => ({ ...err, soDienThoai: undefined }));
                  }}
                  className={formErrors.soDienThoai ? 'border-destructive focus-visible:ring-destructive' : ''}
                  placeholder="10-11 chữ số"
                />
                {formErrors.soDienThoai && <p className="text-xs text-destructive mt-1">{formErrors.soDienThoai}</p>}
              </div>
              <div><Label>Địa chỉ</Label><Input value={form.diaChi} onChange={e => setForm(f => ({ ...f, diaChi: e.target.value }))} /></div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="gradient-primary text-primary-foreground"><Save className="w-4 h-4 mr-1" /> Lưu</Button>
                <Button variant="outline" onClick={() => { setEditing(false); setFormErrors({}); }}>Hủy</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 py-2 border-b">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">Mã NV:</span>
                <span className="text-sm font-medium font-mono">{user.maNguoiDung}</span>
              </div>
              <div className="flex items-center gap-3 py-2 border-b">
                <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">Vai trò:</span>
                <span className="text-sm font-semibold text-foreground">{roleDisplay}</span>
              </div>

              {(user.vaiTro === 'TRUONG_KHOA' || user.vaiTro === 'TRO_LY' || user.maKhoa) && (
                <div className="flex items-center gap-3 py-2.5 border-b bg-blue-50/70 dark:bg-blue-950/30 -mx-6 px-6">
                  <Building className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground w-28">Khoa trực thuộc:</span>
                  <span className="text-sm font-bold text-primary flex items-center gap-2">
                    <Building className="w-3.5 h-3.5" />
                    {departmentName || 'Chưa cập nhật'}
                    {user.maKhoa && (
                      <span className="text-xs font-mono font-normal text-muted-foreground bg-white dark:bg-background px-2 py-0.5 rounded border">
                        {user.maKhoa}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 py-2 border-b">
                <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">Chức danh:</span>
                <span className="text-sm font-medium">{user.chucDanh || 'Chưa cập nhật'}</span>
              </div>

              <div className="flex items-center gap-3 py-2 border-b">
                <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">Số CCCD:</span>
                <span className="text-sm font-mono font-medium">{user.cccd || 'Chưa cập nhật'}</span>
              </div>

              {user.ngaySinh && (
                <div className="flex items-center gap-3 py-2 border-b">
                  <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-muted-foreground w-28">Ngày sinh:</span>
                  <span className="text-sm">{user.ngaySinh}</span>
                </div>
              )}

              <div className="flex items-center gap-3 py-2 border-b">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">Email:</span>
                <span className="text-sm">{user.email}</span>
              </div>

              <div className="flex items-center gap-3 py-2 border-b">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">SĐT:</span>
                <span className="text-sm">{user.soDienThoai || 'Chưa cập nhật'}</span>
              </div>

              <div className="flex items-center gap-3 py-2 border-b">
                <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">Địa chỉ:</span>
                <span className="text-sm">{user.diaChi || 'Chưa cập nhật'}</span>
              </div>

              {user.fileHoSo && user.fileHoSo.length > 0 && (
                <div className="flex items-start gap-3 py-2 border-b">
                  <Paperclip className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground w-28">Hồ sơ đính kèm:</span>
                  <div className="flex flex-wrap gap-2 flex-1">
                    {user.fileHoSo.map((f, i) => {
                      const fullUrl = f.duongDan.startsWith('http') ? f.duongDan : `http://localhost:5000${f.duongDan}`;
                      return (
                        <a
                          key={i}
                          href={fullUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline bg-primary/10 px-2.5 py-1 rounded border border-primary/20"
                        >
                          <Eye className="w-3 h-3" /> {f.tenFile}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 py-2">
                <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground w-28">Ngày tạo:</span>
                <span className="text-sm">{user.ngayTao ? new Date(user.ngayTao).toLocaleString('vi-VN') : 'Chưa cập nhật'}</span>
              </div>

              <div className="flex gap-2 pt-3">
                <Button variant="outline" onClick={() => setEditing(true)}>Chỉnh sửa thông tin</Button>
                <Button variant="outline" onClick={() => setChangingPw(true)}><KeyRound className="w-4 h-4 mr-1" /> Đổi mật khẩu</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {changingPw && (
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Đổi mật khẩu</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Mật khẩu cũ</Label>
              <div className="relative">
                <Input type={showOldPassword ? "text" : "password"} value={passwordForm.matKhauCu} onChange={e => setPasswordForm(f => ({ ...f, matKhauCu: e.target.value }))} className="pr-10" />
                <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Mật khẩu mới</Label>
              <div className="relative">
                <Input type={showNewPassword ? "text" : "password"} value={passwordForm.matKhauMoi} onChange={e => setPasswordForm(f => ({ ...f, matKhauMoi: e.target.value }))} className="pr-10" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Xác nhận mật khẩu mới</Label>
              <div className="relative">
                <Input type={showConfirmPassword ? "text" : "password"} value={passwordForm.xacNhan} onChange={e => setPasswordForm(f => ({ ...f, xacNhan: e.target.value }))} className="pr-10" />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleChangePassword} className="gradient-primary text-primary-foreground">Đổi mật khẩu</Button>
              <Button variant="outline" onClick={() => setChangingPw(false)}>Hủy</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
