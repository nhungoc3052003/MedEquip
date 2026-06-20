import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { ThietBi, ROLE_LABELS, LOAI_THIET_BI_COLORS, LOAI_THIET_BI_LABELS, TINH_TRANG_TRA_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Package, Users, Truck, Building2, FileText, AlertTriangle, 
  TrendingUp, Archive, Eye, RotateCcw, Calendar, Image as ImageIcon 
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const [viewingEquipment, setViewingEquipment] = useState<ThietBi | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  if (!user) return null;

  const equipment = store.getEquipment();
  const inventory = store.getInventory();
  const suppliers = store.getSuppliers();
  const departments = store.getDepartments();
  const requests = store.getRequests();
  const users = store.getUsers();

  const allocations = store.getAllocations();
  
  // Filter for TRUONG_KHOA
  const myRequests = user.vaiTro === 'TRUONG_KHOA' ? requests.filter(r => r.maNguoiYeuCau === user.maNguoiDung) : requests;
  const pendingRequests = myRequests.filter(r => r.trangThai === 'CHO_DUYET').length;
  
  const myAllocations = user.vaiTro === 'TRUONG_KHOA' ? allocations.filter(a => a.maNguoiMuon === user.maNguoiDung) : allocations;
  const đangMuonAllocations = myAllocations.filter(a => a.trangThaiTra !== 'DA_TRA');
  const đaTraAllocations = myAllocations.filter(a => a.trangThaiTra === 'DA_TRA');
  
  const đangMuonKhoa = đangMuonAllocations.reduce((s, a) => s + a.soLuongCapPhat, 0);
  const daTraKhoa = đaTraAllocations.reduce((s, a) => s + a.soLuongCapPhat, 0);

  const returns = store.getReturns();
  const myReturns = user.vaiTro === 'TRUONG_KHOA' ? returns.filter(r => r.maTruongKhoa === user.maNguoiDung) : returns;

  const totalStock = inventory.reduce((s, i) => s + i.soLuongKho, 0);
  const totalInUse = inventory.reduce((s, i) => s + i.soLuongDangDung, 0);

  const filteredStats = [
    { label: 'Thiết bị tổng', value: equipment.length, icon: Package, color: 'text-primary bg-primary/10', roles: ['ADMIN', 'QL_KHO'] },
    { label: 'Tồn kho tổng', value: totalStock, icon: Archive, color: 'text-accent bg-accent/10', roles: ['ADMIN', 'QL_KHO'] },
    { label: 'Đang dùng tổng', value: totalInUse, icon: TrendingUp, color: 'text-info bg-info/10', roles: ['ADMIN', 'QL_KHO'] },
    { label: 'Nhà cung cấp', value: suppliers.length, icon: Truck, color: 'text-primary bg-primary/10', roles: ['ADMIN', 'QL_KHO'] },
    { label: 'Khoa', value: departments.length, icon: Building2, color: 'text-accent bg-accent/10', roles: ['ADMIN', 'QL_KHO'] },
    { label: 'Phiếu chờ duyệt', value: pendingRequests, icon: AlertTriangle, color: 'text-warning bg-warning/10', roles: ['TRUONG_KHOA', 'NV_KHO', 'QL_KHO'] },
    { label: 'Tổng yêu cầu', value: requests.length, icon: FileText, color: 'text-primary bg-primary/10', roles: ['ADMIN'] },
    { label: 'Tổng phiếu trả', value: returns.length, icon: RotateCcw, color: 'text-accent bg-accent/10', roles: ['ADMIN'] },
    { label: 'Thiết bị đang mượn', value: đangMuonKhoa, icon: TrendingUp, color: 'text-info bg-info/10', roles: ['TRUONG_KHOA', 'NV_KHO', 'QL_KHO'] },
    { label: 'Đã trả', value: daTraKhoa, icon: Package, color: 'text-success bg-success/10', roles: ['TRUONG_KHOA'] },
    { label: 'Xin cấp phát', value: myRequests.length, icon: FileText, color: 'text-primary bg-primary/10', roles: ['TRUONG_KHOA'] },
    { label: 'Người dùng', value: users.length, icon: Users, color: 'text-primary bg-primary/10', roles: ['ADMIN'] },
  ].filter(s => s.roles.includes(user.vaiTro));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Xin chào, {user.hoTen}!</h2>
        <p className="text-muted-foreground">Vai trò: {ROLE_LABELS[user.vaiTro]}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredStats.map(stat => (
          <Card key={stat.label} className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-sm font-medium">
        {user.vaiTro === 'TRUONG_KHOA' && (
          <>
            <Card className="shadow-card md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Chi tiết Thiết bị Khoa đang mượn
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium">Mã phiếu</th>
                        <th className="text-left p-3 font-medium">Tên thiết bị</th>
                        <th className="text-center p-3 font-medium">Số lượng</th>
                        <th className="text-left p-3 font-medium">Ngày mượn</th>
                        <th className="text-left p-3 font-medium">Hạn trả (Dự kiến)</th>
                        <th className="text-right p-3 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {đangMuonAllocations.map(a => {
                        const tb = equipment.find(e => e.maThietBi === a.maThietBi);
                        const isOverdue = a.ngayDuKienTra && new Date(a.ngayDuKienTra) < new Date();
                        return (
                          <tr key={a.maPhieu} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-mono text-[10px]">{a.maPhieu}</td>
                            <td className="p-3">
                              <span 
                                className="font-semibold cursor-pointer hover:text-primary transition-colors"
                                onClick={() => {
                                  if (tb) {
                                    setViewingEquipment(tb);
                                    setViewDialogOpen(true);
                                  }
                                }}
                              >
                                {tb?.tenThietBi || a.tenThietBi}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-primary">{a.soLuongCapPhat}</td>
                            <td className="p-3 text-xs">{new Date(a.ngayCapPhat).toLocaleDateString('vi-VN')}</td>
                            <td className="p-3 text-xs">
                              <span className={isOverdue ? "text-destructive font-bold" : ""}>
                                {a.ngayDuKienTra ? new Date(a.ngayDuKienTra).toLocaleDateString('vi-VN') : '—'}
                                {isOverdue && " (Quá hạn)"}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <Button variant="ghost" size="icon" onClick={() => {
                                if (tb) {
                                  setViewingEquipment(tb);
                                  setViewDialogOpen(true);
                                }
                              }} title="Xem chi tiết">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {đangMuonAllocations.length === 0 && (
                        <tr><td colSpan={6} className="p-8 text-center text-muted-foreground italic">Khoa hiện không mượn thiết bị nào.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-success" /> Lịch sử thiết bị đã trả
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium">Mã phiếu trả</th>
                        <th className="text-left p-3 font-medium">Ngày trả</th>
                        <th className="text-left p-3 font-medium">Thiết bị & SL</th>
                        <th className="text-center p-3 font-medium">Trình trạng</th>
                        <th className="text-right p-3 font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myReturns.slice(0, 5).map(r => (
                        <tr key={r.maPhieuTra} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-[10px]">{r.maPhieuTra}</td>
                          <td className="p-3 text-xs">{new Date(r.ngayTao).toLocaleDateString('vi-VN')}</td>
                          <td className="p-3">
                            {r.chiTiet.map((ct, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium">{ct.tenThietBi}</span>: <span className="font-bold">x{ct.soLuong}</span>
                              </div>
                            ))}
                          </td>
                          <td className="p-3 text-center text-xs">
                            {r.chiTiet.map((ct, idx) => (
                              <div key={idx}>{TINH_TRANG_TRA_LABELS[ct.tinhTrangKhiTra]}</div>
                            ))}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase
                              ${r.trangThai === 'DA_TRA' ? 'bg-success/10 text-success' : 
                                r.trangThai === 'CHO_XAC_NHAN' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                              {r.trangThai === 'DA_TRA' ? 'Đã nhập kho' : r.trangThai === 'CHO_XAC_NHAN' ? 'Chờ xác nhận' : 'Bị từ chối'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {myReturns.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground italic">Chưa có lịch sử trả thiết bị.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {user.vaiTro !== 'ADMIN' && (
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> {user.vaiTro === 'TRUONG_KHOA' ? 'Yêu cầu cấp phát vừa gửi' : 'Phiếu yêu cầu gần đây'}</CardTitle></CardHeader>
            <CardContent>
              {myRequests.slice(0, 5).map(r => {
                const tb = equipment.find(e => e.maThietBi === r.maThietBi);
                return (
                  <div key={r.maPhieu} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/20 transition-colors rounded px-1">
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.maPhieu}</p>
                      <p className="text-xs text-muted-foreground">{tb?.tenThietBi} - SL: {r.soLuongYeuCau}</p>
                    </div>
                    <span className={`text-[10px] uppercase px-2 py-1 rounded-full font-bold border ${
                      r.trangThai === 'CHO_DUYET' ? 'bg-warning/10 text-warning border-warning/20' :
                      r.trangThai === 'DA_CAP_PHAT' ? 'bg-success/10 text-success border-success/20' :
                      r.trangThai === 'DA_DUYET' ? 'bg-info/10 text-info border-info/20' :
                      'bg-destructive/10 text-destructive border-destructive/20'
                    }`}>
                      {r.trangThai === 'CHO_DUYET' ? 'Chờ duyệt' : r.trangThai === 'DA_CAP_PHAT' ? 'Đã cấp' : r.trangThai === 'DA_DUYET' ? 'Đã duyệt' : 'Từ chối'}
                    </span>
                  </div>
                );
              })}
              {myRequests.length === 0 && <p className="text-sm text-muted-foreground italic text-center py-4">Chưa có phiếu yêu cầu</p>}
            </CardContent>
          </Card>
        )}

        {user.vaiTro !== 'TRUONG_KHOA' && user.vaiTro !== 'ADMIN' && (
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base text-foreground flex items-center gap-2"><Archive className="w-4 h-4 text-accent" /> Tồn kho thiết bị</CardTitle></CardHeader>
            <CardContent>
              {inventory.slice(0, 5).map(inv => {
                const tb = equipment.find(e => e.maThietBi === inv.maThietBi);
                return (
                  <div key={inv.maTonKho} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-muted/20 transition-colors rounded px-1">
                    <div>
                      <p className="text-sm font-medium text-foreground">{tb?.tenThietBi}</p>
                      <p className="text-xs text-muted-foreground font-mono">{tb?.maThietBi}</p>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-primary font-bold">Kho: {inv.soLuongKho}</span>
                      <span className="text-accent font-medium">Dùng: {inv.soLuongDangDung}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Admin: Tổng quan hoạt động hệ thống */}
        {user.vaiTro === 'ADMIN' && (
          <>
            <Card className="shadow-card md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Yêu cầu cấp phát gần đây (Toàn hệ thống)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium">Mã phiếu</th>
                        <th className="text-left p-3 font-medium">Thiết bị</th>
                        <th className="text-center p-3 font-medium">SL</th>
                        <th className="text-left p-3 font-medium">Ngày tạo</th>
                        <th className="text-right p-3 font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.slice(0, 8).map(r => {
                        const tb = equipment.find(e => e.maThietBi === r.maThietBi);
                        return (
                          <tr key={r.maPhieu} className="border-b hover:bg-muted/30">
                            <td className="p-3 font-mono text-[10px]">{r.maPhieu}</td>
                            <td className="p-3 text-sm font-medium">{tb?.tenThietBi || r.maThietBi}</td>
                            <td className="p-3 text-center font-bold text-primary">{r.soLuongYeuCau}</td>
                            <td className="p-3 text-xs">{new Date(r.ngayTao).toLocaleDateString('vi-VN')}</td>
                            <td className="p-3 text-right">
                              <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${
                                r.trangThai === 'CHO_DUYET' ? 'bg-warning/10 text-warning' :
                                r.trangThai === 'DA_CAP_PHAT' ? 'bg-success/10 text-success' :
                                r.trangThai === 'DA_DUYET' ? 'bg-info/10 text-info' :
                                'bg-destructive/10 text-destructive'
                              }`}>
                                {r.trangThai === 'CHO_DUYET' ? 'Chờ duyệt' : r.trangThai === 'DA_CAP_PHAT' ? 'Đã cấp' : r.trangThai === 'DA_DUYET' ? 'Đã duyệt' : 'Từ chối'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {requests.length === 0 && (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground italic">Chưa có yêu cầu nào.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-accent" /> Phiếu trả thiết bị gần đây (Toàn hệ thống)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium">Mã phiếu trả</th>
                        <th className="text-left p-3 font-medium">Ngày tạo</th>
                        <th className="text-left p-3 font-medium">Thiết bị</th>
                        <th className="text-right p-3 font-medium">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returns.slice(0, 8).map(r => (
                        <tr key={r.maPhieuTra} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-[10px]">{r.maPhieuTra}</td>
                          <td className="p-3 text-xs">{new Date(r.ngayTao).toLocaleDateString('vi-VN')}</td>
                          <td className="p-3 text-xs">
                            {r.chiTiet.slice(0, 2).map((ct, idx) => (
                              <div key={idx}><span className="font-medium">{ct.tenThietBi}</span> x{ct.soLuong}</div>
                            ))}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              r.trangThai === 'DA_TRA' ? 'bg-success/10 text-success' :
                              r.trangThai === 'CHO_XAC_NHAN' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                              {r.trangThai === 'DA_TRA' ? 'Đã nhập kho' : r.trangThai === 'CHO_XAC_NHAN' ? 'Chờ xác nhận' : 'Bị từ chối'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {returns.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-muted-foreground italic">Chưa có phiếu trả nào.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* View Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chi tiết thiết bị</DialogTitle></DialogHeader>
          {viewingEquipment && (
            <div className="space-y-4">
              {viewingEquipment.hinhAnh && (
                <div className="w-full h-48 rounded-lg overflow-hidden bg-muted">
                  <img src={viewingEquipment.hinhAnh} alt={viewingEquipment.tenThietBi} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm bg-muted/30 p-4 rounded-lg">
                <div><span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Mã thiết bị</span> <span className="font-mono font-medium">{viewingEquipment.maThietBi}</span></div>
                <div><span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Tên thiết bị</span> <span className="font-semibold">{viewingEquipment.tenThietBi}</span></div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Phân loại</span> 
                  <span className={`px-2 py-0.5 rounded text-[10px] ${LOAI_THIET_BI_COLORS[viewingEquipment.loaiThietBi || 'TAI_SU_DUNG']}`}>
                    {LOAI_THIET_BI_LABELS[viewingEquipment.loaiThietBi || 'TAI_SU_DUNG']}
                  </span>
                </div>
                <div><span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Đơn vị tính</span> <span>{viewingEquipment.donViCoSo}</span></div>
                
                {viewingEquipment.loaiThietBi === 'TAI_SU_DUNG' && viewingEquipment.serialNumber && (
                  <div className="col-span-2"><span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Serial Number</span> <span className="font-mono bg-muted px-2 py-0.5 rounded">{viewingEquipment.serialNumber}</span></div>
                )}
                
                <div className="col-span-2"><span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Mô tả</span> <span className="text-muted-foreground leading-relaxed">{viewingEquipment.moTa || 'Không có mô tả chi tiết.'}</span></div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setViewDialogOpen(false)} className="gradient-primary text-primary-foreground min-w-[100px]">Đóng</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
