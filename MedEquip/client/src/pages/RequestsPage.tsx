import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { apiCreateRequest, apiScanRequest, apiProcessRequestItems, apiMarkAllAsRead } from '@/lib/apiSync';
import { PhieuYeuCauCapPhat, ThietBi } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Search, CheckCheck, ShoppingCart, Plus, Minus, X, Trash2, Box, Camera, QrCode, RotateCcw, PackageCheck, ClipboardList, AlertCircle, Upload, Keyboard, Bell, Download, ImagePlus, FileText, Printer } from 'lucide-react';
import { fetchApi } from '@/services/api';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QRCodeCanvas as QRCodeComponent } from 'qrcode.react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

const STATUS_MAP = {
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  CHO_TRUONG_KHOA_DUYET: 'Chờ TK duyệt',
  CHO_QL_KHO_DUYET: 'Chờ QL duyệt',
  DA_QL_KHO_DUYET: 'Chờ cấp phát',
  TU_CHOI: 'Từ chối',
  DA_CAP_PHAT: 'Đã cấp phát',
  DA_HUY: 'Đã hủy'
} as const;

const STATUS_COLORS = {
  CHO_DUYET: 'bg-warning/10 text-warning border-warning/20',
  DA_DUYET: 'bg-info/10 text-info border-info/20',
  CHO_TRUONG_KHOA_DUYET: 'bg-warning/10 text-warning border-warning/20',
  CHO_QL_KHO_DUYET: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  DA_QL_KHO_DUYET: 'bg-blue-100 text-blue-700 border-blue-200',
  TU_CHOI: 'bg-destructive/10 text-destructive border-destructive/20',
  DA_CAP_PHAT: 'bg-success/10 text-success border-success/20',
  DA_HUY: 'bg-gray-100 text-gray-700 border-gray-200'
};

export default function RequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState(store.getRequests());
  const [search, setSearch] = useState('');
  const [searchEq, setSearchEq] = useState('');
  const [notifTrigger, setNotifTrigger] = useState(0);

  React.useEffect(() => {
    const handleNotifChange = () => setNotifTrigger(prev => prev + 1);
    window.addEventListener('store_notifications_changed', handleNotifChange);
    return () => window.removeEventListener('store_notifications_changed', handleNotifChange);
  }, []);
  
  // Trạng thái thông báo
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = store.getNotifications().filter(n => {
    if (n.nguoiNhan !== user?.maNguoiDung) return false;
    const t = n.tieuDe.toLowerCase();
    const d = n.noiDung.toLowerCase();
    const isTra = t.includes('trả') || d.includes('trả');
    return !isTra && (t.includes('cấp phát') || t.includes('yêu cầu') || d.includes('cấp phát') || d.includes('yêu cầu'));
  });
  const unreadNotifs = notifications.filter(n => !n.daDoc).length;

  // Lọc tùy chỉnh
  const [filterDept, setFilterDept] = useState('all');

  // Trạng thái giỏ hàng
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<{ tb: ThietBi, soLuong: number, donVi: string, ngayTraDuKien: string }[]>([]);
  const [lyDo, setLyDo] = useState('');
  const [khoaYeuCau, setKhoaYeuCau] = useState(user?.maKhoa || '');

  // Trạng thái NV Kho đang cấp phát
  const [allocateOpen, setAllocateOpen] = useState(false);
  const [allocating, setAllocating] = useState<PhieuYeuCauCapPhat | null>(null);
  const [ngayDuKienTra, setNgayDuKienTra] = useState('');

  // Trạng thái NV Kho đang từ chối
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Trạng thái Khoa đang hủy yêu cầu
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState('');

  // Trạng thái xóa
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // MỚI: Trạng thái xử lý nhiều thiết bị
  const [processingRequest, setProcessingRequest] = useState<any>(null);
  const [processItems, setProcessItems] = useState<{ maThietBi: string; approved: boolean; lyDo: string }[]>([]);
  const [processGhiChu, setProcessGhiChu] = useState('');
  const [loading, setLoading] = useState(false);

  // Trạng thái QR
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataStr, setQrDataStr] = useState('');

  const [scanOpen, setScanOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Trạng thái chọn hàng để xuất PDF
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);

  // Trạng thái Biểu mẫu xem trước & in
  const [previewReq, setPreviewReq] = useState<any | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Trạng thái ảnh chứng minh cho NV Kho khi cấp phát
  const [proofImage, setProofImage] = useState<string | null>(null);

  const equipment = store.getEquipment();
  const departments = store.getDepartments();
  const users = store.getUsers();
  const inventory = store.getInventory();

  const isNvkho = user?.vaiTro === 'NV_KHO';
  const isQlKho = user?.vaiTro === 'QL_KHO';
  const isKhoa = user?.vaiTro === 'TRUONG_KHOA' || user?.vaiTro === 'TRO_LY';
  const isTroLy = user?.vaiTro === 'TRO_LY';
  const isTruongKhoa = user?.vaiTro === 'TRUONG_KHOA';
  const canDelete = user?.vaiTro === 'QL_KHO';

  const eqFiltered = useMemo(() => {
    return equipment.filter(e =>
      e.trangThai && (e.tenThietBi.toLowerCase().includes(searchEq.toLowerCase()) || e.maThietBi.toLowerCase().includes(searchEq.toLowerCase()))
    );
  }, [equipment, searchEq]);

  const reqFiltered = useMemo(() => {
    let list = requests;
    
    if (isTroLy || isTruongKhoa) {
      list = list.filter(r => r.maKhoa === user!.maKhoa);
    }

    if (isQlKho && !isNvkho) {
      // QL Kho chỉ thấy phiếu khi đã qua bước Trưởng Khoa
      list = list.filter(r => ['CHO_QL_KHO_DUYET', 'DA_QL_KHO_DUYET', 'DA_CAP_PHAT', 'TU_CHOI'].includes(r.trangThai) && r.trangThai !== 'CHO_TRUONG_KHOA_DUYET');
    }

    if (isNvkho && user?.vaiTro !== 'ADMIN') {
      // NV Kho chỉ thấy phiếu khi đã qua bước QL Kho
      list = list.filter(r => ['DA_QL_KHO_DUYET', 'DA_CAP_PHAT'].includes(r.trangThai));
    }

    return list.filter(r => {
      const matchSearch = r.maPhieu.toLowerCase().includes(search.toLowerCase());
      const matchDept = filterDept === 'all' || r.maKhoa === filterDept;
      return matchSearch && matchDept;
    });
  }, [requests, search, isTroLy, isTruongKhoa, isQlKho, isNvkho, user, filterDept]);

  // Xử lý logic giỏ hàng
  const addToCart = (tb: ThietBi) => {
    setCart(prev => {
      const existing = prev.find(item => item.tb.maThietBi === tb.maThietBi);
      if (existing) {
        return prev.map(item => item.tb.maThietBi === tb.maThietBi ? { ...item, soLuong: item.soLuong + 1 } : item);
      }
      return [...prev, { tb, soLuong: 1, donVi: tb.donViCoSo, ngayTraDuKien: '' }];
    });
    toast({ title: 'Đã thêm vào giỏ', description: `${tb.tenThietBi}` });
  };

  const updateCartQty = (id: string, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.tb.maThietBi !== id));
    else setCart(prev => prev.map(i => i.tb.maThietBi === id ? { ...i, soLuong: qty } : i));
  };

  const updateCartUnit = (id: string, unit: string) => {
    setCart(prev => prev.map(i => i.tb.maThietBi === id ? { ...i, donVi: unit } : i));
  };

  const updateCartReturnDate = (id: string, date: string) => {
    setCart(prev => prev.map(i => i.tb.maThietBi === id ? { ...i, ngayTraDuKien: date } : i));
  };

  const submitCart = async () => {
    if (cart.length === 0) return toast({ title: 'Lỗi', description: 'Giỏ hàng rỗng.', variant: 'destructive' });
    if (!khoaYeuCau && isKhoa && !departments.find(k => k.maKhoa === khoaYeuCau)) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn khoa của bạn hợp lệ.', variant: 'destructive' }); return;
    }
    if (!lyDo) return toast({ title: 'Lỗi', description: 'Vui lòng nhập lý do (vd: Phục vụ phòng mổ).', variant: 'destructive' });

    let hasError = false;
    for (const item of cart) {
      if (item.tb.loaiThietBi !== 'VAT_TU_TIEU_HAO') {
        if (!item.ngayTraDuKien) {
          toast({ title: 'Lỗi', description: `Vui lòng chọn ngày trả thiết bị do mượn (${item.tb.tenThietBi})`, variant: 'destructive' });
          hasError = true; break;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const returnDate = new Date(item.ngayTraDuKien);
        if (returnDate <= today) {
          toast({ title: 'Lỗi', description: `Ngày trả thiết bị (${item.tb.tenThietBi}) phải sau ngày hôm nay.`, variant: 'destructive' });
          hasError = true; break;
        }
      }

      const inv = inventory.find(i => i.maThietBi === item.tb.maThietBi);
      const factor = item.donVi === item.tb.donViNhap ? (item.tb.heSoQuyDoi || 1) : 1;
      const totalBaseQty = item.soLuong * factor;

      if (!inv || totalBaseQty > inv.soLuongKho) {
        toast({
          title: 'Tồn kho không đủ',
          description: `${item.tb.tenThietBi} yêu cầu quy đổi ${totalBaseQty} ${item.tb.donViCoSo}, nhưng kho chỉ còn ${inv?.soLuongKho || 0} ${item.tb.donViCoSo}.`,
          variant: 'destructive'
        });
        hasError = true; break;
      }
    }
    if (hasError) return;

    try {
      const result = await apiCreateRequest({
        maNguoiYeuCau: user!.maNguoiDung,
        maKhoa: isKhoa ? user?.maKhoa : khoaYeuCau,
        lyDo,
        items: cart.map(item => ({
          maThietBi: item.tb.maThietBi,
          soLuong: item.soLuong,
          donVi: item.donVi,
          ngayTraDuKien: item.ngayTraDuKien
        }))
      });

      if (result.success) {
        await refreshRequests();
        setCartOpen(false);
        setCart([]);
        setLyDo('');

        if (result.maPhieu) {
          setQrDataStr(result.maPhieu);
          setQrOpen(true);
        }

        toast({ title: 'Thành công', description: `Đã gửi yêu cầu cấp phát.` });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  const refreshRequests = async () => {
    const resList = await fetchApi<any[]>('/requests');
    if (Array.isArray(resList)) {
      store.setRequests(resList);
      setRequests(resList);
    }
  };

  const handleReadNotification = async (id: string) => {
    try {
      const result = await fetchApi<any>(`/notifications/${id}/read`, { method: 'PUT' });
      if (result && result.success) {
        const updated = store.getNotifications().map(n => n.id === id ? { ...n, daDoc: true } : n);
        store.setNotifications(updated);
        // Force re-render if needed, but Zustand/store should trigger re-render or we can just update local state if it's mirrored
      }
    } catch (error) {
      console.error(error);
    }
  };

  const startProcessing = async (maPhieu: string) => {
    // Cả NV Kho và Trưởng khoa đều có thể xem, nhưng chỉ ql Kho mới có thể chỉnh sửa các yêu cầu đang chờ duyệt
    setLoading(true);
    setProofImage(null); // Reset ảnh chứng minh mỗi lần mở phiếu mới
    try {
      const result = await apiScanRequest(maPhieu);
      if (result.success) {
        // Đính kèm danh sách thiết bị vào đối tượng yêu cầu để Dialog có thể truy cập
        const requestWithItems = {
          ...result.request,
          items: result.items
        };
        setProcessingRequest(requestWithItems);

        setProcessItems(result.items.map((i: any) => ({
          maThietBi: i.maThietBi,
          approved: i.trangThai !== 'TU_CHOI' && i.trangThai !== 'DA_HUY',
          lyDo: i.lyDoTuChoi || ''
        })));
        setAllocateOpen(true);
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: 'Không thể tải chi tiết phiếu', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const submitProcessItems = async () => {
    if (!processingRequest) return;
    setLoading(true);
    try {
      let result;
      if ((isTruongKhoa || isTroLy) && (processingRequest.trangThai === 'CHO_TRUONG_KHOA_DUYET' || processingRequest.trangThai === 'CHO_DUYET')) {
        result = await fetchApi(`/requests/${processingRequest.maPhieu}/approve-dept`, {
          method: 'PUT',
          body: JSON.stringify({ items: processItems })
        });
      } else if (isQlKho && processingRequest.trangThai === 'CHO_QL_KHO_DUYET') {
        result = await fetchApi(`/requests/${processingRequest.maPhieu}/approve-mgr`, {
          method: 'PUT',
          body: JSON.stringify({ items: processItems })
        });
      } else {
        result = await apiProcessRequestItems(processingRequest.maPhieu, {
          items: processItems,
          ghiChu: processGhiChu,
          proofImage: proofImage
        });
      }

      if (result.success) {
        toast({ title: 'Thành công', description: result.message });
        setAllocateOpen(false);
        setProcessingRequest(null);
        setProcessGhiChu('');
        await refreshRequests();
        const resAlloc = await fetchApi<any[]>('/allocations');
        if (Array.isArray(resAlloc)) store.setAllocations(resAlloc);
        const resInv = await fetchApi<any[]>('/inventory');
        if (Array.isArray(resInv)) store.setInventory(resInv);
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi kết nối', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };


  const handleApprove = async (id: string) => {
    try {
      const endpoint = (user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'ADMIN') ? `/requests/${id}/approve-mgr` : `/requests/${id}/approve-dept`;
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ approved: true, lyDo: '' })
      });
      const result = await response.json();
      if (result.success) {
        await refreshRequests();
        toast({ title: 'Đã duyệt phiếu.' });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể thực hiện duyệt.', variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return toast({ title: 'Lỗi', description: 'Nhập lý do từ chối', variant: 'destructive' });
    try {
      const endpoint = (user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'ADMIN') ? `/requests/${rejectingId}/approve-mgr` : `/requests/${rejectingId}/approve-dept`;
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ approved: false, lyDo: rejectReason })
      });
      const result = await response.json();
      if (result.success) {
        await refreshRequests();
        setRejectOpen(false);
        setRejectReason('');
        toast({ title: 'Đã từ chối phiếu.' });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể thực hiện từ chối.', variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/requests/${cancellingId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const result = await response.json();
      if (result.success) {
        await refreshRequests();
        setCancelOpen(false);
        toast({ title: 'Đã hủy phiếu yêu cầu.' });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể thực hiện hủy.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/requests/${deleteConfirmId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const result = await response.json();
      if (result.success) {
        setDeleteConfirmId(null);
        await refreshRequests();
        toast({ title: 'Thành công', description: 'Đã xóa phiếu yêu cầu.' });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Lỗi', description: 'Không thể thực hiện xóa.', variant: 'destructive' });
    }
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

  const exportSingleRequestPDF = (r: any) => {
    if (!r) return;
    try {
      const doc = new jsPDF();
      const khoa = departments.find(k => k.maKhoa === r.maKhoa);
      const requester = users.find(u => u.maNguoiDung === r.maNguoiYeuCau);
      const tenNguoiYeuCau = requester?.hoTen || r.maNguoiYeuCau || 'Trợ lý khoa';
      const tenKhoa = khoa?.tenKhoa || r.maKhoa;

      doc.setFontSize(10);
      doc.text(removeVietnameseTones('BO Y TE - BENH VIEN MEDEQUIP'), 14, 15);
      doc.text(removeVietnameseTones(`Khoa/Phong: ${tenKhoa}`), 14, 21);
      doc.text(removeVietnameseTones(`Ma phieu: ${r.maPhieu}`), 14, 27);

      doc.text(removeVietnameseTones('CONG HOA XA HOI CHU NGHIA VIET NAM'), 196, 15, { align: 'right' });
      doc.text(removeVietnameseTones('Doc lap - Tu do - Hanh phuc'), 196, 21, { align: 'right' });
      doc.line(135, 23, 196, 23);

      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.text(removeVietnameseTones('GIAY DE NGHI CAP PHAT THIET BI Y TE'), 105, 38, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text(removeVietnameseTones('(Dung cho Tro ly / Khoa phong de nghi cap phat thiet bi y te)'), 105, 44, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(removeVietnameseTones(`Don vi de nghi: ${tenKhoa}`), 14, 54);
      doc.text(removeVietnameseTones(`Nguoi de nghi (Tro ly): ${tenNguoiYeuCau}`), 14, 61);
      doc.text(removeVietnameseTones(`Ngay yeu cau: ${new Date(r.ngayTao).toLocaleString('vi-VN')}`), 14, 68);
      doc.text(removeVietnameseTones(`Trang thai: ${STATUS_MAP[r.trangThai as keyof typeof STATUS_MAP] || r.trangThai}`), 14, 75);
      doc.text(removeVietnameseTones(`Ly do / Muc dich: ${r.lyDo || 'Khong co ghi chu'}`), 14, 82);

      const tableColumn = ["STT", "Ma TB", "Ten Thiet Bi Y Te", "DVT", "SL De Nghi", "Ghi Chu"].map(removeVietnameseTones);
      const tableRows: any[] = [];

      if (r.items && r.items.length > 0) {
        r.items.forEach((item: any, i: number) => {
          tableRows.push([
            (i + 1).toString(),
            item.maThietBi,
            removeVietnameseTones(item.tenThietBi || item.maThietBi),
            removeVietnameseTones(item.donVi || item.donViTinh || 'Cai'),
            item.soLuongCoSo ? item.soLuongCoSo.toString() : (item.soLuong?.toString() || '1'),
            removeVietnameseTones(item.ghiChu || '')
          ]);
        });
      } else {
        tableRows.push(["1", r.maThietBi || '', removeVietnameseTones(r.tenThietBi || ''), 'Cai', r.soLuongYeuCau?.toString() || '1', '']);
      }

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 88,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 12 },
          1: { halign: 'center', cellWidth: 25 },
          2: { cellWidth: 60 },
          3: { halign: 'center', cellWidth: 18 },
          4: { halign: 'center', cellWidth: 22 },
          5: { cellWidth: 'auto' }
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
      doc.text(removeVietnameseTones('NGUOI DE NGHI'), 35, finalY + 8, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 35, finalY + 13, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(removeVietnameseTones('TRUONG KHOA DUYET'), 105, finalY + 8, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 105, finalY + 13, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(removeVietnameseTones('KHO CAP PHAT'), 175, finalY + 8, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 175, finalY + 13, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(removeVietnameseTones(tenNguoiYeuCau), 35, finalY + 36, { align: 'center' });

      doc.save(`bieu_mau_yeu_cau_${r.maPhieu}.pdf`);
      toast({ title: 'Thành công', description: `Đã xuất PDF biểu mẫu phiếu ${r.maPhieu}` });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Lỗi', description: `Không thể xuất PDF: ${err.message}`, variant: 'destructive' });
    }
  };

  const handleExportPDF = () => {
    try {
      const toExport = reqFiltered.filter(r => selectedReqIds.includes(r.maPhieu));
      if (toExport.length === 0) {
        toast({ title: 'Chưa chọn', description: 'Vui lòng tick chọn ít nhất 1 phiếu để xuất.', variant: 'destructive' });
        return;
      }
      const doc = new jsPDF();
      
      toExport.forEach((r, index) => {
        if (index > 0) doc.addPage();
        
        const khoa = departments.find(k => k.maKhoa === r.maKhoa);
        const requester = users.find(u => u.maNguoiDung === r.maNguoiYeuCau);
        const tenNguoiYeuCau = requester?.hoTen || r.maNguoiYeuCau || 'Trợ lý khoa';
        const tenKhoa = khoa?.tenKhoa || r.maKhoa;
        
        doc.setFontSize(10);
        doc.text(removeVietnameseTones('BO Y TE - BENH VIEN MEDEQUIP'), 14, 15);
        doc.text(removeVietnameseTones(`Khoa/Phong: ${tenKhoa}`), 14, 21);
        doc.text(removeVietnameseTones(`Ma phieu: ${r.maPhieu}`), 14, 27);
        
        doc.text(removeVietnameseTones('CONG HOA XA HOI CHU NGHIA VIET NAM'), 196, 15, { align: 'right' });
        doc.text(removeVietnameseTones('Doc lap - Tu do - Hanh phuc'), 196, 21, { align: 'right' });
        doc.line(135, 23, 196, 23);

        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(removeVietnameseTones('GIAY DE NGHI CAP PHAT THIET BI Y TE'), 105, 38, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(removeVietnameseTones(`Don vi: ${tenKhoa}`), 14, 52);
        doc.text(removeVietnameseTones(`Nguoi de nghi: ${tenNguoiYeuCau}`), 14, 59);
        doc.text(removeVietnameseTones(`Ngay yeu cau: ${new Date(r.ngayTao).toLocaleString('vi-VN')}`), 14, 66);
        doc.text(removeVietnameseTones(`Ly do: ${r.lyDo || '---'}`), 14, 73);

        const tableColumn = ["STT", "Ma TB", "Ten Thiet Bi Y Te", "DVT", "SL De Nghi", "Ghi Chu"].map(removeVietnameseTones);
        const tableRows: any[] = [];
        
        if (r.items && r.items.length > 0) {
          r.items.forEach((item, i) => {
            tableRows.push([
              (i + 1).toString(),
              item.maThietBi,
              removeVietnameseTones(item.tenThietBi || item.maThietBi),
              removeVietnameseTones(item.donVi || item.donViTinh || 'Cai'),
              item.soLuongCoSo ? item.soLuongCoSo.toString() : (item.soLuong?.toString() || '1'),
              removeVietnameseTones(item.ghiChu || '')
            ]);
          });
        } else {
          tableRows.push(["1", r.maThietBi || '', removeVietnameseTones(r.tenThietBi || ''), 'Cai', r.soLuongYeuCau?.toString() || '1', '']);
        }

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: 80,
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 12 },
            1: { halign: 'center', cellWidth: 25 },
            2: { cellWidth: 60 },
            3: { halign: 'center', cellWidth: 18 },
            4: { halign: 'center', cellWidth: 22 },
            5: { cellWidth: 'auto' }
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
        doc.text(removeVietnameseTones('NGUOI DE NGHI'), 35, finalY + 8, { align: 'center' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 35, finalY + 13, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(removeVietnameseTones('TRUONG KHOA DUYET'), 105, finalY + 8, { align: 'center' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 105, finalY + 13, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(removeVietnameseTones('KHO CAP PHAT'), 175, finalY + 8, { align: 'center' });
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(removeVietnameseTones('(Ky, ghi ro ho ten)'), 175, finalY + 13, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(removeVietnameseTones(tenNguoiYeuCau), 35, finalY + 36, { align: 'center' });
      });

      doc.save('bieu_mau_cap_phat_thiet_bi.pdf');
      toast({ title: 'Thành công', description: `Đã xuất PDF biểu mẫu cho ${toExport.length} phiếu.` });
      setSelectedReqIds([]);
    } catch (err: any) {
      console.error("Lỗi khi xuất PDF:", err);
      toast({ title: 'Lỗi', description: `Không thể xuất PDF: ${err.message}`, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in relative min-h-[80vh]">
      <Tabs defaultValue={isTroLy ? "catalog" : "history"} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-2 rounded-xl border mb-4 shadow-sm gap-4 relative">
          <TabsList className="bg-muted">
            {isTroLy && <TabsTrigger value="catalog" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Danh mục TB (Yêu cầu cấp phát)</TabsTrigger>}
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {isKhoa ? "Lịch sử Yêu cầu" : "Danh sách Yêu cầu"}
            </TabsTrigger>
          </TabsList>

          {isNvkho && (
            <Button onClick={() => setScanOpen(true)} className="bg-foreground text-background hover:bg-foreground/80">
              <Camera className="w-4 h-4 mr-2" /> Quét QR Duyệt nhanh
            </Button>
          )}

          {/* MỚI: Nút thông báo cụ thể cho yêu cầu cấp phát */}
          <Button onClick={() => setNotifOpen(true)} variant="outline" className="relative shadow-sm mr-2 h-10 w-10 p-0 border-muted-foreground/20">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {unreadNotifs > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full animate-pulse">
                {unreadNotifs}
              </span>
            )}
          </Button>

          {isTroLy && (
            <Button onClick={() => setCartOpen(true)} className="gradient-primary text-primary-foreground shadow-md mr-2 relative">
              <ShoppingCart className="w-4 h-4 mr-2" /> Giỏ hàng yêu cầu
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full animate-in zoom-in">
                  {cart.length}
                </span>
              )}
            </Button>
          )}
        </div>

        {isTroLy && (
          <TabsContent value="catalog" className="mt-0">
            <div className="flex items-center mb-4">
              <div className="relative max-w-sm w-full shadow-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Tìm thiết bị trong kho..." value={searchEq} onChange={e => setSearchEq(e.target.value)} className="pl-10" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {eqFiltered.map(tb => {
                const maxKho = inventory.find(i => i.maThietBi === tb.maThietBi)?.soLuongKho || 0;
                return (
                  <div key={tb.maThietBi} className="bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all group flex flex-col">
                    <div className="aspect-square bg-muted/30 relative flex border-b">
                      {tb.hinhAnh ? (
                        <img src={tb.hinhAnh} className="object-cover w-full h-full" alt={tb.tenThietBi} />
                      ) : (
                        <div className="m-auto text-muted-foreground flex flex-col items-center gap-2">
                          <Box className="w-12 h-12 opacity-20" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold shadow-sm ${maxKho > 0 ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground'}`}>
                          Tồn: {maxKho}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <h4 className="font-bold text-sm line-clamp-1 mb-1 group-hover:text-primary transition-colors" title={tb.tenThietBi}>{tb.tenThietBi}</h4>
                      <p className="text-[10px] font-mono text-muted-foreground mb-2">{tb.maThietBi} • {tb.loaiThietBi === 'TAI_SU_DUNG' ? 'Tái sử dụng' : 'Khấu hao'}</p>
                      <div className="mt-auto pt-2">
                        <Button
                          onClick={() => addToCart(tb)}
                          disabled={maxKho <= 0}
                          className="w-full text-xs h-8"
                          variant={maxKho > 0 ? 'default' : 'secondary'}
                        >
                          {maxKho > 0 ? (cart.some(c => c.tb.maThietBi === tb.maThietBi) ? 'Thêm tiếp' : 'Thêm vào giỏ') : 'Hết hàng'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {eqFiltered.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground">Không tìm thấy thiết bị nào trong kho.</div>}
            </div>
          </TabsContent>
        )}

        <TabsContent value="history" className="mt-0">
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Tìm mã phiếu..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            {(isNvkho || isQlKho) && (
              <SearchableSelect
                options={[{ value: 'all', label: 'Tất cả khoa' }, ...departments.map(k => ({ value: k.maKhoa, label: k.tenKhoa }))]}
                value={filterDept}
                onValueChange={setFilterDept}
                placeholder="Lọc theo khoa"
              />
            )}
            {(isNvkho || isTroLy || isTruongKhoa) && (
              <Button
                variant="outline"
                onClick={handleExportPDF}
                className={cn(
                  "border-indigo-200 text-indigo-600 hover:bg-indigo-50",
                  selectedReqIds.length === 0 && "opacity-50"
                )}
              >
                <Download className="w-4 h-4 mr-2" />
                Xuất Biểu Mẫu PDF {selectedReqIds.length > 0 && `(${selectedReqIds.length})`}
              </Button>
            )}
          </div>

          <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  {(isNvkho || isTroLy || isTruongKhoa) && (
                    <th className="p-3 w-10 text-center">
                      <Checkbox
                        checked={reqFiltered.length > 0 && reqFiltered.every(r => selectedReqIds.includes(r.maPhieu))}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            const newIds = new Set(selectedReqIds);
                            reqFiltered.forEach(r => newIds.add(r.maPhieu));
                            setSelectedReqIds(Array.from(newIds));
                          } else {
                            setSelectedReqIds(selectedReqIds.filter(id => !reqFiltered.some(r => r.maPhieu === id)));
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="text-left p-3 font-medium text-muted-foreground w-1/6">Mã YC</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Khoa</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Danh mục yêu cầu</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Số lượng mục</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Trạng thái</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Ngày YC</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Hành động</th>
                </tr></thead>
                <tbody>
                  {reqFiltered.map(r => {
                    const khoa = departments.find(k => k.maKhoa === r.maKhoa);
                    const itemCount = r.items?.length || 1;
                    const mainItem = r.items?.[0] || { tenThietBi: r.tenThietBi || r.maThietBi };
                    const isSelected = selectedReqIds.includes(r.maPhieu);

                    return (
                      <tr key={r.maPhieu} className={cn("border-b hover:bg-primary/5 transition-colors cursor-pointer group", isSelected && "bg-indigo-50/50")} onClick={() => startProcessing(r.maPhieu)}>
                        {(isNvkho || isTroLy || isTruongKhoa) && (
                          <td className="p-3" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedReqIds([...selectedReqIds, r.maPhieu]);
                                else setSelectedReqIds(selectedReqIds.filter(id => id !== r.maPhieu));
                              }}
                            />
                          </td>
                        )}
                        <td className="p-3 font-mono text-xs font-bold group-hover:text-primary transition-colors">{r.maPhieu}</td>
                        <td className="p-3">{khoa?.tenKhoa || r.maKhoa}</td>
                        <td className="p-3">
                          <div className="font-medium">
                            {itemCount > 1 ? `${mainItem.tenThietBi} và ${itemCount - 1} thiết bị khác...` : mainItem.tenThietBi}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-xs">{r.lyDo}</div>
                        </td>
                        <td className="p-3 text-center font-bold text-lg">{itemCount}</td>
                        <td className="p-3 text-center">
                          <span className={cn(`px-3 py-1 rounded-full text-[10px] uppercase font-bold border`, STATUS_COLORS[r.trangThai as keyof typeof STATUS_COLORS] || 'bg-muted')}>
                            {r.trangThai === 'DA_HUY' ? 'Đã hủy' : (STATUS_MAP[r.trangThai as keyof typeof STATUS_MAP] || r.trangThai)}
                          </span>
                          {isNvkho && r.trangThai === 'DA_HUY' && (
                            <div className="text-[10px] text-destructive mt-2 font-medium italic">Phiếu yêu cầu đã bị hủy bởi người yêu cầu</div>
                          )}
                        </td>
                        <td className="p-3 text-center text-xs text-muted-foreground">{new Date(r.ngayTao).toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-xs h-8 mr-1 inline-flex items-center gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewReq(r);
                              setPreviewOpen(true);
                            }}
                            title="Xem biểu mẫu đề nghị cấp phát"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Biểu mẫu</span>
                          </Button>
                          {isTruongKhoa && (r.trangThai === 'CHO_TRUONG_KHOA_DUYET' || r.trangThai === 'CHO_DUYET') && (
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 mr-2" onClick={(e) => { e.stopPropagation(); startProcessing(r.maPhieu); }}>
                              Xử lý duyệt
                            </Button>
                          )}
                          {isQlKho && r.trangThai === 'CHO_QL_KHO_DUYET' && (
                            <Button size="sm" className="gradient-primary text-white text-xs h-8 mr-2" onClick={(e) => { e.stopPropagation(); startProcessing(r.maPhieu); }}>
                              Xử lý duyệt
                            </Button>
                          )}
                          {isNvkho && r.trangThai === 'DA_QL_KHO_DUYET' && (
                            <Button size="sm" className="gradient-primary text-white text-xs h-8" onClick={(e) => { e.stopPropagation(); startProcessing(r.maPhieu); }}>
                              Xử lý cấp phát
                            </Button>
                          )}
                          {isNvkho && r.trangThai === 'DA_CAP_PHAT' && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); setQrDataStr(r.maPhieu); setQrOpen(true); }}>
                              <QrCode className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                          {isTroLy && (r.trangThai === 'CHO_TRUONG_KHOA_DUYET' || r.trangThai === 'CHO_DUYET') && (() => {
                            const createdAt = new Date(r.ngayTao);
                            const diffMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);
                            const canCancel = diffMinutes <= 30;
                            return canCancel ? (
                              <Button size="sm" variant="destructive" className="text-xs h-8 ml-2" onClick={(e) => { e.stopPropagation(); setCancellingId(r.maPhieu); setCancelOpen(true); }}>
                                Hủy
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled className="text-xs h-8 ml-2 text-muted-foreground cursor-not-allowed" title="Đã quá 30 phút, không thể hủy phiếu">
                                Hết hạn hủy
                              </Button>
                            );
                          })()}
                          {isTroLy && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 ml-1" title="Xem mã QR phiếu" onClick={(e) => { e.stopPropagation(); setQrDataStr(r.maPhieu); setQrOpen(true); }}>
                              <QrCode className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 ml-2" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(r.maPhieu); }}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {reqFiltered.length === 0 && <div className="text-center py-12 text-muted-foreground">Không có dữ liệu yêu cầu.</div>}
          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL GIỎ HÀNG (Dành cho Trưởng khoa) */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b shadow-sm z-10 bg-card"><DialogTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-primary" /> Giỏ hàng yêu cầu cấp phát</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto bg-muted/10 p-5 space-y-5">
            {cart.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground border-2 border-dashed bg-card rounded-xl">Không có thiết bị trong giỏ. Vui lòng thêm từ mục Danh mục.</div>
            ) : (
              <div className="space-y-3">
                {cart.map((item, idx) => {
                  const maxKho = inventory.find(i => i.maThietBi === item.tb.maThietBi)?.soLuongKho || 0;
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border rounded-xl p-3 bg-card shadow-sm gap-3">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-10 h-10 rounded bg-muted/40 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.tb.hinhAnh ? <img src={item.tb.hinhAnh} className="object-cover w-full h-full" alt="" /> : <Box className="w-5 h-5 text-muted-foreground/30" />}
                        </div>
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-sm truncate">{item.tb.tenThietBi}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {item.tb.maThietBi} • Tồn: {inventory.find(i => i.maThietBi === item.tb.maThietBi)?.soLuongKho} {item.tb.donViCoSo}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg border">
                          <button
                            className={cn("px-2 py-0.5 text-[10px] rounded transition-all", item.donVi === item.tb.donViCoSo ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground")}
                            onClick={() => updateCartUnit(item.tb.maThietBi, item.tb.donViCoSo)}
                          >
                            {item.tb.donViCoSo}
                          </button>
                          {item.tb.donViNhap && item.tb.donViNhap !== item.tb.donViCoSo && (
                            <button
                              className={cn("px-2 py-0.5 text-[10px] rounded transition-all", item.donVi === item.tb.donViNhap ? "bg-white shadow-sm font-bold text-primary" : "text-muted-foreground")}
                              onClick={() => updateCartUnit(item.tb.maThietBi, item.tb.donViNhap || 'Hộp')}
                            >
                              {item.tb.donViNhap}
                            </button>
                          )}
                        </div>
                        {item.donVi === item.tb.donViNhap && (
                          <div className="text-[9px] text-primary/70 font-medium">
                            Quy đổi: {item.soLuong * (item.tb.heSoQuyDoi || 1)} {item.tb.donViCoSo}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 w-full sm:w-auto justify-end">
                        {item.tb.loaiThietBi !== 'VAT_TU_TIEU_HAO' && (
                          <div className="flex flex-col items-start w-full sm:w-auto">
                            <span className="text-[10px] text-muted-foreground ml-1">Ngày trả dự kiến *</span>
                            <Input type="date" value={item.ngayTraDuKien || ''} onChange={e => updateCartReturnDate(item.tb.maThietBi, e.target.value)} className="h-8 max-w-[130px] text-xs bg-muted/20" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 border bg-muted/20 p-1 rounded-lg w-full sm:w-auto justify-end mt-4 sm:mt-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded" onClick={() => updateCartQty(item.tb.maThietBi, item.soLuong - 1)}><Minus className="w-3 h-3" /></Button>
                          <Input
                            type="number"
                            className="w-10 h-6 text-center font-bold bg-transparent border-0 focus-visible:ring-0 p-0 text-primary"
                            value={item.soLuong}
                            onChange={e => updateCartQty(item.tb.maThietBi, parseInt(e.target.value) || 0)}
                            min={0} max={maxKho}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded" onClick={() => updateCartQty(item.tb.maThietBi, item.soLuong + 1)} disabled={item.soLuong >= maxKho}><Plus className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {cart.length > 0 && (
              <div className="space-y-4 bg-card p-4 rounded-xl border shadow-sm mt-4">
                <h3 className="font-bold text-sm border-b pb-2">Thông tin người yêu cầu</h3>
                <div className="grid gap-4">
                  {!isTroLy && (
                    <div>
                      <Label className="mb-1 block text-muted-foreground">Khoa nhận cấp phát <span className="text-destructive">*</span></Label>
                      <SearchableSelect
                        options={departments.map(k => ({ value: k.maKhoa, label: k.tenKhoa }))}
                        value={khoaYeuCau}
                        onValueChange={setKhoaYeuCau}
                        placeholder="Tìm và Chọn khoa"
                      />
                    </div>
                  )}
                  <div>
                    <Label className="mb-1 block text-muted-foreground">Lý do nhận / Yêu cầu thêm <span className="text-destructive">*</span></Label>
                    <Textarea value={lyDo} onChange={e => setLyDo(e.target.value)} placeholder="Nhập mục đích sử dụng..." className="h-20 resize-none z-10 relative" style={{ isolation: 'isolate' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 border-t bg-card z-10">
            <Button variant="ghost" onClick={() => setCartOpen(false)}>Đóng</Button>
            <Button className="gradient-primary text-white shadow-md" onClick={submitCart} disabled={cart.length === 0}>Gửi Yêu Cầu Cấp Phát</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MỚI: Dialog xử lý nhiều thiết bị */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
          {processingRequest && (
            <>
              <div className="p-6 overflow-y-auto">
                <DialogHeader className="mb-6">
                  <div className="flex justify-between items-center w-full">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                      <PackageCheck className="w-6 h-6 text-primary" /> Xử lý phiếu {processingRequest.maPhieu}
                    </DialogTitle>
                    <Badge variant="outline">{departments.find(d => d.maKhoa === processingRequest.maKhoa)?.tenKhoa}</Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="bg-muted/30 p-4 rounded-xl border space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Thông tin yêu cầu</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <p><span className="text-muted-foreground">Người mượn:</span> <span className="font-semibold">{users.find(u => u.maNguoiDung === processingRequest.maNguoiYeuCau)?.hoTen}</span></p>
                      <p><span className="text-muted-foreground">Khoa:</span> <span className="font-semibold">{departments.find(d => d.maKhoa === processingRequest.maKhoa)?.tenKhoa}</span></p>
                      <p className="col-span-2"><span className="text-muted-foreground">Lý do:</span> <span className="italic">"{processingRequest.lyDo}"</span></p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Duyệt từng thiết bị
                    </Label>
                    <div className="border rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                          <tr>
                            <th className="text-left p-3 font-medium text-muted-foreground">Thiết bị</th>
                            <th className="text-center p-3 font-medium text-muted-foreground w-1/5">Số lượng</th>
                            {isNvkho && <th className="text-center p-3 font-medium text-muted-foreground w-1/5">Tồn kho</th>}
                            <th className="text-center p-3 font-medium text-muted-foreground w-1/5">Quyết định</th>
                            <th className="text-left p-3 font-medium text-muted-foreground w-1/4">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {processItems.map((item, idx) => {
                            const details = processingRequest.items?.find((it: any) => it.maThietBi === item.maThietBi) ||
                              { tenThietBi: item.maThietBi, soLuong: 0, tonKho: 0 };
                            const itemStatus = details.trangThai || 'CHO_DUYET';
                            const isEditable = (
                              (isTruongKhoa && (processingRequest.trangThai === 'CHO_TRUONG_KHOA_DUYET' || processingRequest.trangThai === 'CHO_DUYET')) ||
                              (isQlKho && processingRequest.trangThai === 'CHO_QL_KHO_DUYET' && itemStatus !== 'TU_CHOI') ||
                              (isNvkho && processingRequest.trangThai === 'DA_QL_KHO_DUYET' && itemStatus !== 'TU_CHOI')
                            );

                            return (
                              <tr key={idx} className={item.approved ? 'bg-green-50/20' : 'bg-red-50/20'}>
                                <td className="p-3">
                                  <div className="font-medium">{details.tenThietBi}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{item.maThietBi}</div>
                                  {details.ngayTraDuKien && (
                                    <div className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md w-fit mt-1 border border-amber-200 font-medium whitespace-nowrap">
                                      Dự kiến trả: {new Date(details.ngayTraDuKien).toLocaleDateString('vi-VN')}
                                    </div>
                                  )}
                                  {!isEditable && (
                                    <Badge className={cn("mt-1 text-[8px] h-4",
                                      (itemStatus === 'DA_DUYET' || itemStatus === 'DA_CAP_PHAT') ? "bg-success text-white" : "bg-destructive text-white"
                                    )}>{STATUS_MAP[itemStatus as keyof typeof STATUS_MAP] || itemStatus}</Badge>
                                  )}
                                </td>
                                <td className="p-3 text-center border-r">
                                  <div className="font-bold text-base">{details.soLuong} {details.donViTinh}</div>
                                  {details.donViTinh !== details.donViCoSo && (
                                    <div className="text-[10px] text-muted-foreground">
                                      = {details.soLuongCoSo} {details.donViCoSo}
                                    </div>
                                  )}
                                </td>
                                {isNvkho && (
                                  <td className="p-3 text-center">
                                    <span className={cn(details.tonKho < (details.soLuong || 0) ? 'text-destructive font-bold' : 'text-success')}>
                                      {details.tonKho}
                                    </span>
                                  </td>
                                )}
                                <td className="p-3">
                                  {isEditable ? (
                                    <div className="flex bg-muted/50 p-0.5 rounded-lg w-fit mx-auto shadow-inner">
                                      <button
                                        onClick={() => {
                                          const newItems = [...processItems];
                                          newItems[idx].approved = true;
                                          setProcessItems(newItems);
                                        }}
                                        className={cn(
                                          "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
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
                                          "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                                          !item.approved ? "bg-white text-red-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                                        )}
                                      >
                                        Từ chối
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      {item.approved ? <CheckCheck className="w-5 h-5 text-success mx-auto" /> : <X className="w-5 h-5 text-destructive mx-auto" />}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  {isEditable ? (
                                    !item.approved && (
                                      <Input
                                        placeholder="Lý do..."
                                        value={item.lyDo}
                                        onChange={e => {
                                          const newItems = [...processItems];
                                          newItems[idx].lyDo = e.target.value;
                                          setProcessItems(newItems);
                                        }}
                                        className="h-7 text-[10px] border-red-200"
                                      />
                                    )
                                  ) : (
                                    !item.approved && <span className="text-[10px] text-destructive italic">{details.lyDoTuChoi || item.lyDo}</span>
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
                    <Label className="text-sm font-bold">Ghi chú chung cho khoa</Label>
                    <Textarea
                      placeholder="VD: Mang theo thẻ nhân viên khi nhận thiết bị..."
                      value={processGhiChu}
                      onChange={e => setProcessGhiChu(e.target.value)}
                      readOnly={!(isNvkho && processingRequest.trangThai === 'DA_QL_KHO_DUYET')}
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                  
                  {/* Hiển thị ảnh chứng minh nếu đã có */}
                  {processingRequest.anhMinhChung && (
                    <div className="space-y-2 mt-4 p-4 border rounded-xl bg-yellow-50/50">
                      <Label className="text-sm font-bold text-yellow-800">Ảnh chứng minh bàn giao thiết bị</Label>
                      <div className="mt-2">
                        <img src={processingRequest.anhMinhChung} alt="Ảnh chứng minh" className="w-32 h-32 object-cover rounded-lg border shadow-sm" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Ảnh chứng minh bắt buộc cho NV Kho khi cấp phát */}
              {isNvkho && processingRequest.trangThai === 'DA_QL_KHO_DUYET' && (
                <div className="mx-6 mb-4 p-4 border-2 border-dashed rounded-xl space-y-3"
                  style={{ borderColor: proofImage ? 'hsl(160,60%,45%)' : 'hsl(0,84%,60%)' }}>
                  <Label className="text-sm font-bold flex items-center gap-2">
                    <ImagePlus className="w-4 h-4 text-primary" />
                    Ảnh chứng minh bàn giao thiết bị
                    <span className="text-destructive text-xs font-normal">(Bắt buộc trước khi hoàn thành cấp phát)</span>
                  </Label>
                  {proofImage ? (
                    <div className="flex items-center gap-3">
                      <img src={proofImage} alt="Proof" className="w-24 h-24 object-cover rounded-lg border shadow-sm" />
                      <div className="flex flex-col gap-2">
                        <span className="text-xs text-success font-medium">✓ Đã tải ảnh chứng minh</span>
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => setProofImage(null)}>Xóa ảnh</Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center gap-2 cursor-pointer py-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click để tải ảnh chứng minh bàn giao lên</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setProofImage(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  )}
                </div>
              )}

              <DialogFooter className="p-4 border-t bg-muted/20 flex flex-row items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setAllocateOpen(false)} disabled={loading}>Đóng</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPreviewReq(processingRequest);
                      setPreviewOpen(true);
                    }}
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  >
                    <FileText className="w-4 h-4 mr-1.5" /> Xem Biểu Mẫu
                  </Button>
                </div>
                {((isTruongKhoa && (processingRequest.trangThai === 'CHO_TRUONG_KHOA_DUYET' || processingRequest.trangThai === 'CHO_DUYET')) ||
                  (isQlKho && processingRequest.trangThai === 'CHO_QL_KHO_DUYET') ||
                  (isNvkho && processingRequest.trangThai === 'DA_QL_KHO_DUYET')) && (
                  <Button
                    onClick={submitProcessItems}
                    disabled={loading
                      || (isNvkho && processingRequest.trangThai === 'DA_QL_KHO_DUYET' && !proofImage)
                      || (isNvkho && processItems.some(i => i.approved && (processingRequest.items?.find((it: any) => it.maThietBi === i.maThietBi)?.tonKho || 0) < (processingRequest.items?.find((it: any) => it.maThietBi === i.maThietBi)?.soLuong || 0)))}
                    className="gradient-primary text-white font-bold min-w-[150px]"
                    title={isNvkho && processingRequest.trangThai === 'DA_QL_KHO_DUYET' && !proofImage ? 'Bắt buộc tải ảnh chứng minh bàn giao trước khi hoàn thành cấp phát' : undefined}
                  >
                    {loading ? 'Đang xử lý...' : (
                      isNvkho && processingRequest.trangThai === 'DA_QL_KHO_DUYET' && !proofImage
                        ? 'Ảnh chứng minh chưa tải lên'
                        : 'Xác nhận xử lý'
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL TỪ CHỐI */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive flex items-center gap-2"><X className="w-5 h-5" /> Từ chối cấp phát</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-muted-foreground">Ghi rõ lý do tại sao không thể cấp thiết bị này cho trưởng khoa:</Label>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="VD: Hết hàng tạm thời, sai thông số yêu cầu..." rows={4} className="resize-none" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Quay lại</Button>
            <Button variant="destructive" onClick={handleReject}>Gửi phản hồi Từ chối</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-destructive flex items-center gap-2"><Trash2 className="w-5 h-5" /> Hủy yêu cầu</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p>Bạn có chắc chắn muốn hủy phiếu yêu cầu <strong>{cancellingId}</strong> không?</p>
            <p className="text-sm text-muted-foreground">Hành động này không thể hoàn tác.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Quay lại</Button>
            <Button variant="destructive" onClick={handleCancel}>Xác nhận hủy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL THÔNG BÁO YÊU CẦU CẤP PHÁT */}
      <Dialog open={notifOpen} onOpenChange={setNotifOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Thông báo Yêu cầu Cấp phát
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Không có thông báo nào.</div>
            ) : (
              notifications.map(n => {
                // Trích xuất mã phiếu từ nội dung hoặc tiêu đề thông báo
                const maPhieuMatch = (n.noiDung + ' ' + n.tieuDe).match(/YCCF-\d{8}-\d{4}/);
                const maPhieu = maPhieuMatch ? maPhieuMatch[0] : null;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 rounded-xl border text-sm transition-all",
                      maPhieu ? "cursor-pointer hover:bg-primary/10 hover:border-primary/30 hover:shadow-md" : "cursor-pointer hover:bg-muted/50",
                      n.daDoc ? "bg-card opacity-70" : "bg-primary/5 border-primary/20 shadow-sm"
                    )}
                    onClick={async () => {
                      if (!n.daDoc) await handleReadNotification(n.id);
                      if (maPhieu) {
                        setNotifOpen(false);
                        startProcessing(maPhieu);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn("font-bold", !n.daDoc && "text-primary")}>{n.tieuDe}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(n.ngayTao).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="text-muted-foreground text-xs leading-relaxed">{n.noiDung}</p>
                    {maPhieu && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-primary font-semibold">
                        <span>→ Nhấn để xem phiếu {maPhieu}</span>
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
                toast({ title: 'Đã đánh dấu đọc tất cả thông báo Cấp phát' });
              }
            }}>
              Đánh dấu đã đọc tất cả
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm text-center flex flex-col items-center justify-center p-6 space-y-4">
          <DialogHeader><DialogTitle>Mã QR Yêu Cầu Cấp Phát</DialogTitle></DialogHeader>
          <div className="bg-white p-4 rounded-xl shadow-inner border inline-block mt-4">
            <QRCodeComponent
              value={qrDataStr}
              size={200}
              fgColor="#000000"
              level="H"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 font-mono font-bold">{qrDataStr}</p>
          <p className="text-[10px] text-muted-foreground">NV Kho có thể quét mã này để xử lý nhanh.</p>
          <Button variant="outline" onClick={() => setQrOpen(false)} className="w-full mt-4">Đóng</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={scanOpen} onOpenChange={(open) => { setScanOpen(open); if (!open) setManualCode(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nhận diện Yêu Cầu Cấp Phát</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="overflow-hidden rounded-xl border bg-black aspect-video relative">
              {scanOpen && (
                <Scanner
                  onScan={(detectedCodes) => {
                    if (detectedCodes && detectedCodes.length > 0) {
                      const code = detectedCodes[0].rawValue;
                      setScanOpen(false);
                      startProcessing(code);
                    }
                  }}
                  formats={['qr_code']}
                  components={{ audio: false, finder: true }}
                  styles={{ container: { width: '100%', height: '100%' } }}
                />
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Hoặc sử dụng cách khác</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="flex flex-col h-auto py-4 gap-2" onClick={() => document.getElementById('req-qr-file-input')?.click()}>
                <Upload className="h-6 w-6 text-primary" />
                <div className="text-xs">Tải ảnh QR lên</div>
                <input
                  id="req-qr-file-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      if (!('BarcodeDetector' in window)) {
                        toast({ title: 'Trình duyệt không hỗ trợ', description: 'Vui lòng nhập mã thủ công.', variant: 'destructive' });
                        return;
                      }
                      const img = new Image();
                      img.src = URL.createObjectURL(file);
                      await img.decode();
                      // @ts-ignore
                      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
                      const [barcode] = await barcodeDetector.detect(img);
                      if (barcode) {
                        setScanOpen(false);
                        startProcessing(barcode.rawValue);
                      } else {
                        toast({ title: 'Lỗi', description: 'Không tìm thấy mã QR trong ảnh này.', variant: 'destructive' });
                      }
                    } catch (err: any) {
                      toast({ title: 'Lỗi', description: 'Không thể xử lý ảnh: ' + err.message, variant: 'destructive' });
                    }
                  }}
                />
              </Button>

              <div className="space-y-2">
                <Button variant="outline" className="flex flex-col h-auto py-4 gap-2 w-full" onClick={() => (document.getElementById('req-manual-input') as HTMLInputElement)?.focus()}>
                  <Keyboard className="h-6 w-6 text-muted-foreground" />
                  <div className="text-xs">Nhập mã thủ công</div>
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                id="req-manual-input"
                placeholder="Ví dụ: YCCF-2026-12345"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setScanOpen(false);
                    startProcessing(manualCode);
                  }
                }}
              />
              <Button onClick={() => { setScanOpen(false); startProcessing(manualCode); }}>Tìm</Button>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setScanOpen(false)} className="w-full">Đóng</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM Modal */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Xác nhận xóa
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-foreground/80">
            Bạn có chắc chắn muốn xóa phiếu yêu cầu <span className="font-bold text-foreground">{deleteConfirmId}</span>? Hành động này sẽ xóa dữ liệu vĩnh viễn và không thể hoàn tác.
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete}>Xác nhận xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL XEM TRƯỚC VÀ IN BIỂU MẪU ĐỀ NGHỊ CẤP PHÁT */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-card z-10 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <FileText className="w-5 h-5 text-primary" />
              Biểu Mẫu Phiếu Yêu Cầu Cấp Phát Thiết Bị Y Tế {previewReq?.maPhieu && `(${previewReq.maPhieu})`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-muted/20">
            {previewReq && (() => {
              const khoa = departments.find(k => k.maKhoa === previewReq.maKhoa);
              const requester = users.find(u => u.maNguoiDung === previewReq.maNguoiYeuCau);
              const tenNguoiYeuCau = requester?.hoTen || previewReq.maNguoiYeuCau || 'Trợ lý khoa';
              const tenKhoa = khoa?.tenKhoa || previewReq.maKhoa;
              const dateCreated = new Date(previewReq.ngayTao);
              const day = dateCreated.getDate();
              const month = dateCreated.getMonth() + 1;
              const year = dateCreated.getFullYear();
              const itemsList = previewReq.items && previewReq.items.length > 0 
                ? previewReq.items 
                : [{
                    maThietBi: previewReq.maThietBi,
                    tenThietBi: previewReq.tenThietBi || previewReq.maThietBi,
                    soLuong: previewReq.soLuongYeuCau || 1,
                    donVi: 'Cái',
                    ghiChu: ''
                  }];

              return (
                <div 
                  id="request-form-content" 
                  className="bg-white text-gray-900 p-8 rounded-lg shadow-sm border border-gray-200 mx-auto max-w-3xl font-serif text-[14px] leading-relaxed"
                >
                  {/* Tiêu đề & Quốc hiệu */}
                  <div className="header-grid flex justify-between items-start border-b pb-4 mb-4">
                    <div className="text-center w-5/12">
                      <div className="font-bold uppercase text-[12px]">BỘ Y TẾ - BỆNH VIỆN MEDEQUIP</div>
                      <div className="font-semibold text-[12px]">KHOA / PHÒNG: {tenKhoa}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-1">Mã phiếu: {previewReq.maPhieu}</div>
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
                      GIẤY ĐỀ NGHỊ CẤP PHÁT THIẾT BỊ Y TẾ
                    </h2>
                    <p className="italic text-xs text-gray-600">
                      (Dùng cho Trợ lý / Khoa phòng điều trị đề xuất trang thiết bị y tế)
                    </p>
                  </div>

                  {/* Kính gửi & Thông tin người đề xuất */}
                  <div className="space-y-2 mb-5 text-[13px]">
                    <div className="italic text-center font-medium mb-3">
                      Kính gửi: Ban Giám Đốc, Phòng Quản lý Trang thiết bị y tế & Quản lý Kho
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-semibold">Đơn vị đề nghị:</span> {tenKhoa}</div>
                      <div><span className="font-semibold">Mã khoa:</span> {previewReq.maKhoa}</div>
                      <div><span className="font-semibold">Người đề nghị (Trợ lý):</span> {tenNguoiYeuCau}</div>
                      <div><span className="font-semibold">Thời gian tạo:</span> {dateCreated.toLocaleString('vi-VN')}</div>
                      <div><span className="font-semibold">Trạng thái phiếu:</span> <span className="font-bold text-primary">{STATUS_MAP[previewReq.trangThai as keyof typeof STATUS_MAP] || previewReq.trangThai}</span></div>
                    </div>
                    <div className="mt-2">
                      <span className="font-semibold">Mục đích / Lý do đề nghị cấp phát:</span>
                      <p className="italic text-gray-700 mt-0.5 bg-gray-50 p-2 rounded border border-gray-100">
                        {previewReq.lyDo || 'Đề nghị cấp phát phục vụ công tác khám chữa bệnh chuyên môn tại khoa.'}
                      </p>
                    </div>
                  </div>

                  {/* Bảng danh sách thiết bị yêu cầu */}
                  <div className="mb-6">
                    <div className="font-semibold text-[13px] mb-2 uppercase tracking-wide">
                      I. Danh mục thiết bị y tế đề nghị cấp phát:
                    </div>
                    <table className="w-full border-collapse border border-gray-400 text-[12px]">
                      <thead>
                        <tr className="bg-gray-100 font-bold text-center">
                          <th className="border border-gray-400 p-2 w-10">STT</th>
                          <th className="border border-gray-400 p-2 w-28">Mã thiết bị</th>
                          <th className="border border-gray-400 p-2 text-left">Tên thiết bị y tế</th>
                          <th className="border border-gray-400 p-2 w-20">ĐVT</th>
                          <th className="border border-gray-400 p-2 w-24">SL Đề nghị</th>
                          <th className="border border-gray-400 p-2 text-left">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsList.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border border-gray-400 p-2 text-center">{idx + 1}</td>
                            <td className="border border-gray-400 p-2 text-center font-mono font-medium">{item.maThietBi}</td>
                            <td className="border border-gray-400 p-2 font-medium">{item.tenThietBi || item.maThietBi}</td>
                            <td className="border border-gray-400 p-2 text-center">{item.donVi || item.donViTinh || 'Cái'}</td>
                            <td className="border border-gray-400 p-2 text-center font-bold text-base text-primary">
                              {item.soLuongCoSo || item.soLuong || 1}
                            </td>
                            <td className="border border-gray-400 p-2 text-gray-600">{item.ghiChu || '---'}</td>
                          </tr>
                        ))}
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
                        <div className="sig-title font-bold uppercase text-[12px]">NGƯỜI ĐỀ NGHỊ</div>
                        <div className="sig-sub italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                        <div className="sig-name font-bold text-[12px]">{tenNguoiYeuCau}</div>
                      </div>
                      <div className="sig-box">
                        <div className="sig-title font-bold uppercase text-[12px]">TRƯỞNG KHOA PHÊ DUYỆT</div>
                        <div className="sig-sub italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                        <div className="sig-name font-bold text-[12px]"></div>
                      </div>
                      <div className="sig-box">
                        <div className="sig-title font-bold uppercase text-[12px]">BỘ PHẬN KHO CẤP PHÁT</div>
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
                onClick={() => handlePrintForm('request-form-content', `Bieu_Mau_YCCF_${previewReq?.maPhieu}`)}
                className="gap-1.5"
              >
                <Printer className="w-4 h-4 text-muted-foreground" />
                In biểu mẫu
              </Button>
              <Button
                onClick={() => exportSingleRequestPDF(previewReq)}
                className="gradient-primary text-white gap-1.5"
              >
                <Download className="w-4 h-4" />
                Tải file PDF
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
