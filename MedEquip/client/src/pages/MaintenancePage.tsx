import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MaintenanceItem, MaintenanceHistoryRecord, TRANG_THAI_BAO_TRI_LABELS, ROLE_LABELS } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Wrench, AlertTriangle, CheckCircle2, Clock, Search, History,
  Upload, ShieldCheck, RefreshCw, AlertCircle, Camera, Check,
  Hospital, Calendar, DollarSign, UserCheck, X, Printer, FileText, CheckCircle,
  Save, Edit3, Eye, BellRing, Bell, ChevronUp, ChevronDown, Send, CheckCheck, ShieldAlert
} from 'lucide-react';

export interface HandoverFormState {
  maPhieu: string;
  maThietBi: string;
  tenThietBi: string;
  serialNumber?: string;
  viTriHienTai: string;
  chuKyBaoTri: number;
  ngayHoanThanh: string;
  ngayBaoTriTiepTheo?: string;
  // Bên giao (Kỹ thuật / Kho)
  nguoiThucHien: string;
  chucVuNguoiGiao: string;
  donViNguoiGiao: string;
  // Bên nhận (Khoa sử dụng)
  nguoiNhan: string;
  chucVuNguoiNhan: string;
  donViNguoiNhan: string;
  // Nội dung & kết quả
  loaiBaoTri: string;
  noiDung: string;
  ketQua: 'DAT' | 'KHONG_DAT';
  tinhTrangBanGiao: string;
  chiPhi?: number;
  ghiChu?: string;
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const [data, setData] = useState<MaintenanceItem[]>([]);
  const [summary, setSummary] = useState<any>({
    tongSo: 0,
    binhThuong: 0,
    sapDenHan: 0,
    quaHan: 0,
    dangBaoTri: 0
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deptInfo, setDeptInfo] = useState<{ isDept: boolean; tenKhoa: string }>({ isDept: false, tenKhoa: '' });

  // Modal Nghiệm thu bảo trì
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<MaintenanceItem | null>(null);
  const [ngayHoanThanh, setNgayHoanThanh] = useState(new Date().toISOString().slice(0, 10));
  const [nguoiThucHien, setNguoiThucHien] = useState('');
  const [loaiBaoTri, setLoaiBaoTri] = useState('DINH_KY');
  const [noiDung, setNoiDung] = useState('Kiểm tra an toàn điện, hiệu chuẩn thông số đo, vệ sinh bộ lọc');
  const [ketQua, setKetQua] = useState<'DAT' | 'KHONG_DAT'>('DAT');
  const [chiPhi, setChiPhi] = useState('0');
  const [anhMinhChung, setAnhMinhChung] = useState<string | null>(null);
  const [ghiChu, setGhiChu] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal Lịch sử bảo trì
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState<MaintenanceHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Preview ảnh
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Modal Biên bản bàn giao & nghiệm thu
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [handoverData, setHandoverData] = useState<HandoverFormState | null>(null);
  const [handoverTab, setHandoverTab] = useState<'preview' | 'edit'>('preview');
  const [savingHandover, setSavingHandover] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  // Trung tâm thông báo & cảnh báo bảo trì
  const [showAlertSection, setShowAlertSection] = useState(true);
  const [alertTab, setAlertTab] = useState<'ALL' | 'DUE' | 'UPCOMING'>('ALL');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [systemNotifs, setSystemNotifs] = useState<any[]>([]);

  const canManage = user?.vaiTro === 'ADMIN' || user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'NV_KHO';

  const calculateNextDate = (baseDate: string, months: number) => {
    try {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + Number(months));
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return '';
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Chưa xác định';
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN');
    } catch (e) {
      return dateStr;
    }
  };

  const getLoaiBaoTriText = (loai?: string) => {
    switch (loai) {
      case 'DINH_KY': return 'Bảo dưỡng định kỳ theo quy chuẩn y tế';
      case 'KIEM_DINH': return 'Kiểm định an toàn bức xạ & Hiệu chuẩn đo lường';
      case 'SUA_CHUA': return 'Sửa chữa, phục hồi & Thay thế linh kiện';
      default: return 'Bảo dưỡng kỹ thuật định kỳ';
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
          <meta charset="utf-8" />
          <style>
            @page { size: A4 portrait; margin: 15mm 20mm; }
            body {
              font-family: 'Times New Roman', 'Segoe UI', Tahoma, Arial, sans-serif;
              font-size: 13pt;
              line-height: 1.45;
              color: #000;
              margin: 0;
              padding: 10px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 6px 10px;
              text-align: left;
              font-size: 12pt;
            }
            th {
              background-color: #f2f2f2;
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
              margin-bottom: 18px;
            }
            .title-area {
              text-align: center;
              margin: 16px 0;
            }
            .signatures {
              display: flex;
              justify-content: space-between;
              margin-top: 35px;
              page-break-inside: avoid;
            }
            .sig-box {
              text-align: center;
              width: 32%;
            }
            .sig-space {
              height: 75px;
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
    }, 300);
  };

  const handlePreSaveHandover = () => {
    if (!handoverData) return;
    if (!canManage) {
      toast({
        title: 'Từ chối quyền thao tác',
        description: 'Chỉ Kỹ thuật viên / Quản lý trang thiết bị mới có thẩm quyền lưu biên bản và cập nhật mốc kiểm định.',
        variant: 'destructive'
      });
      return;
    }
    if (!handoverData.ngayHoanThanh) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn ngày hoàn thành bảo dưỡng.', variant: 'destructive' });
      return;
    }
    if (!handoverData.ngayBaoTriTiepTheo) {
      toast({ title: 'Lỗi', description: 'Vui lòng xác định hạn bảo trì kiểm định tiếp theo.', variant: 'destructive' });
      return;
    }
    if (new Date(handoverData.ngayBaoTriTiepTheo) <= new Date(handoverData.ngayHoanThanh)) {
      toast({
        title: 'Thời hạn không hợp lệ',
        description: `Ngày bảo trì tiếp theo (${formatDate(handoverData.ngayBaoTriTiepTheo)}) phải sau ngày hoàn thành kiểm định (${formatDate(handoverData.ngayHoanThanh)})!`,
        variant: 'destructive'
      });
      return;
    }
    // Mở hộp thoại xác nhận trách nhiệm kỹ thuật
    setSaveConfirmOpen(true);
  };

  const handleExecuteSaveHandover = async () => {
    if (!handoverData) return;
    setSavingHandover(true);
    setSaveConfirmOpen(false);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/maintenance/record`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(handoverData)
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Thành công', description: result.message || 'Đã lưu biên bản thành công.' });
        loadData();
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi lưu biên bản', variant: 'destructive' });
    } finally {
      setSavingHandover(false);
    }
  };

  const handleOpenHandoverForItem = async (item: MaintenanceItem) => {
    setSelectedDevice(item);
    const isStaffKhoOrAdmin = user?.vaiTro === 'ADMIN' || user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'NV_KHO';

    let defaultNguoiGiao = 'Kỹ sư Thiết bị Y tế';
    let defaultChucVuGiao = 'Kỹ thuật viên / Kỹ sư thiết bị y tế';
    let defaultDonViGiao = 'Phòng Quản lý Trang thiết bị Y tế - Kho Trung tâm';

    let defaultNguoiNhan = item.dangSuDung ? `Cán bộ phụ trách - ${item.viTriHienTai}` : 'Thủ kho Tiếp nhận';
    let defaultChucVuNhan = item.dangSuDung ? 'Bác sĩ / Điều dưỡng trưởng' : 'Thủ kho Thiết bị';
    let defaultDonViNhan = item.viTriHienTai || 'Khoa lâm sàng sử dụng';

    if (isStaffKhoOrAdmin) {
      defaultNguoiGiao = user?.hoTen || 'Kỹ thuật viên Thiết bị Y tế';
    } else {
      defaultNguoiNhan = user?.hoTen || `Đại diện ${item.viTriHienTai}`;
      defaultChucVuNhan = user?.vaiTro === 'TRUONG_KHOA' ? 'Trưởng Khoa' : 'Trợ lý Khoa / Điều dưỡng trưởng';
      defaultDonViNhan = item.viTriHienTai || deptInfo.tenKhoa || 'Khoa lâm sàng sử dụng';
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/maintenance/history/${item.maThietBi}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const result = await res.json();
      const latestRec = (result.success && result.data && result.data.length > 0) ? result.data[0] : null;

      const recNguoiThucHien = latestRec?.nguoiThucHien || latestRec?.nguoi_thuc_hien;
      if (recNguoiThucHien && !recNguoiThucHien.toLowerCase().includes('khoa') && !recNguoiThucHien.toLowerCase().includes('trợ lý')) {
        defaultNguoiGiao = recNguoiThucHien;
      }

      if (latestRec) {
        setHandoverData({
          maPhieu: latestRec.maPhieuBaoTri || latestRec.ma_phieu_bao_tri,
          maThietBi: item.maThietBi,
          tenThietBi: item.tenThietBi,
          serialNumber: item.serialNumber,
          viTriHienTai: item.viTriHienTai,
          chuKyBaoTri: item.chuKyBaoTri,
          ngayHoanThanh: latestRec.ngayHoanThanh || latestRec.ngay_hoan_thanh || item.ngayBaoTriGanNhat || new Date().toISOString().slice(0, 10),
          ngayBaoTriTiepTheo: item.ngayBaoTriTiepTheo || calculateNextDate(latestRec.ngayHoanThanh || latestRec.ngay_hoan_thanh || new Date().toISOString().slice(0, 10), item.chuKyBaoTri),
          nguoiThucHien: defaultNguoiGiao,
          chucVuNguoiGiao: defaultChucVuGiao,
          donViNguoiGiao: defaultDonViGiao,
          nguoiNhan: defaultNguoiNhan,
          chucVuNguoiNhan: defaultChucVuNhan,
          donViNguoiNhan: defaultDonViNhan,
          loaiBaoTri: latestRec.loaiBaoTri || latestRec.loai_bao_tri || 'DINH_KY',
          noiDung: latestRec.noiDung || latestRec.noi_dung || 'Kiểm định an toàn điện, đo tiếp đất, hiệu chuẩn thông số vận hành',
          ketQua: (latestRec.ketQua || latestRec.ket_qua) === 'KHONG_DAT' ? 'KHONG_DAT' : 'DAT',
          tinhTrangBanGiao: 'Thiết bị đã được vệ sinh khử khuẩn, kiểm tra đo điện trở tiếp đất và an toàn điện đạt chuẩn; các phím điều khiển, màn hình hiển thị hoạt động chính xác; đã dán tem kiểm định định kỳ lên thân máy.',
          chiPhi: latestRec.chiPhi ?? latestRec.chi_phi ?? 0,
          ghiChu: latestRec.ghiChu || latestRec.ghi_chu || ''
        });
      } else {
        const dateNow = item.ngayBaoTriGanNhat || new Date().toISOString().slice(0, 10);
        setHandoverData({
          maPhieu: `BB-BG-${item.maThietBi}-${dateNow.replace(/-/g, '')}`,
          maThietBi: item.maThietBi,
          tenThietBi: item.tenThietBi,
          serialNumber: item.serialNumber,
          viTriHienTai: item.viTriHienTai,
          chuKyBaoTri: item.chuKyBaoTri,
          ngayHoanThanh: dateNow,
          ngayBaoTriTiepTheo: item.ngayBaoTriTiepTheo || calculateNextDate(dateNow, item.chuKyBaoTri),
          nguoiThucHien: defaultNguoiGiao,
          chucVuNguoiGiao: defaultChucVuGiao,
          donViNguoiGiao: defaultDonViGiao,
          nguoiNhan: defaultNguoiNhan,
          chucVuNguoiNhan: defaultChucVuNhan,
          donViNguoiNhan: defaultDonViNhan,
          loaiBaoTri: 'DINH_KY',
          noiDung: 'Kiểm định kỹ thuật ban đầu, kiểm tra an toàn điện & hiệu chuẩn đo lường tiêu chuẩn',
          ketQua: 'DAT',
          tinhTrangBanGiao: 'Thiết bị hoạt động ổn định, đủ điều kiện đưa vào sử dụng, đã dán tem kiểm định định kỳ.',
          chiPhi: 0,
          ghiChu: 'Thiết bị hoạt động ổn định, đủ điều kiện đưa vào sử dụng'
        });
      }
      setHandoverTab('preview');
      setHandoverModalOpen(true);
    } catch (err) {
      const dateNow = item.ngayBaoTriGanNhat || new Date().toISOString().slice(0, 10);
      setHandoverData({
        maPhieu: `BB-BG-${item.maThietBi}`,
        maThietBi: item.maThietBi,
        tenThietBi: item.tenThietBi,
        serialNumber: item.serialNumber,
        viTriHienTai: item.viTriHienTai,
        chuKyBaoTri: item.chuKyBaoTri,
        ngayHoanThanh: dateNow,
        ngayBaoTriTiepTheo: item.ngayBaoTriTiepTheo || calculateNextDate(dateNow, item.chuKyBaoTri),
        nguoiThucHien: defaultNguoiGiao,
        chucVuNguoiGiao: defaultChucVuGiao,
        donViNguoiGiao: defaultDonViGiao,
        nguoiNhan: defaultNguoiNhan,
        chucVuNguoiNhan: defaultChucVuNhan,
        donViNguoiNhan: defaultDonViNhan,
        loaiBaoTri: 'DINH_KY',
        noiDung: 'Kiểm tra an toàn điện, hiệu chuẩn thông số vận hành',
        ketQua: 'DAT',
        tinhTrangBanGiao: 'Thiết bị hoạt động bình thường, an toàn.',
        chiPhi: 0,
        ghiChu: ''
      });
      setHandoverTab('preview');
      setHandoverModalOpen(true);
    }
  };

  const handleOpenHandoverForRecord = (rec: MaintenanceHistoryRecord) => {
    if (!selectedDevice) return;
    const isStaffKhoOrAdmin = user?.vaiTro === 'ADMIN' || user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'NV_KHO';

    let defaultNguoiGiao = rec.nguoiThucHien || 'Kỹ sư Thiết bị Y tế';
    if (defaultNguoiGiao.toLowerCase().includes('khoa') || defaultNguoiGiao.toLowerCase().includes('trợ lý')) {
      defaultNguoiGiao = 'Kỹ sư Thiết bị Y tế';
    }

    let defaultNguoiNhan = selectedDevice.dangSuDung ? `Cán bộ phụ trách - ${selectedDevice.viTriHienTai}` : 'Thủ kho Thiết bị';
    let defaultChucVuNhan = selectedDevice.dangSuDung ? 'Bác sĩ / Điều dưỡng trưởng' : 'Thủ kho Thiết bị';
    let defaultDonViNhan = selectedDevice.viTriHienTai || 'Khoa điều trị';

    if (!isStaffKhoOrAdmin) {
      defaultNguoiNhan = user?.hoTen || `Đại diện ${selectedDevice.viTriHienTai}`;
      defaultChucVuNhan = user?.vaiTro === 'TRUONG_KHOA' ? 'Trưởng Khoa' : 'Trợ lý Khoa / Điều dưỡng trưởng';
      defaultDonViNhan = selectedDevice.viTriHienTai || deptInfo.tenKhoa || 'Khoa lâm sàng sử dụng';
    }

    setHandoverData({
      maPhieu: rec.maPhieuBaoTri,
      maThietBi: selectedDevice.maThietBi,
      tenThietBi: selectedDevice.tenThietBi,
      serialNumber: selectedDevice.serialNumber,
      viTriHienTai: selectedDevice.viTriHienTai,
      chuKyBaoTri: selectedDevice.chuKyBaoTri,
      ngayHoanThanh: rec.ngayHoanThanh,
      ngayBaoTriTiepTheo: selectedDevice.ngayBaoTriTiepTheo || calculateNextDate(rec.ngayHoanThanh, selectedDevice.chuKyBaoTri),
      nguoiThucHien: defaultNguoiGiao,
      chucVuNguoiGiao: 'Kỹ thuật viên / Phụ trách bảo dưỡng TBYT',
      donViNguoiGiao: 'Phòng Quản lý Trang thiết bị Y tế - Kho Trung tâm',
      nguoiNhan: defaultNguoiNhan,
      chucVuNguoiNhan: defaultChucVuNhan,
      donViNguoiNhan: defaultDonViNhan,
      loaiBaoTri: rec.loaiBaoTri,
      noiDung: rec.noiDung,
      ketQua: rec.ketQua,
      tinhTrangBanGiao: 'Thiết bị đã được vệ sinh khử khuẩn, kiểm tra đo điện trở tiếp đất và an toàn điện đạt chuẩn; các phím điều khiển, màn hình hiển thị hoạt động chính xác; đã dán tem kiểm định định kỳ lên thân máy.',
      chiPhi: rec.chiPhi,
      ghiChu: rec.ghiChu
    });
    setHandoverTab('preview');
    setHandoverModalOpen(true);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/maintenance`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data || []);
        setSummary(result.summary || {});
        setDeptInfo({
          isDept: !!result.isDepartmentRole,
          tenKhoa: result.tenKhoaUser || ''
        });
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }

      // Tải thông báo bảo trì từ hệ thống
      try {
        const notifRes = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/notifications`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
        });
        const notifList = await notifRes.json();
        if (Array.isArray(notifList)) {
          const filteredNotifs = notifList.filter((n: any) => {
            const t = (n.tieuDe || '').toLowerCase();
            const c = (n.noiDung || '').toLowerCase();
            return t.includes('bảo trì') || c.includes('bảo trì') || t.includes('kiểm định') || c.includes('kiểm định');
          });
          setSystemNotifs(filteredNotifs);
        }
      } catch (e) {
        // bỏ qua nếu lỗi mạng
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi kết nối máy chủ', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerSystemNotifications = async () => {
    setSendingNotif(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/notifications/check-due`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const result = await res.json();
      if (result.success) {
        toast({
          title: 'Phát thông báo thành công',
          description: `Đã gửi ${result.sentCount || 0} thông báo cảnh báo bảo trì đến chuông hệ thống của các bộ phận liên quan.`
        });
        loadData();
        window.dispatchEvent(new Event('store_notifications_changed'));
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message || 'Lỗi gửi thông báo', variant: 'destructive' });
    } finally {
      setSendingNotif(false);
    }
  };

  const handleReadNotification = async (id: string) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      setSystemNotifs(prev => prev.map(n => n.id === id ? { ...n, daDoc: true } : n));
      window.dispatchEvent(new Event('store_notifications_changed'));
    } catch (e) { }
  };

  const handleReadAllNotifications = async () => {
    if (!user) return;
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/notifications/read-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ userId: user.maNguoiDung })
      });
      setSystemNotifs(prev => prev.map(n => ({ ...n, daDoc: true })));
      window.dispatchEvent(new Event('store_notifications_changed'));
      toast({ title: 'Thành công', description: 'Đã đánh dấu đã đọc tất cả thông báo bảo trì.' });
    } catch (e) { }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCompleteModal = (item: MaintenanceItem) => {
    setSelectedDevice(item);
    setNgayHoanThanh(new Date().toISOString().slice(0, 10));
    setNguoiThucHien(user?.hoTen || 'Kỹ thuật viên');
    setLoaiBaoTri('DINH_KY');
    setNoiDung('Kiểm tra an toàn điện, hiệu chuẩn thông số đo lường, vệ sinh bộ lọc màng');
    setKetQua('DAT');
    setChiPhi('0');
    setAnhMinhChung(null);
    setGhiChu('');
    setCompleteModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAnhMinhChung(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitComplete = async () => {
    if (!selectedDevice) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/maintenance/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          maThietBi: selectedDevice.maThietBi,
          ngayHoanThanh,
          nguoiThucHien,
          loaiBaoTri,
          noiDung,
          ketQua,
          chiPhi: parseFloat(chiPhi) || 0,
          anhMinhChung,
          ghiChu
        })
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Thành công', description: result.message });
        setCompleteModalOpen(false);
        await loadData();

        const isStaffKhoOrAdmin = user?.vaiTro === 'ADMIN' || user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'NV_KHO';
        const nguoiGiaoName = nguoiThucHien || (isStaffKhoOrAdmin ? (user?.hoTen || 'Kỹ thuật viên TTB Y tế') : 'Kỹ sư Quản lý TBYT');
        const nguoiNhanName = isStaffKhoOrAdmin
          ? (selectedDevice.dangSuDung ? `Cán bộ phụ trách - ${selectedDevice.viTriHienTai}` : 'Thủ kho Tiếp nhận')
          : (user?.hoTen || `Đại diện ${selectedDevice.viTriHienTai}`);

        setHandoverData({
          maPhieu: result.maPhieuBaoTri || `BB-BT-${selectedDevice.maThietBi}`,
          maThietBi: selectedDevice.maThietBi,
          tenThietBi: selectedDevice.tenThietBi,
          serialNumber: selectedDevice.serialNumber,
          viTriHienTai: selectedDevice.viTriHienTai,
          chuKyBaoTri: selectedDevice.chuKyBaoTri,
          ngayHoanThanh,
          ngayBaoTriTiepTheo: calculateNextDate(ngayHoanThanh, selectedDevice.chuKyBaoTri),
          nguoiThucHien: nguoiGiaoName,
          chucVuNguoiGiao: 'Kỹ thuật viên / Phụ trách bảo dưỡng TBYT',
          donViNguoiGiao: 'Phòng Quản lý Trang thiết bị Y tế - Kho Trung tâm',
          nguoiNhan: nguoiNhanName,
          chucVuNguoiNhan: selectedDevice.dangSuDung ? 'Bác sĩ / Điều dưỡng trưởng' : 'Thủ kho Thiết bị',
          donViNguoiNhan: selectedDevice.viTriHienTai || 'Khoa lâm sàng sử dụng',
          loaiBaoTri,
          noiDung,
          ketQua,
          tinhTrangBanGiao: 'Thiết bị đã được vệ sinh khử khuẩn, kiểm tra đo điện trở tiếp đất và an toàn điện đạt chuẩn; các phím điều khiển, màn hình hiển thị hoạt động chính xác; đã dán tem kiểm định định kỳ lên thân máy.',
          chiPhi: parseFloat(chiPhi) || 0,
          ghiChu
        });
        setHandoverTab('preview');
        setHandoverModalOpen(true);
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewHistory = async (item: MaintenanceItem) => {
    setSelectedDevice(item);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/maintenance/history/${item.maThietBi}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const result = await res.json();
      if (result.success) {
        setHistoryList(result.data || []);
      } else {
        toast({ title: 'Lỗi', description: result.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  // Lọc dữ liệu bảng
  const filteredData = data.filter(item => {
    const matchSearch =
      item.tenThietBi.toLowerCase().includes(search.toLowerCase()) ||
      item.maThietBi.toLowerCase().includes(search.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(search.toLowerCase()) ||
      item.viTriHienTai.toLowerCase().includes(search.toLowerCase());

    if (!matchSearch) return false;

    if (statusFilter === 'ALL') return true;
    return item.trangThaiBaoTri === statusFilter;
  });

  // 1. Danh sách thiết bị ĐÃ ĐẾN HẠN hoặc QUÁ HẠN bảo trì (hôm nay hoặc đã trễ)
  const dueItems = data.filter(item =>
    item.trangThaiBaoTri === 'QUA_HAN' ||
    (item.soNgayConLai !== null && item.soNgayConLai <= 0 && item.trangThaiBaoTri !== 'DANG_BAO_TRI')
  );

  // 2. Danh sách thiết bị CHUẨN BỊ ĐẾN HẠN bảo trì (trong vòng 15 ngày tới: 0 < soNgayConLai <= 15)
  const upcomingItems = data.filter(item =>
    item.trangThaiBaoTri !== 'QUA_HAN' &&
    item.trangThaiBaoTri !== 'DANG_BAO_TRI' &&
    ((item.trangThaiBaoTri === 'SAP_DEN_HAN' && (item.soNgayConLai === null || item.soNgayConLai > 0)) ||
      (item.soNgayConLai !== null && item.soNgayConLai > 0 && item.soNgayConLai <= 15))
  );

  // 3. Toàn bộ thiết bị cảnh báo cần bảo trì
  const allAlertItems = [...dueItems, ...upcomingItems];

  const displayedAlertItems = alertTab === 'DUE'
    ? dueItems
    : alertTab === 'UPCOMING'
      ? upcomingItems
      : allAlertItems;

  const unreadSystemNotifs = systemNotifs.filter(n => !n.daDoc).length;

  return (
    <div className="space-y-6 animate-fade-in p-2 md:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2.5 text-primary">
            <Wrench className="w-6 h-6 text-primary" />
            {deptInfo.isDept ? `Theo dõi Bảo trì Thiết bị — ${deptInfo.tenKhoa || 'Khoa'}` : 'Quản lý Bảo trì & Kiểm định Thiết bị'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {deptInfo.isDept
              ? `Theo dõi chu kỳ kiểm định các thiết bị mà ${deptInfo.tenKhoa || 'khoa'} đang mượn sử dụng để chủ động phối hợp bảo dưỡng`
              : 'Theo dõi chu kỳ kiểm định, cảnh báo quá hạn và ghi nhận nhật ký bảo dưỡng định kỳ trang thiết bị y tế toàn viện'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Nút chuông thông báo bảo trì */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotifModalOpen(true)}
            className="relative gap-1.5 shadow-sm border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/50"
          >
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline font-medium">Thông báo</span>
            {allAlertItems.length > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                {allAlertItems.length}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Làm mới
          </Button>
        </div>
      </div>

      {deptInfo.isDept && (
        <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 rounded-xl flex items-center gap-2.5 text-xs text-blue-800 dark:text-blue-300 shadow-sm">
          <Hospital className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Bạn đang xem trạng thái bảo trì các thiết bị mà <strong>{deptInfo.tenKhoa || 'khoa của bạn'}</strong> đang mượn sử dụng. Khi thiết bị đến hạn, vui lòng phối hợp với Kho / Kỹ thuật viên để thực hiện kiểm định.</span>
        </div>
      )}

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div
          onClick={() => setStatusFilter('ALL')}
          className={cn(
            "p-4 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'ALL' ? "ring-2 ring-primary border-primary shadow-sm" : ""
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Thiết bị</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold mt-2 text-foreground">{summary.tongSo || 0}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Máy móc tái sử dụng</p>
        </div>

        <div
          onClick={() => setStatusFilter('QUA_HAN')}
          className={cn(
            "p-4 rounded-xl border bg-destructive/5 cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'QUA_HAN' ? "ring-2 ring-destructive border-destructive shadow-sm" : "border-destructive/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-destructive uppercase">Quá hạn bảo trì</span>
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold mt-2 text-destructive">{summary.quaHan || 0}</div>
          <p className="text-[11px] text-destructive/80 mt-0.5">Cần bảo dưỡng khẩn cấp</p>
        </div>

        <div
          onClick={() => setStatusFilter('SAP_DEN_HAN')}
          className={cn(
            "p-4 rounded-xl border bg-amber-500/5 cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'SAP_DEN_HAN' ? "ring-2 ring-amber-500 border-amber-500 shadow-sm" : "border-amber-500/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">Sắp đến hạn</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-400">{summary.sapDenHan || 0}</div>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Trong vòng 15 ngày tới</p>
        </div>

        <div
          onClick={() => setStatusFilter('DANG_BAO_TRI')}
          className={cn(
            "p-4 rounded-xl border bg-orange-500/5 cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'DANG_BAO_TRI' ? "ring-2 ring-orange-500 border-orange-500 shadow-sm" : "border-orange-500/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase">Đang bảo trì</span>
            <Wrench className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold mt-2 text-orange-600 dark:text-orange-400">{summary.dangBaoTri || 0}</div>
          <p className="text-[11px] text-orange-600/80 mt-0.5">Đang xử lý tại xưởng</p>
        </div>

        <div
          onClick={() => setStatusFilter('BINH_THUONG')}
          className={cn(
            "p-4 rounded-xl border bg-success/5 cursor-pointer transition-all hover:shadow-md",
            statusFilter === 'BINH_THUONG' ? "ring-2 ring-success border-success shadow-sm" : "border-success/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-success uppercase">Đạt chuẩn</span>
            <CheckCircle2 className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-bold mt-2 text-success">{summary.binhThuong || 0}</div>
          <p className="text-[11px] text-success/80 mt-0.5">Hoạt động bình thường</p>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* KHU VỰC THÔNG BÁO BẢO TRÌ: THIẾT BỊ CHUẨN BỊ & ĐẾN HẠN */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden transition-all">
        {/* Thanh tiêu đề khu vực thông báo */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border-b flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all",
              allAlertItems.length > 0
                ? "bg-amber-500 text-white animate-pulse shadow-amber-500/20"
                : "bg-success/20 text-success"
            )}>
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  Thông Báo Bảo Trì & Kiểm Định Thiết Bị
                </h3>
                {allAlertItems.length > 0 ? (
                  <Badge variant="destructive" className="text-xs px-2.5 py-0.5 rounded-full font-semibold shadow-xs">
                    {allAlertItems.length} máy cần chú ý
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30 font-medium">
                    Tất cả đạt chuẩn
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cảnh báo danh sách các thiết bị <strong>chuẩn bị đến hạn</strong> (trong vòng 15 ngày) và <strong>đã đến hạn / quá hạn</strong> cần kiểm định, bảo dưỡng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {allAlertItems.length > 0 && canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerSystemNotifications}
                disabled={sendingNotif}
                className="gap-1.5 text-xs bg-background/80 hover:bg-background border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 shadow-xs"
                title="Phát thông báo nhắc nhở kiểm định tới chuông thông báo của Kho và các Khoa phòng"
              >
                <Bell className={cn("w-3.5 h-3.5 text-amber-600", sendingNotif && "animate-spin")} />
                <span>{sendingNotif ? "Đang gửi..." : "Phát chuông thông báo"}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlertSection(!showAlertSection)}
              className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showAlertSection ? (
                <>Thu gọn <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>Xem chi tiết ({allAlertItems.length}) <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </Button>
          </div>
        </div>

        {/* Nội dung chi tiết các thông báo (Thu gọn / Mở rộng) */}
        {showAlertSection && (
          <div className="p-4 sm:p-5 space-y-4">
            {allAlertItems.length === 0 ? (
              <div className="py-6 px-4 text-center rounded-xl bg-success/5 border border-success/20">
                <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-2 opacity-80" />
                <h4 className="font-semibold text-sm text-success">Không có thiết bị nào đến hạn hoặc sắp đến hạn</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Hiện tại không có thiết bị y tế nào đến hạn hoặc chuẩn bị đến hạn bảo trì trong 15 ngày tới. Tất cả <strong>{data.length}</strong> trang thiết bị đều đang hoạt động đạt chuẩn an toàn.
                </p>
              </div>
            ) : (
              <>
                {/* Bộ lọc tab phụ: Tất cả | Đến hạn & Quá hạn | Chuẩn bị đến hạn */}
                <div className="flex items-center gap-2 flex-wrap pb-1 border-b">
                  <button
                    onClick={() => setAlertTab('ALL')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                      alertTab === 'ALL'
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span>Tất cả cảnh báo</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/20 font-bold">
                      {allAlertItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAlertTab('DUE')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                      alertTab === 'DUE'
                        ? "bg-destructive text-destructive-foreground shadow-sm"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20"
                    )}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Đến hạn & Quá hạn</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/20 font-bold">
                      {dueItems.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setAlertTab('UPCOMING')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                      alertTab === 'UPCOMING'
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                    )}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Chuẩn bị đến hạn (trong 15 ngày)</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-background/20 font-bold">
                      {upcomingItems.length}
                    </span>
                  </button>
                </div>

                {/* Danh sách từng thẻ thông báo thiết bị */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {displayedAlertItems.map((item) => {
                    const isOverdue = item.trangThaiBaoTri === 'QUA_HAN' || (item.soNgayConLai !== null && item.soNgayConLai < 0);
                    const isDueToday = item.soNgayConLai === 0;
                    const isUpcoming = item.soNgayConLai !== null && item.soNgayConLai > 0;

                    return (
                      <div
                        key={item.maThietBi}
                        className={cn(
                          "p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 shadow-xs hover:shadow-md",
                          isOverdue || isDueToday
                            ? "bg-rose-50/70 dark:bg-rose-950/25 border-rose-200/80 dark:border-rose-900/60"
                            : "bg-amber-50/60 dark:bg-amber-950/25 border-amber-200/80 dark:border-amber-900/60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs",
                              isOverdue || isDueToday
                                ? "bg-rose-600 text-white"
                                : "bg-amber-500 text-white"
                            )}>
                              {isOverdue || isDueToday ? (
                                <AlertTriangle className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5 className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer"
                                  onClick={() => setSearch(item.maThietBi)}
                                  title={item.tenThietBi}>
                                  {item.tenThietBi}
                                </h5>
                                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-background/90 border font-semibold text-foreground/80">
                                  {item.maThietBi}
                                </span>
                              </div>
                              {item.serialNumber && (
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                  Số Serial: <span className="font-mono text-foreground font-medium">{item.serialNumber}</span>
                                </p>
                              )}
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                <Hospital className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-medium text-foreground/90 truncate">{item.viTriHienTai}</span>
                              </div>
                            </div>
                          </div>

                          {/* Nhãn thời hạn */}
                          <div className="shrink-0 text-right">
                            {isOverdue && (
                              <Badge variant="destructive" className="text-[11px] px-2 py-0.5 shadow-xs font-semibold whitespace-nowrap">
                                Quá hạn {Math.abs(item.soNgayConLai || 0)} ngày
                              </Badge>
                            )}
                            {isDueToday && (
                              <Badge className="text-[11px] px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white shadow-xs font-semibold whitespace-nowrap animate-pulse">
                                Đến hạn hôm nay
                              </Badge>
                            )}
                            {isUpcoming && (
                              <Badge className="text-[11px] px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white shadow-xs font-semibold whitespace-nowrap">
                                Còn {item.soNgayConLai} ngày
                              </Badge>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Hạn: <strong className="text-foreground">{formatDate(item.ngayBaoTriTiepTheo)}</strong>
                            </p>
                          </div>
                        </div>

                        {/* Thao tác nhanh cho từng thiết bị */}
                        <div className="pt-2.5 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-[11px] text-muted-foreground">
                            Chu kỳ: <strong className="text-foreground">{item.chuKyBaoTri} tháng/lần</strong>
                          </div>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSearch(item.maThietBi);
                                toast({ description: `Đã lọc hiển thị ${item.maThietBi} trong bảng danh sách` });
                              }}
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                              title="Lọc thiết bị này trong bảng dưới"
                            >
                              <Search className="w-3 h-3 mr-1" /> Tìm trong bảng
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenHandoverForItem(item)}
                              className="h-7 text-xs px-2 gap-1 border-primary/30 hover:border-primary text-primary bg-background/80"
                              title="Xem và chỉnh sửa biên bản bàn giao & kiểm định A4"
                            >
                              <FileText className="w-3 h-3" /> Biên bản
                            </Button>

                            {canManage && (
                              <Button
                                size="sm"
                                onClick={() => handleOpenCompleteModal(item)}
                                className={cn(
                                  "h-7 text-xs px-2.5 gap-1 shadow-xs text-white",
                                  isOverdue || isDueToday
                                    ? "bg-rose-600 hover:bg-rose-700"
                                    : "bg-amber-600 hover:bg-amber-700"
                                )}
                              >
                                <Wrench className="w-3 h-3" /> Nghiệm thu
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tìm kiếm & Lọc */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên máy, mã thiết bị, serial hoặc khoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Đang hiển thị <strong>{filteredData.length}</strong> / {data.length} thiết bị</span>
        </div>
      </div>

      {/* Bảng danh sách thiết bị */}
      <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground font-semibold text-xs">
                <th className="p-3.5 text-center w-12">STT</th>
                <th className="p-3.5 text-left">Thiết bị y tế</th>
                <th className="p-3.5 text-left">Vị trí hiện tại</th>
                <th className="p-3.5 text-center">Chu kỳ</th>
                <th className="p-3.5 text-center">Bảo trì lần trước</th>
                <th className="p-3.5 text-center">Hạn bảo trì lần tới</th>
                <th className="p-3.5 text-center">Trạng thái</th>
                <th className="p-3.5 text-center w-48">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, idx) => {
                const isOverdue = item.trangThaiBaoTri === 'QUA_HAN';
                const isNearDue = item.trangThaiBaoTri === 'SAP_DEN_HAN';
                const isUnderMaint = item.trangThaiBaoTri === 'DANG_BAO_TRI';

                return (
                  <tr
                    key={item.maThietBi}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/30 transition-colors",
                      isOverdue && "bg-destructive/[0.02]"
                    )}
                  >
                    <td className="p-3 text-center text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {item.tenThietBi}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {item.maThietBi}
                        </span>
                        {item.serialNumber && (
                          <span className="font-mono text-[10px] text-primary/80">
                            SN: {item.serialNumber}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Hospital className={cn("w-3.5 h-3.5", item.dangSuDung ? "text-primary" : "text-muted-foreground")} />
                        <span className={cn("text-xs font-medium", item.dangSuDung ? "text-primary" : "text-muted-foreground")}>
                          {item.viTriHienTai}
                        </span>
                      </div>
                    </td>

                    <td className="p-3 text-center font-medium text-xs">
                      {item.chuKyBaoTri} tháng/lần
                    </td>

                    <td className="p-3 text-center text-xs text-muted-foreground">
                      {item.ngayBaoTriGanNhat
                        ? new Date(item.ngayBaoTriGanNhat).toLocaleDateString('vi-VN')
                        : <span className="italic text-muted-foreground/60">Chưa có</span>}
                    </td>

                    <td className="p-3 text-center">
                      {item.ngayBaoTriTiepTheo ? (
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-xs">
                            {new Date(item.ngayBaoTriTiepTheo).toLocaleDateString('vi-VN')}
                          </span>
                          {item.soNgayConLai !== null && (
                            <span className={cn(
                              "text-[10px] font-medium mt-0.5",
                              isOverdue ? "text-destructive font-bold" :
                                isNearDue ? "text-amber-600 font-bold" : "text-muted-foreground"
                            )}>
                              {item.soNgayConLai < 0
                                ? `Trễ ${Math.abs(item.soNgayConLai)} ngày`
                                : item.soNgayConLai === 0
                                  ? "Đến hạn hôm nay"
                                  : `Còn ${item.soNgayConLai} ngày`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="italic text-xs text-muted-foreground">Chưa thiết lập</span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border",
                        isOverdue ? "bg-destructive/10 text-destructive border-destructive/20" :
                          isNearDue ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                            isUnderMaint ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                              "bg-success/10 text-success border-success/20"
                      )}>
                        {isOverdue && <AlertTriangle className="w-3 h-3" />}
                        {isNearDue && <Clock className="w-3 h-3" />}
                        {isUnderMaint && <Wrench className="w-3 h-3" />}
                        {!isOverdue && !isNearDue && !isUnderMaint && <CheckCircle2 className="w-3 h-3" />}
                        {TRANG_THAI_BAO_TRI_LABELS[item.trangThaiBaoTri] || item.trangThaiBaoTri}
                      </span>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canManage && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenCompleteModal(item)}
                            className="h-8 px-2.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1 shadow-sm"
                            title="Xác nhận nghiệm thu bảo trì"
                          >
                            <Wrench className="w-3.5 h-3.5" /> Nghiệm thu
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenHandoverForItem(item)}
                          className="h-8 px-2 text-xs border-primary/40 text-primary hover:bg-primary/10 gap-1 shadow-sm"
                          title="In biên bản nghiệm thu & bàn giao thiết bị"
                        >
                          <FileText className="w-3.5 h-3.5" /> Biên bản
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(item)}
                          className="h-8 px-2 text-xs border-muted-foreground/30 hover:bg-muted"
                          title="Xem sổ nhật ký bảo trì"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {deptInfo.isDept
                ? `Hiện tại ${deptInfo.tenKhoa || 'khoa'} chưa mượn thiết bị tái sử dụng nào cần theo dõi bảo trì.`
                : 'Không tìm thấy thiết bị nào phù hợp với bộ lọc.'}
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: NGHIỆM THU HOÀN THÀNH BẢO TRÌ */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <ShieldCheck className="w-5 h-5 text-primary" /> Nghiệm thu Bảo trì Thiết bị Y tế
            </DialogTitle>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4 pt-2 text-sm">
              {/* Thẻ thông tin thiết bị */}
              <div className="p-3 rounded-xl bg-muted/50 border flex flex-col sm:flex-row justify-between gap-2">
                <div>
                  <h4 className="font-bold text-base">{selectedDevice.tenThietBi}</h4>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 font-mono">
                    <span>Mã: {selectedDevice.maThietBi}</span>
                    {selectedDevice.serialNumber && <span>SN: {selectedDevice.serialNumber}</span>}
                  </div>
                </div>
                <div className="text-right sm:text-right">
                  <span className="text-xs text-muted-foreground block">Chu kỳ bảo trì</span>
                  <span className="font-bold text-primary">{selectedDevice.chuKyBaoTri} tháng / lần</span>
                </div>
              </div>

              {/* Form nhập nghiệm thu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Ngày hoàn thành kiểm định (*)</label>
                  <Input
                    type="date"
                    value={ngayHoanThanh}
                    onChange={(e) => setNgayHoanThanh(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Người / Đơn vị thực hiện (*)</label>
                  <Input
                    placeholder="VD: Kỹ sư Nguyễn Văn A / Hãng Philips..."
                    value={nguoiThucHien}
                    onChange={(e) => setNguoiThucHien(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Loại hình thực hiện</label>
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    value={loaiBaoTri}
                    onChange={(e) => setLoaiBaoTri(e.target.value)}
                  >
                    <option value="DINH_KY">Bảo dưỡng định kỳ</option>
                    <option value="KIEM_DINH">Kiểm định an toàn & Hiệu chuẩn</option>
                    <option value="SUA_CHUA">Sửa chữa thay thế linh kiện</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Kết quả đánh giá (*)</label>
                  <select
                    className={cn(
                      "w-full h-10 px-3 rounded-md border text-sm font-semibold",
                      ketQua === 'DAT' ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'
                    )}
                    value={ketQua}
                    onChange={(e) => setKetQua(e.target.value as any)}
                  >
                    <option value="DAT">ĐẠT CHUẨN — Sẵn sàng hoạt động</option>
                    <option value="KHONG_DAT">KHÔNG ĐẠT — Chuyển sửa chữa lớn</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Nội dung kiểm tra & bảo dưỡng (*)</label>
                <textarea
                  className="w-full p-2.5 rounded-md border bg-background text-sm min-h-[70px]"
                  value={noiDung}
                  onChange={(e) => setNoiDung(e.target.value)}
                  placeholder="Ghi rõ các hạng mục: đo độ rò điện, kiểm tra bo mạch, thay thế cảm biến..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Chi phí phát sinh (VNĐ)</label>
                  <Input
                    type="number"
                    value={chiPhi}
                    onChange={(e) => setChiPhi(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Ghi chú thêm</label>
                  <Input
                    value={ghiChu}
                    onChange={(e) => setGhiChu(e.target.value)}
                    placeholder="VD: Đã dán tem kiểm định số 9821..."
                  />
                </div>
              </div>

              {/* Upload ảnh biên bản / tem kiểm định */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Ảnh chụp tem kiểm định / Biên bản bàn giao</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 text-xs"
                  >
                    <Camera className="w-4 h-4" /> Chụp / Tải ảnh minh chứng
                  </Button>
                  {anhMinhChung && (
                    <div className="flex items-center gap-2">
                      <img
                        src={anhMinhChung}
                        alt="Tem kiểm định"
                        className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-90"
                        onClick={() => setPreviewImage(anhMinhChung)}
                      />
                      <span className="text-xs text-success flex items-center gap-1 font-medium">
                        <Check className="w-3.5 h-3.5" /> Đã chọn ảnh
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thông báo tự động tính mốc tiếp theo */}
              {ketQua === 'DAT' && (
                <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 text-xs text-blue-800 dark:text-blue-300">
                  💡 <strong>Tự động gia hạn:</strong> Sau khi bấm xác nhận, mốc bảo trì tiếp theo sẽ được hệ thống tự động cộng thêm <strong>{selectedDevice.chuKyBaoTri} tháng</strong> kể từ ngày {ngayHoanThanh}.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 pt-3 border-t">
            <Button variant="outline" onClick={() => setCompleteModalOpen(false)} disabled={submitting}>
              Hủy
            </Button>
            <Button onClick={handleSubmitComplete} disabled={submitting} className="gradient-primary text-primary-foreground gap-1.5">
              {submitting ? 'Đang lưu...' : 'Lưu kết quả nghiệm thu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: SỔ NHẬT KÝ / LỊCH SỬ BẢO TRÌ */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" /> Sổ Nhật ký Bảo trì — {selectedDevice?.tenThietBi}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {historyLoading ? (
              <div className="text-center py-8 text-muted-foreground">Đang tải lịch sử...</div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground border rounded-xl border-dashed">
                Chưa có ghi nhận bảo trì nào trước đây cho thiết bị này.
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((rec, i) => (
                  <div key={rec.id || i} className="p-4 rounded-xl border bg-card shadow-sm hover:border-primary/30 transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">{rec.maPhieuBaoTri}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          rec.ketQua === 'DAT' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        )}>
                          {rec.ketQua === 'DAT' ? 'Đạt chuẩn' : 'Không đạt'}
                        </span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {rec.loaiBaoTri === 'DINH_KY' ? 'Bảo dưỡng định kỳ' :
                            rec.loaiBaoTri === 'KIEM_DINH' ? 'Kiểm định / Hiệu chuẩn' : 'Sửa chữa'}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Ngày làm: {new Date(rec.ngayHoanThanh).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-foreground">{rec.noiDung}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground mt-3 pt-2 border-t">
                      <div>
                        <span>Người làm:</span> <strong className="text-foreground">{rec.nguoiThucHien}</strong>
                      </div>
                      <div>
                        <span>Chi phí:</span> <strong className="text-primary">{new Intl.NumberFormat('vi-VN').format(rec.chiPhi || 0)} đ</strong>
                      </div>
                      {rec.ghiChu && (
                        <div className="col-span-2">
                          <span>Ghi chú:</span> <span className="italic text-foreground">{rec.ghiChu}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 pt-2 border-t flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {rec.anhMinhChung && (
                          <button
                            type="button"
                            onClick={() => setPreviewImage(rec.anhMinhChung || null)}
                            className="text-xs text-primary hover:underline font-medium cursor-pointer bg-transparent border-0 p-0 flex items-center gap-1"
                          >
                            <Camera className="w-3.5 h-3.5" /> Xem ảnh tem/biên bản
                          </button>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenHandoverForRecord(rec)}
                        className="h-7 px-2.5 text-[11px] border-primary/40 text-primary hover:bg-primary/10 gap-1 shadow-sm"
                        title="In biên bản nghiệm thu & bàn giao cho đợt bảo dưỡng này"
                      >
                        <Printer className="w-3.5 h-3.5" /> In biên bản bàn giao
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-3 border-t">
            <Button variant="outline" onClick={() => setHistoryModalOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: PREVIEW ẢNH */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-2xl p-2 bg-black/90 border-none">
            <div className="relative flex items-center justify-center">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-2 right-2 text-white bg-black/50 p-1 rounded-full hover:bg-black"
              >
                <X className="w-5 h-5" />
              </button>
              <img src={previewImage} alt="Ảnh minh chứng" className="max-h-[80vh] w-auto object-contain rounded-lg" />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 4: BIÊN BẢN NGHIỆM THU & BÀN GIAO THIẾT BỊ Y TẾ (A4 & CHỈNH SỬA) */}
      <Dialog open={handoverModalOpen} onOpenChange={setHandoverModalOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-4 sm:p-6 bg-background">
          <DialogHeader className="border-b pb-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2 text-primary text-lg">
                  <FileText className="w-5 h-5 text-primary" /> Biên bản Nghiệm thu & Bàn giao Kỹ thuật Thiết bị
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bạn có thể chỉnh sửa mọi thông tin bên giao, bên nhận, nội dung kỹ thuật trước khi in hoặc lưu trữ.
                </p>
              </div>

              {/* Nhóm nút chế độ xem / chỉnh sửa & in */}
              <div className="flex flex-wrap items-center gap-2">
                {canManage ? (
                  <div className="flex items-center bg-muted p-1 rounded-lg border">
                    <button
                      type="button"
                      onClick={() => setHandoverTab('preview')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                        handoverTab === 'preview' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem trước A4
                    </button>
                    <button
                      type="button"
                      onClick={() => setHandoverTab('edit')}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                        handoverTab === 'edit' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-primary" /> Chỉnh sửa nội dung
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-blue-50/70 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 text-xs font-semibold">
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Xem trước bản in A4</span>
                  </div>
                )}

                {canManage && (
                  <Button
                    onClick={handlePreSaveHandover}
                    disabled={savingHandover}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-9 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    title="Lưu lại nội dung đã chỉnh sửa vào hệ thống"
                  >
                    <Save className="w-4 h-4 text-emerald-600" /> {savingHandover ? 'Đang lưu...' : 'Lưu biên bản'}
                  </Button>
                )}

                <Button
                  onClick={() => handlePrintForm('handover-form-content', `Bien_Ban_Ban_Giao_${handoverData?.maThietBi}`)}
                  className="gradient-primary text-white gap-1.5 shadow-sm text-xs h-9 px-3.5"
                >
                  <Printer className="w-4 h-4" /> In biên bản (A4)
                </Button>
              </div>
            </div>
          </DialogHeader>

          {handoverData && (
            <div className="py-2">
              {/* TAB 1: FORM CHỈNH SỬA NỘI DUNG BIÊN BẢN */}
              {handoverTab === 'edit' ? (
                <div className="space-y-4 animate-fade-in text-sm">
                  <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 rounded-xl flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                    <span className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-amber-600" />
                      <strong>Chế độ chỉnh sửa:</strong> Bạn có thể sửa đổi họ tên người giao, người nhận, ngày tháng và nội dung kỹ thuật. Mọi thay đổi sẽ cập nhật trực tiếp vào bản in A4.
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setHandoverTab('preview')}
                      className="text-xs h-7 text-amber-800 hover:text-amber-950"
                    >
                      Xem bản in →
                    </Button>
                  </div>

                  {/* Khối 1: Bên giao & Bên nhận */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bên giao */}
                    <div className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
                      <div className="font-bold text-xs uppercase text-primary flex items-center gap-1.5 border-b pb-2">
                        <UserCheck className="w-4 h-4" /> 1. Đại diện Bên Giao (Kỹ thuật / Kho)
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Họ và tên người giao (*)</label>
                        <Input
                          value={handoverData.nguoiThucHien}
                          onChange={(e) => setHandoverData({ ...handoverData, nguoiThucHien: e.target.value })}
                          placeholder="VD: Kỹ sư Nguyễn Văn A / Đơn vị bảo trì"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Chức vụ bên giao</label>
                        <Input
                          value={handoverData.chucVuNguoiGiao}
                          onChange={(e) => setHandoverData({ ...handoverData, chucVuNguoiGiao: e.target.value })}
                          placeholder="VD: Kỹ thuật viên / Phụ trách bảo dưỡng TBYT"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Đơn vị / Phòng ban</label>
                        <Input
                          value={handoverData.donViNguoiGiao}
                          onChange={(e) => setHandoverData({ ...handoverData, donViNguoiGiao: e.target.value })}
                          placeholder="VD: Phòng Quản lý Trang thiết bị Y tế - Kho Trung tâm"
                        />
                      </div>
                    </div>

                    {/* Bên nhận */}
                    <div className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
                      <div className="font-bold text-xs uppercase text-primary flex items-center gap-1.5 border-b pb-2">
                        <Hospital className="w-4 h-4" /> 2. Đại diện Bên Nhận (Khoa sử dụng)
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Họ và tên người nhận (*)</label>
                        <Input
                          value={handoverData.nguoiNhan}
                          onChange={(e) => setHandoverData({ ...handoverData, nguoiNhan: e.target.value })}
                          placeholder="VD: BS. Trần Thị Mai"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Chức vụ bên nhận</label>
                        <Input
                          value={handoverData.chucVuNguoiNhan}
                          onChange={(e) => setHandoverData({ ...handoverData, chucVuNguoiNhan: e.target.value })}
                          placeholder="VD: Trưởng Khoa / Trợ lý Khoa / Điều dưỡng trưởng"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Đơn vị / Khoa tiếp nhận</label>
                        <Input
                          value={handoverData.donViNguoiNhan}
                          onChange={(e) => setHandoverData({ ...handoverData, donViNguoiNhan: e.target.value })}
                          placeholder="VD: Khoa Cấp cứu / Khoa Nội"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Khối 2: Thông tin nghiệm thu & nội dung kỹ thuật */}
                  <div className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
                    <div className="font-bold text-xs uppercase text-primary flex items-center gap-1.5 border-b pb-2">
                      <Wrench className="w-4 h-4" /> 3. Thông số kỹ thuật & Đánh giá chất lượng
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Ngày hoàn thành nghiệm thu</label>
                        <Input
                          type="date"
                          value={handoverData.ngayHoanThanh}
                          onChange={(e) => setHandoverData({ ...handoverData, ngayHoanThanh: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Hạn bảo dưỡng lần kế tiếp</label>
                        <Input
                          type="date"
                          value={handoverData.ngayBaoTriTiepTheo || ''}
                          onChange={(e) => setHandoverData({ ...handoverData, ngayBaoTriTiepTheo: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Hình thức thực hiện</label>
                        <select
                          className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                          value={handoverData.loaiBaoTri}
                          onChange={(e) => setHandoverData({ ...handoverData, loaiBaoTri: e.target.value })}
                        >
                          <option value="DINH_KY">Bảo dưỡng định kỳ</option>
                          <option value="KIEM_DINH">Kiểm định an toàn & Hiệu chuẩn</option>
                          <option value="SUA_CHUA">Sửa chữa & Thay thế linh kiện</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Kết quả đánh giá</label>
                        <select
                          className={cn(
                            "w-full h-10 px-3 rounded-md border text-sm font-semibold",
                            handoverData.ketQua === 'DAT' ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300" : "text-destructive bg-destructive/10 border-destructive/30"
                          )}
                          value={handoverData.ketQua}
                          onChange={(e) => setHandoverData({ ...handoverData, ketQua: e.target.value as any })}
                        >
                          <option value="DAT">ĐẠT CHUẨN — Sẵn sàng hoạt động</option>
                          <option value="KHONG_DAT">KHÔNG ĐẠT — Chuyển sửa chữa</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Nội dung kỹ thuật đã tiến hành</label>
                      <textarea
                        className="w-full p-2.5 rounded-md border bg-background text-sm min-h-[65px]"
                        value={handoverData.noiDung}
                        onChange={(e) => setHandoverData({ ...handoverData, noiDung: e.target.value })}
                        placeholder="Nội dung kiểm tra, đo đạc an toàn, vệ sinh..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Tình trạng thiết bị khi bàn giao</label>
                      <textarea
                        className="w-full p-2.5 rounded-md border bg-background text-sm min-h-[65px]"
                        value={handoverData.tinhTrangBanGiao}
                        onChange={(e) => setHandoverData({ ...handoverData, tinhTrangBanGiao: e.target.value })}
                        placeholder="Thiết bị đã khử khuẩn, dán tem kiểm định..."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Chi phí phát sinh (VNĐ)</label>
                        <Input
                          type="number"
                          value={handoverData.chiPhi || 0}
                          onChange={(e) => setHandoverData({ ...handoverData, chiPhi: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Ghi chú thêm</label>
                        <Input
                          value={handoverData.ghiChu || ''}
                          onChange={(e) => setHandoverData({ ...handoverData, ghiChu: e.target.value })}
                          placeholder="VD: Đã dán tem kiểm định số..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* TAB 2: VÙNG IN BIÊN BẢN CHUẨN A4 */
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 rounded-xl flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                    <span>
                      💡 <strong>Bản xem trước A4:</strong> Đây là bản hiển thị khi in ra giấy hoặc xuất file PDF. Nếu cần chỉnh sửa tên người giao/nhận hoặc nội dung, hãy bấm nút <strong>"Chỉnh sửa nội dung"</strong> ở góc trên.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHandoverTab('edit')}
                      className="text-xs h-7 border-blue-300 gap-1 text-blue-900 dark:text-blue-200"
                    >
                      <Edit3 className="w-3 h-3" /> Sửa thông tin
                    </Button>
                  </div>

                  <div className="py-2 overflow-x-auto">
                    {(() => {
                      const d = handoverData.ngayHoanThanh ? new Date(handoverData.ngayHoanThanh) : new Date();
                      const day = String(d.getDate()).padStart(2, '0');
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const year = d.getFullYear();

                      return (
                        <div
                          id="handover-form-content"
                          style={{ fontFamily: "'Times New Roman', 'Segoe UI', Tahoma, Arial, sans-serif" }}
                          className="bg-white text-black p-8 sm:p-12 text-[13px] leading-relaxed border shadow-md rounded-xl max-w-[800px] mx-auto min-w-[650px]"
                        >
                          {/* Quốc hiệu - Tiêu ngữ */}
                          <div className="header-grid flex justify-between items-start mb-6">
                            <div className="text-center w-5/12">
                              <div className="font-bold text-[12px] uppercase tracking-wider">BỘ Y TẾ</div>
                              <div className="font-bold text-[13px] uppercase text-black">BỆNH VIỆN ĐA KHOA QUỐC TẾ</div>
                              <div className="text-[11.5px] italic text-gray-700">Phòng Vật tư - Trang thiết bị Y tế</div>
                              <div className="border-b border-black w-24 mx-auto my-1.5"></div>
                            </div>
                            <div className="text-center w-6/12">
                              <div className="font-bold text-[12px] uppercase tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                              <div className="font-bold text-[12px] italic text-black">Độc lập - Tự do - Hạnh phúc</div>
                              <div className="border-b border-black w-32 mx-auto my-1.5"></div>
                              <div className="text-[11px] italic text-gray-600 mt-1">Mã số: {handoverData.maPhieu}</div>
                              <div className="text-[11px] italic text-gray-700">Hà Nội, ngày {day} tháng {month} năm {year}</div>
                            </div>
                          </div>

                          {/* Tiêu đề chính */}
                          <div className="title-area text-center my-6">
                            <h2 className="font-bold text-[16.5px] uppercase tracking-wide">
                              BIÊN BẢN NGHIỆM THU KỸ THUẬT & BÀN GIAO THIẾT BỊ Y TẾ
                            </h2>
                            <div className="italic text-[12px] text-gray-700 mt-1">
                              (Sau khi hoàn thành bảo dưỡng kỹ thuật định kỳ / kiểm định đo lường an toàn)
                            </div>
                          </div>

                          {/* Căn cứ */}
                          <div className="mb-4 text-[12px] italic text-gray-800 space-y-1">
                            <p>- Căn cứ Quy chế quản lý, vận hành và bảo dưỡng trang thiết bị y tế tại Bệnh viện Đa khoa Quốc tế;</p>
                            <p>- Căn cứ Kế hoạch bảo trì định kỳ và kiểm định an toàn kỹ thuật trang thiết bị y tế năm {year};</p>
                            <p>- Căn cứ kết quả kiểm tra, bảo dưỡng thực tế tại vị trí lắp đặt thiết bị;</p>
                            <p>- Hôm nay, ngày {day} tháng {month} năm {year}, tại {handoverData.donViNguoiNhan || handoverData.viTriHienTai}, hai bên tiến hành bàn giao nghiệm thu thiết bị y tế với các nội dung chi tiết dưới đây:</p>
                          </div>

                          {/* Phần I: Thành phần tham gia */}
                          <div className="mb-4">
                            <div className="font-bold uppercase text-[13px] mb-2 text-black">I. THÀNH PHẦN THAM GIA BÀN GIAO:</div>
                            <div className="grid grid-cols-2 gap-4 pl-2 text-[12.5px]">
                              <div className="p-2.5 rounded bg-gray-50/70 border border-gray-200">
                                <div className="font-bold text-black uppercase text-[11.5px] mb-1">1. ĐẠI DIỆN BÊN GIAO (KỸ THUẬT / KHO):</div>
                                <p>- Họ và tên: <strong>{handoverData.nguoiThucHien}</strong></p>
                                <p>- Chức vụ: {handoverData.chucVuNguoiGiao || 'Kỹ thuật viên / Kỹ sư thiết bị y tế'}</p>
                                <p>- Đơn vị: {handoverData.donViNguoiGiao || 'Phòng Quản lý Trang thiết bị Y tế - Kho Trung tâm'}</p>
                              </div>
                              <div className="p-2.5 rounded bg-gray-50/70 border border-gray-200">
                                <div className="font-bold text-black uppercase text-[11.5px] mb-1">2. ĐẠI DIỆN BÊN NHẬN (ĐƠN VỊ SỬ DỤNG):</div>
                                <p>- Họ và tên: <strong>{handoverData.nguoiNhan || 'Cán bộ phụ trách'}</strong></p>
                                <p>- Chức vụ: {handoverData.chucVuNguoiNhan || 'Bác sĩ / Điều dưỡng trưởng'}</p>
                                <p>- Đơn vị công tác: <strong>{handoverData.donViNguoiNhan || handoverData.viTriHienTai}</strong></p>
                              </div>
                            </div>
                          </div>

                          {/* Phần II: Thông tin thiết bị & Kết quả kỹ thuật */}
                          <div className="mb-4">
                            <div className="font-bold uppercase text-[13px] mb-2 text-black">II. THÔNG SỐ THIẾT BỊ VÀ NỘI DUNG NGHIỆM THU:</div>
                            <table className="w-full border-collapse border border-black my-2 text-[12px]">
                              <tbody>
                                <tr>
                                  <td className="border border-black p-2 font-semibold w-1/3 bg-gray-100">Tên trang thiết bị:</td>
                                  <td className="border border-black p-2 font-bold text-[13px]">{handoverData.tenThietBi}</td>
                                </tr>
                                <tr>
                                  <td className="border border-black p-2 font-semibold bg-gray-100">Mã quản lý thiết bị:</td>
                                  <td className="border border-black p-2 font-mono font-bold">{handoverData.maThietBi}</td>
                                </tr>
                                <tr>
                                  <td className="border border-black p-2 font-semibold bg-gray-100">Số Chế tạo / Serial:</td>
                                  <td className="border border-black p-2 font-mono">{handoverData.serialNumber || 'Theo mã quản lý'}</td>
                                </tr>
                                <tr>
                                  <td className="border border-black p-2 font-semibold bg-gray-100">Khoa / Phòng sử dụng:</td>
                                  <td className="border border-black p-2 font-bold">{handoverData.donViNguoiNhan || handoverData.viTriHienTai}</td>
                                </tr>
                                <tr>
                                  <td className="border border-black p-2 font-semibold bg-gray-100">Loại hình thực hiện:</td>
                                  <td className="border border-black p-2">{getLoaiBaoTriText(handoverData.loaiBaoTri)}</td>
                                </tr>
                                <tr>
                                  <td className="border border-black p-2 font-semibold bg-gray-100">Chu kỳ kiểm định kỹ thuật:</td>
                                  <td className="border border-black p-2 font-semibold">{handoverData.chuKyBaoTri} tháng / lần</td>
                                </tr>
                                <tr>
                                  <td className="border border-black p-2 font-semibold bg-gray-100">Ngày hoàn thành bảo dưỡng:</td>
                                  <td className="border border-black p-2 font-bold">{formatDate(handoverData.ngayHoanThanh)}</td>
                                </tr>
                                <tr>
                                  <td className="border border-black p-2 font-semibold bg-gray-100">Thời hạn bảo dưỡng lần kế tiếp:</td>
                                  <td className="border border-black p-2 font-bold text-black">{formatDate(handoverData.ngayBaoTriTiepTheo)}</td>
                                </tr>
                              </tbody>
                            </table>

                            <div className="mt-3 text-[12.5px] space-y-1.5 pl-1">
                              <p>
                                <strong>- Nội dung kỹ thuật đã tiến hành: </strong>
                                <span>{handoverData.noiDung}</span>
                              </p>
                              {handoverData.ghiChu && (
                                <p>
                                  <strong>- Ghi chú kỹ thuật bổ sung: </strong>
                                  <span className="italic">{handoverData.ghiChu}</span>
                                </p>
                              )}
                              <p>
                                <strong>- Đánh giá chất lượng sau bảo dưỡng: </strong>
                                <span className={cn(
                                  "font-bold uppercase px-1.5 py-0.5 rounded text-[11.5px]",
                                  handoverData.ketQua === 'DAT' ? "text-green-800 bg-green-100 border border-green-300" : "text-red-800 bg-red-100 border border-red-300"
                                )}>
                                  {handoverData.ketQua === 'DAT' ? '✓ ĐẠT TIÊU CHUẨN AN TOÀN VẬN HÀNH & ĐỦ ĐIỀU KIỆN SỬ DỤNG' : '✗ KHÔNG ĐẠT - CHUYỂN BỘ PHẬN SỬA CHỮA CHUYÊN SÂU'}
                                </span>
                              </p>
                              <p>
                                <strong>- Tình trạng khi bàn giao: </strong>
                                <span>{handoverData.tinhTrangBanGiao || 'Thiết bị đã được vệ sinh khử khuẩn, kiểm tra đo điện trở tiếp đất và an toàn điện đạt chuẩn; các phím điều khiển, màn hình hiển thị hoạt động chính xác; đã dán tem kiểm định định kỳ lên thân máy.'}</span>
                              </p>
                            </div>
                          </div>

                          {/* Phần III: Điều khoản cam kết */}
                          <div className="mb-6 text-[12.5px]">
                            <div className="font-bold uppercase text-[13px] mb-1.5 text-black">III. ĐIỀU KHOẢN TRÁCH NHIỆM & CAM KẾT:</div>
                            <ul className="list-disc pl-5 space-y-1 text-gray-800">
                              <li>Đơn vị tiếp nhận có trách nhiệm bảo quản, vệ sinh sau mỗi ca trực và vận hành thiết bị theo đúng quy trình hướng dẫn của nhà sản xuất.</li>
                              <li>Tuyệt đối không tự ý can thiệp, tháo dỡ linh kiện hoặc thay đổi các thông số hiệu chuẩn kỹ thuật đã được thiết lập.</li>
                              <li>Khi máy có dấu hiệu cảnh báo lỗi hoặc đến hạn kiểm định tiếp theo ({formatDate(handoverData.ngayBaoTriTiepTheo)}), đơn vị sử dụng phải thông báo ngay cho Phòng Vật tư - TBYT để xử lý kịp thời.</li>
                              <li>Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, Bên giao giữ 01 bản, Bên nhận giữ 01 bản để theo dõi hồ sơ trang thiết bị.</li>
                            </ul>
                          </div>

                          {/* Phần IV: Khối chữ ký (3 bên) */}
                          <div className="signatures flex justify-between items-start mt-10 pt-4 border-t border-dashed border-gray-300 page-break-inside-avoid">
                            <div className="sig-box text-center w-[30%]">
                              <div className="font-bold uppercase text-[12px] text-black">ĐẠI DIỆN KHOA SỬ DỤNG</div>
                              <div className="italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                              <div className="font-bold text-[12px] text-black">{handoverData.nguoiNhan || ''}</div>
                            </div>
                            <div className="sig-box text-center w-[30%]">
                              <div className="font-bold uppercase text-[12px] text-black">KỸ THUẬT VIÊN THỰC HIỆN</div>
                              <div className="italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                              <div className="font-bold text-[12px] text-black">{handoverData.nguoiThucHien || ''}</div>
                            </div>
                            <div className="sig-box text-center w-[30%]">
                              <div className="font-bold uppercase text-[12px] text-black">PHỤ TRÁCH KHO / VẬT TƯ</div>
                              <div className="italic text-[11px] text-gray-500 mb-16">(Ký và ghi rõ họ tên)</div>
                              <div className="font-bold text-[12px] text-black"></div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-3 pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Mã biên bản: <strong className="font-mono text-foreground">{handoverData?.maPhieu}</strong></span>
              <span className="text-muted-foreground/40">•</span>
              <span className="italic">{handoverTab === 'edit' ? 'Đang ở chế độ chỉnh sửa' : 'Đang ở chế độ xem trước bản in'}</span>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {canManage && (
                <>
                  {handoverTab === 'edit' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHandoverTab('preview')}
                      className="text-xs h-9 gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Xem trước A4
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHandoverTab('edit')}
                      className="text-xs h-9 gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-primary" /> Chỉnh sửa
                    </Button>
                  )}

                  <Button
                    onClick={handlePreSaveHandover}
                    disabled={savingHandover}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-9 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  >
                    <Save className="w-4 h-4 text-emerald-600" /> {savingHandover ? 'Đang lưu...' : 'Lưu biên bản'}
                  </Button>
                </>
              )}

              {!canManage && (
                <div className="text-xs text-muted-foreground italic flex items-center gap-1.5 mr-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Chỉ Kỹ thuật viên / Quản lý kho mới có thẩm quyền lưu biên bản</span>
                </div>
              )}

              <Button
                onClick={() => handlePrintForm('handover-form-content', `Bien_Ban_Ban_Giao_${handoverData?.maThietBi}`)}
                className="gradient-primary text-white gap-1.5 shadow-sm text-xs h-9 px-3.5"
              >
                <Printer className="w-4 h-4" /> In biên bản (A4)
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setHandoverModalOpen(false)} className="text-xs h-9">
                Đóng
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* HỘP THOẠI CẢNH BÁO & XÁC NHẬN TRÁCH NHIỆM KỸ THUẬT KHI LƯU BIÊN BẢN */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <DialogContent className="max-w-md p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              Xác Nhận Cập Nhật Hồ Sơ Kỹ Thuật
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              ⚠️ <strong>Cảnh báo trách nhiệm kỹ thuật:</strong> Bạn đang chuẩn bị ghi nhận biên bản kiểm định chính thức và cập nhật mốc bảo dưỡng cho thiết bị vào cơ sở dữ liệu bệnh viện.
            </div>

            <div className="border rounded-xl p-3 bg-muted/30 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-1.5 border-b">
                <span className="text-muted-foreground">Người chịu trách nhiệm:</span>
                <strong className="text-foreground">{user?.hoTen} ({ROLE_LABELS[user?.vaiTro || 'ADMIN']})</strong>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b">
                <span className="text-muted-foreground">Trang thiết bị:</span>
                <span className="font-semibold text-foreground text-right">{handoverData?.tenThietBi} ({handoverData?.maThietBi})</span>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b">
                <span className="text-muted-foreground">Ngày hoàn thành:</span>
                <strong className="text-foreground">{formatDate(handoverData?.ngayHoanThanh)}</strong>
              </div>
              <div className="flex justify-between items-center pb-1.5 border-b">
                <span className="text-muted-foreground">Mốc kiểm định tiếp theo:</span>
                <strong className="text-primary font-bold text-sm">{formatDate(handoverData?.ngayBaoTriTiepTheo)}</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Đánh giá kỹ thuật:</span>
                <span className={cn(
                  "font-bold px-2 py-0.5 rounded text-[11px]",
                  handoverData?.ketQua === 'DAT' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}>
                  {handoverData?.ketQua === 'DAT' ? 'ĐẠT TIÊU CHUẨN AN TOÀN' : 'KHÔNG ĐẠT'}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic">
              * Hệ thống sẽ tự động gửi thông báo đồng bộ đến Khoa đang quản lý thiết bị này để đảm bảo tính minh bạch.
            </p>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setSaveConfirmOpen(false)} disabled={savingHandover}>
              Hủy bỏ
            </Button>
            <Button
              onClick={handleExecuteSaveHandover}
              disabled={savingHandover}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shadow-sm font-semibold"
            >
              <CheckCircle className="w-4 h-4" /> {savingHandover ? "Đang lưu..." : "Tôi xác nhận & Lưu hồ sơ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL DANH SÁCH THÔNG BÁO BẢO TRÌ THIẾT BỊ */}
      {/* ────────────────────────────────────────────────────────── */}
      <Dialog open={notifModalOpen} onOpenChange={setNotifModalOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b bg-muted/20">
            <DialogTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <span>Thông Báo Bảo Trì & Kiểm Định</span>
              </div>
              {allAlertItems.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {allAlertItems.length} thiết bị
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {allAlertItems.length === 0 && systemNotifs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground space-y-2">
                <CheckCircle2 className="w-10 h-10 text-success mx-auto opacity-70" />
                <p className="font-medium text-sm">Không có thông báo bảo trì nào</p>
                <p className="text-xs">Tất cả thiết bị đều đang trong tình trạng hoạt động đạt chuẩn.</p>
              </div>
            ) : (
              <>
                {/* 1. Cảnh báo trực tiếp từ thiết bị */}
                {allAlertItems.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                      <span>Thiết bị cần kiểm định ({allAlertItems.length})</span>
                      <span className="text-[11px] font-normal lowercase">nhấn để thao tác</span>
                    </div>

                    {allAlertItems.map((item) => {
                      const isOverdue = item.trangThaiBaoTri === 'QUA_HAN' || (item.soNgayConLai !== null && item.soNgayConLai < 0);
                      const isDueToday = item.soNgayConLai === 0;

                      return (
                        <div
                          key={item.maThietBi}
                          className={cn(
                            "p-3 rounded-xl border text-sm transition-all flex flex-col gap-2",
                            isOverdue || isDueToday
                              ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900"
                              : "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-foreground flex items-center gap-1.5">
                                <span>{item.tenThietBi}</span>
                                <span className="font-mono text-[10px] px-1 bg-background/80 border rounded text-muted-foreground">
                                  {item.maThietBi}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Vị trí: <strong className="text-foreground/90">{item.viTriHienTai}</strong>
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              {isOverdue && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0.2 font-semibold">
                                  Quá hạn {Math.abs(item.soNgayConLai || 0)} ngày
                                </Badge>
                              )}
                              {isDueToday && (
                                <Badge className="text-[10px] px-1.5 py-0.2 bg-rose-600 text-white font-semibold">
                                  Đến hạn hôm nay
                                </Badge>
                              )}
                              {!isOverdue && !isDueToday && (
                                <Badge className="text-[10px] px-1.5 py-0.2 bg-amber-500 text-white font-semibold">
                                  Còn {item.soNgayConLai} ngày
                                </Badge>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Hạn: {formatDate(item.ngayBaoTriTiepTheo)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/40">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSearch(item.maThietBi);
                                setNotifModalOpen(false);
                              }}
                              className="h-6 text-[11px] px-2 text-muted-foreground"
                            >
                              Xem trong bảng
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setNotifModalOpen(false);
                                handleOpenHandoverForItem(item);
                              }}
                              className="h-6 text-[11px] px-2 text-primary"
                            >
                              Biên bản
                            </Button>

                            {canManage && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setNotifModalOpen(false);
                                  handleOpenCompleteModal(item);
                                }}
                                className={cn(
                                  "h-6 text-[11px] px-2 text-white",
                                  isOverdue || isDueToday ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"
                                )}
                              >
                                Nghiệm thu
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Lịch sử thông báo hệ thống nếu có */}
                {systemNotifs.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      Lịch sử thông báo hệ thống ({systemNotifs.length})
                    </div>
                    {systemNotifs.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "p-3 rounded-xl border text-xs transition-all",
                          n.daDoc ? "bg-card opacity-70" : "bg-primary/5 border-primary/20 shadow-xs"
                        )}
                        onClick={() => handleReadNotification(n.id)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={cn("font-bold text-[13px]", !n.daDoc && "text-primary")}>{n.tieuDe}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(n.ngayTao).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{n.noiDung}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="p-3 border-t bg-muted/20 flex items-center justify-between">
            {systemNotifs.some(n => !n.daDoc) && (
              <Button variant="outline" size="sm" onClick={handleReadAllNotifications} className="text-xs gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> Đánh dấu đã đọc tất cả
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setNotifModalOpen(false)} className="text-xs ml-auto">
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
