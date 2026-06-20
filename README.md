# MedEquip v4 - Hệ thống Quản lý Thiết bị Y tế Bệnh viện

Dự án phần mềm quản lý kho thiết bị y tế và vật tư tiêu hao nội bộ bệnh viện. 
Phiên bản v4 đi kèm với các cập nhật lớn về kiến trúc, phân quyền chặt chẽ (RBAC), hệ thống cảnh báo tự động, xử lý quét QR code trả thiết bị, và giỏ hàng cấp phát.

## Cấu trúc dự án

```text
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

## Phân quyền & Tài khoản mẫu (mật khẩu chung: 123456)

Hệ thống v4 áp dụng mô hình phân quyền **Role-Based Access Control (RBAC) cực kỳ nghiêm ngặt**:

1. **Admin (Quản trị viên)**: `admin@benhvien.vn`
   - Có quyền quản lý Tài khoản Người dùng (Thêm, Sửa, Khóa, Gán Khoa).
   - Không can thiệp nhưng xem dữ liệu nghiệp vụ Thiết bị, Kho, Phiếu yêu cầu. Báo cáo thống kê

2. **Quản lý Kho (QL_KHO)**: `qlkho@benhvien.vn`
   - Có quyền về mặt nghiệp vụ: Quản lý Khoa, Nhà cung cấp, Danh mục Thiết bị.
   - Có quyền gửi cảnh báo tự động cho các Khoa đang giữ thiết bị quá hạn. Xuất báo cáo thống kê tổng hợp toàn viện.

3. **Nhân viên Kho (NV_KHO)**: `kho@benhvien.vn`
   - Chỉ được cấp quyền thực thi nghiệp vụ hàng ngày: Tiếp nhận phiếu yêu cầu cấp phát, phiếu trả, phiếu gia hạn và xử lý báo cáo hư hỏng.

4. **Trưởng Khoa (TRUONG_KHOA)**: (VD: `khoanoi@benhvien.vn` - Khoa Nội)
   - Chịu trách nhiệm về thiết bị của khoa mình.
   - Duyệt các đề xuất trả thiết bị từ Trợ lý, gửi phiếu yêu cầu cấp phát chính thức lên Kho. Có báo cáo thống kê riêng biệt cho thiết bị của Khoa.

5. **Trợ lý Khoa (TRO_LY)**: (VD: `troly.noi@benhvien.vn` - Khoa Nội)
   - Được gán chặt chẽ với một Khoa cụ thể.
   - Lập danh sách, tạo đề xuất (mượn, trả, gia hạn, báo hỏng) trình lên Trưởng khoa. Trực tiếp nhận cảnh báo quá hạn từ Quản lý Kho.

## Các tính năng nổi bật 

1. **Quản lý Nhập / Xuất Kho Toàn diện**
   - **Nhập Kho (UPSERT Logic qua Excel):** Không còn lập phiếu nhập tay/thủ công. QL Kho sẽ tải file Excel báo cáo và upload trực tiếp lên hệ thống. Tự động thêm mới hoặc cộng dồn tồn kho đối với thiết bị đã tồn tại. Hiển thị bảng Preview báo lỗi định dạng trước khi lưu.
   - **Xuất Kho (Thanh lý / Điều chuyển):** Hỗ trợ xuất kho thiết bị ra khỏi bệnh viện với các lý do cụ thể (Bảo hành, Thanh lý, Hết hạn sử dụng...). Hệ thống tự động trừ tồn kho và ghi nhận lịch sử xuất chi tiết.

2. **Cấp phát Giỏ hàng và Cảnh báo Tồn Kho**
   - Khoa tạo Yêu Cầu bằng "Giỏ hàng" trực quan. Kho duyệt và chuyển thành Phiếu Cấp Phát.
   - Hỗ trợ ngưỡng cảnh báo (Low Stock) tuỳ chỉnh. Các thiết bị dưới mức cảnh báo sẽ bị bôi đỏ cảnh giác. 

3. **Hệ thống Nhắc nhở & Cảnh báo Tự động**
   - Quản lý Kho có màn hình theo dõi thiết bị quá hạn chuyên biệt. Chỉ với 1 nút bấm, cảnh báo sẽ được đẩy Realtime xuống trực tiếp màn hình của Trợ lý Khoa đang vi phạm hạn trả.

4. **Trình Quản lý Trả Thiết Bị & QR Code**
   - Trợ lý khai báo tình trạng thiết bị khi trả (Nguyên hộp, Bóc seal, hoặc Hỏng hóc) sau đó gửi cho trưởng khoa duyệt, sau khi trưởng khoa duyệt thì gửi cho quản lý kho duyệt 
   - Hệ thống tự tạo mã QRCode bảo mật.
   - Nhân viên Kho sử dụng QR Code hoặc quét để đối chiếu Xác nhận. 

5. **Gia hạn Thời gian sử dụng**
   - Tính năng trực tiếp theo dõi hạn trả thiết bị Tái sử dụng, Khoa xin gia hạn số ngày và hiển thị cho Kho duyệt. 

6. **Báo cáo Thống kê Đa Tầng (Multi-tier Reports)**
   - Các Dashboard và Báo cáo tự động thay đổi (biến hình) tùy theo Role của người đăng nhập. Tôn trọng triệt để quyền hạn.
   - Tự động lấy danh sách và xuất ra file Excel `.xlsx` chuyên nghiệp theo chuẩn Bệnh viện.

---

> 📝 **Lưu ý trong phiên bản API:** 
> Vui lòng đảm bảo các biến môi trường trong file `server/.env` (DB_HOST, DB_NAME, JWT_SECRET, CLIENT_URL) được set chính xác để tránh lỗi CORS trong việc truyền/tải tệp Excel.
