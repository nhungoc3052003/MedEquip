import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { apiMarkAsRead, apiMarkAllAsRead } from '@/lib/apiSync';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const ICON_MAP = {
  info: <Info className="w-4 h-4 text-info" />,
  success: <CheckCircle className="w-4 h-4 text-success" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" />,
  error: <XCircle className="w-4 h-4 text-destructive" />,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(store.getNotifications());

  const myNotifs = notifications
    .filter(n => n.nguoiNhan === user?.maNguoiDung)
    .sort((a, b) => new Date(b.ngayTao).getTime() - new Date(a.ngayTao).getTime());

  const markAllRead = async () => {
    if (!user) return;
    const updated = notifications.map(n => n.nguoiNhan === user.maNguoiDung ? { ...n, daDoc: true } : n);
    store.setNotifications(updated);
    setNotifications(updated);
    await apiMarkAllAsRead(user.maNguoiDung);
  };

  const markRead = async (id: string) => {
    const updated = notifications.map(n => n.id === id ? { ...n, daDoc: true } : n);
    store.setNotifications(updated);
    setNotifications(updated);
    await apiMarkAsRead(id);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{myNotifs.filter(n => !n.daDoc).length} thông báo chưa đọc</p>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <CheckCheck className="w-4 h-4 mr-1" /> Đánh dấu tất cả đã đọc
        </Button>
      </div>

      <div className="space-y-2">
        {myNotifs.map(n => (
          <div
            key={n.id}
            className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
              n.daDoc ? 'bg-card' : 'bg-primary/5 border-primary/20'
            }`}
            onClick={() => markRead(n.id)}
          >
            <div className="mt-0.5">{ICON_MAP[n.loai]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{n.tieuDe}</p>
              <p className="text-sm text-muted-foreground">{n.noiDung}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(n.ngayTao).toLocaleString('vi-VN')}</p>
            </div>
            {!n.daDoc && <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />}
          </div>
        ))}
      </div>
      {myNotifs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Không có thông báo</p>
        </div>
      )}
    </div>
  );
}
