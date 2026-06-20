import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store, generateId } from '@/lib/store';
import { apiCreateRequest, apiScanRequest, apiProcessRequestItems } from '@/lib/apiSync';
import { PhieuCapPhat, PhieuYeuCauCapPhat } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Check, X, QrCode, Boxes, User, Building2, ClipboardList, ChevronRight, AlertCircle, PackageCheck } from 'lucide-react';
import { refreshData } from '@/lib/dataLoader';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RequestItem {
  maThietBi: string;
  soLuong: number;
}

export default function AllocationsPage() {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Trạng thái Dialog
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Trạng thái Form để tạo yêu cầu
  const [requestForm, setRequestForm] = useState<{
    maKhoa: string;
    lyDo: string;
    items: { maThietBi: string, soLuong: number, donVi: string }[];
  }>({
    maKhoa: user?.maKhoa || '',
    lyDo: '',
    items: [{ maThietBi: '', soLuong: 1, donVi: '' }]
  });

  // Trạng thái để xử lý yêu cầu
  const [scanningId, setScanningId] = useState('');
  const [processingRequest, setProcessingRequest] = useState<any>(null);
  const [processItems, setProcessItems] = useState<{ maThietBi: string; approved: boolean; lyDo: string }[]>([]);
  const [processGhiChu, setProcessGhiChu] = useState('');

  const equipment = store.getEquipment();
  const departments = store.getDepartments();
  const users = store.getUsers();

  const isNV_KHO = user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'ADMIN' || user?.vaiTro === 'QL_KHO';
  const isTRUONG_KHOA = user?.vaiTro === 'TRUONG_KHOA';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await refreshData('allocations');
    await refreshData('requests');
    await refreshData('equipment');
    await refreshData('inventory');
    setAllocations(store.getAllocations());
    setRequests(store.getRequests());
    setLoading(false);
  };

  // Xử lý tạo yêu cầu
  const addRequestItem = () => {
    setRequestForm(prev => ({ ...prev, items: [...prev.items, { maThietBi: '', soLuong: 1, donVi: '' }] }));
  };

  const removeRequestItem = (index: number) => {
    if (requestForm.items.length === 1) return;
    setRequestForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const updateRequestItem = (index: number, field: string, value: any) => {
    const newItems = [...requestForm.items];
    (newItems[index] as any)[field] = value;

    // Tự động điền đơn vị nếu thiết bị thay đổi
    if (field === 'maThietBi') {
      const tb = equipment.find(e => e.maThietBi === value);
      if (tb) (newItems[index] as any).donVi = tb.donViCoSo;
    }

    setRequestForm(prev => ({ ...prev, items: newItems }));
  };

  const handleCreateRequest = async () => {
    if (!requestForm.maKhoa) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn khoa', variant: 'destructive' });
      return;
    }
    const validItems = requestForm.items.filter(i => i.maThietBi && i.soLuong > 0);
    if (validItems.length === 0) {
      toast({ title: 'Lỗi', description: 'Danh sách thiết bị không hợp lệ', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const result = await apiCreateRequest({
        maKhoa: requestForm.maKhoa,
        lyDo: requestForm.lyDo,
        items: validItems,
        maNguoiYeuCau: user?.maNguoiDung
      });

      if (result.success) {
        toast({ title: 'Thành công', description: 'Đã gửi yêu cầu cấp phát. Chờ phê duyệt.' });
        setRequestDialogOpen(false);
        setRequestForm({ maKhoa: user?.maKhoa || '', lyDo: '', items: [{ maThietBi: '', soLuong: 1 }] });
        loadData();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi kết nối', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Xử lý cấp phát yêu cầu
  const startProcessing = async (maPhieu: string) => {
    setLoading(true);
    try {
      const result = await apiScanRequest(maPhieu);
      if (result.success) {
        setProcessingRequest(result.request);
        setProcessItems(result.items.map((i: any) => ({
          maThietBi: i.maThietBi,
          approved: i.tonKho >= i.soLuong,
          lyDo: i.tonKho < i.soLuong ? 'Không đủ tồn kho' : ''
        })));
        setProcessDialogOpen(true);
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: 'Không thể tải chi tiết phiếu', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessFinish = async () => {
    setLoading(true);
    try {
      const result = await apiProcessRequestItems(processingRequest.maPhieu, {
        items: processItems,
        ghiChu: processGhiChu
      });

      if (result.success) {
        toast({ title: 'Thành công', description: result.message });
        setProcessDialogOpen(false);
        setProcessingRequest(null);
        setProcessGhiChu('');
        loadData();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi kết nối', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredAllocations = allocations.filter(a =>
    a.maPhieu.toLowerCase().includes(search.toLowerCase()) ||
    (a.tenThietBi || '').toLowerCase().includes(search.toLowerCase())
  );

  const pendingAllocations = requests.filter(r => r.trangThai === 'DA_DUYET');
  const myRequests = isTRUONG_KHOA ? requests.filter(r => r.maNguoiYeuCau === user?.maNguoiDung) : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm phiếu cấp phát/yêu cầu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 shadow-sm"
          />
        </div>

        {isTRUONG_KHOA && (
          <Button onClick={() => setRequestDialogOpen(true)} className="gradient-primary text-primary-foreground shadow-md hover:scale-105 transition-transform">
            <Plus className="w-4 h-4 mr-2" /> Gửi yêu cầu cấp phát
          </Button>
        )}

        {isNV_KHO && (
          <div className="flex gap-2">
            <Dialog>
              <DialogHeader><DialogTitle className="hidden">Quét QR</DialogTitle></DialogHeader>
              <Button variant="outline" className="border-primary text-primary hover:bg-primary/5 shadow-sm" onClick={() => { }}>
                <QrCode className="w-4 h-4 mr-2" /> Quét mã phiếu
              </Button>
            </Dialog>
          </div>
        )}
      </div>

      <Tabs defaultValue={isNV_KHO ? "allocations" : "my-requests"} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-4">
          {isNV_KHO && <TabsTrigger value="allocations" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Lịch sử cấp phát</TabsTrigger>}
          {isNV_KHO && <TabsTrigger value="pending" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Chờ xử lý {pendingAllocations.length > 0 && <Badge variant="destructive" className="ml-2 h-5 min-w-5 p-0 flex items-center justify-center">{pendingAllocations.length}</Badge>}
          </TabsTrigger>}
          {isTRUONG_KHOA && <TabsTrigger value="my-requests" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">Yêu cầu của tôi</TabsTrigger>}
        </TabsList>

        {/* Nội dung các Tab */}
        {isNV_KHO && (
          <TabsContent value="allocations" className="space-y-4">
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Mã phiếu</th>
                    <th className="text-left p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Thiết bị</th>
                    <th className="text-left p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Người nhận</th>
                    <th className="text-left p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Khoa</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Số lượng</th>
                    <th className="text-right p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Ngày cấp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAllocations.map(d => {
                    const nguoiMuon = users.find(u => u.maNguoiDung === d.maNguoiMuon);
                    const khoa = departments.find(k => k.maKhoa === d.maKhoa);
                    return (
                      <tr key={d.maPhieu} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-mono text-xs text-primary font-bold">{d.maPhieu}</td>
                        <td className="p-4">
                          <div className="font-medium">{(d as any).tenThietBi}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{d.maThietBi}</div>
                        </td>
                        <td className="p-4 text-muted-foreground">{nguoiMuon?.hoTen || '-'}</td>
                        <td className="p-4"><Badge variant="outline" className="font-normal">{khoa?.tenKhoa || '-'}</Badge></td>
                        <td className="p-4 text-center">
                          <div className="font-bold text-lg text-primary">{d.soLuongCapPhat} {d.donViTinh || 'Cái'}</div>
                          {(d.soLuongCoSo && d.soLuongCoSo !== d.soLuongCapPhat) && (
                            <div className="text-[10px] text-muted-foreground italic">= {d.soLuongCoSo} {d.donViCoSo}</div>
                          )}
                        </td>
                        <td className="p-4 text-right text-xs text-muted-foreground">{new Date(d.ngayCapPhat).toLocaleString('vi-VN')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredAllocations.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Không tìm thấy phiếu nào</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {isNV_KHO && (
          <TabsContent value="pending" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingAllocations.map(r => {
                const nguoi = users.find(u => u.maNguoiDung === r.maNguoiYeuCau);
                const khoa = departments.find(k => k.maKhoa === r.maKhoa);
                return (
                  <div key={r.maPhieu} className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 -mr-8 -mt-8 rounded-full group-hover:bg-primary/10 transition-colors" />
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 mb-2">{r.maPhieu}</Badge>
                        <h4 className="font-bold text-lg">Yêu cầu cấp phát</h4>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{new Date(r.ngayTao).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6 text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Người yêu cầu</p>
                          <p className="font-medium">{nguoi?.hoTen}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Đơn vị nhận</p>
                          <p className="font-medium">{khoa?.tenKhoa}</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      className="w-full gradient-primary text-primary-foreground group-hover:scale-[1.02] transition-transform"
                      onClick={() => startProcessing(r.maPhieu)}
                    >
                      <PackageCheck className="w-4 h-4 mr-2" /> Xử lý xuất kho
                    </Button>
                  </div>
                );
              })}
              {pendingAllocations.length === 0 && (
                <div className="col-span-full text-center py-20 text-muted-foreground bg-muted/20 border-2 border-dashed rounded-xl">
                  <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">Tất cả các yêu cầu đã được xử lý xong!</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {isTRUONG_KHOA && (
          <TabsContent value="my-requests" className="space-y-4">
            <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Mã phiếu</th>
                    <th className="text-left p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Nội dung yêu cầu</th>
                    <th className="text-center p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Ngày tạo</th>
                    <th className="text-right p-4 font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {myRequests.map(r => (
                    <tr key={r.maPhieu} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-xs font-bold">{r.maPhieu}</td>
                      <td className="p-4">
                        <div className="font-medium">{r.lyDo || 'Cấp phát thiết bị định kỳ'}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Danh mục: {r.items?.map((item: any) => `${item.tenThietBi} (x${item.soLuong})`).join(', ') || 'Đang tải...'}
                        </div>
                      </td>
                      <td className="p-4 text-center text-xs text-muted-foreground">{new Date(r.ngayTao).toLocaleDateString('vi-VN')}</td>
                      <td className="p-4 text-right">
                        <Badge
                          className={cn(
                            r.trangThai === 'CHO_DUYET' && 'bg-amber-100 text-amber-700 hover:bg-amber-100',
                            r.trangThai === 'DA_DUYET' && 'bg-blue-100 text-blue-700 hover:bg-blue-100',
                            r.trangThai === 'DA_CAP_PHAT' && 'bg-green-100 text-green-700 hover:bg-green-100',
                            r.trangThai === 'TU_CHOI' && 'bg-red-100 text-red-700 hover:bg-red-100',
                          )}
                        >
                          {r.trangThai === 'CHO_DUYET' ? 'Chờ duyệt' :
                            r.trangThai === 'DA_DUYET' ? 'Đã duyệt' :
                              r.trangThai === 'DA_CAP_PHAT' ? 'Đã cấp' : 'Từ chối'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {myRequests.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Bạn chưa gửi yêu cầu nào</p>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog Tạo yêu cầu cấp phát */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <div className="p-6 overflow-y-auto">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Plus className="w-6 h-6 text-primary" /> Lập phiếu yêu cầu cấp phát
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Khoa/Đơn vị yêu cầu</Label>
                  <Select
                    value={requestForm.maKhoa}
                    onValueChange={v => setRequestForm(f => ({ ...f, maKhoa: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Chọn khoa" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(d => (
                        <SelectItem key={d.maKhoa} value={d.maKhoa}>{d.tenKhoa}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Lý do/Mục đích</Label>
                  <Input
                    placeholder="VD: Cần bổ sung vật tư..."
                    value={requestForm.lyDo}
                    onChange={e => setRequestForm(f => ({ ...f, lyDo: e.target.value }))}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Boxes className="w-4 h-4" /> Danh sách thiết bị yêu cầu
                  </Label>
                  <Button variant="outline" size="sm" onClick={addRequestItem} className="h-8 text-primary border-primary/20 hover:bg-primary/5">
                    <Plus className="w-4 h-4 mr-1" /> Thêm dòng
                  </Button>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left p-3 font-medium text-muted-foreground w-1/2">Thiết bị</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Phân loại</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Số lượng</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Đơn vị</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {requestForm.items.map((item, idx) => {
                        const tb = equipment.find(e => e.maThietBi === item.maThietBi);
                        return (
                          <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="p-2">
                              <Select
                                value={item.maThietBi}
                                onValueChange={v => updateRequestItem(idx, 'maThietBi', v)}
                              >
                                <SelectTrigger className="h-9 border-none bg-transparent focus:ring-0">
                                  <SelectValue placeholder="Chọn thiết bị..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {equipment.map(e => (
                                    <SelectItem key={e.maThietBi} value={e.maThietBi}>{e.tenThietBi}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2 text-center text-xs text-muted-foreground">
                              {tb?.loaiThietBi === 'TAI_SU_DUNG' ? 'Tài sử dụng' : tb?.loaiThietBi === 'VAT_TU_TIEU_HAO' ? 'Tiêu hao' : '-'}
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min={1}
                                value={item.soLuong}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  updateRequestItem(idx, 'soLuong', val < 1 ? 1 : val);
                                }}
                                className="h-9 text-center w-16 mx-auto bg-muted/20"
                              />
                            </td>
                            <td className="p-2">
                              <Select
                                value={item.donVi}
                                onValueChange={v => updateRequestItem(idx, 'donVi', v)}
                              >
                                <SelectTrigger className="h-9 border-none bg-transparent focus:ring-0 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {tb && <SelectItem value={tb.donViCoSo}>{tb.donViCoSo}</SelectItem>}
                                  {tb?.donViNhap && tb.donViNhap !== tb.donViCoSo && <SelectItem value={tb.donViNhap}>{tb.donViNhap}</SelectItem>}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRequestItem(idx)}
                                disabled={requestForm.items.length === 1}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-muted/20">
            <Button variant="ghost" onClick={() => setRequestDialogOpen(false)} disabled={loading}>Hủy bỏ</Button>
            <Button
              onClick={handleCreateRequest}
              disabled={loading}
              className="gradient-primary text-primary-foreground min-w-[140px]"
            >
              {loading ? 'Đang gửi...' : 'Gửi yêu cầu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xử lý cấp phát (Duyệt từng thiết bị) */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          {processingRequest && (
            <>
              <div className="p-6 overflow-y-auto">
                <DialogHeader className="mb-6">
                  <div className="flex justify-between items-center w-full">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                      <Check className="w-6 h-6 text-primary" /> Xử lý phiếu {processingRequest.maPhieu}
                    </DialogTitle>
                    <Badge className="bg-muted text-muted-foreground">{departments.find(d => d.maKhoa === processingRequest.maKhoa)?.tenKhoa}</Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mb-4">
                    <h5 className="font-semibold text-primary mb-2 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Thông tin phê duyệt
                    </h5>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                      <p><span className="text-muted-foreground">Người mượn:</span> <span className="font-medium text-foreground">{users.find(u => u.maNguoiDung === processingRequest.maNguoiYeuCau)?.hoTen}</span></p>
                      <p><span className="text-muted-foreground">Lý do:</span> <span className="font-medium text-foreground">{processingRequest.lyDo}</span></p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Cấp phát/Từ chối từng thiết bị</Label>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="text-left p-3 font-medium text-muted-foreground w-2/5">Thiết bị</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Số lượng</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Tồn kho</th>
                            <th className="text-center p-3 font-medium text-muted-foreground w-1/4">Quyết định</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Lý do từ chối</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {processItems.map((item, idx) => {
                            const details = (processingRequest as any).items?.find((i: any) => i.maThietBi === item.maThietBi) ||
                              { tenThietBi: item.maThietBi, soLuong: 0, tonKho: 0 };

                            return (
                              <tr key={idx} className={item.approved ? 'bg-green-50/30' : 'bg-red-50/30'}>
                                <td className="p-3">
                                  <div className="font-medium">{details.tenThietBi}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{item.maThietBi}</div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="font-bold text-base">{details.soLuong} {details.donViTinh}</div>
                                  {details.donViTinh !== details.donViCoSo && (
                                    <div className="text-[10px] text-muted-foreground">= {details.soLuongCoSo} {details.donViCoSo}</div>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <span className={cn(details.tonKho < (details.soLuongCoSo || details.soLuong) ? 'text-destructive font-bold' : 'text-success font-medium')}>
                                    {details.tonKho} {(details.donViCoSo || 'Cái')}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex bg-muted/50 p-0.5 rounded-lg w-fit mx-auto">
                                    <button
                                      onClick={() => {
                                        const newItems = [...processItems];
                                        newItems[idx].approved = true;
                                        setProcessItems(newItems);
                                      }}
                                      className={cn(
                                        "px-3 py-1 text-xs font-bold rounded-md transition-all",
                                        item.approved ? "bg-white text-green-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      Duyệt
                                    </button>
                                    <button
                                      onClick={() => {
                                        const newItems = [...processItems];
                                        newItems[idx].approved = false;
                                        setProcessItems(newItems);
                                      }}
                                      className={cn(
                                        "px-3 py-1 text-xs font-bold rounded-md transition-all",
                                        !item.approved ? "bg-white text-red-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                                      )}
                                    >
                                      Từ chối
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3">
                                  {!item.approved && (
                                    <Input
                                      placeholder="Lý do..."
                                      value={item.lyDo}
                                      onChange={e => {
                                        const newItems = [...processItems];
                                        newItems[idx].lyDo = e.target.value;
                                        setProcessItems(newItems);
                                      }}
                                      className="h-8 text-xs bg-white/50 border-red-200 focus:border-red-400"
                                    />
                                  )}
                                  {item.approved && details.tonKho < details.soLuong && (
                                    <span className="text-[10px] text-destructive flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" /> Quá tồn kho
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Ghi chú chung cho phiếu cấp phát</Label>
                    <Textarea
                      placeholder="Nhập ghi chú (nếu có)..."
                      value={processGhiChu}
                      onChange={e => setProcessGhiChu(e.target.value)}
                      className="min-h-[80px]"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 border-t bg-muted/20">
                <Button variant="ghost" onClick={() => setProcessDialogOpen(false)} disabled={loading}>Đóng</Button>
                <Button
                  onClick={handleProcessFinish}
                  disabled={loading || processItems.some(i => i.approved && (processingRequest as any).items?.find((it: any) => it.maThietBi === i.maThietBi)?.tonKho < ((processingRequest as any).items?.find((it: any) => it.maThietBi === i.maThietBi)?.soLuongCoSo || (processingRequest as any).items?.find((it: any) => it.maThietBi === i.maThietBi)?.soLuong))}
                  className="gradient-primary text-primary-foreground min-w-[140px]"
                >
                  {loading ? 'Đang lưu...' : 'Xác nhận xử lý'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
