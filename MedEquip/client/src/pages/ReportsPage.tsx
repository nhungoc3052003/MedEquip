import { store } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const COLORS = ['hsl(199, 89%, 48%)', 'hsl(160, 60%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(262, 83%, 58%)'];

function exportToExcel(data: Record<string, unknown>[], sheetName: string, fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export default function ReportsPage() {
  const { user } = useAuth();
  
  const allInventory = store.getInventory();
  const allEquipment = store.getEquipment();
  const allRequests = store.getRequests();
  const allImports = store.getImports();
  const allExports = store.getExports();
  const allAllocations = store.getAllocations();
  const allDamageReports = store.getDamageReports();
  const departments = store.getDepartments();
  const users = store.getUsers();

  const isTK = user?.vaiTro === 'TRUONG_KHOA';
  
  const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    NV_KHO: 'Nhân viên Kho',
    TRUONG_KHOA: 'Trưởng Khoa',
    QL_KHO: 'Quản lý Kho',
    TRO_LY: 'Trợ lý Khoa'
  };

  const roleStats = Object.keys(ROLE_LABELS).map(role => ({
    name: ROLE_LABELS[role],
    value: users.filter(u => u.vaiTro === role).length
  })).filter(r => r.value > 0);

  const activeUsers = users.filter(u => u.trangThai).length;
  const inactiveUsers = users.length - activeUsers;

  const exportUsers = () => {
    const data = users.map(u => {
      const deptName = u.maKhoa ? departments.find(d => d.maKhoa === u.maKhoa)?.tenKhoa || u.maKhoa : '';
      return {
        'Mã NĐ': u.maNguoiDung,
        'Họ Tên': u.hoTen,
        'Email': u.email,
        'Vai trò': ROLE_LABELS[u.vaiTro],
        'Khoa': deptName,
        'Trạng thái': u.trangThai ? 'Hoạt động' : 'Vô hiệu'
      };
    });
    exportToExcel(data, 'Người dùng', 'bao_cao_nguoi_dung.xlsx');
  };


  
  // Filtering logic
  const requests = isTK ? allRequests.filter(r => r.maNguoiYeuCau === user.maNguoiDung) : allRequests;
  const allocations = isTK ? allAllocations.filter(a => a.maNguoiMuon === user.maNguoiDung) : allAllocations;
  const damageReports = isTK ? allDamageReports.filter(d => d.maNguoiBao === user.maNguoiDung) : allDamageReports;
  
  // For Inventory charts/stats, TK only sees devices they participated in
  const myDeviceIds = new Set(allocations.map(a => a.maThietBi));
  const inventory = isTK ? allInventory.filter(inv => myDeviceIds.has(inv.maThietBi)) : allInventory;
  const equipment = isTK ? allEquipment.filter(e => myDeviceIds.has(e.maThietBi)) : allEquipment;
  
  // Imports/Exports are usually hidden or scoped too, but for TK they shouldn't see hospital-wide imports
  const imports = isTK ? [] : allImports;
  const exports_ = isTK ? [] : allExports;

  const invData = inventory.map(inv => {
    const tb = equipment.find(e => e.maThietBi === inv.maThietBi);
    return {
      name: tb?.tenThietBi || inv.maThietBi,
      'Trong kho': inv.soLuongKho,
      'Đang dùng': inv.soLuongDangDung,
      'Hư hỏng': inv.soLuongHu,
    };
  });

  const reqStats = [
    { name: 'Chờ duyệt', value: requests.filter(r => r.trangThai === 'CHO_DUYET').length },
    { name: 'Đã duyệt', value: requests.filter(r => r.trangThai === 'DA_DUYET').length },
    { name: 'Từ chối', value: requests.filter(r => r.trangThai === 'TU_CHOI').length },
  ].filter(d => d.value > 0);

  const totalStock = inventory.reduce((s, i) => s + i.soLuongKho, 0);
  const totalInUse = inventory.reduce((s, i) => s + i.soLuongDangDung, 0);
  const totalDamaged = inventory.reduce((s, i) => s + i.soLuongHu, 0);
  const totalImported = imports.reduce((s, i) => s + i.soLuongNhap, 0);
  const totalExported = exports_.filter(e => e.trangThai === 'DA_XUAT').reduce((s, e) => s + e.soLuong, 0);
  const totalAllocated = allocations.reduce((s, a) => s + a.soLuongCapPhat, 0);

  const summaryData = [
    { name: 'Trong kho', value: totalStock },
    { name: 'Đang dùng', value: totalInUse },
    { name: 'Hư hỏng', value: totalDamaged },
  ];

  // Export functions
  const exportInventory = () => {
    const data = inventory.map(inv => {
      const tb = equipment.find(e => e.maThietBi === inv.maThietBi);
      return { 'Mã TB': inv.maThietBi, 'Tên TB': tb?.tenThietBi || '', 'Trong kho': inv.soLuongKho, 'Đang dùng': inv.soLuongDangDung, 'Hư hỏng': inv.soLuongHu };
    });
    exportToExcel(data, 'Tồn kho', 'bao_cao_ton_kho.xlsx');
  };

  const exportRequests = () => {
    const data = requests.map(r => {
      const tb = equipment.find(e => e.maThietBi === r.maThietBi);
      return { 'Mã phiếu': r.maPhieu, 'Thiết bị': tb?.tenThietBi || r.maThietBi, 'Số lượng': r.soLuongYeuCau, 'Lý do': r.lyDo, 'Trạng thái': r.trangThai, 'Ngày tạo': r.ngayTao };
    });
    exportToExcel(data, 'Yêu cầu', 'bao_cao_yeu_cau.xlsx');
  };

  const exportAllocations = () => {
    const data = allocations.map(a => {
      const tb = equipment.find(e => e.maThietBi === a.maThietBi);
      const dept = departments.find(k => k.maKhoa === a.maKhoa);
      const borrower = users.find(u => u.maNguoiDung === a.maNguoiMuon);
      return { 'Mã phiếu': a.maPhieu, 'Thiết bị': tb?.tenThietBi || a.maThietBi, 'SL cấp phát': a.soLuongCapPhat, 'Người mượn': borrower?.hoTen || a.maNguoiMuon, 'Khoa': dept?.tenKhoa || a.maKhoa, 'Ngày': a.ngayCapPhat };
    });
    exportToExcel(data, 'Cấp phát', 'bao_cao_cap_phat.xlsx');
  };

  const exportDamage = () => {
    const data = damageReports.map(d => {
      const tb = equipment.find(e => e.maThietBi === d.maThietBi);
      return { 'Mã phiếu': d.maPhieu, 'Thiết bị': tb?.tenThietBi || d.maThietBi, 'Số lượng hư': d.soLuongHu, 'Mô tả': d.moTaHuHong, 'Trạng thái': d.trangThai, 'Ngày báo': d.ngayBao };
    });
    exportToExcel(data, 'Hư hỏng', 'bao_cao_hu_hong.xlsx');
  };

  const exportImports = () => {
    const data = imports.map(i => {
      const tb = equipment.find(e => e.maThietBi === i.maThietBi);
      return { 'Mã phiếu': i.maPhieu, 'Thiết bị': tb?.tenThietBi || i.maThietBi, 'SL nhập': i.soLuongNhap, 'NCC': i.maNhaCungCap, 'Ngày nhập': i.ngayNhap };
    });
    exportToExcel(data, 'Nhập kho', 'bao_cao_nhap_kho.xlsx');
  };

  const exportExportsData = () => {
    const data = exports_.map(e => {
      const tb = equipment.find(eq => eq.maThietBi === e.maThietBi);
      return { 'Mã phiếu': e.maPhieu, 'Thiết bị': tb?.tenThietBi || e.maThietBi, 'Số lượng': e.soLuong, 'Lý do': e.lyDoXuat, 'Trạng thái': e.trangThai, 'Ngày xuất': e.ngayXuat };
    });
    exportToExcel(data, 'Xuất kho', 'bao_cao_xuat_kho.xlsx');
  };

  const exportAll = () => {
    const wb = XLSX.utils.book_new();
    const invSheet = XLSX.utils.json_to_sheet(inventory.map(inv => {
      const tb = equipment.find(e => e.maThietBi === inv.maThietBi);
      return { 'Mã TB': inv.maThietBi, 'Tên TB': tb?.tenThietBi || '', 'Trong kho': inv.soLuongKho, 'Đang dùng': inv.soLuongDangDung, 'Hư hỏng': inv.soLuongHu };
    }));
    XLSX.utils.book_append_sheet(wb, invSheet, 'Tồn kho');

    const reqSheet = XLSX.utils.json_to_sheet(requests.map(r => {
      const tb = equipment.find(e => e.maThietBi === r.maThietBi);
      return { 'Mã phiếu': r.maPhieu, 'Thiết bị': tb?.tenThietBi || r.maThietBi, 'Số lượng': r.soLuongYeuCau, 'Trạng thái': r.trangThai, 'Ngày tạo': r.ngayTao };
    }));
    XLSX.utils.book_append_sheet(wb, reqSheet, 'Yêu cầu');

    const allocSheet = XLSX.utils.json_to_sheet(allocations.map(a => {
      const tb = equipment.find(e => e.maThietBi === a.maThietBi);
      const dept = departments.find(k => k.maKhoa === a.maKhoa);
      const borrower = users.find(u => u.maNguoiDung === a.maNguoiMuon);
      return { 'Mã phiếu': a.maPhieu, 'Thiết bị': tb?.tenThietBi || a.maThietBi, 'SL cấp phát': a.soLuongCapPhat, 'Người mượn': borrower?.hoTen || a.maNguoiMuon, 'Khoa': dept?.tenKhoa || a.maKhoa, 'Ngày': a.ngayCapPhat };
    }));
    XLSX.utils.book_append_sheet(wb, allocSheet, 'Cấp phát');

    const dmgSheet = XLSX.utils.json_to_sheet(damageReports.map(d => {
      const tb = equipment.find(e => e.maThietBi === d.maThietBi);
      return { 'Mã phiếu': d.maPhieu, 'Thiết bị': tb?.tenThietBi || d.maThietBi, 'SL hư': d.soLuongHu, 'Trạng thái': d.trangThai, 'Ngày báo': d.ngayBao };
    }));
    XLSX.utils.book_append_sheet(wb, dmgSheet, 'Hư hỏng');

    const impSheet = XLSX.utils.json_to_sheet(imports.map(i => {
      const tb = equipment.find(e => e.maThietBi === i.maThietBi);
      return { 'Mã phiếu': i.maPhieu, 'Thiết bị': tb?.tenThietBi || i.maThietBi, 'SL nhập': i.soLuongNhap, 'Ngày nhập': i.ngayNhap };
    }));
    XLSX.utils.book_append_sheet(wb, impSheet, 'Nhập kho');

    const expSheet = XLSX.utils.json_to_sheet(exports_.map(e => {
      const tb = equipment.find(eq => eq.maThietBi === e.maThietBi);
      return { 'Mã phiếu': e.maPhieu, 'Thiết bị': tb?.tenThietBi || e.maThietBi, 'Số lượng': e.soLuong, 'Trạng thái': e.trangThai, 'Ngày xuất': e.ngayXuat };
    }));
    XLSX.utils.book_append_sheet(wb, expSheet, 'Xuất kho');

    XLSX.writeFile(wb, 'bao_cao_tong_hop.xlsx');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Export all button */}
      <div className="flex justify-end gap-2">
        {user?.vaiTro === 'ADMIN' && (
          <Button variant="outline" onClick={exportUsers} className="gap-2 border-primary/20 text-primary hover:bg-primary/5">
            <Download className="h-4 w-4" /> Excel Người dùng
          </Button>
        )}
        <Button onClick={exportAll} className="gap-2">
          <Download className="h-4 w-4" /> Xuất Excel tổng hợp
        </Button>
      </div>

      {user?.vaiTro === 'ADMIN' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{users.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Tổng người dùng</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-success">{activeUsers}</p>
                <p className="text-xs text-muted-foreground mt-1">Tài khoản hoạt động</p>
              </CardContent>
            </Card>
            <Card className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{inactiveUsers}</p>
                <p className="text-xs text-muted-foreground mt-1">Tài khoản vô hiệu</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="shadow-card">
              <CardHeader><CardTitle className="text-base">Phân bổ Vai trò Người dùng</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={roleStats} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {roleStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-border flex-1"></div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thống kê Thiết bị & Kho</span>
            <div className="h-px bg-border flex-1"></div>
          </div>
        </>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Tổng trong kho', value: totalStock, color: 'text-primary', hide: isTK },
          { label: 'Đang sử dụng', value: totalInUse, color: 'text-accent', hide: isTK },
          { label: 'Hư hỏng', value: totalDamaged, color: 'text-warning', hide: isTK },
          { label: 'Đã nhập', value: totalImported, color: 'text-info', hide: isTK },
          { label: 'Đã xuất (BV)', value: totalExported, color: 'text-destructive', hide: isTK },
          { label: 'Đã mượn', value: totalAllocated, color: 'text-success' },
        ].filter(s => !s.hide).map(s => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inventory chart */}
        {(!isTK || invData.length > 0) && (
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{isTK ? 'Tình trạng thiết bị đã mượn' : 'Tồn kho theo thiết bị'}</CardTitle>
              <Button variant="outline" size="sm" onClick={exportInventory} className="gap-1">
                <Download className="h-3 w-3" /> Excel
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={invData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  {!isTK && <Bar dataKey="Trong kho" fill="hsl(199, 89%, 48%)" radius={[4, 4, 0, 0]} />}
                  <Bar dataKey="Đang dùng" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Hư hỏng" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Request status pie */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Trạng thái phiếu yêu cầu</CardTitle>
            <Button variant="outline" size="sm" onClick={exportRequests} className="gap-1">
              <Download className="h-3 w-3" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            {reqStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={reqStats} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {reqStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">Chưa có dữ liệu</div>
            )}
          </CardContent>
        </Card>

        {/* Overall stock distribution */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Phân bổ tồn kho tổng</CardTitle>
            <Button variant="outline" size="sm" onClick={exportInventory} className="gap-1">
              <Download className="h-3 w-3" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={summaryData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {summaryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Damage reports summary */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Tổng quan báo hư hỏng</CardTitle>
            <Button variant="outline" size="sm" onClick={exportDamage} className="gap-1">
              <Download className="h-3 w-3" /> Excel
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Tổng phiếu báo hư hỏng</span>
                <span className="font-bold">{damageReports.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Chờ xử lý</span>
                <span className="font-bold text-warning">{damageReports.filter(d => d.trangThai === 'CHO_XU_LY').length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Đã xử lý</span>
                <span className="font-bold text-success">{damageReports.filter(d => d.trangThai === 'DA_XU_LY').length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Tổng phiếu nhập kho</span>
                <span className="font-bold text-info">{imports.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Tổng phiếu xuất kho</span>
                <span className="font-bold text-destructive">{exports_.length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Tổng phiếu cấp phát</span>
                <span className="font-bold text-primary">{allocations.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Import/Export summary */}
        {!isTK && (
          <>
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Nhập kho</CardTitle>
                <Button variant="outline" size="sm" onClick={exportImports} className="gap-1">
                  <Download className="h-3 w-3" /> Excel
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Tổng phiếu nhập</span>
                    <span className="font-bold">{imports.length}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Tổng SL đã nhập</span>
                    <span className="font-bold text-info">{totalImported}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Xuất kho / Cấp phát</CardTitle>
                <Button variant="outline" size="sm" onClick={exportExportsData} className="gap-1">
                  <Download className="h-3 w-3" /> Excel
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Tổng phiếu xuất</span>
                    <span className="font-bold">{exports_.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Tổng SL đã xuất</span>
                    <span className="font-bold text-destructive">{totalExported}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-sm text-muted-foreground">Tổng phiếu cấp phát</span>
                    <span className="font-bold">{allocations.length}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-sm text-muted-foreground">Tổng SL cấp phát</span>
                    <span className="font-bold text-success">{totalAllocated}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
