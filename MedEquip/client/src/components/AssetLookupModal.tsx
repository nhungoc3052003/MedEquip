import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { fetchApi } from '@/services/api';
import { 
  Search, QrCode, Camera, Building2, Warehouse, User, 
  Calendar, AlertTriangle, CheckCircle2, Clock, Upload, ArrowRight
} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface AssetLookupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToReturns?: () => void;
}

export function AssetLookupModal({ open, onOpenChange, onNavigateToReturns }: AssetLookupModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [cameraScan, setCameraScan] = useState(false);

  const handleLookup = async (lookupCode?: string) => {
    const targetCode = (lookupCode || code).trim();
    if (!targetCode) {
      toast({ title: 'Chưa nhập mã', description: 'Vui lòng nhập hoặc quét mã thiết bị.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetchApi<{ found: boolean; instance?: any; instances?: any[]; isMulti?: boolean; count?: number; message?: string }>(`/instances/lookup/${encodeURIComponent(targetCode)}`);
      if (res.found && res.instance) {
        setResult(res.instance);
        setMatches(res.instances || [res.instance]);
      } else {
        setResult(null);
        setMatches([]);
        toast({ title: 'Không tìm thấy', description: res.message || `Không tìm thấy thiết bị với mã "${targetCode}".`, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi tra cứu', description: err.message || 'Không thể kết nối đến máy chủ.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!('BarcodeDetector' in window)) {
        toast({ title: 'Trình duyệt không hỗ trợ', description: 'Vui lòng nhập mã thủ công hoặc dùng camera.', variant: 'destructive' });
        return;
      }

      const img = new Image();
      img.src = URL.createObjectURL(file);
      await img.decode();

      // @ts-ignore
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
      const [barcode] = await barcodeDetector.detect(img);

      if (barcode) {
        setCode(barcode.rawValue);
        handleLookup(barcode.rawValue);
      } else {
        toast({ title: 'Không tìm thấy mã', description: 'Không nhận diện được mã QR/Barcode trong ảnh.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Lỗi đọc ảnh', description: err?.message || 'Không thể xử lý ảnh.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary font-bold">
            <QrCode className="w-5 h-5" />
            Tra cứu nhanh Vị trí & Thông tin Thiết bị
          </DialogTitle>
        </DialogHeader>

        {/* Input & Scan Options */}
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Nhập mã TB (VD: TB-ECG-02), mã máy, mã phiếu (YCCF-...), số Serial..."
                value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                className="pl-9 font-mono"
              />
            </div>
            <Button onClick={() => handleLookup()} disabled={loading} className="gradient-primary text-primary-foreground">
              Tra cứu
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between pt-1 border-t">
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setCameraScan(!cameraScan)}
                className="text-xs"
              >
                <Camera className="w-3.5 h-3.5 mr-1 text-primary" />
                {cameraScan ? 'Tắt Camera' : 'Quét Camera'}
              </Button>

              <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3">
                <Upload className="w-3.5 h-3.5 mr-1 text-primary" />
                Tải ảnh mã vạch
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <span className="text-[11px] text-muted-foreground italic">Quét QR hoặc mã vạch dán trên thân máy</span>
          </div>

          {/* Camera Scanner View */}
          {cameraScan && (
            <div className="overflow-hidden rounded-xl border bg-black aspect-video relative mt-2 shadow-inner">
              <Scanner
                onScan={(detectedCodes) => {
                  if (detectedCodes && detectedCodes.length > 0) {
                    const scanned = detectedCodes[0].rawValue;
                    setCode(scanned);
                    setCameraScan(false);
                    handleLookup(scanned);
                  }
                }}
                formats={['qr_code', 'code_128', 'ean_13', 'code_39']}
                components={{ finder: true }}
                styles={{ container: { width: '100%', height: '100%' } }}
              />
            </div>
          )}

          {/* Multiple matches selector */}
          {matches.length > 1 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Tìm thấy {matches.length} máy thuộc danh mục / phiếu này:</span>
                <span className="text-[11px] font-normal italic">Bấm vào máy để xem vị trí</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-1 border rounded-lg bg-muted/10">
                {matches.map(m => {
                  const isSelected = result?.maCaThe === m.maCaThe;
                  return (
                    <button
                      key={m.maCaThe}
                      type="button"
                      onClick={() => setResult(m)}
                      className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary' 
                          : 'border-border/60 hover:bg-muted/40 bg-card'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-xs text-foreground truncate">{m.maCaThe}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {m.viTri === 'KHO' ? '🟢 Tại Kho' : `🔵 ${m.tenKhoa || m.maKhoa}`}
                        </div>
                      </div>
                      <Badge variant={m.viTri === 'KHO' ? 'outline' : 'default'} className="text-[9px] shrink-0">
                        {m.viTri === 'KHO' ? 'Trong kho' : 'Đang mượn'}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="mt-4 border rounded-xl p-4 bg-muted/20 space-y-4 animate-in fade-in duration-200">
              <div className="flex gap-4 items-start">
                {result.hinhAnh ? (
                  <img 
                    src={result.hinhAnh} 
                    alt={result.tenThietBi} 
                    className="w-20 h-20 rounded-lg object-cover border shadow-sm flex-shrink-0" 
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border flex-shrink-0">
                    <QrCode className="w-8 h-8 opacity-40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                      {result.maCaThe}
                    </span>
                    {result.serialNumber && (
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Serial: {result.serialNumber}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-foreground mt-1 truncate" title={result.tenThietBi}>
                    {result.tenThietBi}
                  </h3>
                  <p className="text-xs text-muted-foreground">Mã chủng loại: {result.maThietBi} • ĐVT: {result.donViCoSo}</p>
                </div>
              </div>

              {/* Location & Status Banner */}
              <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
                result.viTri === 'KHO'
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-800'
                  : 'bg-blue-50/70 border-blue-200 text-blue-950 dark:bg-blue-950/20 dark:border-blue-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    {result.viTri === 'KHO' ? (
                      <>
                        <Warehouse className="w-4 h-4 text-emerald-600" />
                        Vị trí hiện tại: Ở TRONG KHO
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4 text-blue-600" />
                        Vị trí hiện tại: ĐANG Ở KHOA / PHÒNG
                      </>
                    )}
                  </span>
                  <Badge variant={result.viTri === 'KHO' ? 'outline' : 'default'} className={
                    result.viTri === 'KHO'
                      ? 'border-emerald-500 text-emerald-700 bg-emerald-100'
                      : 'bg-blue-600 text-white'
                  }>
                    {result.viTri === 'KHO' ? 'Sẵn sàng cấp phát' : result.tenKhoa || result.maKhoa}
                  </Badge>
                </div>

                {result.viTri === 'KHOA_PHONG' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-blue-200/60 dark:border-blue-800/60">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Khoa mượn: <strong>{result.tenKhoa || result.maKhoa}</strong></span>
                    </div>
                    {result.tenNguoiMuon && (
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Người mượn: <strong>{result.tenNguoiMuon}</strong></span>
                      </div>
                    )}
                    {result.ngayCapPhat && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Ngày mượn: <strong>{new Date(result.ngayCapPhat).toLocaleDateString('vi-VN')}</strong></span>
                      </div>
                    )}
                    {result.ngayTraDuKien && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Hạn trả: <strong>{new Date(result.ngayTraDuKien).toLocaleDateString('vi-VN')}</strong>
                          <span className={`ml-1.5 font-bold ${
                            result.soNgayConLai < 0 ? 'text-destructive' : (result.soNgayConLai <= 3 ? 'text-amber-600' : 'text-emerald-600')
                          }`}>
                            ({result.soNgayConLai < 0 ? `Quá hạn ${Math.abs(result.soNgayConLai)} ngày` : `Còn ${result.soNgayConLai} ngày`})
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Thiết bị đang nằm trong kho y tế, đã kiểm tra kỹ thuật và sẵn sàng cấp phát khi có yêu cầu từ các khoa phòng.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                {result.viTri === 'KHOA_PHONG' && onNavigateToReturns && (
                  <Button 
                    size="sm" 
                    className="gradient-primary text-primary-foreground text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      onNavigateToReturns();
                    }}
                  >
                    Đến màn hình Trả thiết bị
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
