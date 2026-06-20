import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store, generateId } from '@/lib/store';
import { apiCreateDamageReport, apiResolveDamageReport } from '@/lib/apiSync';
import { PhieuBaoHuHong } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Plus, Search, Check, AlertTriangle } from 'lucide-react';

const STATUS_MAP = { CHO_XU_LY: 'Chờ xử lý', DA_XU_LY: 'Đã xử lý' };
const STATUS_COLORS = { CHO_XU_LY: 'bg-warning/10 text-warning', DA_XU_LY: 'bg-success/10 text-success' };

export default function DamageReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(store.getDamageReports());
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const equipment = store.getEquipment();
  const departments = store.getDepartments();
  const users = store.getUsers();

  const canReport = ['NV_BV', 'TRUONG_KHOA', 'NV_KHO', 'ADMIN'].includes(user?.vaiTro || '');
  const canProcess = user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'ADMIN' || user?.vaiTro === 'QL_KHO';

  const [form, setForm] = useState({ maThietBi: '', maKhoa: '', soLuongHu: 1, moTaHuHong: '' });

  const handleCreate = () => {
    if (!form.maThietBi || !form.maKhoa || !form.moTaHuHong) {
      toast({ title: 'Lỗi', description: 'Nhập đầy đủ thông tin', variant: 'destructive' }); return;
    }
    if (form.soLuongHu < 1) {
      toast({ title: 'Lỗi', description: 'Số lượng phải lớn hơn 0', variant: 'destructive' }); return;
    }
    const phieu: PhieuBaoHuHong = {
      maPhieu: generateId('BHH'), maNguoiBao: user!.maNguoiDung,
      maThietBi: form.maThietBi, maKhoa: form.maKhoa,
      soLuongHu: form.soLuongHu, moTaHuHong: form.moTaHuHong,
      trangThai: 'CHO_XU_LY', ngayBao: new Date().toISOString()
    };
    const updated = [...data, phieu];
    store.setDamageReports(updated); setData(updated); setDialogOpen(false);
    // Notify NV_KHO
    const notifs = store.getNotifications();
    const tbName = equipment.find(e => e.maThietBi === form.maThietBi)?.tenThietBi;
    const khoUsers = store.getUsers().filter(u => u.vaiTro === 'NV_KHO' || u.vaiTro === 'ADMIN');
    khoUsers.forEach(k => {
      notifs.push({ id: generateId('TB-N'), tieuDe: 'Báo hư hỏng thiết bị', noiDung: `${tbName} - SL: ${form.soLuongHu} bị hư hỏng tại ${departments.find(d => d.maKhoa === form.maKhoa)?.tenKhoa}`, loai: 'warning', nguoiNhan: k.maNguoiDung, daDoc: false, ngayTao: new Date().toISOString() });
    });
    store.setNotifications(notifs);
    toast({ title: 'Thành công', description: `Đã báo hư hỏng ${phieu.maPhieu}` });
  };

  const handleProcess = (maPhieu: string) => {
    const phieu = data.find(d => d.maPhieu === maPhieu);
    if (!phieu) return;
    const updated = data.map(d => d.maPhieu === maPhieu ? { ...d, trangThai: 'DA_XU_LY' as const, ngayXuLy: new Date().toISOString() } : d);
    store.setDamageReports(updated); setData(updated);
    // Update inventory: move from dangDung to hu
    const inv = store.getInventory();
    const idx = inv.findIndex(i => i.maThietBi === phieu.maThietBi);
    if (idx >= 0) {
      const moveQty = Math.min(phieu.soLuongHu, inv[idx].soLuongDangDung);
      inv[idx].soLuongDangDung -= moveQty;
      inv[idx].soLuongHu += phieu.soLuongHu;
      inv[idx].ngayCapNhat = new Date().toISOString();
      store.setInventory(inv);
    }
    // Notify reporter
    const notifs = store.getNotifications();
    notifs.push({ id: generateId('TB-N'), tieuDe: 'Báo hư hỏng đã xử lý', noiDung: `Phiếu ${maPhieu} đã được xử lý`, loai: 'success', nguoiNhan: phieu.maNguoiBao, daDoc: false, ngayTao: new Date().toISOString() });
    store.setNotifications(notifs);
    toast({ title: 'Đã xử lý báo hư hỏng' });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Tìm phiếu..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        {canReport && <Button onClick={() => { setForm({ maThietBi: '', maKhoa: '', soLuongHu: 1, moTaHuHong: '' }); setDialogOpen(true); }} className="bg-warning text-warning-foreground hover:bg-warning/90"><Plus className="w-4 h-4 mr-2" /> Báo hư hỏng</Button>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="text-left p-3 font-medium text-muted-foreground">Mã phiếu</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Người báo</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Thiết bị</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Khoa</th>
            <th className="text-center p-3 font-medium text-muted-foreground">SL hư</th>
            <th className="text-left p-3 font-medium text-muted-foreground">Mô tả</th>
            <th className="text-center p-3 font-medium text-muted-foreground">Trạng thái</th>
            <th className="text-right p-3 font-medium text-muted-foreground">Thao tác</th>
          </tr></thead>
          <tbody>
            {data.filter(d => d.maPhieu.toLowerCase().includes(search.toLowerCase())).map(d => (
              <tr key={d.maPhieu} className="border-b hover:bg-muted/30">
                <td className="p-3 font-mono text-xs">{d.maPhieu}</td>
                <td className="p-3">{users.find(u => u.maNguoiDung === d.maNguoiBao)?.hoTen}</td>
                <td className="p-3">{equipment.find(e => e.maThietBi === d.maThietBi)?.tenThietBi}</td>
                <td className="p-3">{departments.find(k => k.maKhoa === d.maKhoa)?.tenKhoa}</td>
                <td className="p-3 text-center font-medium text-warning">{d.soLuongHu}</td>
                <td className="p-3 text-sm max-w-[200px] truncate">{d.moTaHuHong}</td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[d.trangThai]}`}>{STATUS_MAP[d.trangThai]}</span></td>
                <td className="p-3 text-right">
                  {canProcess && d.trangThai === 'CHO_XU_LY' && (
                    <Button variant="ghost" size="sm" className="text-success" onClick={() => handleProcess(d.maPhieu)}><Check className="w-3.5 h-3.5 mr-1" /> Xử lý</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Chưa có phiếu báo hư hỏng</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Báo thiết bị hư hỏng</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Thiết bị *</Label>
              <Select value={form.maThietBi} onValueChange={v => setForm(f => ({ ...f, maThietBi: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn thiết bị" /></SelectTrigger>
                <SelectContent>{equipment.filter(e => e.trangThai).map(e => <SelectItem key={e.maThietBi} value={e.maThietBi}>{e.tenThietBi}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Khoa *</Label>
              <Select value={form.maKhoa} onValueChange={v => setForm(f => ({ ...f, maKhoa: v }))}>
                <SelectTrigger><SelectValue placeholder="Chọn khoa" /></SelectTrigger>
                <SelectContent>{departments.filter(k => k.trangThai).map(k => <SelectItem key={k.maKhoa} value={k.maKhoa}>{k.tenKhoa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Số lượng hư hỏng *</Label>
              <Input type="number" min={1} value={form.soLuongHu} onChange={e => {
                const val = parseInt(e.target.value) || 0;
                setForm(f => ({ ...f, soLuongHu: val < 0 ? 0 : val }));
              }} />
            </div>
            <div><Label>Mô tả hư hỏng *</Label><Textarea placeholder="Mô tả tình trạng hư hỏng..." value={form.moTaHuHong} onChange={e => setForm(f => ({ ...f, moTaHuHong: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} className="bg-warning text-warning-foreground hover:bg-warning/90">Báo hư hỏng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
