# DỮ LIỆU ĐẶC TẢ VÀ VẼ SƠ ĐỒ HỆ THỐNG MEDEQUIP V4

Tài liệu này cung cấp toàn bộ các tác nhân (Actors), danh sách ca sử dụng (Use Cases) và các luồng hoạt động (Activity flows) để phục vụ cho việc vẽ UML.

---

## PHẦN 1: DỮ LIỆU VẼ SƠ ĐỒ USE CASE

### 1. Phân chia tác nhân (Actors)
- **Admin**: Quản lý hệ thống (tài khoản).
- **Quản lý kho (QL_KHO)**: Quản lý danh mục, thiết bị, nhập/xuất kho và xem báo cáo tổng hợp.
- **Nhân viên kho (NV_KHO)**: Quét QR, đối chiếu, kiểm tra tiếp nhận yêu cầu cấp phát, trả, gia hạn.
- **Trưởng khoa (TRUONG_KHOA)**: Chịu trách nhiệm duyệt phiếu của khoa và gửi lên Kho.
- **Trợ lý khoa (TRO_LY)**: Lên danh sách thiết bị cần mượn/trả/gia hạn/báo hỏng để trình lên Trưởng khoa.

### 2. Danh sách Use Case theo Package
Để sơ đồ không bị rối, hãy vẽ thành 3 cụm (packages) riêng biệt:

**A. Cụm Quản trị Hệ thống (Admin)**
- Đăng nhập / Đăng xuất
- Quản lý tài khoản (Thêm/Sửa/Khóa/Xóa)
- Xem tổng quan người dùng
- Gán người dùng vào Khoa

**B. Cụm Nghiệp vụ Kho (QL_Kho & NV_Kho)**
- Quản lý Danh mục (Thêm/Sửa/Xóa Khoa, Nhà cung cấp) *(Chỉ QL_Kho)*
- Quản lý Thiết bị (Thêm/Sửa/Xóa máy móc) *(Chỉ QL_Kho)*
- Nhập kho thiết bị (Upload Excel) *(Chỉ QL_Kho)*
- Xuất kho thiết bị (Thanh lý/Điều chuyển) *(Chỉ QL_Kho)*
- Xem Báo cáo & Xuất Excel toàn viện *(Chỉ QL_Kho)*
- Nhắc nhở khoa quá hạn *(Chỉ QL_Kho)*
- Phê duyệt / Từ chối phiếu Cấp phát *(QL_Kho, NV_Kho)*
- Phê duyệt / Từ chối phiếu Gia hạn *(QL_Kho, NV_Kho)*
- Quét QR Code nghiệm thu phiếu Trả *(QL_Kho, NV_Kho)*
- Cập nhật trạng thái Báo hỏng *(QL_Kho, NV_Kho)*

**C. Cụm Nghiệp vụ Khoa (Trưởng khoa & Trợ lý)**
- Xem danh sách thiết bị khoa đang giữ
- Đề xuất phiếu Cấp phát *(Trợ lý tạo -> Trưởng duyệt -> Gửi Kho)*
- Đề xuất phiếu Trả thiết bị *(Trợ lý khai báo tình trạng -> Trưởng duyệt -> Gửi Kho)*
- Xin gia hạn mượn thiết bị *(Trợ lý tạo -> Gửi Kho)*
- Lập báo cáo hư hỏng *(Trợ lý/Trưởng tạo)*
- Xem lịch sử mượn/trả của Khoa
- Xem Báo cáo thiết bị riêng của Khoa *(Chỉ Trưởng khoa)*

---

## PHẦN 2: DỮ LIỆU VẼ SƠ ĐỒ HOẠT ĐỘNG (ACTIVITY DIAGRAM)

Dưới đây là các luồng (flows) bước-by-bước để bạn vẽ Sơ đồ Hoạt động cho các chức năng quan trọng nhất. Sự tách biệt nhiệm vụ giữa **Quản lý Kho** (Đánh giá/Duyệt) và **Nhân viên Kho** (Thực thi/Giao nhận) được tuân thủ nghiêm ngặt.

### 1. Sơ đồ Hoạt động: Quy trình Cấp phát thiết bị
- **Các làn (Swimlanes):** Trợ lý Khoa | Trưởng Khoa | Quản lý Kho | Nhân viên Kho | Hệ thống
- **Các bước:**
  1. **Trợ lý Khoa**: Chọn thiết bị từ danh mục, đưa vào Giỏ hàng, nhập số lượng cần mượn. Bấm "Tạo đề xuất".
  2. **Hệ thống**: Đổi trạng thái thành CHỜ DUYỆT và Bắn thông báo cho Trưởng Khoa.
  3. **Trưởng Khoa**: Xem xét đề xuất.
     - *[Không đồng ý]*: Bấm "Từ chối". Hệ thống hủy phiếu, báo lại cho Trợ lý. (Kết thúc)
     - *[Đồng ý]*: Bấm "Gửi yêu cầu lên Kho".
  4. **QL Kho**: Nhận thông báo. Xem chi tiết phiếu yêu cầu và Đánh giá tình hình kho.
     - *[Không đồng ý]*: Bấm "Từ chối". Hệ thống hủy phiếu, báo lại cho Trưởng khoa và trợ lý. (Kết thúc)
     - *[Đồng ý]*: Bấm "Duyệt" và gửi thông báo công việc cho Nhân viên Kho.
  5. **Nhân viên Kho**: Lấy phiếu đã duyệt, soạn thiết bị và Thực hiện cấp phát theo phiếu, sau đó có sự ký xác nhận/bàn giao với Trợ lý.
  6. **Hệ thống**: 
     - Trừ số lượng Tồn kho.
     - Cộng số lượng vào Thiết bị khoa đang mượn.
     - Tạo "Phiếu Cấp Phát". Gửi thông báo hoàn tất cho Khoa.
  7. **Kết thúc**.

### 2. Sơ đồ Hoạt động: Quy trình Trả thiết bị (Có QR Code)
- **Các làn (Swimlanes):** Trợ lý Khoa | Trưởng Khoa | Quản lý Kho | Nhân viên Kho | Hệ thống
- **Các bước:**
  1. **Trợ lý Khoa**: Vào danh sách thiết bị đang mượn. Chọn thiết bị cần trả, Khai báo tình trạng (Bình thường / Hư hỏng). Bấm "Tạo đề xuất trả".
  2. **Trưởng Khoa**: Duyệt danh sách trả. Bấm "Xác nhận trả thiết bị" gửi lên Kho.nếu từ chối thì gửi thông báo lại cho trợ lý
  3. **QL Kho**: Nhận thông báo và xem xét phiếu trả. Bấm "Phê duyệt yêu cầu trả" (cho phép khoa mang đồ xuống kho).Nếu từ chối thì thông báo alji cho trưởng khoa và trợ lý
  4. **Hệ thống**: Sinh ra **Mã QR Code** cho phiếu trả và đổi trạng thái thành CHỜ NHẬN.
  5. **Trợ lý Khoa**: Mang thiết bị vật lý xuống Kho kèm mã QR.
  6. **Nhân viên Kho**: Dùng điện thoại/máy quét để Quét mã QR do Trợ lý cung cấp nhằm mở thông tin đối chiếu.
  7. **Nhân viên Kho**: Kiểm tra thực tế thiết bị so với khai báo trên màn hình.
     - *[Thực tế không đúng khai báo (VD: máy vỡ nhưng khai bình thường)]*: Bấm "Từ chối nhận". Khoa mang về tạo lại phiếu. (Kết thúc)
     - *[Thực tế đúng như khai báo]*: Bấm "Xác nhận thu hồi".
  8. **Hệ thống**: 
     - Xóa thiết bị khỏi danh sách Khoa đang mượn.
     - *[Nếu khai báo BÌNH THƯỜNG]*: Cộng số lượng lại vào Tồn kho sẵn sàng.
     - *[Nếu khai báo HƯ HỎNG]*: Chuyển số lượng vào Tồn kho hư hỏng.
  9. **Kết thúc**.

### 3. Sơ đồ Hoạt động: Nhập Kho bằng Excel
- **Các làn (Swimlanes):** Quản lý Kho | Hệ thống
- **Các bước:**
  1. **QL Kho**: Chọn chức năng "Nhập kho". Tải file Excel báo cáo theo mẫu.
  2. **Hệ thống**: Đọc file và hiển thị bảng *Preview* (Xem trước). Kiểm tra tính hợp lệ của dữ liệu (chuẩn format).
     - *[Có lỗi]*: Bôi đỏ dòng lỗi. QL Kho phải sửa lại Excel và upload lại (Về bước 1).
     - *[Hợp lệ]*: Cho phép QL Kho bấm xác nhận.
  3. **QL Kho**: Bấm "Xác nhận Lưu dữ liệu".
  4. **Hệ thống (UPSERT Logic)**:
     - *[Nếu thiết bị mới]*: Tạo mới bản ghi.
     - *[Nếu thiết bị cũ]*: Cộng dồn tồn kho.
  5. **Hệ thống**: Ghi lại lịch sử nhập kho và báo thành công.
  6. **Kết thúc**.

### 4. Sơ đồ Hoạt động: Xin Gia hạn Thiết bị
- **Các làn (Swimlanes):** Trợ lý|Trưởng Khoa | Quản lý Kho | Hệ thống
- **Các bước:**
  1. **Trợ lý**: Chọn thiết bị mượn sắp tới hạn. Bấm "Xin gia hạn", nhập số ngày và lý do.
  2. **Hệ thống**: Chuyển phiếu sang phiếu xin cấp phát và gửi thông báo cho trưởng khoa
  3. **Trưởng khoa**: Xem xét phiếu yêu cầu gia hạn. Đồng ý thì gửi lên cho quản lý kho còn từ chối thì thông báo lại cho trợ lý
  2. **QL Kho**: Nhận yêu cầu. Xem xét lịch trình thiết bị.
     - *[Từ chối]*: Bấm Từ chối. Hệ thống báo lại trưởng khoa và trợ lý
     - *[Đồng ý]*: Bấm Duyệt gia hạn.
  3. **Hệ thống**: Cập nhật lại trường `NgayDuKienTra`. Gửi thông báo thành công cho trợ lý và trưởng khoa.
  4. **Kết thúc**.

### 5. Sơ đồ Hoạt động: Báo hỏng Thiết bị
- **Các làn (Swimlanes):** Trợ lý/Trưởng Khoa | Quản lý Kho | Nhân viên Kho | Hệ thống
- **Các bước:**
  1. **Trợ lý/Trưởng Khoa**: Bấm "Báo hỏng", điền mức độ hỏng và đính kèm ảnh.
  2. **Hệ thống**: Lưu phiếu (CHỜ XỬ LÝ). Bắn Alert cho QL Kho.
  3. **QL Kho**: Nhận thông báo, đánh giá tình hình và phân công nhiệm vụ sửa chữa/thu hồi cho Nhân viên Kho.
  4. **Nhân viên Kho**: Đi thực địa tại khoa hoặc nhận máy tại kho. Cập nhật tiến độ trên hệ thống.
     - *[Đang sửa chữa]*: Đổi trạng thái ĐANG_SUA.
     - *[Sửa xong]*: Đổi trạng thái DA_SUA. 
     - *[Không thể sửa]*: Trả phiếu lại cho QL Kho tiến hành làm thủ tục Thanh lý (Xuất kho).
  5. **Hệ thống**: Tự động chuyển máy từ Tồn kho hư hỏng về Tồn kho sử dụng (Nếu báo sửa xong).
  6. **Kết thúc**.

### 6. Sơ đồ Hoạt động: Gửi Nhắc nhở Quá hạn
- **Các làn (Swimlanes):** Quản lý Kho | Hệ thống | Trợ lý Khoa
- **Các bước:**
  1. **Hệ thống**: Tự động quét và lọc ra các máy có hạn trả < Ngày hiện tại.
  2. **QL Kho**: Vào danh sách Quá hạn. Chọn khoa vi phạm và bấm "Gửi nhắc nhở".
  3. **Hệ thống**: Push thông báo Realtime thẳng đến tài khoản của Trợ lý Khoa đó.
  4. **Trợ lý Khoa**: Xem thông báo. Có trách nhiệm tiến hành làm Phiếu Trả (Hoặc Gia hạn).
  5. **Kết thúc**.
