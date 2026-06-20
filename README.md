# MedEquip- Hệ thống Quản lý Thiết bị Y tế Bệnh viện

Dự án phần mềm quản lý kho thiết bị y tế và vật tư tiêu hao nội bộ bệnh viện. 
đi kèm với các cập nhật lớn về kiến trúc, luồng nhập/xuất kho bằng Excel, xử lý quét QR code trả thiết bị, và giỏ hàng cấp phát.

## Cấu trúc dự án

```
MedEquip_4/
├── client/          # Frontend React + Vite + TypeScript + TailwindCSS
├── server/          # Backend Node.js + Express + MySQL
└── database/        # Chứa schema SQL, DB mẫu và file migration
    ├── medequip_database.sql # Database hiện tại (Full Schema Mới)
    └── migration_v4.sql      # Script nâng cấp lên DB v4
```

## Cài đặt và Chạy

### 1. Database (MySQL)
Để bắt đầu với CSDL mới nhất, hãy nạp schema:
```bash
mysql -u root -p < database/medequip_database.sql
```
*(Lưu ý: Nếu bạn đang sử dụng phiên bản cũ (v3), vui lòng chạy file `migration_v4.sql` để nâng cấp CSDL không mất dữ liệu)*

### 2. Backend
Backend Node.js tại Port `5000`. Cần môi trường chạy cho upload Excel.
```bash
cd server
npm install
npm run dev
```

### 3. Frontend
Frontend React/Vite tại Port `5173`.
```bash
cd client
npm install
npm run dev
```

## Tài khoản mẫu (mật khẩu: 123456)
Hệ thống v4 **đã lược bỏ tài khoản Nhân viên Bệnh viện (NV_BV)**:
- **Admin**: admin@benhvien.vn
- **Nhân viên Kho (NV_KHO)**: kho@benhvien.vn
- **Quản lý Kho (QL_KHOA)**: qlkho@benhvien.vn
- **Trưởng Khoa (TRUONG_KHOA)**: khoanoi@benhvien.vn (K-001)
  - khoangoai@benhvien.vn (K-002)
  - khoasan@benhvien.vn (K-003)
  - khoanhi@benhvien.vn (K-004)
  - khoacapcuu@benhvien.vn (K-005)
- **Trợ lý Khoa (TRO_LY)**: 
  - troly.noi@benhvien.vn (Khoa Nội)
  - troly.ngoai@benhvien.vn (Khoa Ngoại)
  - troly.san@benhvien.vn (Khoa Sản)

Mật khẩu chung cho tất cả: 123456

## Các tính năng nổi bật (v4 Update)

1. **Upload Excel Nhập Kho (UPSERT Logic)**
   - Không còn lập phiếu nhập tay/thủ công. NV Kho sẽ tải file Excel báo cáo và upload trực tiếp lên hệ thống.
   - Hệ thống tự động thêm mới (tạo thiết bị mới) hoặc cộng dồn tồn kho đối với các thiết bị đã tồn tại trong DB.
   - Hiển thị bảng Preview và báo lỗi các dòng nếu format sai trước khi xác nhận.

2. **Cấp phát Giỏ hàng và Cảnh báo Tồn Kho**
   - Trưởng khoa tạo Yêu Cầu bằng "Giỏ hàng" trực quan. NV Kho duyệt và chuyển thành Phiếu Cấp Phát.
   - Hỗ trợ ngưỡng cảnh báo (Low Stock) tuỳ chỉnh. Các thiết bị dưới mức cảnh báo sẽ bị bôi đỏ cảnh giác. 

3. **Phân loại Thiết bị: Tái sử dụng & Tiêu hao**
   - Tiêu hao (Bông, băng, cồn...): Cấp đứt, không cần hoàn trả. Đi kèm hệ số quy đổi xuất.
   - Tái sử dụng (Máy móc, công cụ...): Quản lý theo `SerialNumber`. Bắt buộc khai báo "Ngày dự kiến trả".

4. **Trình Quản lý Trả Thiết Bị & QR Code**
   - Trưởng khoa khai báo tình trạng thiết bị khi trả (Nguyên hộp, Bóc seal, hoặc Hỏng hóc). 
   - Hệ thống tự tạo mã QRCode bảo mật.
   - Nhân viên Kho sử dụng QR Code hoặc quét để đối chiếu Xác nhận. Tự động chuyển Hỏng vào Tồn hư hỏng. Máy bình thường được trả lại Tồn sẵn dùng.

5. **Gia hạn Thời gian sử dụng**
   - Tính năng trực tiếp theo dõi hạn trả thiết bị Tái sử dụng của Trưởng khoa, xin gia hạn hiển thị cho NV Kho duyệt. 

6. **Xuất báo cáo Excel**
   - Tự động lấy danh sách xuất kho (hoặc các luồng khác) và xuất ra file Excel `.xlsx` chuyên nghiệp theo chuẩn Bệnh viện.

---

> 📝 **Lưu ý trong phiên bản API:** 
> Vui lòng đảm bảo các biến môi trường trong file `server/.env` (DB_HOST, DB_NAME, JWT_SECRET, CLIENT_URL) được set chính xác để tránh lỗi CORS trong việc truyền/tải tệp Excel.
