import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/components/LoginPage';
import AppLayout, { PageKey } from '@/components/AppLayout';
import DashboardPage from '@/pages/DashboardPage';
import InventoryPage from '@/pages/InventoryPage';
import ImportsPage from '@/pages/ImportsPage';
import ExportsPage from '@/pages/ExportsPage';
import SuppliersPage from '@/pages/SuppliersPage';
import DepartmentsPage from '@/pages/DepartmentsPage';
import RequestsPage from '@/pages/RequestsPage';
import TransfersPage from '@/pages/TransfersPage';
import ReturnsPage from '@/pages/ReturnsPage';
import UsersPage from '@/pages/UsersPage';
import NotificationsPage from '@/pages/NotificationsPage';
import ProfilePage from '@/pages/ProfilePage';
import ReportsPage from '@/pages/ReportsPage';
import MaintenancePage from '@/pages/MaintenancePage';

const pages: Record<PageKey, React.ComponentType> = {
  dashboard: DashboardPage,
  inventory: InventoryPage,
  imports: ImportsPage,
  exports: ExportsPage,
  suppliers: SuppliersPage,
  departments: DepartmentsPage,
  requests: RequestsPage,
  transfers: TransfersPage,
  returns: ReturnsPage,
  maintenance: MaintenancePage,
  users: UsersPage,
  notifications: NotificationsPage,
  profile: ProfilePage,
  reports: ReportsPage,
};

function AppContent() {
  const { isLoggedIn } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard');

  if (!isLoggedIn) return <LoginPage />;

  const PageComponent = pages[currentPage];

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      <PageComponent />
    </AppLayout>
  );
}

export default function Index() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
