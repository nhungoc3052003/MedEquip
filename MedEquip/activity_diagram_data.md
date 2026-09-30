# DỮ LIỆU VẼ SƠ ĐỒ HOẠT ĐỘNG (ACTIVITY DIAGRAM) CHO TỪNG USE CASE

Dưới đây là mô tả chi tiết từng bước (Step-by-step) có kèm theo các rẽ nhánh điều kiện (Decision Nodes) và phân làn (Swimlanes) cho từng Use Case trong hệ thống MedEquip.

---

## Nhóm 1: Các Use Case Cơ bản (CRUD & Hệ thống)

### 1. Sơ đồ Hoạt động: Đăng nhập
- **Swimlanes**: Người dùng (User) | Hệ thống (System)
- **Các bước**:
  1. **User**: Nhập Email và Mật khẩu trên màn hình đăng nhập. Bấm "Đăng nhập".
  2. **System**: Kiểm tra thông tin đăng nhập trong Cơ sở dữ liệu.
     - *[Sai thông tin]*: Hiển thị thông báo lỗi "Sai email hoặc mật khẩu". Quay lại bước 1.
     - *[Tài khoản bị khóa]*: Hiển thị thông báo "Tài khoản đã bị vô hiệu hóa". Quay lại bước 1.
     - *[Hợp lệ]*: Tạo phiên (Session/JWT Token).
  3. **System**: Phân tích Vai trò (Role) của User để điều hướng.
     - *[Nếu là Admin]*: Chuyển hướng đến Dashboard Quản lý Người dùng.
     - *[Nếu là Kho / Khoa]*: Chuyển hướng đến Dashboard Thống kê Thiết bị tương ứng.
  4. **Kết thúc**.

### 2. Sơ đồ Hoạt động: Quản lý Tài khoản / Danh mục (Thêm/Sửa/Xóa)
*(Áp dụng chung cho Quản lý User, Quản lý Khoa, NCC, Thiết bị)*
- **Swimlanes**: Quản trị viên / QL Kho | Hệ thống
- **Các bước**:
  1. **User**: Chọn chức năng "Thêm mới" (hoặc Sửa/Xóa).
  2. **User**: Nhập dữ liệu vào Form (Tên, Mã, Email, Số lượng...). Bấm "Lưu".
  3. **System**: Xác thực dữ liệu đầu vào (Validation).
     - *[Dữ liệu thiếu/sai định dạng]*: Báo lỗi ngay trên Form. Quay lại bước 2.
     - *[Trùng lặp Mã/Email]*: Báo lỗi "Dữ liệu đã tồn tại". Quay lại bước 2.
     - *[Hợp lệ]*: Lưu bản ghi vào Cơ sở dữ liệu (Insert/Update/Delete).
  4. **System**: Hiển thị thông báo "Thành công" và Cập nhật lại giao diện danh sách (Reload Table).
  5. **Kết thúc**.

---

## Nhóm 2: Các Use Case Nghiệp vụ Nhập/Xuất Kho

### 3. Sơ đồ Hoạt động: Nhập kho bằng Excel
- **Swimlanes**: Quản lý Kho | Hệ thống
- **Các bước**:
  1. **QL Kho**: Chọn "Tải lên Excel". Chọn file `.xlsx` từ máy tính.
  2. **Hệ thống**: Đọc file và hiển thị bảng Preview (Xem trước dữ liệu).
  3. **Hệ thống**: Rà soát lỗi (Check Validation).
     - *[Phát hiện lỗi định dạng/thiếu dữ liệu]*: Bôi đỏ các dòng lỗi. 
     - **QL Kho**: Hủy thao tác, sửa lại file Excel và tải lại (Quay lại bước 1).
     - *[Dữ liệu hợp lệ]*: Hiển thị nút "Xác nhận Lưu".
  4. **QL Kho**: Bấm "Xác nhận Lưu dữ liệu".
  5. **Hệ thống (UPSERT Logic)**:
     - Duyệt từng dòng:
       - *[Nếu Mã TB chưa tồn tại]*: Thêm mới thiết bị vào CSDL.
       - *[Nếu Mã TB đã tồn tại]*: Cộng dồn số lượng vào Tồn kho hiện tại.
  6. **Hệ thống**: Tạo "Phiếu Nhập Kho" lưu lịch sử. Thông báo thành công.
  7. **Kết thúc**.

### 4. Sơ đồ Hoạt động: Xuất kho (Thanh lý / Điều chuyển)
- **Swimlanes**: Quản lý Kho | Hệ thống
- **Các bước**:
  1. **QL Kho**: Bấm "Tạo phiếu xuất kho". Chọn Thiết bị, nhập Số lượng xuất và Lý do (Thanh lý, Bảo hành...).
  2. **Hệ thống**: Kiểm tra tồn kho sẵn có.
     - *[Số lượng xuất > Tồn kho]*: Báo lỗi "Vượt quá số lượng trong kho". Quay lại bước 1.
     - *[Hợp lệ]*: Tiến hành xuất.
  3. **Hệ thống**: Trừ số lượng khỏi Tồn kho. Tạo "Phiếu Xuất Kho".
  4. **Kết thúc**.

---

## Nhóm 3: Các Use Case Nghiệp vụ Mượn / Trả / Gia hạn

### 5. Sơ đồ Hoạt động: Đề xuất và Cấp phát Thiết bị
- **Swimlanes**: Trợ lý Khoa | Trưởng Khoa | Nhân viên / QL Kho | Hệ thống
- **Các bước**:
  1. **Trợ lý Khoa**: Chọn thiết bị từ danh mục, đưa vào Giỏ hàng, nhập số lượng cần mượn. Bấm "Tạo đề xuất".
  2. **Hệ thống**: Đổi trạng thái thành CHỜ DUYỆT và Bắn thông báo cho Trưởng Khoa.
  3. **Trưởng Khoa**: Xem xét đề xuất.
     - *[Không đồng ý]*: Bấm "Từ chối". Hệ thống hủy phiếu, báo lại cho Trợ lý. (Kết thúc)
     - *[Đồng ý]*: Bấm "Gửi yêu cầu lên Kho".
  4. **QL Kho**: Nhận thông báo. Xem chi tiết phiếu yêu cầu và Đánh giá tình hình kho.
     - *[Không đồng ý]*: Bấm "Từ chối". Hệ thống hủy phiếu, báo lại cho Trưởng khoa và trợ lý. (Kết thúc)
     - *[Đồng ý]*: Bấm "Duyệt" và gửi phiếu cho nhân vien kho biết.
  5. **NV**: Thực hiện cấp phát theo phiếu và có sự xác nhận của trợ lý.
  6. **Hệ thống**: 
     - Trừ số lượng Tồn kho.
     - Cộng số lượng vào Thiết bị khoa đang mượn.
     - Tạo "Phiếu Cấp Phát". Gửi thông báo cho Khoa.
  7. **Kết thúc**.

### 6. Sơ đồ Hoạt động: Đề xuất Trả và Quét QR Nghiệm thu
- **Swimlanes**: Trợ lý Khoa | Trưởng Khoa | Quản lý Kho | Nhân viên Kho | Hệ thống
- **Các bước**:
  1. **Trợ lý Khoa**: Vào danh sách thiết bị đang mượn. Chọn thiết bị cần trả, Khai báo tình trạng (Bình thường / Hư hỏng). Bấm "Tạo đề xuất trả".
  2. **Trưởng Khoa**: Duyệt danh sách trả. Bấm "Xác nhận trả thiết bị" gửi lên Kho.
  3. **QL Kho**: Nhận thông báo và xem xét phiếu trả. Bấm "Phê duyệt yêu cầu trả" (cho phép khoa mang đồ xuống).
  4. **Hệ thống**: Sinh ra **Mã QR Code** cho phiếu trả và đổi trạng thái thành CHỜ NHẬN.
  5. **Trợ lý Khoa**: Mang thiết bị vật lý xuống Kho kèm mã QR.
  6. **Nhân viên Kho**: Dùng thiết bị Quét mã QR (hoặc nhập mã phiếu) do Trợ lý cung cấp để mở thông tin đối chiếu.
  7. **Nhân viên Kho**: Kiểm tra thực tế thiết bị.
     - *[Thực tế không đúng khai báo (VD: máy vỡ nhưng khai bình thường)]*: Bấm "Từ chối nhận". Khoa mang về tạo lại phiếu. (Kết thúc)
     - *[Thực tế đúng như khai báo]*: Bấm "Xác nhận thu hồi".
  8. **Hệ thống**: 
     - Xóa thiết bị khỏi danh sách Khoa đang mượn.
     - *[Nếu khai báo BÌNH THƯỜNG]*: Cộng số lượng lại vào Tồn kho sẵn sàng.
     - *[Nếu khai báo HƯ HỎNG]*: Chuyển số lượng vào Tồn kho hư hỏng.
  9. **Kết thúc**.

### 7. Sơ đồ Hoạt động: Xin Gia hạn Thiết bị
- **Swimlanes**: Trợ lý Khoa/Trưởng Khoa | Quản lý Kho | Hệ thống
- **Các bước**:
  1. **Trợ lý/Trưởng Khoa**: Chọn thiết bị tái sử dụng. Bấm "Xin gia hạn". Nhập số ngày muốn mượn thêm và Lý do.
  2. **QL Kho**: Nhận yêu cầu gia hạn. Xem xét.
     - *[Từ chối]*: Bấm Từ chối. Hệ thống giữ nguyên Hạn trả cũ. (Khoa bắt buộc phải trả).
     - *[Đồng ý]*: Bấm Duyệt gia hạn.
  3. **Hệ thống**: Cập nhật lại trường `NgayDuKienTra` (Hạn trả mới). Gửi thông báo thành công cho Khoa.
  4. **Kết thúc**.

---

## Nhóm 4: Xử lý Báo hỏng và Cảnh báo

### 8. Sơ đồ Hoạt động: Báo hỏng Thiết bị
- **Swimlanes**: Trợ lý Khoa/Trưởng Khoa | Quản lý Kho | Nhân viên Kho | Hệ thống
- **Các bước**:
  1. **Trợ lý/Trưởng Khoa**: Bấm "Báo hỏng" trên 1 thiết bị. Điền mô tả chi tiết, mức độ hỏng và Tải ảnh lên.
  2. **Hệ thống**: Lưu phiếu báo hỏng (Trạng thái: CHỜ XỬ LÝ). Gửi thông báo khẩn cấp (Alert) cho QL Kho.
  3. **QL Kho**: Nhận thông báo, đánh giá tình hình và phân công cho Nhân viên kho đi kiểm tra.
  4. **Nhân viên Kho**: Xuống khoa kiểm tra hoặc yêu cầu khoa mang thiết bị xuống. Cập nhật trạng thái phiếu hỏng trên hệ thống.
     - *[Đang sửa chữa]*: Đổi trạng thái -> ĐANG_SUA.
     - *[Sửa xong]*: Đổi trạng thái -> DA_SUA.
     - *[Không thể sửa]*: Báo cáo lại cho QL Kho để tiến hành quy trình Thanh lý (Xuất kho).
  5. **Hệ thống**: Tự động cập nhật lại thông tin kho nếu máy đã sửa xong.
  6. **Kết thúc**.

### 9. Sơ đồ Hoạt động: Gửi Nhắc nhở Quá hạn
- **Swimlanes**: QL Kho | Hệ thống | Trợ lý Khoa
- **Các bước**:
  1. **Hệ thống**: Định kỳ (hoặc khi Load trang) quét bảng Cấp phát. Lọc ra các thiết bị có `NgayDuKienTra` < Ngày hiện tại.
  2. **QL Kho**: Truy cập tab "Thiết bị quá hạn". Chọn các khoa đang vi phạm. Bấm "Gửi nhắc nhở".
  3. **Hệ thống**: Push thông báo Realtime (Chuông thông báo / Popup) đến tài khoản Trợ lý Khoa của khoa đó.
  4. **Trợ lý Khoa**: Nhận được thông báo. Phải tiến hành quy trình Trả thiết bị hoặc Xin gia hạn ngay lập tức.
  5. **Kết thúc**.
