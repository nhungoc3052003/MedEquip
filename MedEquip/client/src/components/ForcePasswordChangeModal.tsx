import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiChangePassword } from '@/lib/apiSync';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { ShieldAlert, CheckCircle2, XCircle, LogOut, KeyRound } from 'lucide-react';

export function ForcePasswordChangeModal() {
  const { user, updateCurrentUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user || !user.yeuCauDoiMatKhau) return null;

  const hasLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isValid = hasLength && hasUpper && hasNumber && isMatch && currentPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    try {
      const res = await apiChangePassword(user.maNguoiDung, currentPassword, newPassword);
      if (res.success) {
        toast({
          title: 'Đổi mật khẩu thành công!',
          description: 'Tài khoản của bạn đã được kích hoạt an toàn. Bạn có thể sử dụng hệ thống bình thường.',
        });
        updateCurrentUser({ yeuCauDoiMatKhau: false });
      } else {
        toast({
          title: 'Đổi mật khẩu thất bại',
          description: res.message || 'Mật khẩu hiện tại không chính xác.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Lỗi',
        description: err.message || 'Không thể kết nối đến máy chủ.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent 
        className="sm:max-w-md [&>button]:hidden" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left space-y-2">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-1">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            Thiết lập mật khẩu cá nhân mới
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Xin chào <strong>{user.hoTen}</strong>. Đây là lần đăng nhập đầu tiên với mật khẩu tạm thời. 
            Để đảm bảo an toàn thông tin y tế của bệnh viện, bạn bắt buộc phải tạo mật khẩu mới trước khi tiếp tục.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Mật khẩu tạm thời vừa đăng nhập *</Label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Nhập mật khẩu tạm được cấp..."
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Mật khẩu mới của bạn *</Label>
            <Input
              type="password"
              placeholder="Nhập mật khẩu mới..."
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Xác nhận lại mật khẩu mới *</Label>
            <Input
              type="password"
              placeholder="Nhập lại mật khẩu mới..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Tiêu chí mật khẩu */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1.5 text-xs">
            <div className="font-medium text-muted-foreground mb-1">Quy định bảo mật mật khẩu:</div>
            <div className="flex items-center gap-2">
              {hasLength ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={hasLength ? 'text-success font-medium' : 'text-muted-foreground'}>Ít nhất 8 ký tự</span>
            </div>
            <div className="flex items-center gap-2">
              {hasUpper ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={hasUpper ? 'text-success font-medium' : 'text-muted-foreground'}>Ít nhất 1 chữ cái in hoa (A-Z)</span>
            </div>
            <div className="flex items-center gap-2">
              {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={hasNumber ? 'text-success font-medium' : 'text-muted-foreground'}>Ít nhất 1 chữ số (0-9)</span>
            </div>
            <div className="flex items-center gap-2">
              {isMatch ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={isMatch ? 'text-success font-medium' : 'text-muted-foreground'}>Mật khẩu xác nhận phải trùng khớp</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-destructive gap-1.5"
            >
              <LogOut className="w-4 h-4" /> Đăng xuất
            </Button>
            <Button
              type="submit"
              disabled={!isValid || loading}
              className="gradient-primary text-primary-foreground font-semibold px-5"
            >
              {loading ? 'Đang cập nhật...' : 'Xác nhận & Vào hệ thống'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
