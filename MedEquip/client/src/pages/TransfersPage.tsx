import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { store } from '@/lib/store';
import { fetchApi } from '@/services/api';
import { 
  apiGetNeeds, apiCreateNeed, apiCloseNeed, apiReopenNeed,
  apiCreateRequest, apiApproveRequest, apiConfirmTransfer 
} from '@/lib/apiSync';
import { PhieuYeuCauCapPhat, NhuCauThietBi, ThietBi, Khoa } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { QRCodeCanvas as QRCodeComponent } from 'qrcode.react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ArrowLeftRight, Plus, Search, CheckCircle2, Clock, AlertTriangle,
  Building2, UserCheck, ShieldCheck, FileText, Printer, CheckCheck,
  Send, Eye, X, Activity, Sparkles, Filter, ChevronRight, Stethoscope,
  Info, Check, Ban, History, RotateCcw
} from 'lucide-react';


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

export default function TransfersPage() {
  const { user } = useAuth();

  const isTruongKhoa = user?.vaiTro === 'TRUONG_KHOA';
  const isTroLy = user?.vaiTro === 'TRO_LY';
  const isQlKho = user?.vaiTro === 'QL_KHO' || user?.vaiTro === 'ADMIN';

  // Xác định mã khoa của người dùng hiện tại
  const userDept = user?.maKhoa || (
    user?.email === 'khoanoi@benhvien.vn' || user?.hoTen?.includes('Nội') ? 'K-001' :
    user?.hoTen?.includes('Ngoại') ? 'K-002' :
    user?.hoTen?.includes('Sản') ? 'K-003' : 'K-001'
  );

  // Tab chính: 'bulletin' (Bảng tin nhu cầu) vs 'transfers' (Tiến độ & Biên bản) vs 'history' (Lịch sử phiếu)
  const [activeTab, setActiveTab] = useState<'bulletin' | 'transfers' | 'history'>('bulletin');

  // Dữ liệu Nhu cầu Bảng tin
  const [needs, setNeeds] = useState<NhuCauThietBi[]>([]);
  const [loadingNeeds, setLoadingNeeds] = useState(false);
  const [needSearch, setNeedSearch] = useState('');
  const [needFilterPriority, setNeedFilterPriority] = useState<'ALL' | 'KHAN_CAP' | 'BINH_THUONG'>('ALL');

  // Lịch sử phiếu nhu cầu của khoa
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'ALL' | 'DA_DONG' | 'HOAN_THANH'>('ALL');

  // Dữ liệu Phiếu Điều chuyển
  const [requests, setRequests] = useState<PhieuYeuCauCapPhat[]>([]);
  const [transferSearch, setTransferSearch] = useState('');
  const [transferFilterStatus, setTransferFilterStatus] = useState<string>('ALL');

  // Dữ liệu tham chiếu
  const [departments, setDepartments] = useState<Khoa[]>([]);
  const [equipmentList, setEquipmentList] = useState<ThietBi[]>([]);
  const [deptInstances, setDeptInstances] = useState<any[]>([]);
  const [loadingDeptInstances, setLoadingDeptInstances] = useState(false);

  // Modal 1: Đăng nhu cầu cần máy
  const [newNeedOpen, setNewNeedOpen] = useState(false);
  const [needDept, setNeedDept] = useState(userDept);
  const [needEquipment, setNeedEquipment] = useState('');
  const [needCustomName, setNeedCustomName] = useState('');
  const [needQty, setNeedQty] = useState(1);
  const [needPriority, setNeedPriority] = useState<'BINH_THUONG' | 'KHAN_CAP'>('BINH_THUONG');

  const [needReason, setNeedReason] = useState('');

  // Modal 2: Tạo đề xuất điều chuyển
  const [newTransferOpen, setNewTransferOpen] = useState(false);
  const [transferSelectedNeedId, setTransferSelectedNeedId] = useState<string | null>(null);
  const [transferInstance, setTransferInstance] = useState('');
  const [transferDestDept, setTransferDestDept] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Modal 3: Kiểm tra kỹ thuật tại chỗ & Tiếp nhận
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectingRequest, setInspectingRequest] = useState<PhieuYeuCauCapPhat | null>(null);
  const [checklist, setChecklist] = useState({
    nguonPin: true,
    manHinhPhim: true,
    camBienDayDo: true,
    khuKhuan: true,
    ngoaiQuan: true,
  });
  const [inspectorName, setInspectorName] = useState(user?.hoTen || '');
  const [inspectNotes, setInspectNotes] = useState('');

  // Modal 4: Xem & In Biên bản A4
  const [previewA4Open, setPreviewA4Open] = useState(false);
  const [previewRequest, setPreviewRequest] = useState<PhieuYeuCauCapPhat | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Load danh sách nhu cầu từ API
  const loadNeeds = async () => {
    setLoadingNeeds(true);
    try {
      const res = await apiGetNeeds();
      if (res?.success && Array.isArray(res.data)) {
        setNeeds(res.data);
      }
    } catch (err) {
      console.error("Failed to load equipment needs:", err);
    } finally {
      setLoadingNeeds(false);
    }
  };

  // Load danh sách phiếu điều chuyển từ Store/API
  const loadTransferRequests = () => {
    const all = store.getRequests();
    const transfersOnly = all.filter(r => r.loaiDeXuat === 'DIEU_CHUYEN');
    setRequests(transfersOnly);
  };

  // Load danh mục khoa & thiết bị
  useEffect(() => {
    setDepartments(store.getDepartments());
    setEquipmentList(store.getEquipment());
    setUsers(store.getUsers());

    fetchApi<any>('/users').then(res => {
      const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      if (list.length > 0) setUsers(list);
    }).catch(() => {});

    loadNeeds();
    loadTransferRequests();

    const handleStoreChange = () => {
      loadTransferRequests();
      loadNeeds();
    };
    window.addEventListener('store_requests_changed', handleStoreChange);
    return () => window.removeEventListener('store_requests_changed', handleStoreChange);
  }, []);

  // Tải danh sách cá thể máy khoa đang giữ
  const fetchDeptInstances = async (deptCode: string) => {
    setLoadingDeptInstances(true);
    try {
      const res = await fetchApi<any>(`/instances/department/${deptCode}`);
      const rawList = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
      setDeptInstances(rawList.filter((i: any) => i.trangThai === 'DANG_SU_DUNG' || !i.trangThai));
    } catch (e) {
      console.error(e);
      setDeptInstances([]);
    } finally {
      setLoadingDeptInstances(false);
    }
  };

  // Tự động tải danh sách thiết bị của khoa ngay khi vào trang hoặc khi đổi khoa
  useEffect(() => {
    if (userDept) {
      fetchDeptInstances(userDept);
    }
  }, [userDept]);


  // Xử lý gửi Đăng Nhu cầu
  const handleCreateNeed = async () => {
    let finalTbName = needCustomName.trim();
    if (needEquipment) {
      const eq = equipmentList.find(e => e.maThietBi === needEquipment);
      if (eq) finalTbName = eq.tenThietBi;
    }

    if (!finalTbName) {
      return toast({ title: 'Thiếu thông tin', description: 'Vui lòng chọn hoặc nhập tên thiết bị cần hỗ trợ.', variant: 'destructive' });
    }
    if (needQty < 1) {
      return toast({ title: 'Không hợp lệ', description: 'Số lượng cần phải tối thiểu là 1.', variant: 'destructive' });
    }

    try {
      const targetDept = userDept;
      const res = await apiCreateNeed({
        maKhoaYeuCau: targetDept,
        maThietBi: needEquipment || undefined,
        tenThietBi: finalTbName,
        soLuongCan: Number(needQty),
        mucDoUuTien: needPriority,
        lyDo: needReason.trim()
      });

      if (res.success) {
        toast({ title: 'Thành công', description: 'Đã đăng nhu cầu thiết bị lên bảng tin nội viện.' });
        setNewNeedOpen(false);
        setNeedEquipment('');
        setNeedCustomName('');
        setNeedQty(1);
        setNeedReason('');
        loadNeeds();
      } else {
        toast({ title: 'Lỗi', description: res.message || 'Không thể đăng nhu cầu.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  // Xử lý Dừng tìm kiếm Nhu cầu
  const handleCloseNeed = async (id: string) => {
    try {
      const res = await apiCloseNeed(id);
      if (res.success) {
        toast({ 
          title: 'Đã dừng tìm kiếm', 
          description: 'Phiếu nhu cầu đã dừng tìm kiếm và được chuyển vào mục "Lịch sử phiếu".' 
        });
        loadNeeds();
      }
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  // Xử lý Mở lại / Tìm kiếm lại Nhu cầu từ Lịch sử
  const handleReopenNeed = async (id: string) => {
    try {
      const res = await apiReopenNeed(id);
      if (res.success) {
        toast({ 
          title: 'Đã mở lại tìm kiếm', 
          description: 'Phiếu nhu cầu đã được đưa trở lại Bảng tin để tiếp tục kêu gọi hỗ trợ.' 
        });
        loadNeeds();
      } else {
        toast({ title: 'Lỗi', description: res.message || 'Không thể mở lại nhu cầu.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };


  // Mở modal điều chuyển từ một tin nhu cầu
  const handleSupportFromNeed = (need: NhuCauThietBi) => {
    setTransferSelectedNeedId(need.maNhuCau);
    setTransferDestDept(need.maKhoaYeuCau);
    setTransferReason(`Hỗ trợ đáp ứng nhu cầu [${need.maNhuCau}] của ${need.tenKhoaYeuCau || need.maKhoaYeuCau}: ${need.tenThietBi}.`);

    // Tự động tìm và chọn máy cá thể phù hợp của khoa mình nếu có sẵn
    const matching = deptInstances.filter(i => {
      if (need.maThietBi && i.maThietBi === need.maThietBi) return true;
      if (need.tenThietBi && i.tenThietBi) {
        const nName = need.tenThietBi.toLowerCase();
        const iName = i.tenThietBi.toLowerCase();
        return nName.includes(iName) || iName.includes(nName);
      }
      return false;
    });

    if (matching.length > 0) {
      setTransferInstance(matching[0].maCaThe);
    } else {
      setTransferInstance('');
    }

    setNewTransferOpen(true);
  };


  // Xử lý gửi Đề xuất Điều chuyển
  const handleSubmitTransfer = async () => {
    if (!transferInstance) return toast({ title: 'Thiếu thông tin', description: 'Vui lòng chọn máy cá thể cần điều chuyển.', variant: 'destructive' });
    if (!transferDestDept) return toast({ title: 'Thiếu thông tin', description: 'Vui lòng chọn khoa tiếp nhận.', variant: 'destructive' });
    const currentDept = userDept;
    if (transferDestDept === currentDept) return toast({ title: 'Không hợp lệ', description: 'Khoa tiếp nhận phải khác khoa hiện tại.', variant: 'destructive' });
    if (!transferReason.trim()) return toast({ title: 'Thiếu thông tin', description: 'Vui lòng nhập lý do điều chuyển thiết bị.', variant: 'destructive' });

    try {
      const selectedInst = deptInstances.find(i => i.maCaThe === transferInstance);
      const res = await apiCreateRequest({
        maNguoiYeuCau: user?.maNguoiDung,
        maKhoa: currentDept,
        loaiDeXuat: 'DIEU_CHUYEN',
        maKhoaNhan: transferDestDept,
        maCaThe: transferInstance,
        lyDo: transferReason,
        maNhuCau: transferSelectedNeedId || undefined,
        items: [{
          maThietBi: selectedInst?.maThietBi || 'TB',
          soLuong: 1,
          donVi: selectedInst?.donViCoSo || 'Cái'
        }]
      });

      if (res.success) {
        toast({ title: 'Thành công', description: 'Đã gửi đề xuất điều chuyển. Chờ Trưởng khoa duyệt để bàn giao.' });
        setNewTransferOpen(false);
        setTransferInstance('');
        setTransferDestDept('');
        setTransferReason('');
        setTransferSelectedNeedId(null);
        setActiveTab('transfers');
        loadTransferRequests();
      } else {
        toast({ title: 'Lỗi', description: res.message, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi', description: err.message, variant: 'destructive' });
    }
  };

  // Trưởng khoa duyệt điều chuyển
  const handleApproveByHead = async (req: PhieuYeuCauCapPhat, approved: boolean) => {
    try {
      const res = await apiApproveRequest(req.maPhieu, approved);
      if (res.success) {
        toast({ 
          title: approved ? 'Đã phê duyệt' : 'Đã từ chối', 
          description: approved 
            ? 'Đề xuất điều chuyển đã được duyệt. Chuyển sang bước kiểm tra & tiếp nhận tại Khoa nhận.' 
            : 'Đã từ chối đề xuất điều chuyển.' 
        });
        loadTransferRequests();
      }
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  // Mở modal Kiểm tra kỹ thuật & Tiếp nhận
  const handleOpenInspectModal = (req: PhieuYeuCauCapPhat) => {
    setInspectingRequest(req);
    setChecklist({
      nguonPin: true,
      manHinhPhim: true,
      camBienDayDo: true,
      khuKhuan: true,
      ngoaiQuan: true,
    });
    const receiverAssistant = users.find(u => u.maKhoa === req.maKhoaNhan && u.vaiTro === 'TRO_LY');
    const defaultInspector = (user?.vaiTro === 'TRO_LY' && user?.hoTen) 
      ? user.hoTen 
      : (receiverAssistant?.hoTen || (user?.hoTen && !user.hoTen.startsWith('ND-') ? user.hoTen : ''));
    setInspectorName(defaultInspector || (req.maKhoaNhan === 'K-002' ? 'Trợ lý Khoa Ngoại' : 'Trợ lý khoa'));
    setInspectNotes('');
    setInspectModalOpen(true);
  };

  // Xác nhận Kiểm tra Kỹ thuật & Tiếp nhận vào khoa
  const handleConfirmReceive = async () => {
    if (!inspectingRequest) return;
    const allChecked = Object.values(checklist).every(Boolean);
    if (!allChecked) {
      return toast({ 
        title: 'Chưa đạt chuẩn kiểm tra', 
        description: 'Vui lòng kiểm tra và tích đủ tất cả 5 tiêu chuẩn kỹ thuật an toàn trước khi tiếp nhận máy.', 
        variant: 'destructive' 
      });
    }

    try {
      const res = await apiConfirmTransfer(inspectingRequest.maPhieu, {
        checklist: {
          ...checklist,
          nguoiKiemTra: inspectorName.trim(),
          ghiChu: inspectNotes.trim()
        },
        ghiChu: inspectNotes.trim()
      });

      if (res.success) {
        toast({ 
          title: 'Hoàn tất bàn giao!', 
          description: 'Thiết bị đã được cập nhật sang khoa của bạn. Hồ sơ tự động hoàn tất!' 
        });
        setInspectModalOpen(false);
        loadTransferRequests();
        loadNeeds();
      } else {
        toast({ title: 'Lỗi', description: res.message, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Lỗi', description: e.message, variant: 'destructive' });
    }
  };

  // Mở xem Biên bản A4
  const handleOpenPreviewA4 = (req: PhieuYeuCauCapPhat) => {
    setPreviewRequest(req);
    setPreviewA4Open(true);
  };

  // Helper lấy tên khoa từ mã
  const getDeptName = (code?: string | null) => {
    if (!code) return 'N/A';
    const dept = departments.find(d => d.maKhoa === code);
    if (dept) return dept.tenKhoa;
    const hardcodedDepts: Record<string, string> = {
      'K-001': 'Khoa Nội',
      'K-002': 'Khoa Ngoại',
      'K-003': 'Khoa Sản',
      'K-004': 'Khoa Nhi',
      'K-005': 'Khoa Cấp cứu',
      'KHO_TONG': 'Kho Tổng / VTTBYT'
    };
    if (hardcodedDepts[code]) return hardcodedDepts[code];
    return code;
  };

  // Helper lấy họ tên người dùng từ mã hoặc email hoặc tên
  const getUserName = (idOrName?: string | null) => {
    if (!idOrName) return '';
    const found = users.find(u => u.maNguoiDung === idOrName || u.email === idOrName || u.hoTen === idOrName);
    if (found) return found.hoTen;
    const hardcodedUsers: Record<string, string> = {
      'ND-001': 'Nguyễn Văn Admin',
      'ND-002': 'Trần Thị Kho',
      'ND-003': 'Trưởng khoa Nội',
      'ND-004': 'Trưởng khoa Ngoại',
      'ND-005': 'Trưởng khoa Sản',
      'ND-006': 'Lê Văn Quản Lý',
      'ND-007': 'Trợ lý Khoa Nội',
      'ND-008': 'Trợ lý Khoa Ngoại',
      'ND-009': 'Trợ lý Khoa Sản',
    };
    if (hardcodedUsers[idOrName]) return hardcodedUsers[idOrName];
    return idOrName;
  };

  // Helper lấy tên trợ lý / đại diện bên giao (không dùng mã nhân viên)
  const getSenderPersonName = (req: PhieuYeuCauCapPhat) => {
    // 1. Nếu có mã người yêu cầu, đối chiếu sang họ tên (ví dụ: ND-007 -> Trợ lý Khoa Nội)
    if (req.maNguoiYeuCau) {
      const name = getUserName(req.maNguoiYeuCau);
      if (name && !name.startsWith('ND-')) return name;
    }
    // 2. Ưu tiên tìm Trợ lý của khoa giao
    if (req.maKhoa) {
      const senderUsers = users.filter(u => u.maKhoa === req.maKhoa);
      const senderAssistant = senderUsers.find(u => u.vaiTro === 'TRO_LY');
      if (senderAssistant) return senderAssistant.hoTen;

      const assistantMap: Record<string, string> = {
        'K-001': 'Trợ lý Khoa Nội',
        'K-002': 'Trợ lý Khoa Ngoại',
        'K-003': 'Trợ lý Khoa Sản',
        'K-004': 'Trợ lý Khoa Nhi',
        'K-005': 'Trợ lý Khoa Cấp cứu',
      };
      if (assistantMap[req.maKhoa]) return assistantMap[req.maKhoa];
    }
    return 'Trợ lý khoa';
  };

  // Helper lấy tên trợ lý / người tiếp nhận bên nhận (không dùng mã nhân viên)
  const getReceiverPersonName = (req: PhieuYeuCauCapPhat) => {
    const parsedChecklist = typeof req.checklistKyThuat === 'string'
      ? (() => { try { return JSON.parse(req.checklistKyThuat); } catch { return null; } })()
      : req.checklistKyThuat;
    
    const rawInspector = parsedChecklist?.nguoiKiemTra;
    if (rawInspector && rawInspector !== 'Cán bộ khoa' && rawInspector !== 'Đã kiểm tra' && !rawInspector.startsWith('ND-')) {
      return getUserName(rawInspector);
    }
    if (req.maNguoiNhanTest) {
      const name = getUserName(req.maNguoiNhanTest);
      if (name && !name.startsWith('ND-')) return name;
    }

    // Ưu tiên tìm Trợ lý của khoa nhận
    if (req.maKhoaNhan) {
      const receiverUsers = users.filter(u => u.maKhoa === req.maKhoaNhan);
      const receiverAssistant = receiverUsers.find(u => u.vaiTro === 'TRO_LY');
      if (receiverAssistant) return receiverAssistant.hoTen;

      const assistantMap: Record<string, string> = {
        'K-001': 'Trợ lý Khoa Nội',
        'K-002': 'Trợ lý Khoa Ngoại',
        'K-003': 'Trợ lý Khoa Sản',
        'K-004': 'Trợ lý Khoa Nhi',
        'K-005': 'Trợ lý Khoa Cấp cứu',
      };
      if (assistantMap[req.maKhoaNhan]) return assistantMap[req.maKhoaNhan];
    }
    return 'Trợ lý khoa tiếp nhận';
  };

  // In ấn trực tiếp
  const handlePrint = () => {
    window.print();
  };

  // Tải PDF Biên bản A4
  const handleDownloadPDF = () => {
    if (!previewRequest) return;
    const senderDeptName = getDeptName(previewRequest.maKhoa);
    const receiverDeptName = getDeptName(previewRequest.maKhoaNhan);
    const senderPersonName = getSenderPersonName(previewRequest);
    const receiverPersonName = getReceiverPersonName(previewRequest);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("BO Y TE - BENH VIEN DA KHOA", 105, 18, { align: "center" });
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("CONG HOA XA HOI CHU NGHIA VIET NAM", 105, 24, { align: "center" });
    doc.text("Doc lap - Tu do - Hanh phuc", 105, 29, { align: "center" });
    doc.line(75, 31, 135, 31);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("BIEN BAN BAN GIAO & KIEM DINH KY THUAT THIET BI", 105, 42, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Ma so phieu: ${previewRequest.maPhieu}`, 14, 52);
    doc.text(`Ngay lap: ${new Date(previewRequest.ngayTao).toLocaleDateString('vi-VN')}`, 14, 58);
    doc.text(`Khoa giao: ${removeVietnameseTones(senderDeptName)} - Nguoi dai dien: ${removeVietnameseTones(senderPersonName)}`, 14, 64);
    doc.text(`Khoa nhan: ${removeVietnameseTones(receiverDeptName)} - Nguoi tiep nhan: ${removeVietnameseTones(receiverPersonName)}`, 14, 70);
    doc.text(`Thiet bi: ${removeVietnameseTones(previewRequest.items?.[0]?.tenThietBi || previewRequest.maThietBi)} - Ca the: ${previewRequest.maCaThe || 'N/A'}`, 14, 76);
    doc.text(`Trang thai: HOAN THANH - DA TIEP NHAN VAO KHOA`, 14, 82);

    autoTable(doc, {
      startY: 88,
      head: [['STT', 'Tieu chi kiem tra ky thuat', 'Ket qua']],
      body: [
        ['1', 'Nguon & Pin luu dien (Khong chai, hoat dong on dinh)', 'DAT CHUAN [V]'],
        ['2', 'Man hinh hien thi & Phim bam dieu khien (Sac net, nhay)', 'DAT CHUAN [V]'],
        ['3', 'Cam bien, dau do & Day ket noi (Day du phu kien)', 'DAT CHUAN [V]'],
        ['4', 'Tiet trung & Khu khuan lam sang (Dat chuan KSNK)', 'DAT CHUAN [V]'],
        ['5', 'Ngoai quan, vo may & Tem kiem dinh (Nguyen ven)', 'DAT CHUAN [V]'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [88, 28, 135] }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 145;
    doc.text("DAI DIEN KHOA GIAO", 35, finalY + 16, { align: "center" });
    doc.text(`(${removeVietnameseTones(senderDeptName)})`, 35, finalY + 21, { align: "center" });
    doc.text(removeVietnameseTones(senderPersonName), 35, finalY + 33, { align: "center" });

    doc.text("DAI DIEN KHOA NHAN", 105, finalY + 16, { align: "center" });
    doc.text(`(${removeVietnameseTones(receiverDeptName)})`, 105, finalY + 21, { align: "center" });
    doc.text(removeVietnameseTones(receiverPersonName), 105, finalY + 33, { align: "center" });

    doc.text("QUAN LY KHO / VTTBYT", 170, finalY + 16, { align: "center" });
    doc.text("(Phong VTTBYT)", 170, finalY + 21, { align: "center" });
    doc.text("He thong tu dong", 170, finalY + 33, { align: "center" });

    doc.save(`BienBan_DieuChuyen_${previewRequest.maPhieu}.pdf`);
    toast({ title: 'Xuất PDF thành công', description: 'Biên bản điều chuyển thiết bị đã được tải về máy.' });
  };

  // BẢNG TIN: Chỉ lấy các nhu cầu đang tìm kiếm (DANG_TIM_KIEM) trên toàn viện.
  // Phiếu đã dừng tìm kiếm của khoa khác hoặc của khoa mình sẽ KHÔNG xuất hiện trên Bảng tin.
  const bulletinNeeds = useMemo(() => {

    return needs.filter(n => n.trangThai === 'DANG_TIM_KIEM');
  }, [needs]);

  const filteredBulletinNeeds = useMemo(() => {
    return bulletinNeeds.filter(n => {
      const matchSearch = n.tenThietBi.toLowerCase().includes(needSearch.toLowerCase()) ||
        n.maNhuCau.toLowerCase().includes(needSearch.toLowerCase()) ||
        (n.lyDo && n.lyDo.toLowerCase().includes(needSearch.toLowerCase())) ||
        (n.tenKhoaYeuCau && n.tenKhoaYeuCau.toLowerCase().includes(needSearch.toLowerCase()));
      const matchPriority = needFilterPriority === 'ALL' || n.mucDoUuTien === needFilterPriority;
      return matchSearch && matchPriority;
    });
  }, [bulletinNeeds, needSearch, needFilterPriority]);

  // LỊCH SỬ PHIẾU: Các phiếu của khoa đã dừng tìm kiếm (DA_DONG) hoặc đã hoàn thành (HOAN_THANH).
  // (Nếu là QL Kho / Admin thì xem được lịch sử của toàn bộ các khoa).
  const historyNeeds = useMemo(() => {
    return needs.filter(n => {
      const isTargetDept = isQlKho ? true : (n.maKhoaYeuCau === userDept);
      const isPastStatus = n.trangThai === 'DA_DONG' || n.trangThai === 'HOAN_THANH';
      return isTargetDept && isPastStatus;
    });
  }, [needs, userDept, isQlKho]);

  const filteredHistoryNeeds = useMemo(() => {
    return historyNeeds.filter(n => {
      const matchSearch = n.tenThietBi.toLowerCase().includes(historySearch.toLowerCase()) ||
        n.maNhuCau.toLowerCase().includes(historySearch.toLowerCase()) ||
        (n.lyDo && n.lyDo.toLowerCase().includes(historySearch.toLowerCase())) ||
        (n.tenKhoaYeuCau && n.tenKhoaYeuCau.toLowerCase().includes(historySearch.toLowerCase()));
      const matchStatus = historyFilterStatus === 'ALL' || n.trangThai === historyFilterStatus;
      return matchSearch && matchStatus;
    });
  }, [historyNeeds, historySearch, historyFilterStatus]);

  // Filtered Transfers
  const filteredTransfers = useMemo(() => {
    return requests.filter(r => {
      const matchSearch = r.maPhieu.toLowerCase().includes(transferSearch.toLowerCase()) ||
        (r.maCaThe && r.maCaThe.toLowerCase().includes(transferSearch.toLowerCase())) ||
        (r.lyDo && r.lyDo.toLowerCase().includes(transferSearch.toLowerCase())) ||
        r.maKhoa.toLowerCase().includes(transferSearch.toLowerCase()) ||
        (r.maKhoaNhan && r.maKhoaNhan.toLowerCase().includes(transferSearch.toLowerCase()));
      const matchStatus = transferFilterStatus === 'ALL' || r.trangThai === transferFilterStatus;
      return matchSearch && matchStatus;
    });
  }, [requests, transferSearch, transferFilterStatus]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const searchingCount = needs.filter(n => n.trangThai === 'DANG_TIM_KIEM').length;
    const urgentCount = needs.filter(n => n.trangThai === 'DANG_TIM_KIEM' && n.mucDoUuTien === 'KHAN_CAP').length;
    const completedTransfers = requests.filter(r => r.trangThai === 'HOAN_THANH').length;
    const pendingInspection = requests.filter(r => r.trangThai === 'CHO_KHOA_NHAN_TEST').length;
    return { searchingCount, urgentCount, completedTransfers, pendingInspection };
  }, [needs, requests]);


  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-6 rounded-2xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <ArrowLeftRight className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Điều chuyển Thiết bị Y tế
              </h1>
              <p className="text-xs sm:text-sm text-purple-200/80">
                Kênh điều phối thiết bị nội viện & Bàn giao kỹ thuật trực tiếp giữa các khoa
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={() => setNewNeedOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-2 shadow-sm rounded-xl h-10 px-4"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Đăng nhu cầu cần máy
          </Button>

          <Button
            onClick={() => {
              setTransferSelectedNeedId(null);
              setTransferDestDept('');
              setTransferReason('');
              setNewTransferOpen(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2 shadow-sm rounded-xl h-10 px-4 border border-purple-400/30"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Tạo đề xuất điều chuyển
          </Button>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card p-4 rounded-xl border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Nhu cầu đang tìm máy</div>
            <div className="text-xl font-black text-blue-700">{stats.searchingCount} <span className="text-xs font-normal text-muted-foreground">tin</span></div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Nhu cầu cấp bách / Khẩn cấp</div>
            <div className="text-xl font-black text-rose-700">{stats.urgentCount} <span className="text-xs font-normal text-muted-foreground">tin</span></div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Chờ khoa nhận kiểm tra test</div>
            <div className="text-xl font-black text-purple-700">{stats.pendingInspection} <span className="text-xs font-normal text-muted-foreground">máy</span></div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-xl border shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Bàn giao hoàn tất thành công</div>
            <div className="text-xl font-black text-emerald-700">{stats.completedTransfers} <span className="text-xs font-normal text-muted-foreground">ca</span></div>
          </div>
        </div>
      </div>

      {/* Tabs Chuyển đổi */}
      <div className="flex border-b border-border/80 gap-6">
        <button
          onClick={() => setActiveTab('bulletin')}
          className={cn(
            "pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all",
            activeTab === 'bulletin'
              ? "border-purple-600 text-purple-700 dark:text-purple-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="w-4 h-4" />
          Bảng tin Nhu cầu Thiết bị ({bulletinNeeds.length})
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={cn(
            "pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all",
            activeTab === 'transfers'
              ? "border-purple-600 text-purple-700 dark:text-purple-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeftRight className="w-4 h-4" />
          Tiến độ Điều chuyển & Biên bản ({requests.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all",
            activeTab === 'history'
              ? "border-purple-600 text-purple-700 dark:text-purple-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <History className="w-4 h-4" />
          Lịch sử phiếu ({historyNeeds.length})
        </button>
      </div>

      {/* TAB 1: BẢNG TIN NHU CẦU THIẾT BỊ NỘI VIỆN (CHỈ HIỆN CÁC PHIẾU ĐANG TÌM KIẾM) */}
      {activeTab === 'bulletin' && (
        <div className="space-y-4">
          {/* Thanh tìm kiếm & lọc */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3.5 rounded-xl border shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm tên máy, mã tin, khoa yêu cầu..."
                value={needSearch}
                onChange={e => setNeedSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant={needFilterPriority === 'ALL' ? 'default' : 'outline'}
                onClick={() => setNeedFilterPriority('ALL')}
                className="h-8 text-xs font-semibold"
              >
                Tất cả ({bulletinNeeds.length})
              </Button>
              <Button
                size="sm"
                variant={needFilterPriority === 'BINH_THUONG' ? 'default' : 'outline'}
                onClick={() => setNeedFilterPriority(needFilterPriority === 'BINH_THUONG' ? 'ALL' : 'BINH_THUONG')}
                className="h-8 text-xs text-blue-600 border-blue-200"
              >
                Bình thường ({bulletinNeeds.filter(n => n.mucDoUuTien === 'BINH_THUONG').length})
              </Button>
              <Button
                size="sm"
                variant={needFilterPriority === 'KHAN_CAP' ? 'destructive' : 'outline'}
                onClick={() => setNeedFilterPriority(needFilterPriority === 'KHAN_CAP' ? 'ALL' : 'KHAN_CAP')}
                className="h-8 text-xs gap-1 font-bold"
              >
                🚨 Khẩn cấp ({bulletinNeeds.filter(n => n.mucDoUuTien === 'KHAN_CAP').length})
              </Button>
            </div>
          </div>

          {/* Danh sách thẻ Nhu cầu */}
          {loadingNeeds ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Đang tải bảng tin nhu cầu...</div>
          ) : filteredBulletinNeeds.length === 0 ? (
            <div className="py-16 text-center bg-card rounded-2xl border border-dashed p-8">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1">Hiện không có nhu cầu nào đang tìm kiếm</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mb-4">
                Nếu khoa của bạn đang thiếu máy móc để điều trị bệnh nhân, hãy bấm "Đăng nhu cầu cần máy" để các khoa bạn hỗ trợ.
              </p>
              <Button onClick={() => setNewNeedOpen(true)} size="sm" className="bg-purple-600 text-white gap-2">
                <Plus className="w-4 h-4" />
                Đăng nhu cầu ngay
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBulletinNeeds.map(need => {
                const isMyDept = (need.maKhoaYeuCau === userDept);
                const isUrgent = need.mucDoUuTien === 'KHAN_CAP';
                const progressPct = Math.min(100, Math.round(((need.soLuongDaDapUng || 0) / need.soLuongCan) * 100));

                return (
                  <div
                    key={need.maNhuCau}
                    className={cn(
                      "bg-card rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md relative overflow-hidden",
                      isUrgent && "border-rose-300 dark:border-rose-900/60 bg-gradient-to-br from-rose-50/30 to-card"
                    )}
                  >
                    {isUrgent && (
                      <div className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider flex items-center gap-1 shadow-xs">
                        🚨 KHẨN CẤP
                      </div>
                    )}

                    <div>
                      {/* Header Card */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">{need.maNhuCau}</span>
                        <span className="text-[11px] text-muted-foreground">•</span>
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                          {need.tenKhoaYeuCau || need.maKhoaYeuCau}
                        </span>
                      </div>

                      {/* Tên thiết bị */}
                      <h3 className="font-bold text-base text-foreground mb-1 line-clamp-1 flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        {need.tenThietBi}
                      </h3>

                      {/* Lý do */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 bg-muted/30 p-2 rounded-lg italic">
                        "{need.lyDo || 'Cần bổ sung máy phục vụ bệnh nhân theo chỉ định khoa.'}"
                      </p>

                      {/* Tiến độ đáp ứng của nhu cầu */}
                      <div className="space-y-1.5 mb-3 bg-card/80 p-2.5 rounded-xl border border-border/60 text-xs">
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">Nhu cầu cần: <strong className="text-foreground">{need.soLuongCan} máy</strong></span>
                          <span>Khoa đã nhận: <strong className="text-purple-700 font-bold">{need.soLuongDaDapUng || 0} / {need.soLuongCan}</strong></span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              progressPct >= 100 ? "bg-emerald-500" : isUrgent ? "bg-rose-500" : "bg-purple-600"
                            )}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Đối chiếu tồn kho thực tế của Khoa bạn đối với nhu cầu này */}
                      {!isMyDept && (() => {
                        const matchingInstances = deptInstances.filter(i => {
                          if (need.maThietBi && i.maThietBi === need.maThietBi) return true;
                          if (need.tenThietBi && i.tenThietBi) {
                            const nName = need.tenThietBi.toLowerCase();
                            const iName = i.tenThietBi.toLowerCase();
                            return nName.includes(iName) || iName.includes(nName);
                          }
                          return false;
                        });
                        const myCount = matchingInstances.length;

                        return (
                          <div className={cn(
                            "mb-3 p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all",
                            myCount > 0
                              ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300"
                              : "bg-slate-50 dark:bg-muted/40 border-slate-200/80 dark:border-border text-muted-foreground"
                          )}>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                myCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"
                              )} />
                              <span className="font-medium">
                                Khoa bạn đang có: <strong className={myCount > 0 ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-foreground"}>{myCount} máy</strong>
                              </span>
                            </div>
                            {myCount > 0 ? (
                              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold px-2 py-0.5">
                                Có thể hỗ trợ
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-muted-foreground italic">Không có máy dư</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Footer & Actions */}
                    <div className="pt-3 border-t flex items-center justify-between gap-2 mt-2">
                      <div className="text-[11px] text-muted-foreground">
                        Đăng bởi: <strong>{need.tenNguoiDang || need.maNguoiDang}</strong>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Nút hủy / dừng tìm kiếm đối với tin của khoa mình */}
                        {(isMyDept || isQlKho) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCloseNeed(need.maNhuCau)}
                            className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 gap-1 px-2.5 font-medium"
                            title="Dừng tìm kiếm và lưu vào Lịch sử phiếu"
                          >
                            <X className="w-3.5 h-3.5" />
                            Dừng tìm kiếm
                          </Button>
                        )}

                        {/* Nút hỗ trợ chuyển máy đối với tin của khoa khác */}
                        {!isMyDept && (() => {
                          const matchingCount = deptInstances.filter(i => {
                            if (need.maThietBi && i.maThietBi === need.maThietBi) return true;
                            if (need.tenThietBi && i.tenThietBi) {
                              const nName = need.tenThietBi.toLowerCase();
                              const iName = i.tenThietBi.toLowerCase();
                              return nName.includes(iName) || iName.includes(nName);
                            }
                            return false;
                          }).length;

                          return (
                            <Button
                              size="sm"
                              onClick={() => handleSupportFromNeed(need)}
                              className={cn(
                                "text-xs font-bold gap-1.5 h-8 rounded-lg shadow-xs transition-all",
                                matchingCount > 0
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                  : "bg-purple-600 hover:bg-purple-700 text-white"
                              )}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                              {matchingCount > 0 ? `Hỗ trợ chuyển máy (${matchingCount})` : 'Hỗ trợ chuyển máy'}
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );

              })}
            </div>
          )}
        </div>
      )}


      {/* TAB 2: TIẾN ĐỘ ĐIỀU CHUYỂN & BIÊN BẢN */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Thanh tìm kiếm & Lọc trạng thái */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3.5 rounded-xl border shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm mã đề xuất, mã máy, khoa..."
                value={transferSearch}
                onChange={e => setTransferSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant={transferFilterStatus === 'ALL' ? 'default' : 'outline'}
                onClick={() => setTransferFilterStatus('ALL')}
                className="h-8 text-xs"
              >
                Tất cả ({requests.length})
              </Button>
              <Button
                size="sm"
                variant={transferFilterStatus === 'CHO_TRUONG_KHOA_DUYET' ? 'default' : 'outline'}
                onClick={() => setTransferFilterStatus('CHO_TRUONG_KHOA_DUYET')}
                className="h-8 text-xs text-amber-600 border-amber-200"
              >
                Chờ TK duyệt ({requests.filter(r => r.trangThai === 'CHO_TRUONG_KHOA_DUYET').length})
              </Button>
              <Button
                size="sm"
                variant={transferFilterStatus === 'CHO_KHOA_NHAN_TEST' ? 'default' : 'outline'}
                onClick={() => setTransferFilterStatus('CHO_KHOA_NHAN_TEST')}
                className="h-8 text-xs text-purple-600 border-purple-200"
              >
                Chờ test máy ({requests.filter(r => r.trangThai === 'CHO_KHOA_NHAN_TEST').length})
              </Button>
              <Button
                size="sm"
                variant={transferFilterStatus === 'HOAN_THANH' ? 'default' : 'outline'}
                onClick={() => setTransferFilterStatus('HOAN_THANH')}
                className="h-8 text-xs text-emerald-600 border-emerald-200"
              >
                Hoàn thành ({requests.filter(r => r.trangThai === 'HOAN_THANH').length})
              </Button>
            </div>
          </div>

          {/* Bảng danh sách phiếu điều chuyển */}
          <div className="bg-card rounded-2xl border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground font-semibold">
                    <th className="py-3 px-4 text-left">Mã đề xuất</th>
                    <th className="py-3 px-4 text-left">Khoa giao ➔ Khoa nhận</th>
                    <th className="py-3 px-4 text-left">Thiết bị & Cá thể máy</th>
                    <th className="py-3 px-4 text-left">Trạng thái tiến độ</th>
                    <th className="py-3 px-4 text-left">Ngày tạo</th>
                    <th className="py-3 px-4 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        Không tìm thấy đề xuất điều chuyển nào.
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map(req => {
                      const isSenderDept = (user?.maKhoa && req.maKhoa === user.maKhoa);
                      const isReceiverDept = (user?.maKhoa && req.maKhoaNhan === user.maKhoa);

                      return (
                        <tr key={req.maPhieu} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-purple-700">
                            {req.maPhieu}
                            {req.maNhuCau && (
                              <div className="text-[10px] text-muted-foreground font-sans">
                                (Tin: {req.maNhuCau})
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="text-slate-700">{getDeptName(req.maKhoa)}</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="text-purple-700 font-bold">{getDeptName(req.maKhoaNhan)}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 italic">
                              "{req.lyDo || 'Điều chuyển chi viện'}"
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-bold text-foreground">
                              {req.items?.[0]?.tenThietBi || req.maThietBi}
                            </div>
                            {req.maCaThe ? (
                              <div className="text-[11px] font-mono text-purple-600 bg-purple-50 inline-block px-1.5 py-0.5 rounded mt-0.5">
                                Máy: {req.maCaThe}
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground">1 Thiết bị</div>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {req.trangThai === 'CHO_TRUONG_KHOA_DUYET' && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                                ⏳ Chờ Trưởng khoa giao duyệt
                              </Badge>
                            )}
                            {req.trangThai === 'CHO_KHOA_NHAN_TEST' && (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 animate-pulse">
                                🔬 Chờ Khoa nhận test máy
                              </Badge>
                            )}
                            {req.trangThai === 'HOAN_THANH' && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                                ✓ Hoàn thành bàn giao
                              </Badge>
                            )}
                            {req.trangThai === 'TU_CHOI' && (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-200">
                                ✕ Bị từ chối
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-muted-foreground">
                            {new Date(req.ngayTao).toLocaleDateString('vi-VN')}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Nếu là Trưởng khoa giao duyệt */}
                              {req.trangThai === 'CHO_TRUONG_KHOA_DUYET' && isTruongKhoa && (isSenderDept || isQlKho) && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveByHead(req, true)}
                                    className="bg-purple-600 hover:bg-purple-700 text-white h-7 text-xs px-2.5"
                                  >
                                    Duyệt chuyển
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleApproveByHead(req, false)}
                                    className="h-7 text-xs text-rose-600 hover:bg-rose-50 px-2"
                                  >
                                    Từ chối
                                  </Button>
                                </>
                              )}

                              {/* Nếu đang chờ Khoa nhận test máy */}
                              {req.trangThai === 'CHO_KHOA_NHAN_TEST' && (isReceiverDept || isQlKho) && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenInspectModal(req)}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold h-7 text-xs px-2.5 gap-1.5 shadow-sm"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Test & Tiếp nhận
                                </Button>
                              )}

                              {/* Xem Biên bản A4 */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPreviewA4(req)}
                                className="h-7 text-xs px-2 gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Biên bản A4
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LỊCH SỬ PHIẾU NHU CẦU CỦA KHOA */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Thanh tìm kiếm & Lọc trạng thái */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3.5 rounded-xl border shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Tìm mã phiếu, tên thiết bị, lý do..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant={historyFilterStatus === 'ALL' ? 'default' : 'outline'}
                onClick={() => setHistoryFilterStatus('ALL')}
                className="h-8 text-xs font-semibold"
              >
                Tất cả ({historyNeeds.length})
              </Button>
              <Button
                size="sm"
                variant={historyFilterStatus === 'DA_DONG' ? 'default' : 'outline'}
                onClick={() => setHistoryFilterStatus('DA_DONG')}
                className="h-8 text-xs text-amber-700 border-amber-200 font-medium"
              >
                Đã dừng tìm kiếm ({historyNeeds.filter(n => n.trangThai === 'DA_DONG').length})
              </Button>
              <Button
                size="sm"
                variant={historyFilterStatus === 'HOAN_THANH' ? 'default' : 'outline'}
                onClick={() => setHistoryFilterStatus('HOAN_THANH')}
                className="h-8 text-xs text-emerald-700 border-emerald-200 font-medium"
              >
                Đã đáp ứng đủ máy ({historyNeeds.filter(n => n.trangThai === 'HOAN_THANH').length})
              </Button>
            </div>
          </div>

          {/* Danh sách thẻ Lịch sử */}
          {loadingNeeds ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Đang tải lịch sử phiếu...</div>
          ) : filteredHistoryNeeds.length === 0 ? (
            <div className="py-16 text-center bg-card rounded-2xl border border-dashed p-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                <History className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-foreground mb-1">Chưa có phiếu nhu cầu nào trong lịch sử</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Các phiếu nhu cầu sau khi khoa dừng tìm kiếm hoặc đã nhận đủ máy sẽ được lưu trữ tự động tại đây để tra cứu và theo dõi.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHistoryNeeds.map(need => {
                const isMyDept = (need.maKhoaYeuCau === userDept);
                const isCompleted = need.trangThai === 'HOAN_THANH';
                const isClosed = need.trangThai === 'DA_DONG';

                return (
                  <div
                    key={need.maNhuCau}
                    className="bg-card rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md relative overflow-hidden bg-slate-50/20 dark:bg-card"
                  >
                    <div>
                      {/* Header Card */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold text-muted-foreground">{need.maNhuCau}</span>
                          <span className="text-[11px] text-muted-foreground">•</span>
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            {need.tenKhoaYeuCau || need.maKhoaYeuCau}
                          </span>
                        </div>

                        {isClosed ? (
                          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs font-semibold gap-1 py-0.5 px-2">
                            <Ban className="w-3 h-3 text-amber-500" />
                            Đã dừng tìm kiếm
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-xs font-semibold gap-1 py-0.5 px-2">
                            <Check className="w-3 h-3 text-emerald-500" />
                            Đã hoàn thành
                          </Badge>
                        )}
                      </div>

                      {/* Tên thiết bị */}
                      <h3 className="font-bold text-base text-foreground mb-1 line-clamp-1 flex items-center gap-1.5">
                        <Stethoscope className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        {need.tenThietBi}
                      </h3>

                      {/* Lý do */}
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4 bg-muted/30 p-2 rounded-lg italic">
                        "{need.lyDo || 'Không có ghi chú thêm.'}"
                      </p>

                      {/* Thông tin số lượng & ngày tạo */}
                      <div className="space-y-1.5 mb-4 bg-card/80 p-3 rounded-xl border border-border/60 text-xs">
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">Số lượng cần:</span>
                          <strong className="text-foreground">{need.soLuongCan} máy</strong>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-muted-foreground">Đã đáp ứng:</span>
                          <strong className="text-emerald-600">{need.soLuongDaDapUng || 0} máy</strong>
                        </div>
                        <div className="flex justify-between font-medium text-[11px] pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">Ngày đăng tin:</span>
                          <span className="text-foreground">{new Date(need.ngayTao).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer & Actions */}
                    <div className="pt-3 border-t flex items-center justify-between gap-2 mt-2">
                      <div className="text-[11px] text-muted-foreground">
                        Đăng bởi: <strong>{need.tenNguoiDang || need.maNguoiDang}</strong>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {(isMyDept || isQlKho) && isClosed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReopenNeed(need.maNhuCau)}
                            className="h-8 text-xs text-purple-700 hover:text-purple-800 hover:bg-purple-50 border-purple-200 gap-1.5 px-3 font-semibold shadow-xs"
                            title="Đưa phiếu này trở lại Bảng tin để tiếp tục kêu gọi hỗ trợ"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                            Tiếp tục tìm kiếm lại
                          </Button>
                        )}
                        {isCompleted && (
                          <Badge variant="outline" className="text-muted-foreground bg-muted/30 border-border text-[11px] py-0.5 px-2">
                            Lưu trữ hồ sơ
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* MODAL 1: ĐĂNG NHU CẦU CẦN MÁY */}
      <Dialog open={newNeedOpen} onOpenChange={setNewNeedOpen}>
        <DialogContent className="sm:max-w-xl w-full overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-amber-900">
              <Plus className="w-5 h-5 text-amber-600 flex-shrink-0" />
              Đăng nhu cầu thiết bị y tế nội viện
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs sm:text-sm min-w-0">
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-900 text-xs">

              💡 Thông tin đăng tải sẽ được hiển thị ngay trên <strong>Bảng tin Nhu cầu Thiết bị</strong> để các khoa phòng kiểm tra thiết bị dư và chủ động hỗ trợ điều chuyển.
            </div>

            <div>
              <Label className="mb-1 block font-semibold">Khoa yêu cầu <span className="text-destructive">*</span></Label>
              {userDept ? (
                <div className="flex items-center justify-between p-3 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-foreground">
                      {departments.find(d => d.maKhoa === userDept)?.tenKhoa || userDept} ({userDept})
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-medium">
                    Mặc định theo khoa của bạn
                  </Badge>
                </div>
              ) : (
                <SearchableSelect
                  options={departments.map(d => ({ value: d.maKhoa, label: `${d.tenKhoa} (${d.maKhoa})` }))}
                  value={needDept}
                  onValueChange={setNeedDept}
                  placeholder="Chọn khoa yêu cầu..."
                />
              )}
            </div>

            <div>
              <Label className="mb-1 block font-semibold">Thiết bị y tế cần hỗ trợ <span className="text-destructive">*</span></Label>
              <SearchableSelect
                options={equipmentList.map(e => ({ value: e.maThietBi, label: `${e.tenThietBi} (${e.maThietBi})` }))}
                value={needEquipment}
                onValueChange={val => {
                  setNeedEquipment(val);
                  const eq = equipmentList.find(e => e.maThietBi === val);
                  if (eq) setNeedCustomName(eq.tenThietBi);
                }}
                placeholder="Chọn thiết bị từ danh mục kho..."
              />
              <div className="mt-1.5">
                <Input
                  placeholder="Hoặc nhập tên máy / yêu cầu riêng..."
                  value={needCustomName}
                  onChange={e => setNeedCustomName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block font-semibold">Số lượng cần <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  value={needQty}
                  onChange={e => setNeedQty(parseInt(e.target.value) || 1)}
                  className="h-9"
                />
              </div>

              <div>
                <Label className="mb-1 block font-semibold">Mức độ ưu tiên</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={needPriority === 'BINH_THUONG' ? 'default' : 'outline'}
                    onClick={() => setNeedPriority('BINH_THUONG')}
                    className="flex-1 h-9 text-xs"
                  >
                    Bình thường
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={needPriority === 'KHAN_CAP' ? 'destructive' : 'outline'}
                    onClick={() => setNeedPriority('KHAN_CAP')}
                    className="flex-1 h-9 text-xs font-bold"
                  >
                    🚨 Khẩn cấp
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <Label className="mb-1 block font-semibold">Lý do & Mục đích lâm sàng cấp bách</Label>
              <Textarea
                placeholder="Ví dụ: Khoa tiếp nhận ca cấp cứu hàng loạt, thiếu máy thở theo dõi..."
                value={needReason}
                onChange={e => setNeedReason(e.target.value)}
                className="h-20 resize-none text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewNeedOpen(false)}>Hủy</Button>
            <Button onClick={handleCreateNeed} className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2">
              <Send className="w-4 h-4" />
              Đăng lên Bảng tin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: TẠO ĐỀ XUẤT ĐIỀU CHUYỂN */}
      <Dialog open={newTransferOpen} onOpenChange={setNewTransferOpen}>
        <DialogContent className="sm:max-w-xl w-full overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-purple-900">
              <ArrowLeftRight className="w-5 h-5 text-purple-600 flex-shrink-0" />
              Đề xuất điều chuyển thiết bị sang khoa khác
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs sm:text-sm min-w-0">
            {transferSelectedNeedId && (
              <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-200 text-purple-900 text-xs flex items-center gap-2 overflow-hidden">
                <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="truncate">Đáp ứng trực tiếp cho Nhu cầu nội viện: <strong>{transferSelectedNeedId}</strong></span>
              </div>
            )}

            <div>
              <Label className="mb-1 block font-semibold">Khoa bàn giao (Khoa gửi)</Label>
              <div className="flex items-center justify-between p-2.5 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="font-bold text-foreground truncate">
                    {departments.find(d => d.maKhoa === userDept)?.tenKhoa || userDept} ({userDept})
                  </span>
                </div>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-medium flex-shrink-0">
                  Khoa của bạn
                </Badge>
              </div>

              <Label className="mb-1 block font-semibold">
                Chọn máy cá thể tại khoa cần điều chuyển <span className="text-destructive">*</span>
              </Label>
              {loadingDeptInstances ? (
                <div className="text-xs text-muted-foreground py-2 italic">Đang tải danh sách máy khoa đang giữ...</div>
              ) : deptInstances.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  Khoa hiện chưa có thiết bị nào đang mượn/sử dụng để điều chuyển.
                </div>
              ) : (
                <SearchableSelect
                  options={deptInstances.map(i => ({
                    value: i.maCaThe,
                    label: `${i.maCaThe} - ${i.tenThietBi} ${i.serialNumber ? `(SN: ${i.serialNumber})` : ''}`
                  }))}
                  value={transferInstance}
                  onValueChange={setTransferInstance}
                  placeholder="Chọn mã máy cá thể cần gửi..."
                />
              )}
            </div>

            <div>
              <Label className="mb-1 block font-semibold">Khoa tiếp nhận thiết bị <span className="text-destructive">*</span></Label>
              <SearchableSelect
                options={departments.filter(d => d.maKhoa !== userDept).map(d => ({
                  value: d.maKhoa,
                  label: `${d.tenKhoa} (${d.maKhoa})`
                }))}
                value={transferDestDept}
                onValueChange={setTransferDestDept}
                placeholder="Chọn khoa tiếp nhận..."
              />
            </div>

            <div>
              <Label className="mb-1 block font-semibold">Lý do & Mục đích điều chuyển <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Nhập lý do điều chuyển máy..."
                value={transferReason}
                onChange={e => setTransferReason(e.target.value)}
                className="h-20 resize-none text-xs w-full"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setNewTransferOpen(false)}>Hủy</Button>
            <Button
              onClick={handleSubmitTransfer}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold gap-2"
              disabled={!transferInstance || !transferDestDept || !transferReason.trim()}
            >
              <Send className="w-4 h-4" />
              Gửi đề xuất điều chuyển
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* MODAL 3: KIỂM TRA KỸ THUẬT & TIẾP NHẬN MÁY TẠI KHOA NHẬN */}
      <Dialog open={inspectModalOpen} onOpenChange={setInspectModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-purple-900">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              Kiểm tra kỹ thuật tại chỗ & Tiếp nhận thiết bị
            </DialogTitle>
          </DialogHeader>

          {inspectingRequest && (
            <div className="space-y-4 py-2 text-xs sm:text-sm">
              <div className="bg-slate-50 p-3 rounded-xl border space-y-1 text-xs">
                <div>Phiếu điều chuyển: <strong>{inspectingRequest.maPhieu}</strong></div>
                <div>Từ khoa: <strong>{getDeptName(inspectingRequest.maKhoa)}</strong> ➔ Đến khoa: <strong>{getDeptName(inspectingRequest.maKhoaNhan)}</strong></div>
                <div>Thiết bị: <strong>{inspectingRequest.items?.[0]?.tenThietBi || inspectingRequest.maThietBi}</strong> (Mã cá thể: <strong>{inspectingRequest.maCaThe || 'Chưa gán'}</strong>)</div>
              </div>

              <div>
                <Label className="mb-2 block font-bold text-slate-900">
                  Checklist 5 tiêu chuẩn kỹ thuật an toàn trước khi nhận máy:
                </Label>
                <div className="space-y-2.5 bg-card p-4 rounded-xl border">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={checklist.nguonPin}
                      onCheckedChange={c => setChecklist(prev => ({ ...prev, nguonPin: !!c }))}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-foreground text-xs">1. Nguồn điện & Pin lưu điện (UPS)</div>
                      <div className="text-[11px] text-muted-foreground">Khởi động tốt, pin nạp xả bình thường, không chai phồng.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={checklist.manHinhPhim}
                      onCheckedChange={c => setChecklist(prev => ({ ...prev, manHinhPhim: !!c }))}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-foreground text-xs">2. Màn hình hiển thị & Bàn phím điều khiển</div>
                      <div className="text-[11px] text-muted-foreground">Hiển thị sắc nét, phím bấm và cảm ứng phản hồi nhạy bén.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={checklist.camBienDayDo}
                      onCheckedChange={c => setChecklist(prev => ({ ...prev, camBienDayDo: !!c }))}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-foreground text-xs">3. Cảm biến, đầu dò & Cáp kết nối phụ kiện</div>
                      <div className="text-[11px] text-muted-foreground">Đầy đủ cáp nguồn, cảm biến chuyên dụng đi kèm không đứt gãy.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={checklist.khuKhuan}
                      onCheckedChange={c => setChecklist(prev => ({ ...prev, khuKhuan: !!c }))}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-foreground text-xs">4. Khử khuẩn & Kiểm soát nhiễm khuẩn lâm sàng</div>
                      <div className="text-[11px] text-muted-foreground">Bề mặt máy đã được khử khuẩn đạt chuẩn trước khi bàn giao.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={checklist.ngoaiQuan}
                      onCheckedChange={c => setChecklist(prev => ({ ...prev, ngoaiQuan: !!c }))}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-semibold text-foreground text-xs">5. Ngoại quan, vỏ máy & Tem kiểm định</div>
                      <div className="text-[11px] text-muted-foreground">Không nứt vỡ cơ học, tem kiểm định thiết bị còn hiệu lực.</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block font-semibold">Người kiểm tra test máy</Label>
                  <Input
                    value={inspectorName}
                    onChange={e => setInspectorName(e.target.value)}
                    placeholder="Họ tên người kiểm tra..."
                    className="h-9 text-xs"
                  />
                </div>

                <div>
                  <Label className="mb-1 block font-semibold">Ghi chú tình trạng khi nhận</Label>
                  <Input
                    value={inspectNotes}
                    onChange={e => setInspectNotes(e.target.value)}
                    placeholder="Máy hoạt động tốt, nhận đủ phụ kiện..."
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setInspectModalOpen(false)}>Hủy</Button>
            <Button
              onClick={handleConfirmReceive}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
            >
              <CheckCheck className="w-4 h-4" />
              Đạt chuẩn & Tiếp nhận vào khoa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: XEM & IN BIÊN BẢN A4 */}
      <Dialog open={previewA4Open} onOpenChange={setPreviewA4Open}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Biên bản Bàn giao & Kiểm định Kỹ thuật (Mẫu A4)
            </DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 gap-1.5 text-xs">
                <Printer className="w-3.5 h-3.5" />
                In biên bản
              </Button>
              <Button size="sm" onClick={handleDownloadPDF} className="bg-purple-600 text-white h-8 gap-1.5 text-xs">
                Tải PDF
              </Button>
            </div>
          </DialogHeader>

          {previewRequest && (() => {
            const senderDeptName = getDeptName(previewRequest.maKhoa);
            const receiverDeptName = getDeptName(previewRequest.maKhoaNhan);
            const senderPersonName = getSenderPersonName(previewRequest);
            const receiverPersonName = getReceiverPersonName(previewRequest);

            return (
              <div className="p-6 overflow-y-auto flex-1 bg-white text-slate-900 text-xs sm:text-sm font-sans" ref={printAreaRef}>
                <div className="border border-slate-300 p-8 rounded-xl shadow-xs space-y-6">
                  {/* Header văn bản */}
                  <div className="grid grid-cols-2 text-center border-b pb-4">
                    <div>
                      <div className="font-bold uppercase text-xs">BỘ Y TẾ - BỆNH VIỆN ĐA KHOA</div>
                      <div className="text-[11px] text-slate-500">Phòng Vật tư - Trang thiết bị Y tế</div>
                    </div>
                    <div>
                      <div className="font-bold text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                      <div className="text-[11px] font-semibold">Độc lập - Tự do - Hạnh phúc</div>
                      <div className="w-24 h-0.5 bg-slate-400 mx-auto mt-1" />
                    </div>
                  </div>

                  {/* Tiêu đề biên bản */}
                  <div className="text-center space-y-1">
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-purple-950">
                      BIÊN BẢN BÀN GIAO & KIỂM ĐỊNH KỸ THUẬT THIẾT BỊ
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Mã số văn bản: <span className="font-mono font-bold text-slate-800">{previewRequest.maPhieu}</span> | Ngày: {new Date(previewRequest.ngayTao).toLocaleDateString('vi-VN')}
                    </p>
                  </div>

                  {/* Thông tin bàn giao */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border text-xs">
                    <div>
                      <div className="font-bold text-slate-700 mb-1">BÊN GIAO (Khoa đề xuất):</div>
                      <div>Khoa: <strong className="text-slate-900">{senderDeptName}</strong></div>
                      <div>Người đại diện: <strong className="text-purple-700 font-semibold">{senderPersonName}</strong></div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-700 mb-1">BÊN NHẬN (Khoa thụ hưởng):</div>
                      <div>Khoa tiếp nhận: <strong className="text-slate-900">{receiverDeptName}</strong></div>
                      <div>Người tiếp nhận test: <strong className="text-emerald-700 font-semibold">{receiverPersonName}</strong></div>
                    </div>
                  </div>

                  {/* Bảng thiết bị */}
                  <div>
                    <div className="font-bold text-xs mb-1.5 uppercase text-slate-700">1. Thông tin thiết bị bàn giao</div>
                    <table className="w-full border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b">
                          <th className="border p-2 text-center w-10">STT</th>
                          <th className="border p-2 text-left">Tên trang thiết bị</th>
                          <th className="border p-2 text-center">Mã cá thể</th>
                          <th className="border p-2 text-center">Số lượng</th>
                          <th className="border p-2 text-left">Lý do điều chuyển</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border p-2 text-center">1</td>
                          <td className="border p-2 font-bold">{previewRequest.items?.[0]?.tenThietBi || previewRequest.maThietBi}</td>
                          <td className="border p-2 text-center font-mono text-purple-700 font-bold">{previewRequest.maCaThe || 'Chưa gán'}</td>
                          <td className="border p-2 text-center">1 Bộ</td>
                          <td className="border p-2 italic">{previewRequest.lyDo || 'Chi viện lâm sàng'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Bảng checklist kiểm định */}
                  <div>
                    <div className="font-bold text-xs mb-1.5 uppercase text-slate-700">2. Kết quả kiểm tra kỹ thuật tại chỗ</div>
                    <table className="w-full border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b">
                          <th className="border p-2 text-center w-10">STT</th>
                          <th className="border p-2 text-left">Tiêu chí kiểm tra an toàn kỹ thuật</th>
                          <th className="border p-2 text-center w-28">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border p-2 text-center">1</td>
                          <td className="border p-2">Nguồn điện & Pin lưu điện (Khởi động tốt, pin nạp xả bình thường)</td>
                          <td className="border p-2 text-center font-bold text-emerald-700">ĐẠT CHUẨN [✓]</td>
                        </tr>
                        <tr>
                          <td className="border p-2 text-center">2</td>
                          <td className="border p-2">Màn hình hiển thị & Bàn phím điều khiển (Sắc nét, phím nhạy bén)</td>
                          <td className="border p-2 text-center font-bold text-emerald-700">ĐẠT CHUẨN [✓]</td>
                        </tr>
                        <tr>
                          <td className="border p-2 text-center">3</td>
                          <td className="border p-2">Cảm biến, đầu dò & Cáp kết nối (Đầy đủ phụ kiện tiêu chuẩn đi kèm)</td>
                          <td className="border p-2 text-center font-bold text-emerald-700">ĐẠT CHUẨN [✓]</td>
                        </tr>
                        <tr>
                          <td className="border p-2 text-center">4</td>
                          <td className="border p-2">Kiểm soát nhiễm khuẩn & Khử khuẩn lâm sàng (Đã tiệt trùng đạt chuẩn)</td>
                          <td className="border p-2 text-center font-bold text-emerald-700">ĐẠT CHUẨN [✓]</td>
                        </tr>
                        <tr>
                          <td className="border p-2 text-center">5</td>
                          <td className="border p-2">Ngoại quan, vỏ máy & Tem kiểm định (Nguyên vẹn, còn hiệu lực)</td>
                          <td className="border p-2 text-center font-bold text-emerald-700">ĐẠT CHUẨN [✓]</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Chữ ký 3 bên & QR code */}
                  <div className="pt-4 border-t flex items-end justify-between">
                    <div className="flex items-center gap-3">
                      <QRCodeComponent value={previewRequest.maPhieu} size={64} className="border p-1 rounded" />
                      <div className="text-[10px] text-slate-500">
                        <div>Xác thực số: <strong>{previewRequest.maPhieu}</strong></div>
                        <div>Hệ thống QLTTBYT MedEquip</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-8 text-center text-xs">
                      <div>
                        <div className="font-bold text-slate-800">ĐẠI DIỆN KHOA GIAO</div>
                        <div className="text-[10px] text-slate-500 font-medium">{senderDeptName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">(Ký điện tử)</div>
                        <div className="min-h-12 flex flex-col items-center justify-center font-serif text-purple-800 font-bold italic pt-2">
                          <span>{senderPersonName}</span>
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-slate-800">ĐẠI DIỆN KHOA NHẬN</div>
                        <div className="text-[10px] text-slate-500 font-medium">{receiverDeptName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">(Ký điện tử)</div>
                        <div className="min-h-12 flex flex-col items-center justify-center font-serif text-emerald-800 font-bold italic pt-2">
                          <span>{receiverPersonName}</span>
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-slate-800">QUẢN LÝ KHO</div>
                        <div className="text-[10px] text-slate-500 font-medium">Phòng VTTBYT</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">(Lưu vết tự động)</div>
                        <div className="min-h-12 flex flex-col items-center justify-center font-serif text-blue-800 font-bold italic pt-2">
                          <span>Hệ thống tự động</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
