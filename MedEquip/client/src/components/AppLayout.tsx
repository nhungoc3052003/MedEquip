import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, ROLE_LABELS } from '@/types';
import { store } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Hospital, LayoutDashboard, Package, Truck, Building2, FolderOpen,
  FileText, FileInput, FileOutput, ClipboardCheck, Bell, Users,
  LogOut, ChevronLeft, Menu, AlertTriangle, UserCircle, BarChart3, RotateCcw, Wrench
} from 'lucide-react';

export type PageKey =
  | 'dashboard' | 'inventory' | 'imports' | 'exports' | 'suppliers' | 'departments'
  | 'requests' | 'returns' | 'users' | 'notifications' | 'profile' | 'reports';

interface NavItem {
  key: PageKey;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Tổng quan', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['ADMIN', 'NV_KHO', 'TRUONG_KHOA', 'QL_KHO', 'TRO_LY'] },
  { key: 'inventory', label: 'Quản lý Kho', icon: <Package className="w-5 h-5" />, roles: ['ADMIN', 'QL_KHO', 'TRUONG_KHOA', 'NV_KHO'] },
  { key: 'suppliers', label: 'Nhà cung cấp', icon: <Truck className="w-5 h-5" />, roles: ['ADMIN', 'QL_KHO'] },
  { key: 'departments', label: 'Khoa', icon: <Building2 className="w-5 h-5" />, roles: ['ADMIN', 'QL_KHO'] },
  { key: 'requests', label: 'Yêu cầu cấp phát', icon: <FileText className="w-5 h-5" />, roles: ['ADMIN', 'TRUONG_KHOA', 'NV_KHO', 'QL_KHO', 'TRO_LY'] },
  { key: 'returns', label: 'Trả thiết bị', icon: <RotateCcw className="w-5 h-5" />, roles: ['ADMIN', 'TRUONG_KHOA', 'NV_KHO', 'QL_KHO', 'TRO_LY'] },
  { key: 'reports', label: 'Báo cáo thống kê', icon: <BarChart3 className="w-5 h-5" />, roles: ['ADMIN', 'TRUONG_KHOA', 'QL_KHO'] },
  { key: 'users', label: 'Quản lý Tài khoản', icon: <Users className="w-5 h-5" />, roles: ['ADMIN'] },
  { key: 'profile', label: 'Trang cá nhân', icon: <UserCircle className="w-5 h-5" />, roles: ['ADMIN', 'NV_KHO', 'TRUONG_KHOA', 'QL_KHO', 'TRO_LY'] },
];

interface AppLayoutProps {
  currentPage: PageKey;
  onNavigate: (page: PageKey) => void;
  children: React.ReactNode;
}

export default function AppLayout({ currentPage, onNavigate, children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setNotifTrigger] = React.useState(0);

  React.useEffect(() => {
    const handleNotifChange = () => setNotifTrigger(prev => prev + 1);
    window.addEventListener('store_notifications_changed', handleNotifChange);
    return () => window.removeEventListener('store_notifications_changed', handleNotifChange);
  }, []);

  if (!user) return null;

  const filteredNav = navItems.filter(item => item.roles.includes(user.vaiTro));
  
  const unreadRequestsCount = store.getNotifications().filter(n => {
    if (n.nguoiNhan !== user.maNguoiDung || n.daDoc) return false;
    const t = n.tieuDe.toLowerCase();
    const d = n.noiDung.toLowerCase();
    const isTra = t.includes('trả') || d.includes('trả');
    return !isTra && (t.includes('cấp phát') || t.includes('yêu cầu') || d.includes('cấp phát') || d.includes('yêu cầu'));
  }).length;

  const unreadReturnsCount = store.getNotifications().filter(n => {
    if (n.nguoiNhan !== user.maNguoiDung || n.daDoc) return false;
    const t = n.tieuDe.toLowerCase();
    const d = n.noiDung.toLowerCase();
    return t.includes('trả') || d.includes('trả');
  }).length;

  const SidebarContent = () => (
    <div className="flex flex-col h-full gradient-sidebar">
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Hospital className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-sidebar-primary-foreground truncate">Kho Bệnh viện</h2>
            <p className="text-xs text-sidebar-foreground truncate">Hệ thống quản lý v4</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNav.map(item => (
          <button
            key={item.key}
            onClick={() => { onNavigate(item.key); setMobileOpen(false); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              currentPage === item.key
                ? 'bg-sidebar-primary/20 text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            {item.icon}
            {!collapsed && <span className="truncate">{item.label}</span>}
            {item.key === 'requests' && unreadRequestsCount > 0 && !collapsed && (
              <Badge variant="destructive" className="ml-auto text-xs h-5 min-w-5 flex items-center justify-center">
                {unreadRequestsCount}
              </Badge>
            )}
            {item.key === 'returns' && unreadReturnsCount > 0 && !collapsed && (
              <Badge variant="destructive" className="ml-auto text-xs h-5 min-w-5 flex items-center justify-center">
                {unreadReturnsCount}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div
          className={cn('flex items-center gap-3 px-3 py-2 mb-2 cursor-pointer rounded-lg hover:bg-sidebar-accent', collapsed && 'justify-center')}
          onClick={() => { onNavigate('profile'); setMobileOpen(false); }}
        >
          <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold flex-shrink-0">
            {user.hoTen.charAt(0)}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-sidebar-accent-foreground truncate">{user.hoTen}</p>
              <p className="text-xs text-sidebar-foreground truncate">{ROLE_LABELS[user.vaiTro]}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-sidebar-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Đăng xuất</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn(
        'hidden lg:flex flex-col transition-all duration-300 border-r border-sidebar-border',
        collapsed ? 'w-20' : 'w-64'
      )}>
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 h-full">
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b flex items-center justify-between px-4 bg-card flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden lg:flex" onClick={() => setCollapsed(!collapsed)}>
              <ChevronLeft className={cn('w-5 h-5 transition-transform', collapsed && 'rotate-180')} />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">
              {navItems.find(n => n.key === currentPage)?.label || 'Tổng quan'}
            </h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
