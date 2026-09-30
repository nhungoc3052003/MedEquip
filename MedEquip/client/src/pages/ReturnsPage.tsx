import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { PhieuCapPhat, PhieuTraThietBi, TINH_TRANG_TRA_LABELS, TRANG_THAI_TRA_LABELS, TRANG_THAI_PHIEU_TRA_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { fetchApi } from '@/services/api';
import { refreshData } from '@/lib/dataLoader';
import { apiMarkAllAsRead } from '@/lib/apiSync';
import { Plus, Search, QrCode, Check, X, RotateCcw, Camera, Upload, Keyboard, Trash2, Eye, Info, Bell, Download, ImagePlus, FileText, Printer } from 'lucide-react';
import { QRCodeCanvas as QRCodeComponent } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Hàm bỏ dấu tiếng Việt để xuất PDF không bị lỗi font
const removeVietnameseTones = (str: any) => {
  if (!str) return '';
  str = String(str);
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str;
};

// Hàm tính trạng thái và số ngày quá hạn / còn lại của hạn trả
export const getDueStatus = (dateStr?: string | null) => {
  if (!dateStr) return { isOverdue: false, diffDays: 0, text: '', formattedDate: '' };
  const dueDate = new Date(dateStr);
  const formattedDate = dueDate.toLocaleDateString('vi-VN');
  
  const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((todayStart - dueStart) / (1000 * 60 * 60 * 24));
  
  const isOverdue = diffDays > 0;
  let text = '';
  if (diffDays > 0) {
    text = `Quá hạn ${diffDays} ngày`;
  } else if (diffDays === 0) {
    text = 'Đến hạn hôm nay';
  } else {
    text = `Còn ${Math.abs(diffDays)} ngày`;
  }
  
  return { isOverdue, diffDays, text, formattedDate };
};

export default function ReturnsPage() {
  const { user } = useAuth();
  const [data, setData] = useState(store.getReturns() || []);
  const [allocations, setAllocations] = useState(store.getAllocations() || []);
  const departments = store.getDepartments() || [];
  const [search, setSearch] = useState('');
  
  // Extension state
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendingAllocs, setExtendingAllocs] = useState<any[]>([]);
  const [extDate, setExtDate] = useState('');
  const [extReason, setExtReason] = useState('');

  // Due List state
  const [dueDialogOpen, setDueDialogOpen] = useState(false);
  const [selectedDueItems, setSelectedDueItems] = useState<any[]>([]);
  // Overdue alert state for QL_KHO
  const [overdueDialogOpen, setOverdueDialogOpen] = useState(false);
  const [overdueRemindSending, setOverdueRemindSending] = useState(false);
  const [selectedOverdueItems, setSelectedOverdueItems] = useState<any[]>([]);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    ghiChu: string;
    chiTiet: {
      maPhieuCapPhat: string;
      maThietBi: string;
      tenThietBi: string;
      soLuong: number;
      tinhTrangKhiTra: 'NGUYEN_SEAL' | 'DA_BOC_SEAL' | 'HONG';
      anhMinhChung?: string;
    }[];
  }>({ ghiChu: '', chiTiet: [] });

  const [detailOpen, setDetailOpen] = useState(false);
  const [viewingPhieu, setViewingPhieu] = useState<PhieuTraThietBi | null>(null);
  // Luôn dùng dữ liệu mới nhất từ data khi hiển thị modal
  const currentViewingPhieu = viewingPhieu 
    ? ((data || []).find(d => d && d.maPhieuTra === viewingPhieu.maPhieuTra) || viewingPhieu) 
    : null;

  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataStr, setQrDataStr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmingPhieu, setConfirmingPhieu] = useState<PhieuTraThietBi | null>(null);

  // Scanner state
  const [scanOpen, setScanOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [processItems, setProcessItems] = useState<{
    maThietBi: string;
    approved: boolean;
    lyDo: string;
  }[]>([]);
  const [confirmComment, setConfirmComment] = useState('');

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'CHO_TRUONG_KHOA_DUYET':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'CHO_QL_KHO_DUYET':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'CHO_XAC_NHAN':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'DA_TRA':
        return 'bg-success/10 text-success border-success/20';
      case 'TU_CHOI':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'HUY':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  useEffect(() => {
    if (confirmingPhieu) {
      setProcessItems((confirmingPhieu.chiTiet || []).map(ct => ({
        maThietBi: ct.maThietBi,
        approved: ct.trangThai !== 'TU_CHOI',
        lyDo: ''
      })));
      setConfirmComment('');
    } else {
      setProcessItems([]);
      setConfirmComment('');
    }
  }, [confirmingPhieu]);
  const [notifTrigger, setNotifTrigger] = useState(0);

  useEffect(() => {
    const handleNotifChange = () => setNotifTrigger(prev => prev + 1);
    window.addEventListener('store_notifications_changed', handleNotifChange);
    return () => window.removeEventListener('store_notifications_changed', handleNotifChange);
  }, []);

  // Trạng thái thông báo
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = store.getNotifications().filter(n => n.nguoiNhan === user?.maNguoiDung && 
    (n.tieuDe?.toLowerCase()?.includes('trả') || n.noiDung?.toLowerCase()?.includes('trả')));
  const unreadNotifs = notifications.filter(n => !n.daDoc).length;

  const canCreate = user?.vaiTro === 'TRO_LY';
  const canScanQR = user?.vaiTro === 'NV_KHO';
  const canOperateDue = user?.vaiTro === 'TRO_LY';

  const dueAllocations = (allocations || []).filter(a => {
    if (!a) return false;
    const dueDate = a.ngayDuKienTra ? new Date(a.ngayDuKienTra) : null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Đã gia hạn (DA_GIA_HAN) vẫn được coi là mượn (để cảnh báo khi đến hạn mới)
    const isBorrowed = a.trangThaiTra === 'CHUA_TRA' || a.trangThaiTra === 'DA_GIA_HAN';
    const isMine = ((user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && a.maKhoa === user?.maKhoa) || user?.vaiTro === 'ADMIN';

    // Nếu đã có phiếu trả đang chờ duyệt/xác nhận thì không hiện ở đây
    const isInPendingReturn = (data || []).some(ret => 
      ret && ['CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_XAC_NHAN'].includes(ret.trangThai) && 
      Array.isArray(ret.chiTiet) && ret.chiTiet.some((ct: any) => ct && ct.maPhieuCapPhat === a.maPhieu && ct.maThietBi === a.maThietBi)
    );

    // Nếu đang có yêu cầu gia hạn chưa duyệt thì không hiện ở đây
    const hasPendingExtension = requests.some(r => 
      r.maPhieuCapPhatCu === a.maPhieu &&
      ['CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_CAP_PHAT'].includes(r.trangThai) &&
      Array.isArray(r.items) && r.items.some((i: any) => i.maThietBi === a.maThietBi)
    );

    return isBorrowed && isMine && !isInPendingReturn && !hasPendingExtension && dueDate && dueDate <= threeDaysLater;
  });

  // Tất cả thiết bị CHUA_TRA đã quá hạn (không phân biệt khoa) — dành cho QL_KHO
  const overdueAllocations = (allocations || []).filter(a => {
    if (!a) return false;
    const dueDate = a.ngayDuKienTra ? new Date(a.ngayDuKienTra) : null;
    if (!dueDate) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const isBorrowed = a.trangThaiTra === 'CHUA_TRA' || a.trangThaiTra === 'DA_GIA_HAN';
    // Không đang trong phiếu trả hay gia hạn chờ duyệt
    const isInPendingReturn = (data || []).some(ret =>
      ret && ['CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_XAC_NHAN'].includes(ret.trangThai) &&
      Array.isArray(ret.chiTiet) && ret.chiTiet.some((ct: any) => ct && ct.maPhieuCapPhat === a.maPhieu && ct.maThietBi === a.maThietBi)
    );
    const hasPendingExtension = requests.some(r =>
      r.maPhieuCapPhatCu === a.maPhieu &&
      ['CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_CAP_PHAT'].includes(r.trangThai) &&
      Array.isArray(r.items) && r.items.some((i: any) => i.maThietBi === a.maThietBi)
    );
    return isBorrowed && !isInPendingReturn && !hasPendingExtension && dueDate < now;
  });

  const reload = async () => {
    try {
      const endpoint = (user?.vaiTro === 'TRUONG_KHOA' || user?.vaiTro === 'TRO_LY') ? '/returns/my' : '/returns';
      const returnsData = await fetchApi<any[]>(endpoint);
      if (Array.isArray(returnsData)) {
        store.setReturns(returnsData);
        setData(returnsData);
      }

      const resAlloc = await fetchApi<any[]>('/allocations');
      if (Array.isArray(resAlloc)) {
        store.setAllocations(resAlloc);
        setAllocations(resAlloc);
      } else if (resAlloc && (resAlloc as any).success) {
        store.setAllocations((resAlloc as any).data);
        setAllocations((resAlloc as any).data);
      }

      const resReq = await fetchApi<any[]>('/requests');
      if (Array.isArray(resReq)) {
        setRequests(resReq);
      }
      
      await refreshData('inventory');
      if (user?.maNguoiDung) {
        await refreshData('notifications', user.maNguoiDung);
      }
    } catch (err: any) {
      console.error('Reload error:', err);
    }
  };

  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancellingPhieu, setCancellingPhieu] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleReadNotification = async (id: string) => {
    try {
      const result = await fetchApi<any>(`/notifications/${id}/read`, { method: 'PUT' });
      if (result && result.success) {
        const updated = store.getNotifications().map(n => n.id === id ? { ...n, daDoc: true } : n);
        store.setNotifications(updated);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleCreateReturn = async () => {
    if (form.chiTiet.length === 0) { 
      toast({ title: 'Lỗi', description: 'Vui lòng chọn ít nhất một thiết bị để trả.', variant: 'destructive' }); 
      return; 
    }

    const invalid = form.chiTiet.some(ct => ct.soLuong <= 0);
    if (invalid) { 
      toast({ title: 'Lỗi', description: 'Số lượng trả phải lớn hơn 0.', variant: 'destructive' }); 
      return; 
    }

    const isValidMinhChung = form.chiTiet.every(ct => {
      const alloc = (allocations || []).find(a => a && a.maPhieu === ct.maPhieuCapPhat && a.maThietBi === ct.maThietBi);
      const isTuTieuHao = alloc?.loaiThietBi === 'VAT_TU_TIEU_HAO';
      if (isTuTieuHao && ct.tinhTrangKhiTra === 'NGUYEN_SEAL' && !ct.anhMinhChung) {
        return false;
      }
      return true;
    });

    if (!isValidMinhChung) {
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh minh chứng nguyên seal cho vật tư tiêu hao.', variant: 'destructive' });
      return;
    }

    let finalGhiChu = form.ghiChu;
    const minhChungs = form.chiTiet.filter(ct => ct.anhMinhChung).map(ct => ct.tenThietBi);
    if (minhChungs.length > 0) {
      finalGhiChu += `\n[Đã đính kèm ảnh minh chứng nguyên seal cho: ${minhChungs.join(', ')}]`;
    }

    try {
      const result = await fetchApi<{ success: boolean; message: string; maPhieuTra: string }>('/returns/create', {
        method: 'POST',
        body: JSON.stringify({
          ghiChu: finalGhiChu,
          chiTiet: form.chiTiet.map(ct => ({
             maPhieuCapPhat: ct.maPhieuCapPhat,
             maThietBi: ct.maThietBi,
             soLuong: ct.soLuong,
             tinhTrangKhiTra: ct.tinhTrangKhiTra,
             anhMinhChung: ct.anhMinhChung
          }))
        })
      });
      if (result.success) {
        toast({ title: 'Thành công', description: 'Đã tạo Phiếu thông báo trả thiết bị.' });
        setDialogOpen(false);
        setQrDataStr(result.maPhieuTra);
        setQrOpen(true);
        reload();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err?.message || 'Lỗi không xác định', variant: 'destructive' });
    }
  };

  const handleConfirmReturn = async (approved: boolean) => {
    if (!confirmingPhieu) return;
    
    let endpoint = `/returns/${confirmingPhieu.maPhieuTra}/confirm`;
    let successMsg = approved ? 'xác nhận nhập kho' : 'từ chối';
    
    if (confirmingPhieu.trangThai === 'CHO_TRUONG_KHOA_DUYET' && user?.vaiTro === 'TRUONG_KHOA') {
      endpoint = `/returns/${confirmingPhieu.maPhieuTra}/approve-dept`;
      successMsg = approved ? 'Trưởng khoa duyệt' : 'từ chối';
    } else if (confirmingPhieu.trangThai === 'CHO_QL_KHO_DUYET' && user?.vaiTro === 'QL_KHO') {
      endpoint = `/returns/${confirmingPhieu.maPhieuTra}/approve-mgr`;
      successMsg = approved ? 'Quản lý kho duyệt' : 'từ chối';
    }

    try {
      const payload = approved
        ? { approved: true, lyDo: confirmComment, items: processItems, proofImage: user?.vaiTro === 'NV_KHO' ? returnProofImage : undefined }
        : { approved: false, lyDo: confirmComment || 'Từ chối phiếu' };

      const result = await fetchApi<{ success: boolean; message: string }>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (result.success) {
        toast({ title: 'Thành công', description: `Đã ${successMsg} phiếu trả.` });
        setConfirmOpen(false);
        await reload();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err?.message || 'Lỗi không xác định', variant: 'destructive' });
    }
  };

  const handleConsume = async (maPhieu: string, maThietBi: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Xác nhận đã sử dụng/khấu trừ vật tư này? Vật tư sẽ được trừ khỏi danh sách mà không cần tạo phiếu trả.')) return;
    try {
      const result = await fetchApi<{ success: boolean; message: string }>(`/allocations/${maPhieu}/consume`, { 
        method: 'PUT',
        body: JSON.stringify({ maThietBi })
      });
      if (result.success) {
        toast({ title: 'Thành công', description: result.message });
        reload();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleScanQR = (text: string) => {
    if (!text) return;
    const cleanText = text.trim().toUpperCase();
    const phieuData = (data || []).find(d => {
      if (!d) return false;
      const q = d.qrData?.trim()?.toUpperCase();
      const m = d.maPhieuTra?.trim()?.toUpperCase();
      return (q === cleanText) || (m === cleanText);
    });

    if (phieuData) {
      if (!['CHO_XAC_NHAN', 'CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET'].includes(phieuData.trangThai)) {
         toast({ title: 'Cảnh báo', description: 'Phiếu này đã được xử lý (Trạng thái: ' + phieuData.trangThai + ')', variant: 'destructive' });
      } else {
         setConfirmingPhieu(phieuData);
         setReturnProofImage(null); // Reset ảnh chứng minh
         setConfirmOpen(true);
         setScanOpen(false); 
      }
    } else {
      toast({ 
        title: 'Không tìm thấy phiếu', 
        description: `Mã "${cleanText}" không khớp với bất kỳ phiếu trả nào đang chờ xác nhận trong danh sách của bạn.`, 
        variant: 'destructive' 
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!('BarcodeDetector' in window)) {
        toast({ 
          title: 'Trình duyệt không hỗ trợ', 
          description: 'Trình duyệt của bạn không hỗ trợ tự động quét ảnh. Vui lòng nhập mã thủ công.', 
          variant: 'destructive' 
        });
        return;
      }

      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      // @ts-ignore
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const [barcode] = await barcodeDetector.detect(img);

      if (barcode) {
        handleScanQR(barcode.rawValue);
      } else {
        toast({ title: 'Lỗi', description: 'Không tìm thấy mã QR trong ảnh này.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: 'Không thể xử lý ảnh: ' + (err?.message || 'Lỗi không xác định'), variant: 'destructive' });
    }
  };

  const handleDeleteReturn = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phiếu trả này khỏi danh sách của bạn?')) return;
    try {
      const result = await fetchApi<{ success: boolean; message: string }>(`/returns/${id}`, {
        method: 'DELETE'
      });
      if (result.success) {
        toast({ title: 'Đã xóa', description: result.message });
        reload();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const handleCancelReturn = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn hủy yêu cầu trả này? Các thiết bị sẽ quay về trạng thái Đang mượn.')) return;
    try {
      const result = await fetchApi<{ success: boolean; message: string }>(`/returns/${id}/cancel`, {
        method: 'POST'
      });
      if (result.success) {
        toast({ title: 'Đã hủy', description: result.message });
        await reload();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || "Lỗi khi hủy phiếu.", variant: 'destructive' });
    }
  };

  const handleExtendRequest = async () => {
    if (extendingAllocs.length === 0 || !extDate || !extReason) {
      toast({ title: 'Lỗi', description: 'Vui lòng nhập đầy đủ thông tin.', variant: 'destructive' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newExtDate = new Date(extDate);
    newExtDate.setHours(0, 0, 0, 0);

    if (newExtDate <= today) {
      toast({ title: 'Lỗi', description: 'Ngày gia hạn phải sau ngày yêu cầu (ngày hiện tại).', variant: 'destructive' });
      return;
    }

    const invalidDates = extendingAllocs.some(alloc => {
      if (alloc.ngayDuKienTra) {
        const oldDate = new Date(alloc.ngayDuKienTra);
        oldDate.setHours(0, 0, 0, 0);
        return newExtDate <= oldDate;
      }
      return false;
    });

    if (invalidDates) {
      toast({ title: 'Lỗi', description: 'Ngày gia hạn không được trùng hoặc trước ngày trả hiện tại của thiết bị.', variant: 'destructive' });
      return;
    }

    try {
      const grouped = extendingAllocs.reduce((acc, curr) => {
        if (!acc[curr.maPhieu]) acc[curr.maPhieu] = [];
        acc[curr.maPhieu].push(curr);
        return acc;
      }, {} as Record<string, any[]>);

      const promises = Object.entries(grouped).map(([maPhieu, items]) => {
        return fetchApi<{ success: boolean; message: string }>('/requests', {
          method: 'POST',
          body: JSON.stringify({ 
            maNguoiYeuCau: user?.maNguoiDung,
            maKhoa: user?.maKhoa,
            lyDo: `[GIA HẠN THIẾT BỊ] Phiếu mượn: ${maPhieu}. Lý do: ${extReason}`,
            maPhieuCapPhatCu: maPhieu, // Gắn ID phiếu cũ để NV Kho duyệt gia hạn
            items: items.map(it => ({
              maThietBi: it.maThietBi,
              soLuong: it.soLuongCapPhat,
              donVi: it.donViTinh,
              ngayTraDuKien: extDate
            }))
          })
        });
      });

      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.success);

      if (allSuccess) {
        toast({ title: 'Thành công', description: 'Yêu cầu gia hạn đã được gửi tới NV Kho dưới dạng phiếu Yêu cầu cấp phát.' });
        setExtendOpen(false);
        setExtendingAllocs([]);
        setExtDate('');
        setExtReason('');
        setSelectedDueItems([]);
        await reload();
      } else {
        toast({ title: 'Lỗi', description: 'Có lỗi xảy ra khi gửi một số yêu cầu gia hạn.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err?.message || 'Lỗi khi gửi yêu cầu gia hạn.', variant: 'destructive' });
    }
  };

  const toggleAllocationSelection = (alloc: PhieuCapPhat) => {
    setForm(prev => {
      const exists = prev.chiTiet.find(ct => ct.maPhieuCapPhat === alloc.maPhieu && ct.maThietBi === alloc.maThietBi);
      if (exists) {
        return { ...prev, chiTiet: prev.chiTiet.filter(ct => !(ct.maPhieuCapPhat === alloc.maPhieu && ct.maThietBi === alloc.maThietBi)) };
      } else {
        return {
          ...prev,
          chiTiet: [...prev.chiTiet, {
            maPhieuCapPhat: alloc.maPhieu,
            maThietBi: alloc.maThietBi,
            tenThietBi: alloc.tenThietBi || alloc.maThietBi,
            soLuong: alloc.soLuongCapPhat,
            tinhTrangKhiTra: alloc.loaiThietBi === 'VAT_TU_TIEU_HAO' ? 'NGUYEN_SEAL' : 'DA_BOC_SEAL',
            anhMinhChung: undefined
          }]
        };
      }
    });
  };

  const filtered = (data || []).filter(d => {
    if (!d) return false;
    const s = search.toLowerCase();
    return (
      (d.maPhieuTra?.toLowerCase()?.includes(s)) ||
      (d.tenTruongKhoa?.toLowerCase()?.includes(s)) ||
      (d.chiTiet?.some((ct: any) => ct.maPhieuCapPhat?.toLowerCase()?.includes(s)))
    );
  });

  const pendingAllocations = (allocations || []).filter(a => {
    if (!a) return false;
    const isBorrowed = (a.trangThaiTra === 'CHUA_TRA' || a.trangThaiTra === 'DA_GIA_HAN');
    const isMine = ((user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && a.maKhoa === user?.maKhoa) || user?.vaiTro === 'ADMIN';
    
    // ĐÃ TRẢ: Không hiển thị nếu đã có phiếu trả đang chờ duyệt/xác nhận
    const isInPendingReturn = (data || []).some(ret => 
      ret && ['CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_XAC_NHAN'].includes(ret.trangThai) && 
      Array.isArray(ret.chiTiet) && ret.chiTiet.some((ct: any) => ct && ct.maPhieuCapPhat === a.maPhieu && ct.maThietBi === a.maThietBi)
    );
    
    return isBorrowed && isMine && !isInPendingReturn;
  });

  const activeReturns = filtered.filter(d => 
    (user?.vaiTro === 'NV_KHO' ? d.trangThai === 'CHO_XAC_NHAN' : false) ||
    (user?.vaiTro === 'QL_KHO' ? d.trangThai === 'CHO_QL_KHO_DUYET' : false) ||
    (user?.vaiTro === 'TRUONG_KHOA' || user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'ADMIN' ? ['CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_XAC_NHAN'].includes(d.trangThai) : false)
  );
  
  const historyReturns = filtered.filter(d => !activeReturns.some(ar => ar.maPhieuTra === d.maPhieuTra));

  // Grouping by Ma Phieu for better UI
  const groupedAllocations = pendingAllocations.reduce((acc, curr) => {
    if (!curr || !curr.maPhieu) return acc;
    if (!acc[curr.maPhieu]) acc[curr.maPhieu] = [];
    acc[curr.maPhieu].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  // Trạng thái chọn hàng để xuất PDF
  const [selectedReturnIds, setSelectedReturnIds] = useState<string[]>([]);

  // Trạng thái Biểu mẫu xem trước & in phiếu trả
  const [previewReturn, setPreviewReturn] = useState<PhieuTraThietBi | null>(null);
  const [returnPreviewOpen, setReturnPreviewOpen] = useState(false);

  // Trạng thái ảnh chứng minh cho NV Kho khi nhập kho
  const [returnProofImage, setReturnProofImage] = useState<string | null>(null);

  const getDeptNameForReturn = (r: PhieuTraThietBi) => {
    const users = store.getUsers();
    const departments = store.getDepartments();
    const u = users.find(usr => usr.hoTen === r.tenTruongKhoa || usr.maNguoiDung === r.maTruongKhoa);
    if (u?.maKhoa) {
      const d = departments.find(k => k.maKhoa === u.maKhoa);
      if (d) return d.tenKhoa;
    }
    const firstItem = r.chiTiet?.[0];
    if (firstItem?.maPhieuCapPhat) {
      const alloc = (allocations || []).find(a => a && a.maPhieu === firstItem.maPhieuCapPhat);
      if (alloc?.maKhoa) {
        const d = departments.find(k => k.maKhoa === alloc.maKhoa);
        if (d) return d.tenKhoa;
      }
    }
    return user?.maKhoa ? (departments.find(k => k.maKhoa === user.maKhoa)?.tenKhoa || user.maKhoa) : 'Khoa điều trị';
  };

  const handlePrintForm = (elementId: string, title: string) => {
    const printContent = document.getElementById(elementId);
    if (!printContent) return;
    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: 13pt;
              line-height: 1.4;
              color: #000;
              margin: 0;
              padding: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px 8px;
              text-align: left;
              font-size: 11pt;
            }
            th {
              background-color: #f0f0f0;
              text-align: center;
              font-weight: bold;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .italic { font-style: italic; }
            .uppercase { text-transform: uppercase; }
            .header-grid {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
            }
            .title-area {
              text-align: center;
              margin: 18px 0;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 30px;
              page-break-inside: avoid;
            }
            .sig-box {
              text-align: center;
              width: 32%;
            }
            .sig-space {
              height: 70px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const exportSingleReturnPDF = (r: PhieuTraThietBi) => {
    if (!r) return;
    try {
      const doc = new jsPDF();
      const tenKhoa = getDeptNameForReturn(r);
      const tenNguoiTra = r.tenTruongKhoa || user?.hoTen || 'Người trả';
      const returnDate = r.ngayTao ? new Date(r.ngayTao).toLocaleString('vi-VN') : '---';

      doc.setFontSize(10);
      doc.text(removeVietnameseTones('BO Y TE - BENH VIEN MEDEQUIP'), 14, 15);
      doc.text(removeVietnameseTones(`Khoa/Phong: ${tenKhoa}`), 14, 21);
      doc.text(removeVietnameseTones(`Ma phieu tra: ${r.maPhieuTra}`), 14, 27);

      doc.text(removeVietnameseTones('CONG HOA XA HOI CHU NGHIA VIET NAM'), 196, 15, { align: 'right' });
      doc.text(removeVietnameseTones('Doc lap - Tu do - Hanh phuc'), 196, 21, { align: 'right' });
      doc.line(135, 23, 196, 23);

      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text(removeVietnameseTones('PHIEU HOAN TRA THIET BI Y TE'), 105, 38, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(removeVietnameseTones('(Bien ban ban giao va hoan tra thiet bi ve kho)'), 105, 44, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(removeVietnameseTones(`Khoa hoan tra: ${tenKhoa}`), 14, 54);
      doc.text(removeVietnameseTones(`Nguoi lap phieu: ${tenNguoiTra}`), 14, 61);
      doc.text(removeVietnameseTones(`Ngay tra thiet bi: ${returnDate}`), 14, 68);
      doc.text(removeVietnameseTones(`Trang thai: ${TRANG_THAI_PHIEU_TRA_LABELS[r.trangThai] || r.trangThai}`), 14, 75);
      doc.text(removeVietnameseTones(`Ghi chu: ${r.ghiChu || 'Hoan tra theo quy dinh'}`), 14, 82);

      const tableColumn = ["STT", "Ma TB", "Ten Thiet Bi Y Te", "Ma CP", "SL Tra", "DVT", "Tinh Trang"].map(removeVietnameseTones);
      const tableRows: any[] = [];

      if (r.chiTiet && r.chiTiet.length > 0) {
        r.chiTiet.forEach((item: any, i: number) => {
          tableRows.push([
            (i + 1).toString(),
            item.maThietBi,
            removeVietnameseTones(item.tenThietBi || item.maThietBi),
            item.maPhieuCapPhat || '---',
            item.soLuongCoSo ? item.soLuongCoSo.toString() : (item.soLuong?.toString() || '1'),
            removeVietnameseTones(item.donViTinh || item.donViCoSo || 'Cai'),
            removeVietnameseTones(TINH_TRANG_TRA_LABELS[item.tinhTrangKhiTra as keyof typeof TINH_TRANG_TRA_LABELS] || item.tinhTrangKhiTra || '')
          ]);
        });
      }

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 88,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [39, 174, 96], textColor: 255, halign: 'center' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 24 },
          2: { cellWidth: 55 },
          3: { halign: 'center', cellWidth: 26 },
          4: { halign: 'center', cellWidth: 18 },
          5: { halign: 'center', cellWidth: 18 },
          6: { cellWidth: 'auto' }
        }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 14;
      const dateFormatted = new Date(r.ngayTao);
      const day = dateFormatted.getDate();
      const month = dateFormatted.getMonth() + 1;
      const year = dateFormatted.getFullYear();

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(removeVietnameseTones(`Ngay ${day} thang ${month} nam ${year}`), 196, finalY, { align: 'right' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(removeVietnameseTones('NGUOI TRA THIET BI'), 35, finalY + 8, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 35, finalY + 13, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(removeVietnameseTones('TRUONG KHOA XAC NHAN'), 105, finalY + 8, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 105, finalY + 13, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(removeVietnameseTones('KHO TIEP NHAN'), 175, finalY + 8, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 175, finalY + 13, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(removeVietnameseTones(tenNguoiTra), 35, finalY + 36, { align: 'center' });

      doc.save(`bieu_mau_tra_${r.maPhieuTra}.pdf`);
      toast({ title: 'Thành công', description: `Đã xuất PDF biểu mẫu phiếu trả ${r.maPhieuTra}` });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Lỗi', description: `Không thể xuất PDF: ${err.message}`, variant: 'destructive' });
    }
  };

  const handleExportPDF = () => {
    try {
      const allData = [...activeReturns, ...historyReturns];
      const toExport = allData.filter(d => selectedReturnIds.includes(d.maPhieuTra));
      if (toExport.length === 0) {
        toast({ title: 'Chưa chọn', description: 'Vui lòng tick chọn ít nhất 1 phiếu để xuất.', variant: 'destructive' });
        return;
      }
      const doc = new jsPDF();
      
      toExport.forEach((r, index) => {
        if (index > 0) doc.addPage();
        
        const tenKhoa = getDeptNameForReturn(r);
        const tenNguoiTra = r.tenTruongKhoa || user?.hoTen || 'Người trả';
        const returnDate = r.ngayTao ? new Date(r.ngayTao).toLocaleString('vi-VN') : '---';

        doc.setFontSize(10);
        doc.text(removeVietnameseTones('BO Y TE - BENH VIEN MEDEQUIP'), 14, 15);
        doc.text(removeVietnameseTones(`Khoa/Phong: ${tenKhoa}`), 14, 21);
        doc.text(removeVietnameseTones(`Ma phieu tra: ${r.maPhieuTra}`), 14, 27);

        doc.text(removeVietnameseTones('CONG HOA XA HOI CHU NGHIA VIET NAM'), 196, 15, { align: 'right' });
        doc.text(removeVietnameseTones('Doc lap - Tu do - Hanh phuc'), 196, 21, { align: 'right' });
        doc.line(135, 23, 196, 23);

        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(removeVietnameseTones('PHIEU HOAN TRA THIET BI Y TE'), 105, 38, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(removeVietnameseTones(`Khoa hoan tra: ${tenKhoa}`), 14, 52);
        doc.text(removeVietnameseTones(`Nguoi lap: ${tenNguoiTra}`), 14, 59);
        doc.text(removeVietnameseTones(`Ngay tra: ${returnDate}`), 14, 66);
        doc.text(removeVietnameseTones(`Ghi chu: ${r.ghiChu || '---'}`), 14, 73);

        const tableColumn = ["STT", "Ma TB", "Ten Thiet Bi Y Te", "Ma CP", "SL Tra", "DVT", "Tinh Trang"].map(removeVietnameseTones);
        const tableRows: any[] = [];
        
        if (r.chiTiet && r.chiTiet.length > 0) {
          r.chiTiet.forEach((item: any, i: number) => {
            tableRows.push([
              (i + 1).toString(),
              item.maThietBi,
              removeVietnameseTones(item.tenThietBi || item.maThietBi),
              item.maPhieuCapPhat || '---',
              item.soLuongCoSo ? item.soLuongCoSo.toString() : (item.soLuong?.toString() || '1'),
              removeVietnameseTones(item.donViTinh || item.donViCoSo || 'Cai'),
              removeVietnameseTones(TINH_TRANG_TRA_LABELS[item.tinhTrangKhiTra as keyof typeof TINH_TRANG_TRA_LABELS] || item.tinhTrangKhiTra || '')
            ]);
          });
        }

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 80,
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [39, 174, 96], textColor: 255, halign: 'center' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'center', cellWidth: 24 },
            2: { cellWidth: 55 },
            3: { halign: 'center', cellWidth: 26 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'center', cellWidth: 18 },
            6: { cellWidth: 'auto' }
          }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 14;
        const dateFormatted = new Date(r.ngayTao);
        const day = dateFormatted.getDate();
        const month = dateFormatted.getMonth() + 1;
        const year = dateFormatted.getFullYear();

        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text(removeVietnameseTones(`Ngay ${day} thang ${month} nam ${year}`), 196, finalY, { align: 'right' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(removeVietnameseTones('NGUOI TRA THIET BI'), 35, finalY + 8, { align: 'center' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 35, finalY + 13, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(removeVietnameseTones('TRUONG KHOA XAC NHAN'), 105, finalY + 8, { align: 'center' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 105, finalY + 13, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(removeVietnameseTones('KHO TIEP NHAN'), 175, finalY + 8, { align: 'center' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 175, finalY + 13, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(removeVietnameseTones(tenNguoiTra), 35, finalY + 36, { align: 'center' });
      });

      doc.save('bieu_mau_tra_thiet_bi.pdf');
      toast({ title: 'Thành công', description: `Đã xuất PDF biểu mẫu cho ${toExport.length} phiếu.` });
      setSelectedReturnIds([]);
    } catch (err: any) {
      console.error("Lỗi khi xuất PDF:", err);
      toast({ title: 'Lỗi', description: `Không thể xuất PDF: ${err.message}`, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-primary" /> Quản lý Trả thiết bị
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Trưởng khoa khai báo trả thiết bị, NV Kho quét mã hoặc xác nhận để tăng Tồn kho.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Nút thông báo */}
          <Button onClick={() => setNotifOpen(true)} variant="outline" className="relative shadow-sm h-10 w-10 p-0 border-muted-foreground/20">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                {unreadNotifs}
              </span>
            )}
          </Button>

          {/* Nút Xuất PDF */}
          {(user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && (
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className={cn("border-indigo-200 text-indigo-600 hover:bg-indigo-50", selectedReturnIds.length === 0 && "opacity-50")}
            >
              <Download className="w-4 h-4 mr-2" /> Xuất Biểu Mẫu PDF {selectedReturnIds.length > 0 && `(${selectedReturnIds.length})`}
            </Button>
          )}
          
          {canScanQR && (
            <Button onClick={() => setScanOpen(true)} className="bg-foreground text-background hover:bg-foreground/80">
              <Camera className="w-4 h-4 mr-2" /> Quét QR Nhập kho
            </Button>
          )}
          {(user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && (
            <Button 
              variant="outline" 
              onClick={() => setDueDialogOpen(true)}
              className="relative border-destructive/30 text-destructive hover:bg-destructive/5"
            >
              <Info className="w-4 h-4 mr-2" /> Thiết bị đến hạn
              {dueAllocations.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse">
                  {dueAllocations.length}
                </span>
              )}
            </Button>
          )}
          {/* Nút cảnh báo quá hạn cho QL_KHO */}
          {(user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'ADMIN') && (
            <Button
              variant="outline"
              onClick={() => { setSelectedOverdueItems([]); setOverdueDialogOpen(true); }}
              className="relative border-destructive/50 text-destructive hover:bg-destructive/5"
            >
              <Info className="w-4 h-4 mr-2" /> Thiết bị quá hạn
              {overdueAllocations.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm animate-pulse">
                  {overdueAllocations.length}
                </span>
              )}
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => {
              setForm({ ghiChu: '', chiTiet: [] });
              setDialogOpen(true);
            }} className="gradient-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Khai báo Trả thiết bị
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="grid grid-cols-2 w-[400px]">
            <TabsTrigger value="active" className="relative">
              Phiếu đang xử lý
              {activeReturns.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                  {activeReturns.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Lịch sử trả thiết bị</TabsTrigger>
          </TabsList>
          
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Tìm mã phiếu..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-9" />
          </div>
        </div>

        <TabsContent value="active" className="mt-0 space-y-4">
          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {(user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && (
                      <th className="p-3 w-10 text-center">
                        <Checkbox
                          checked={activeReturns.length > 0 && activeReturns.every(d => selectedReturnIds.includes(d.maPhieuTra))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const newIds = new Set(selectedReturnIds);
                              activeReturns.forEach(d => newIds.add(d.maPhieuTra));
                              setSelectedReturnIds(Array.from(newIds));
                            } else {
                              setSelectedReturnIds(selectedReturnIds.filter(id => !activeReturns.some(d => d.maPhieuTra === id)));
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className="text-left p-3 font-medium text-muted-foreground">Mã Phiếu Trả</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Người Trả</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Ngày Trả</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Số lượng mục</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Trạng thái</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReturns.map(d => {
                    if (!d) return null;
                    const isSelected = selectedReturnIds.includes(d.maPhieuTra);
                    return (
                      <tr key={d.maPhieuTra} className={cn("border-b hover:bg-muted/30 cursor-pointer group", isSelected && "bg-indigo-50/50")} onClick={() => { setViewingPhieu(d); setDetailOpen(true); }}>
                        {(user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && (
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedReturnIds([...selectedReturnIds, d.maPhieuTra]);
                                else setSelectedReturnIds(selectedReturnIds.filter(id => id !== d.maPhieuTra));
                              }}
                            />
                          </td>
                        )}
                        <td className="p-3 font-mono text-xs font-bold group-hover:text-primary transition-colors">{d.maPhieuTra}</td>
                        <td className="p-3 font-medium">{d.tenTruongKhoa}</td>
                        <td className="p-3 text-xs text-muted-foreground">{d.ngayTao ? new Date(d.ngayTao).toLocaleString('vi-VN') : '---'}</td>
                        <td className="p-3 font-medium">{(d.chiTiet?.length || 0)} thiết bị</td>
                        <td className="p-3 text-center">
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase border", getStatusBadgeStyle(d.trangThai))}>
                            {TRANG_THAI_PHIEU_TRA_LABELS[d.trangThai] || 'ĐANG XỬ LÝ'}
                          </span>
                        </td>
                        <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewReturn(d);
                                setReturnPreviewOpen(true);
                              }}
                              title="Xem biểu mẫu phiếu trả"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Biểu mẫu</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setQrDataStr(d.maPhieuTra); setQrOpen(true); }} title="Mã QR">
                              <QrCode className="w-4 h-4 text-primary" />
                            </Button>
                            {((user?.vaiTro === 'TRUONG_KHOA' && d.trangThai === 'CHO_TRUONG_KHOA_DUYET') ||
                              (user?.vaiTro === 'QL_KHO' && d.trangThai === 'CHO_QL_KHO_DUYET') ||
                              (user?.vaiTro === 'NV_KHO' && d.trangThai === 'CHO_XAC_NHAN')) && (
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:bg-success/10" onClick={() => { setConfirmingPhieu(d); setReturnProofImage(null); setConfirmOpen(true); }} title="Xử lý / Duyệt">
                                 <Check className="w-4 h-4" />
                               </Button>
                            )}
                            {user?.vaiTro === 'TRO_LY' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-8 w-8 text-orange-500 hover:bg-orange-50", (new Date().getTime() - new Date(d.ngayTao).getTime()) / 60000 > 30 ? "opacity-30 cursor-not-allowed" : "")}
                                onClick={(e) => { 
                                  if ((new Date().getTime() - new Date(d.ngayTao).getTime()) / 60000 > 30) {
                                    e.preventDefault();
                                    toast({ title: 'Hết hạn', description: 'Đã quá 30 phút, không thể hủy.', variant: 'destructive' });
                                    return;
                                  }
                                  setCancellingPhieu(d); 
                                  setCancelConfirmOpen(true); 
                                }} 
                                title={(new Date().getTime() - new Date(d.ngayTao).getTime()) / 60000 > 30 ? "Đã quá hạn hủy" : "Hủy/Gia hạn"}
                              >
                                <RotateCcw className="w-4 h-4" />
                              </Button>
                            )}
                            {user?.vaiTro === 'QL_KHO' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteReturn(d.maPhieuTra)} title="Xóa">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {activeReturns.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground bg-muted/5">Không có phiếu đang chờ xử lý.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-4">
          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {(user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && (
                      <th className="p-3 w-10 text-center">
                        <Checkbox
                          checked={historyReturns.length > 0 && historyReturns.every(d => selectedReturnIds.includes(d.maPhieuTra))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const newIds = new Set(selectedReturnIds);
                              historyReturns.forEach(d => newIds.add(d.maPhieuTra));
                              setSelectedReturnIds(Array.from(newIds));
                            } else {
                              setSelectedReturnIds(selectedReturnIds.filter(id => !historyReturns.some(d => d.maPhieuTra === id)));
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className="text-left p-3 font-medium text-muted-foreground">Mã Trả</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Ngày Trả</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Ngày mượn</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Danh mục</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Trạng thái</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {historyReturns.map(d => {
                    if (!d) return null;
                    const isSelectedHist = selectedReturnIds.includes(d.maPhieuTra);
                    return (
                      <tr key={d.maPhieuTra} className={cn("border-b hover:bg-muted/30 cursor-pointer", isSelectedHist && "bg-indigo-50/50")} onClick={() => { setViewingPhieu(d); setDetailOpen(true); }}>
                        {(user?.vaiTro === 'NV_KHO' || user?.vaiTro === 'TRO_LY' || user?.vaiTro === 'TRUONG_KHOA') && (
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelectedHist}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedReturnIds([...selectedReturnIds, d.maPhieuTra]);
                                else setSelectedReturnIds(selectedReturnIds.filter(id => id !== d.maPhieuTra));
                              }}
                            />
                          </td>
                        )}
                        <td className="p-3 font-mono text-xs font-bold">{d.maPhieuTra}</td>
                        <td className="p-3 text-xs text-muted-foreground">{d.ngayTao ? new Date(d.ngayTao).toLocaleString('vi-VN') : '---'}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {(() => {
                             const firstItem = d.chiTiet?.[0];
                             if (!firstItem) return '---';
                             const alloc = (allocations || []).find(a => a && a.maPhieu === firstItem.maPhieuCapPhat && a.maThietBi === firstItem.maThietBi);
                             return alloc?.ngayCapPhat ? new Date(alloc.ngayCapPhat).toLocaleDateString('vi-VN') : '---';
                          })()}
                        </td>
                        <td className="p-3">
                          <div className="font-medium truncate max-w-[150px]">
                            {d.chiTiet?.[0]?.tenThietBi} {(d.chiTiet?.length || 0) > 1 ? `và ${d.chiTiet.length - 1} TB khác...` : ''}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase border", getStatusBadgeStyle(d.trangThai))}>
                            {TRANG_THAI_PHIEU_TRA_LABELS[d.trangThai] || d.trangThai}
                          </span>
                        </td>
                        <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewReturn(d);
                                setReturnPreviewOpen(true);
                              }}
                              title="Xem biểu mẫu phiếu trả"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Biểu mẫu</span>
                            </Button>
                            {user?.vaiTro === 'QL_KHO' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteReturn(d.maPhieuTra)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {historyReturns.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground bg-muted/5">Lịch sử trống.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Lập phiếu Trả Thiết bị</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div>
              <Label className="mb-2 block">Chọn thiết bị mượn (Gồm cả thiết bị được gia hạn) *</Label>
              <div className="border rounded-lg divide-y max-h-80 overflow-y-auto bg-muted/20">
                {Object.keys(groupedAllocations).length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">Không có thiết bị nào đang mượn.</div>
                ) : (
                  Object.entries(groupedAllocations).map(([maPhieu, items]) => (
                    <div key={maPhieu} className="p-1">
                      <div className="px-3 py-1.5 bg-muted font-bold text-[11px] text-muted-foreground uppercase flex justify-between items-center">
                         <span>Mã CP: {maPhieu}</span>
                         <span className={cn("text-[10px] font-medium italic", 
                            items?.[0]?.loaiThietBi === 'VAT_TU_TIEU_HAO' ? "text-orange-600" : 
                            (getDueStatus(items?.[0]?.ngayDuKienTra).isOverdue ? "text-destructive" : "text-muted-foreground")
                          )}>
                            {items?.[0]?.loaiThietBi === 'VAT_TU_TIEU_HAO' 
                              ? 'Vật tư tiêu hao (Không trả, trừ khi lĩnh nhầm)' 
                              : (items?.[0]?.ngayDuKienTra 
                                  ? `Hạn trả: ${getDueStatus(items[0].ngayDuKienTra).formattedDate}${getDueStatus(items[0].ngayDuKienTra).isOverdue ? ` (${getDueStatus(items[0].ngayDuKienTra).text})` : ''}` 
                                  : 'Hạn trả: Không có hạn')}
                          </span>
                      </div>
                      {items.map(alloc => {
                        if (!alloc) return null;
                        const key = `${alloc.maPhieu}-${alloc.maThietBi}`;
                        return (
                          <div key={key} className="flex items-center p-3 gap-3 hover:bg-white/50 transition-colors">
                            <Checkbox 
                              id={`check-${key}`}
                              checked={form.chiTiet.some(ct => ct && ct.maPhieuCapPhat === alloc.maPhieu && ct.maThietBi === alloc.maThietBi)}
                              onCheckedChange={() => toggleAllocationSelection(alloc)}
                            />
                            <label htmlFor={`check-${key}`} className="flex-1 cursor-pointer">
                              <div className="text-sm font-medium">{alloc.tenThietBi}</div>
                              <div className="flex justify-between items-center w-full">
                                <div className="text-[10px] text-muted-foreground flex gap-3">
                                  <span className="font-bold text-primary">Mượn: {alloc.soLuongCapPhat} {alloc.donViTinh}</span>
                                  {alloc.soLuongCoSo !== alloc.soLuongCapPhat && (
                                    <span className="italic">(= {alloc.soLuongCoSo} {alloc.donViCoSo})</span>
                                  )}
                                </div>
                                <div className={cn("text-[10px] font-bold", 
                                  alloc.loaiThietBi === 'VAT_TU_TIEU_HAO' ? "text-orange-500" : 
                                  (getDueStatus(alloc.ngayDuKienTra).isOverdue ? "text-destructive" : "text-muted-foreground")
                                )}>
                                  {alloc.loaiThietBi === 'VAT_TU_TIEU_HAO' 
                                    ? 'Vật tư tiêu hao' 
                                    : (alloc.ngayDuKienTra 
                                        ? `${getDueStatus(alloc.ngayDuKienTra).formattedDate}${getDueStatus(alloc.ngayDuKienTra).isOverdue ? ` (${getDueStatus(alloc.ngayDuKienTra).text})` : ''}` 
                                        : '')}
                                </div>
                              </div>
                            </label>
                            {alloc.loaiThietBi === 'VAT_TU_TIEU_HAO' && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-[10px] text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:text-orange-700 pointer-events-auto"
                                onClick={(e) => handleConsume(alloc.maPhieu, alloc.maThietBi, e)}
                              >
                                Báo dùng
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {form.chiTiet.length > 0 && (
              <div className="space-y-4">
                <Label>Chi tiết trạng thái & số lượng trả</Label>
                <div className="space-y-3">
                  {form.chiTiet.map((ct, idx) => (
                    <div key={ct.maPhieuCapPhat} className="bg-card p-3 rounded-lg border shadow-sm flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="flex-1 min-w-[150px]">
                        <div className="text-sm font-semibold text-primary">{ct.tenThietBi}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Mã CP: {ct.maPhieuCapPhat} • Đơn vị trả: {allocations.find(a => a && a.maPhieu === ct.maPhieuCapPhat)?.donViTinh || '---'}
                        </div>
                      </div>
                      
                      <div className="w-full sm:w-24">
                        <Label className="text-[10px] mb-1 block">Số lượng</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          max={allocations.find(a => a && a.maPhieu === ct.maPhieuCapPhat && a.maThietBi === ct.maThietBi)?.soLuongCapPhat || 9999}
                          value={ct.soLuong}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setForm(prev => ({
                              ...prev,
                              chiTiet: prev.chiTiet.map((it, i) => i === idx ? { ...it, soLuong: val } : it)
                            }));
                          }}
                          className="h-8 text-sm"
                        />
                      </div>

                      <div className="flex-1 w-full">
                        <Label className="text-[10px] mb-1 block">Tình trạng</Label>
                        <Select 
                          value={ct.tinhTrangKhiTra} 
                          onValueChange={(val: any) => {
                            setForm(prev => ({
                              ...prev,
                              chiTiet: prev.chiTiet.map((it, i) => i === idx ? { ...it, tinhTrangKhiTra: val } : it)
                            }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                             <SelectItem value="NGUYEN_SEAL">Nguyên seal (Còn nguyên bao bì)</SelectItem>
                             {(() => {
                               const alloc = (allocations || []).find(a => a && a.maPhieu === ct.maPhieuCapPhat && a.maThietBi === ct.maThietBi);
                               return alloc?.loaiThietBi === 'TAI_SU_DUNG' && (
                                 <SelectItem value="DA_BOC_SEAL">Đã bóc seal (Dùng tốt)</SelectItem>
                               );
                             })()}
                             <SelectItem value="HONG">Hỏng / Cần sửa chữa</SelectItem>
                           </SelectContent>
                        </Select>
                      </div>

                      {allocations.find(a => a.maPhieu === ct.maPhieuCapPhat && a.maThietBi === ct.maThietBi)?.loaiThietBi === 'VAT_TU_TIEU_HAO' && ct.tinhTrangKhiTra === 'NGUYEN_SEAL' && (
                        <div className="w-full sm:w-auto mt-2 sm:mt-0 flex flex-col gap-1">
                          <Label className="text-[10px] text-orange-600 font-semibold flex items-center gap-1">
                            <Camera className="w-3 h-3" /> Ảnh minh chứng *
                          </Label>
                          {ct.anhMinhChung ? (
                            <div className="flex items-center justify-between gap-1 bg-success/10 text-success text-xs p-1 rounded border border-success/20 w-full sm:w-32">
                              <span className="flex items-center gap-1 truncate" title={ct.anhMinhChung.length > 20 ? 'Ảnh đính kèm' : ct.anhMinhChung}><Check className="w-3 h-3 shrink-0" /> <span className="truncate">Đã tải ảnh lên</span></span>
                              <Button 
                                variant="ghost" size="icon" className="h-4 w-4 rounded-full hover:bg-success/20 hover:text-success shrink-0" 
                                onClick={(e) => { e.preventDefault(); setForm(prev => ({ ...prev, chiTiet: prev.chiTiet.map((it, i) => i === idx ? { ...it, anhMinhChung: undefined } : it) })); }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline" size="sm" className="h-8 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 w-full sm:w-32"
                              onClick={(e) => {
                                e.preventDefault();
                                const input = document.createElement('input');
                                input.type = 'file'; input.accept = 'image/*';
                                input.onchange = (ev) => {
                                  const file = (ev.target as HTMLInputElement).files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                      setForm(prev => ({ ...prev, chiTiet: prev.chiTiet.map((it, i) => i === idx ? { ...it, anhMinhChung: reader.result as string } : it) }));
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                };
                                input.click();
                              }}
                            >
                              <Upload className="w-3 h-3 mr-1" /> Tải lên
                            </Button>
                          )}
                        </div>
                      )}

                      <Button variant="ghost" size="icon" onClick={() => setForm(prev => ({ ...prev, chiTiet: prev.chiTiet.filter((_, i) => i !== idx) }))}>
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Ghi chú (Tùy chọn)</Label>
              <Textarea placeholder="Lý do trả, ghi chú thêm..." value={form.ghiChu} onChange={e => setForm(prev => ({ ...prev, ghiChu: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleCreateReturn} disabled={form.chiTiet.length === 0}>
              Tạo Phiếu Trả & Lấy mã QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Chi tiết Phiếu Trả {currentViewingPhieu?.maPhieuTra}</DialogTitle></DialogHeader>
          {currentViewingPhieu && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg border">
                <div><span className="text-muted-foreground">Mã phiếu:</span> <span className="font-mono ml-2">{currentViewingPhieu.maPhieuTra}</span></div>
                <div><span className="text-muted-foreground">Ngày tạo:</span> <span className="ml-2">{new Date(currentViewingPhieu.ngayTao).toLocaleString('vi-VN')}</span></div>
                <div><span className="text-muted-foreground">Người lập:</span> <span className="ml-2 font-medium">{currentViewingPhieu.tenTruongKhoa}</span></div>
                <div className="flex items-center"><span className="text-muted-foreground mr-2">Trạng thái:</span> 
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border", getStatusBadgeStyle(currentViewingPhieu.trangThai))}>
                    {TRANG_THAI_PHIEU_TRA_LABELS[currentViewingPhieu.trangThai] || currentViewingPhieu.trangThai}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Info className="w-4 h-4" /> Danh sách thiết bị</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr className="border-b">
                        <th className="text-left p-2">Thiết bị</th>
                        <th className="text-center p-2">Số lượng</th>
                        <th className="text-left p-2">Ngày mượn</th>
                        <th className="text-left p-2">Tình trạng</th>
                        <th className="text-left p-2">Mã CP</th>
                        <th className="text-center p-2">Duyệt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(currentViewingPhieu.chiTiet || []).map((ct, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="p-2 font-medium">{ct.tenThietBi}</td>
                          <td className="p-2 text-center">
                             <div className="font-bold text-primary">{ct.soLuong} {ct.donViTinh}</div>
                             {ct.donViTinh !== ct.donViCoSo && (
                                <div className="text-[9px] text-muted-foreground italic">= {ct.soLuongCoSo} {ct.donViCoSo}</div>
                             )}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">
                             {(() => {
                               const alloc = (allocations || []).find(a => a && a.maPhieu === ct.maPhieuCapPhat && a.maThietBi === ct.maThietBi);
                               return alloc?.ngayCapPhat ? new Date(alloc.ngayCapPhat).toLocaleDateString('vi-VN') : '---';
                             })()}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", ct.tinhTrangKhiTra === 'HONG' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-success/10 text-success border-success/20')}>
                                {TINH_TRANG_TRA_LABELS[ct.tinhTrangKhiTra]}
                              </span>
                              {ct.anhMinhChung && (
                                <button type="button" onClick={() => setPreviewImage(ct.anhMinhChung)} className="flex items-center gap-1 text-primary text-[9px] hover:underline font-medium cursor-pointer bg-transparent border-none p-0 text-left">
                                  <Camera className="w-3 h-3" /> Xem ảnh
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-2 font-mono text-[10px] text-muted-foreground">{ct.maPhieuCapPhat}</td>
                          <td className="p-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              {(() => {
                                const itemStatus = (currentViewingPhieu.trangThai === 'DA_TRA' && ct.trangThai !== 'TU_CHOI') 
                                  ? 'DA_TRA' 
                                  : (ct.trangThai || 'CHO_DUYET');
                                return (
                                  <>
                                    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase border", getStatusBadgeStyle(itemStatus))}>
                                      {itemStatus === 'DA_TRA' ? 'Đã nhận' : 
                                       itemStatus === 'TU_CHOI' ? 'Từ chối' : 
                                       itemStatus === 'CHO_QL_KHO_DUYET' ? 'Chờ QL duyệt' : 
                                       itemStatus === 'CHO_XAC_NHAN' ? 'Chờ nhận' : 'Chờ duyệt'}
                                    </span>
                                    {itemStatus === 'TU_CHOI' && ct.lyDoTuChoi && (
                                      <span className="text-[9px] text-destructive italic max-w-[120px] truncate" title={ct.lyDoTuChoi}>
                                        Lý do: {ct.lyDoTuChoi}
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(currentViewingPhieu.ghiChu || currentViewingPhieu.anhMinhChung || (currentViewingPhieu.chiTiet && currentViewingPhieu.chiTiet.some(ct => ct.anhMinhChung))) && (
                <div className="p-3 border rounded-lg bg-yellow-50/50 space-y-2 mt-4">
                  {currentViewingPhieu.ghiChu && (
                    <>
                      <span className="text-[10px] text-muted-foreground block mb-1">Ghi chú:</span>
                      <p className="text-sm whitespace-pre-wrap">{currentViewingPhieu.ghiChu}</p>
                    </>
                  )}
                  {currentViewingPhieu.chiTiet && currentViewingPhieu.chiTiet.some(ct => ct.anhMinhChung) && (
                    <div className="pt-2 border-t border-yellow-200">
                      <span className="text-[10px] text-muted-foreground block mb-2">Ảnh minh chứng đính kèm:</span>
                      <div className="flex flex-wrap gap-2">
                        {currentViewingPhieu.chiTiet.filter(ct => ct.anhMinhChung).map((ct, idx) => (
                          <div key={idx} className="relative group rounded border bg-white p-1 shadow-sm">
                            <button type="button" onClick={() => setPreviewImage(ct.anhMinhChung)} className="block w-20 h-20 overflow-hidden rounded bg-transparent border-none p-0 cursor-pointer">
                              <img src={ct.anhMinhChung} alt={`Minh chứng ${ct.tenThietBi}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] p-1 truncate text-center" title={ct.tenThietBi}>
                              {ct.tenThietBi}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {currentViewingPhieu.anhMinhChung && (
                    <div className="pt-2 border-t border-yellow-200">
                      <span className="text-[10px] text-muted-foreground block mb-2">Ảnh chứng minh nhập kho:</span>
                      <div className="flex flex-wrap gap-2">
                        <div className="relative group rounded border bg-white p-1 shadow-sm">
                          <button type="button" onClick={() => setPreviewImage(currentViewingPhieu.anhMinhChung!)} className="block w-20 h-20 overflow-hidden rounded bg-transparent border-none p-0 cursor-pointer">
                            <img src={currentViewingPhieu.anhMinhChung} alt="Minh chứng nhập kho" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] p-1 truncate text-center">
                            Kho xác nhận
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex justify-between items-center sm:justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPreviewReturn(currentViewingPhieu);
                setReturnPreviewOpen(true);
              }}
              className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
            >
              <FileText className="w-4 h-4 mr-1.5" /> Xem Biểu Mẫu Phiếu Trả
            </Button>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm text-center flex flex-col items-center justify-center p-6 space-y-4">
          <DialogHeader><DialogTitle>Mã QR Phiếu Trả</DialogTitle></DialogHeader>
          <div className="bg-white p-4 rounded-xl shadow-inner border inline-block mt-4">
            <QRCodeComponent 
              value={qrDataStr} 
            />
          </div>
          <div className="font-mono text-sm font-bold bg-muted px-3 py-1 rounded border shadow-sm">
            Mã phiếu: {qrDataStr}
          </div>
          <p className="text-xs text-muted-foreground mt-2">NV Kho có thể quét mã này bằng điện thoại/máy quét để duyệt nhanh.</p>
          <Button variant="outline" onClick={() => setQrOpen(false)} className="w-full mt-4">Đóng</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={scanOpen} onOpenChange={(open) => { setScanOpen(open); if(!open) setManualCode(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nhận diện Phiếu Trả</DialogTitle></DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="overflow-hidden rounded-xl border bg-black aspect-video relative">
              {scanOpen && (
                  <Scanner
                    onScan={(detectedCodes) => {
                       if (detectedCodes && detectedCodes.length > 0) {
                          handleScanQR(detectedCodes[0].rawValue);
                       }
                    }}
                    formats={['qr_code']}
                    components={{ finder: true }}
                    styles={{ container: { width: '100%', height: '100%' } }}
                  />
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Hoặc sử dụng cách khác</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2" onClick={() => document.getElementById('qr-file-input')?.click()}>
                <Upload className="h-6 w-6 text-primary" />
                <div className="text-xs">Tải ảnh QR lên</div>
                <input id="qr-file-input" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </Button>

              <div className="space-y-2">
                <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 w-full" onClick={() => (document.getElementById('manual-input') as HTMLInputElement)?.focus()}>
                  <Keyboard className="h-6 w-6 text-muted-foreground" />
                  <div className="text-xs">Nhập mã thủ công</div>
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Input 
                id="manual-input"
                placeholder="Ví dụ: TRA-2026-12345" 
                value={manualCode} 
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScanQR(manualCode)}
              />
              <Button onClick={() => handleScanQR(manualCode)}>Tìm</Button>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScanOpen(false)} className="w-full">Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {user?.vaiTro === 'TRUONG_KHOA' ? 'Phê duyệt trả thiết bị' : 
               user?.vaiTro === 'QL_KHO' ? 'Phê duyệt trả thiết bị (Quản lý kho)' : 
               user?.vaiTro === 'NV_KHO' ? 'Xác nhận Nhập kho trả thiết bị' : 
               'Xác nhận xử lý phiếu trả'}
            </DialogTitle>
          </DialogHeader>
          {confirmingPhieu && (
            <div className="space-y-4 my-2">
              <div className="p-4 bg-muted/40 rounded-lg space-y-2 border">
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Mã phiếu:</span> <span className="font-mono">{confirmingPhieu.maPhieuTra}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Người trả:</span> <span className="font-semibold">{confirmingPhieu.tenTruongKhoa}</span></div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-bold">Danh sách thiết bị yêu cầu trả</Label>
                <div className="border rounded-lg overflow-hidden bg-card">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr className="border-b">
                        {(user?.vaiTro !== 'NV_KHO') && <th className="p-2 text-center w-12">Chọn</th>}
                        <th className="text-left p-2">Thiết bị</th>
                        <th className="text-center p-2">Số lượng</th>
                        <th className="text-left p-2">Tình trạng</th>
                        {(user?.vaiTro !== 'NV_KHO') && <th className="text-left p-2">Lý do từ chối (nếu bỏ chọn)</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {confirmingPhieu.chiTiet.map((ct, idx) => {
                        const itemState = processItems.find(pi => pi.maThietBi === ct.maThietBi);
                        const isApproved = itemState ? itemState.approved : true;
                        
                        // Nếu item đã bị từ chối ở Dept stage, và user là QL_KHO, item này sẽ bị disable/ẩn hoặc hiển thị là Đã từ chối
                        const isAlreadyRejected = ct.trangThai === 'TU_CHOI';

                        return (
                          <tr key={idx} className={cn("border-b last:border-0", isAlreadyRejected ? "bg-muted/50 opacity-60" : "")}>
                            {(user?.vaiTro !== 'NV_KHO') && (
                              <td className="p-2 text-center align-top pt-3">
                                {isAlreadyRejected ? (
                                  <span className="text-[9px] text-destructive font-bold uppercase whitespace-nowrap">Bị từ chối</span>
                                ) : (
                                  <Checkbox 
                                    checked={isApproved} 
                                    onCheckedChange={(checked) => {
                                      setProcessItems(prev => prev.map(pi => pi.maThietBi === ct.maThietBi ? { ...pi, approved: !!checked } : pi));
                                    }}
                                  />
                                )}
                              </td>
                            )}
                            <td className="p-2 font-medium">
                              <div>{ct.tenThietBi}</div>
                              <div className="text-[10px] text-muted-foreground font-mono mt-1">{ct.maPhieuCapPhat}</div>
                            </td>
                            <td className="p-2 text-center">
                              <div className="font-bold text-primary">{ct.soLuong} {ct.donViTinh}</div>
                              {ct.donViTinh !== ct.donViCoSo && (
                                <div className="text-[9px] text-muted-foreground italic mt-0.5">= {ct.soLuongCoSo} {ct.donViCoSo}</div>
                              )}
                            </td>
                            <td className="p-2">
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", 
                                ct.tinhTrangKhiTra === 'HONG' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-success/10 text-success border-success/20'
                              )}>
                                {TINH_TRANG_TRA_LABELS[ct.tinhTrangKhiTra]}
                              </span>
                            </td>
                            {(user?.vaiTro !== 'NV_KHO') && (
                              <td className="p-2">
                                {isAlreadyRejected ? (
                                  <span className="text-[10px] text-muted-foreground italic line-clamp-2" title={ct.lyDoTuChoi}>{ct.lyDoTuChoi}</span>
                                ) : (
                                  !isApproved && (
                                    <Input 
                                      placeholder="Nhập lý do từ chối..." 
                                      value={itemState?.lyDo || ''} 
                                      onChange={(e) => {
                                        setProcessItems(prev => prev.map(pi => pi.maThietBi === ct.maThietBi ? { ...pi, lyDo: e.target.value } : pi));
                                      }}
                                      className="h-8 text-xs min-w-[150px]"
                                    />
                                  )
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {(user?.vaiTro !== 'NV_KHO') && (
                <div className="space-y-2 mt-4">
                  <Label className="text-sm font-bold">Ghi chú chung (Tùy chọn)</Label>
                  <Textarea 
                    placeholder="Nhập ghi chú chung hoặc lý do từ chối toàn bộ..." 
                    value={confirmComment} 
                    onChange={e => setConfirmComment(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              )}

              {user?.vaiTro === 'NV_KHO' && (
                <>
                  <p className="text-xs text-muted-foreground italic mt-4">
                    * Nếu xác nhận, thiết bị không hỏng sẽ được cộng vào <strong>Tồn Kho</strong>, thiết bị hỏng sẽ được cộng vào <strong>Số lượng hư</strong>. Phiếu cấp phát sẽ được đánh dấu <strong>Đã trả</strong>.
                  </p>
                  {/* Ảnh chứng minh bắt buộc cho NV Kho */}
                  <div className="mt-4 p-4 border-2 border-dashed rounded-xl space-y-3"
                    style={{ borderColor: returnProofImage ? 'hsl(160,60%,45%)' : 'hsl(0,84%,60%)' }}>
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <ImagePlus className="w-4 h-4 text-primary" />
                      Ảnh chứng minh nhập kho
                      <span className="text-destructive text-xs font-normal">(Bắt buộc trước khi xác nhận nhập kho)</span>
                    </Label>
                    {returnProofImage ? (
                      <div className="flex items-center gap-3">
                        <img src={returnProofImage} alt="Proof" className="w-24 h-24 object-cover rounded-lg border shadow-sm" />
                        <div className="flex flex-col gap-2">
                          <span className="text-xs text-success font-medium">✓ Đã tải ảnh chứng minh</span>
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setReturnProofImage(null)}>Xóa ảnh</Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer py-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Click để tải ảnh chứng minh nhập kho lên</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => setReturnProofImage(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => handleConfirmReturn(false)} className="text-destructive hover:bg-destructive/10 border-destructive/20">Từ chối</Button>
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={() => handleConfirmReturn(true)}
              disabled={user?.vaiTro === 'NV_KHO' && confirmingPhieu?.trangThai === 'CHO_XAC_NHAN' && !returnProofImage}
              title={user?.vaiTro === 'NV_KHO' && !returnProofImage ? 'Bắt buộc tải ảnh chứng minh nhập kho' : undefined}
            >
              {user?.vaiTro === 'NV_KHO'
                ? (returnProofImage ? 'Xác nhận & Nhập kho' : 'Ảnh chứng minh chưa tải lên')
                : 'Duyệt & Lưu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DANH SÁCH ĐẾN HẠN */}
      <Dialog open={dueDialogOpen} onOpenChange={setDueDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-destructive" /> Thiết bị đến hạn / quá hạn trả
              {user?.vaiTro === 'TRUONG_KHOA' && (
                <span className="text-xs bg-muted text-muted-foreground font-normal px-2.5 py-0.5 rounded-full border">Chế độ xem</span>
              )}
            </DialogTitle>
            {user?.vaiTro === 'TRUONG_KHOA' && (
              <p className="text-xs text-muted-foreground mt-1">
                Trưởng khoa xem theo dõi tình trạng hạn trả. Chỉ Trợ lý khoa mới có quyền thực hiện thao tác trả hoặc gia hạn.
              </p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {dueAllocations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Không có thiết bị nào đến hạn trong 3 ngày tới.</div>
            ) : (
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      {canOperateDue && (
                        <th className="p-3 w-10 text-center">
                          <Checkbox 
                            checked={selectedDueItems.length === dueAllocations.length && dueAllocations.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedDueItems(dueAllocations);
                              } else {
                                setSelectedDueItems([]);
                              }
                            }}
                          />
                        </th>
                      )}
                      <th className="text-left p-3 font-medium">Thiết bị</th>
                      <th className="text-left p-3 font-medium">Ngày mượn</th>
                      <th className="text-left p-3 font-medium">Mã CP</th>
                      <th className="text-center p-3 font-medium">Hạn trả</th>
                      <th className="text-center p-3 font-medium">Trạng thái</th>
                      {canOperateDue && (
                        <th className="text-right p-3 font-medium">Hành động</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dueAllocations.map(alloc => {
                      const { isOverdue, diffDays, text: dueStatusText, formattedDate } = getDueStatus(alloc.ngayDuKienTra);
                      const isSelected = selectedDueItems.some(item => item.maPhieu === alloc.maPhieu && item.maThietBi === alloc.maThietBi);
                      return (
                        <tr key={alloc.maPhieu + alloc.maThietBi} className={cn(isOverdue ? 'bg-destructive/5' : '', isSelected ? 'bg-primary/5' : '')}>
                          {canOperateDue && (
                            <td className="p-3 text-center">
                              <Checkbox 
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedDueItems(prev => [...prev, alloc]);
                                  } else {
                                    setSelectedDueItems(prev => prev.filter(item => !(item.maPhieu === alloc.maPhieu && item.maThietBi === alloc.maThietBi)));
                                  }
                                }}
                              />
                            </td>
                          )}
                          <td className="p-3">
                            <div className="font-bold">{alloc.tenThietBi}</div>
                            <div className="text-[10px] text-muted-foreground">{alloc.soLuongCapPhat} {alloc.donViTinh}</div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{alloc.ngayCapPhat ? new Date(alloc.ngayCapPhat).toLocaleDateString('vi-VN') : '---'}</td>
                          <td className="p-3 font-mono text-xs">{alloc.maPhieu}</td>
                          <td className="p-3 text-center">
                            {alloc.ngayDuKienTra ? (
                              <div className="flex flex-col items-center justify-center gap-1">
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold inline-block", isOverdue ? "bg-destructive text-white" : "bg-warning/20 text-warning-foreground")}>
                                  {formattedDate}
                                </span>
                                <span className={cn(
                                  "text-[10px] whitespace-nowrap",
                                  isOverdue ? "font-bold text-destructive" : diffDays === 0 ? "font-bold text-amber-600 dark:text-amber-400" : "font-medium text-muted-foreground"
                                )}>
                                  {dueStatusText}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">---</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-[10px] font-medium">{TRANG_THAI_TRA_LABELS[alloc.trangThaiTra]}</span>
                          </td>
                          {canOperateDue && (
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-2">
                                 <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setExtendingAllocs([alloc]); setExtDate(alloc.ngayDuKienTra!); setExtendOpen(true); }}>Gia hạn</Button>
                                 <Button size="sm" className="gradient-primary h-8 text-xs text-white" onClick={() => { 
                                    setDueDialogOpen(false); 
                                    setForm({ ghiChu: '', chiTiet: [{
                                      maPhieuCapPhat: alloc.maPhieu,
                                      maThietBi: alloc.maThietBi,
                                      tenThietBi: alloc.tenThietBi || alloc.maThietBi,
                                      soLuong: alloc.soLuongCapPhat,
                                      tinhTrangKhiTra: alloc.loaiThietBi === 'VAT_TU_TIEU_HAO' ? 'NGUYEN_SEAL' : 'DA_BOC_SEAL',
                                    }] });
                                    setDialogOpen(true);
                                 }}>Trả ngay</Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-between items-center w-full">
            {canOperateDue ? (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  disabled={selectedDueItems.length === 0}
                  onClick={() => {
                    setExtendingAllocs(selectedDueItems);
                    setExtDate('');
                    setExtendOpen(true);
                  }}
                >
                  Gia hạn ({selectedDueItems.length})
                </Button>
                <Button 
                  className="gradient-primary text-white"
                  disabled={selectedDueItems.length === 0}
                  onClick={() => {
                    setDueDialogOpen(false);
                    setForm({ ghiChu: '', chiTiet: selectedDueItems.map(alloc => ({
                      maPhieuCapPhat: alloc.maPhieu,
                      maThietBi: alloc.maThietBi,
                      tenThietBi: alloc.tenThietBi || alloc.maThietBi,
                      soLuong: alloc.soLuongCapPhat,
                      tinhTrangKhiTra: alloc.loaiThietBi === 'VAT_TU_TIEU_HAO' ? 'NGUYEN_SEAL' : 'DA_BOC_SEAL',
                    })) });
                    setDialogOpen(true);
                    setSelectedDueItems([]);
                  }}
                >
                  Trả ngay ({selectedDueItems.length})
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                <Info className="w-4 h-4 text-primary" />
                Chỉ Trợ lý khoa mới có quyền thực hiện thao tác Trả hoặc Gia hạn thiết bị.
              </div>
            )}
            <Button variant="ghost" onClick={() => setDueDialogOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL QUÁ HẠN — dành cho QL_KHO */}
      <Dialog open={overdueDialogOpen} onOpenChange={setOverdueDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-destructive" />
              Thiết bị quá hạn chưa trả
              <span className="ml-2 bg-destructive text-white text-xs font-bold px-2 py-0.5 rounded-full">{overdueAllocations.length}</span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Chọn thiết bị và gửi cảnh báo đến Trợ lý phòng ban tương ứng.</p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {overdueAllocations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Không có thiết bị nào quá hạn.</div>
            ) : (
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-destructive/5 border-b">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <Checkbox
                          checked={selectedOverdueItems.length === overdueAllocations.length && overdueAllocations.length > 0}
                          onCheckedChange={(checked) => {
                            setSelectedOverdueItems(checked ? overdueAllocations : []);
                          }}
                        />
                      </th>
                      <th className="text-left p-3 font-medium">Thiết bị</th>
                      <th className="text-left p-3 font-medium">Khoa</th>
                      <th className="text-left p-3 font-medium">Mã CP</th>
                      <th className="text-left p-3 font-medium">Ngày mượn</th>
                      <th className="text-center p-3 font-medium">Hạn trả</th>
                      <th className="text-center p-3 font-medium">Quá hạn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overdueAllocations.map(alloc => {
                      const isSelected = selectedOverdueItems.some(i => i.maPhieu === alloc.maPhieu && i.maThietBi === alloc.maThietBi);
                      const { diffDays, formattedDate } = getDueStatus(alloc.ngayDuKienTra);
                      return (
                        <tr key={alloc.maPhieu + alloc.maThietBi} className={cn("transition-colors", isSelected ? "bg-destructive/5" : "hover:bg-muted/20")}>
                          <td className="p-3 text-center">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedOverdueItems(prev => [...prev, alloc]);
                                else setSelectedOverdueItems(prev => prev.filter(i => !(i.maPhieu === alloc.maPhieu && i.maThietBi === alloc.maThietBi)));
                              }}
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold">{alloc.tenThietBi}</div>
                            <div className="text-[10px] text-muted-foreground">{alloc.soLuongCapPhat} {alloc.donViTinh}</div>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{departments.find(d => d.maKhoa === alloc.maKhoa)?.tenKhoa || alloc.maKhoa || '---'}</td>
                          <td className="p-3 font-mono text-xs">{alloc.maPhieu}</td>
                          <td className="p-3 text-xs text-muted-foreground">{alloc.ngayCapPhat ? new Date(alloc.ngayCapPhat).toLocaleDateString('vi-VN') : '---'}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-destructive text-white">
                              {formattedDate}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-destructive font-bold text-xs">+{diffDays} ngày</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-muted/20 flex justify-between items-center w-full">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Đã chọn: <strong>{selectedOverdueItems.length}</strong> thiết bị</span>
              <Button
                variant="destructive"
                disabled={selectedOverdueItems.length === 0 || overdueRemindSending}
                onClick={async () => {
                  setOverdueRemindSending(true);
                  try {
                    const result = await fetchApi<{ success: boolean; message: string }>('/returns/remind', {
                      method: 'POST',
                      body: JSON.stringify({
                        items: selectedOverdueItems.map(a => ({
                          maPhieuCapPhat: a.maPhieu,
                          maThietBi: a.maThietBi,
                          tenThietBi: a.tenThietBi || a.maThietBi,
                        }))
                      })
                    });
                    if (result.success) {
                      toast({ title: 'Thành công', description: `Đã gửi cảnh báo cho ${selectedOverdueItems.length} thiết bị quá hạn.` });
                      setSelectedOverdueItems([]);
                    } else {
                      toast({ title: 'Lỗi', description: (result as any).message, variant: 'destructive' });
                    }
                  } catch (err: any) {
                    toast({ title: 'Lỗi', description: err?.message || 'Lỗi không xác định', variant: 'destructive' });
                  } finally {
                    setOverdueRemindSending(false);
                  }
                }}
              >
                {overdueRemindSending ? 'Đang gửi...' : `Gửi cảnh báo (${selectedOverdueItems.length})`}
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setOverdueDialogOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL GIA HẠN */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gửi yêu cầu Gia hạn mượn</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1 block">Ngày gia hạn mới *</Label>
              <Input 
                type="date" 
                value={extDate} 
                onChange={e => setExtDate(e.target.value)} 
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label className="mb-1 block">Lý do gia hạn *</Label>
              <Textarea 
                placeholder="VD: Dự án kéo dài thêm 1 tuần..." 
                value={extReason} 
                onChange={e => setExtReason(e.target.value)}
                className="h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtendOpen(false)}>Hủy</Button>
            <Button className="gradient-primary text-white" onClick={handleExtendRequest}>Gửi yêu cầu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-orange-500" /> Xử lý Phiếu Trả {cancellingPhieu?.maPhieuTra}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Bạn muốn thực hiện thao tác nào cho phiếu trả này?</p>
            
            <div className="border rounded-lg p-3 bg-muted/30">
               <div className="text-[10px] uppercase text-muted-foreground mb-2">Danh sách thiết bị trong phiếu:</div>
               {cancellingPhieu?.chiTiet?.map((ct: any, i: number) => (
                 <div key={i} className="text-xs space-y-1 pt-2 border-t first:border-0 first:pt-0">
                    <div className="flex justify-between font-medium">
                       <span>{ct.tenThietBi}</span>
                       <span className="font-bold text-primary">{ct.soLuong} {ct.donViTinh}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground italic">
                       <span>Ngày mượn: {(() => {
                         const alloc = (allocations || []).find(a => a && a.maPhieu === ct.maPhieuCapPhat && a.maThietBi === ct.maThietBi);
                         return alloc?.ngayCapPhat ? new Date(alloc.ngayCapPhat).toLocaleDateString('vi-VN') : '---';
                       })()}</span>
                       <span>Mã CP: {ct.maPhieuCapPhat}</span>
                    </div>
                 </div>
               ))}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button 
                variant="outline" 
                className="justify-start h-auto py-3 px-4 flex flex-col items-start gap-1 border-orange-200 hover:bg-orange-50"
                onClick={() => {
                  const firstCt = cancellingPhieu?.chiTiet?.[0];
                  const alloc = allocations.find(a => a.maPhieu === firstCt?.maPhieuCapPhat);
                  if (alloc) {
                    setExtendingAlloc(alloc);
                    setExtDate(alloc.ngayDuKienTra ? new Date(alloc.ngayDuKienTra).toISOString().split('T')[0] : '');
                    setCancelConfirmOpen(false);
                    setExtendOpen(true);
                  }
                }}
              >
                <div className="font-bold flex items-center gap-2"><Plus className="w-4 h-4" /> Gia hạn thêm ngày trả</div>
                <div className="text-[10px] text-muted-foreground">Tiếp tục mượn và dời ngày trả cho thiết bị này</div>
              </Button>

              <Button 
                variant="outline" 
                className="justify-start h-auto py-3 px-4 flex flex-col items-start gap-1 border-destructive/20 hover:bg-destructive/5 text-destructive"
                onClick={() => {
                  handleCancelReturn(cancellingPhieu?.maPhieuTra);
                  setCancelConfirmOpen(false);
                }}
              >
                <div className="font-bold flex items-center gap-2"><X className="w-4 h-4" /> Hủy yêu cầu trả (vẫn mượn)</div>
                <div className="text-[10px] text-muted-foreground opacity-70">Xóa phiếu trả này và giữ trạng thái mượn</div>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelConfirmOpen(false)} className="w-full">Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewImage(null)}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
            onClick={() => setPreviewImage(null)}
          >
            <X className="w-6 h-6" />
          </Button>
          <img 
            src={previewImage} 
            alt="Phóng to minh chứng" 
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl bg-black/50" 
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* MODAL THÔNG BÁO TRẢ THIẾT BỊ */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Thông báo Trả thiết bị
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Không có thông báo nào.</div>
            ) : (
              notifications.map(n => {
                // Trích xuất mã phiếu từ nội dung hoặc tiêu đề thông báo
                const maPhieuMatch = (n.noiDung + ' ' + n.tieuDe).match(/TRA-\d{4}-\d{5}/);
                const maPhieuTra = maPhieuMatch ? maPhieuMatch[0] : null;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 rounded-xl border text-sm transition-all",
                      maPhieuTra ? "cursor-pointer hover:bg-primary/10 hover:border-primary/30 hover:shadow-md" : "cursor-pointer hover:bg-muted/50",
                      n.daDoc ? "bg-card opacity-70" : "bg-primary/5 border-primary/20 shadow-sm"
                    )}
                    onClick={async () => {
                      if (!n.daDoc) await handleReadNotification(n.id);
                      if (maPhieuTra) {
                        const phieu = (data || []).find(d => d && d.maPhieuTra === maPhieuTra);
                        if (phieu) {
                          setNotifOpen(false);
                          setViewingPhieu(phieu);
                          setDetailOpen(true);
                        } else {
                          // Nếu chưa load, thông báo lấy dữ liệu mới
                          await reload();
                          const freshPhieu = store.getReturns().find(d => d && d.maPhieuTra === maPhieuTra);
                          if (freshPhieu) {
                            setNotifOpen(false);
                            setViewingPhieu(freshPhieu as any);
                            setDetailOpen(true);
                          }
                        }
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn("font-bold", !n.daDoc && "text-primary")}>{n.tieuDe}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(n.ngayTao).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{n.noiDung}</p>
                    {maPhieuTra && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-primary font-semibold">
                        <span>→ Nhấn để xem phiếu {maPhieuTra}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-muted/20">
            <Button variant="outline" size="sm" onClick={async () => {
              if (user) {
                const unreadForThisModule = notifications.filter(n => !n.daDoc);
                await Promise.all(unreadForThisModule.map(n => handleReadNotification(n.id)));
                toast({ title: 'Đã đánh dấu đọc tất cả thông báo Trả thiết bị' });
              }
            }}>
              Đánh dấu đã đọc tất cả
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL XEM TRƯỚC VÀ IN BIỂU MẪU PHIẾU TRẢ THIẾT BỊ */}
      <Dialog open={returnPreviewOpen} onOpenChange={setReturnPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-card z-10 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <FileText className="w-5 h-5 text-primary" />
              Biểu Mẫu Phiếu Trả Thiết Bị Y Tế {previewReturn?.maPhieuTra && `(${previewReturn.maPhieuTra})`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
            {previewReturn && (() => {
              const tenKhoa = getDeptNameForReturn(previewReturn);
              const tenNguoiTra = previewReturn.tenTruongKhoa || user?.hoTen || 'Trợ lý khoa';
              const returnDate = previewReturn.ngayTao ? new Date(previewReturn.ngayTao) : new Date();
              const day = returnDate.getDate();
              const month = returnDate.getMonth() + 1;
              const year = returnDate.getFullYear();
              const itemsList = previewReturn.chiTiet || [];

              return (
                <div 
                  id="return-form-content" 
                  className="bg-white text-gray-900 p-8 rounded-lg shadow-sm border border-gray-200 mx-auto max-w-3xl font-serif text-[14px] leading-relaxed"
                >
                  {/* Tiêu đề & Quốc hiệu */}
                  <div className="header-grid flex justify-between items-start border-b pb-4 mb-4">
                    <div className="text-center w-5/12">
                      <div className="font-bold uppercase text-[12px]">BỘ Y TẾ - BỆNH VIỆN MEDEQUIP</div>
                      <div className="font-semibold text-[12px]">KHOA / PHÒNG: {tenKhoa}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-1">Mã phiếu trả: {previewReturn.maPhieuTra}</div>
                    </div>
                    <div className="text-center w-6/12">
                      <div className="font-bold uppercase text-[12px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                      <div className="font-bold text-[12px]">Độc lập - Tự do - Hạnh phúc</div>
                      <div className="text-xs text-gray-400">---***---</div>
                      <div className="italic text-[11px] text-gray-600 mt-1">
                        Ngày {day} tháng {month} năm {year}
                      </div>
                    </div>
                  </div>

                  {/* Tên văn bản */}
                  <div className="title-area text-center my-6">
                    <h2 className="text-xl font-bold uppercase tracking-wide text-gray-900 mb-1">
                      PHIẾU HOÀN TRẢ THIẾT BỊ Y TẾ
                    </h2>
                    <p className="italic text-xs text-gray-600">
                      (Biên bản giao nhận và hoàn trả trang thiết bị y tế về kho bệnh viện)
                    </p>
                  </div>

                  {/* Kính gửi & Thông tin người hoàn trả */}
                  <div className="space-y-2 mb-5 text-[13px]">
                    <div className="italic text-center font-medium mb-3">
                      Kính gửi: Ban Giám Đốc, Phòng Quản lý Trang thiết bị y tế & Bộ phận Quản lý Kho
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-semibold">Đơn vị / Khoa phòng trả:</span> {tenKhoa}</div>
                      <div><span className="font-semibold">Người lập phiếu trả:</span> {tenNguoiTra}</div>
                      <div>
                        <span className="font-semibold">Ngày trả thiết bị:</span>{' '}
                        <span className="font-bold text-primary">{returnDate.toLocaleString('vi-VN')}</span>
                      </div>
                      <div>
                        <span className="font-semibold">Trạng thái phiếu:</span>{' '}
                        <span className="font-bold">
                          {TRANG_THAI_PHIEU_TRA_LABELS[previewReturn.trangThai] || previewReturn.trangThai}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="font-semibold">Lý do hoàn trả / Ghi chú:</span>
                      <p className="italic text-gray-700 mt-0.5 bg-gray-50 p-2 rounded border border-gray-100">
                        {previewReturn.ghiChu || 'Hoàn trả trang thiết bị y tế theo quy định hoặc hết thời gian sử dụng.'}
                      </p>
                    </div>
                  </div>

                  {/* Bảng danh sách thiết bị trả */}
                  <div className="mb-6">
                    <div className="font-semibold text-[13px] mb-2 uppercase tracking-wide">
                      I. Danh mục thiết bị y tế bàn giao hoàn trả:
                    </div>
                    <table className="w-full border-collapse border border-gray-400 text-[12px]">
                      <thead>
                        <tr className="bg-gray-100 font-bold text-center">
                          <th className="border border-gray-400 p-2 w-10">STT</th>
                          <th className="border border-gray-400 p-2 w-24">Mã thiết bị</th>
                          <th className="border border-gray-400 p-2 text-left">Tên thiết bị y tế</th>
                          <th className="border border-gray-400 p-2 w-24">Mã cấp phát</th>
                          <th className="border border-gray-400 p-2 w-20">Ngày mượn</th>
                          <th className="border border-gray-400 p-2 w-20">SL Trả</th>
                          <th className="border border-gray-400 p-2 w-16">ĐVT</th>
                          <th className="border border-gray-400 p-2 text-left">Tình trạng khi trả</th>
                          <th className="border border-gray-400 p-2 text-center w-24">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsList.map((item: any, idx: number) => {
                          const alloc = (allocations || []).find(a => a && a.maPhieu === item.maPhieuCapPhat && a.maThietBi === item.maThietBi);
                          const ngayMuon = alloc?.ngayCapPhat ? new Date(alloc.ngayCapPhat).toLocaleDateString('vi-VN') : '---';
                          const tinhTrangText = TINH_TRANG_TRA_LABELS[item.tinhTrangKhiTra as keyof typeof TINH_TRANG_TRA_LABELS] || item.tinhTrangKhiTra || 'Bình thường';
                          const isHong = item.tinhTrangKhiTra === 'HONG';

                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                              <td className="border border-gray-400 p-2 text-center font-mono font-medium">{item.maThietBi}</td>
                              <td className="border border-gray-400 p-2 font-medium">{item.tenThietBi || item.maThietBi}</td>
                              <td className="border border-gray-400 p-2 text-center font-mono text-[11px]">{item.maPhieuCapPhat || '---'}</td>
                              <td className="border border-gray-400 p-2 text-center text-[11px]">{ngayMuon}</td>
                              <td className="border border-gray-400 p-2 text-center font-bold text-base text-primary">
                                {item.soLuongCoSo || item.soLuong || 1}
                              </td>
                              <td className="border border-gray-400 p-2 text-center">{item.donViTinh || item.donViCoSo || 'Cái'}</td>
                              <td className="border border-gray-400 p-2">
                                <span className={cn(isHong ? "text-destructive font-semibold" : "text-emerald-700")}>
                                  {tinhTrangText}
                                </span>
                              </td>
                              <td className="border border-gray-400 p-2 text-center text-[11px]">
                                {(() => {
                                  const itemStatus = (previewReturn?.trangThai === 'DA_TRA' && item.trangThai !== 'TU_CHOI') ? 'DA_TRA' : item.trangThai;
                                  return itemStatus === 'DA_TRA' ? 'Đã nhận kho' : 
                                         itemStatus === 'TU_CHOI' ? 'Từ chối' : 
                                         itemStatus === 'CHO_QL_KHO_DUYET' ? 'Chờ QL duyệt' : 
                                         itemStatus === 'CHO_XAC_NHAN' ? 'Chờ kho nhận' : 'Chờ duyệt';
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Khối chữ ký 3 bên */}
                  <div className="signatures mt-8 pt-4">
                    <div className="text-right italic text-[11px] mb-4 text-gray-600">
                      ........., Ngày ..... tháng ..... năm 20...
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="sig-box">
                        <div className="sig-title font-bold uppercase text-[12px]">NGƯỜI TRẢ THIẾT BỊ</div>
                        <div className="sig-sub italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                        <div className="sig-name font-bold text-[12px]">{tenNguoiTra}</div>
                      </div>
                      <div className="sig-box">
                        <div className="sig-title font-bold uppercase text-[12px]">TRƯỞNG KHOA XÁC NHẬN</div>
                        <div className="sig-sub italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                        <div className="sig-name font-bold text-[12px]"></div>
                      </div>
                      <div className="sig-box">
                        <div className="sig-title font-bold uppercase text-[12px]">KHO TIẾP NHẬN</div>
                        <div className="sig-sub italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                        <div className="sig-name font-bold text-[12px]"></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="p-3 border-t bg-card flex flex-row items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handlePrintForm('return-form-content', `Phieu_Tra_${previewReturn?.maPhieuTra}`)}
                className="gap-1.5"
              >
                <Printer className="w-4 h-4 text-muted-foreground" />
                In biểu mẫu
              </Button>
              <Button
                onClick={() => exportSingleReturnPDF(previewReturn!)}
                className="gradient-primary text-white gap-1.5"
              >
                <Download className="w-4 h-4" />
                Tải file PDF
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setReturnPreviewOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
