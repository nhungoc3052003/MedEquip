# Tài liệu Chức năng Yêu cầu Cấp phát - MedEquip

Tài liệu này tóm tắt các thành phần và luồng xử lý của chức năng **Yêu cầu cấp phát** trong hệ thống.

## 1. Các File Liên Quan

### Backend (Server)
- `server/routes/requests.js`: Định nghĩa các API endpoints cho yêu cầu.
- `server/routes/allocations.js`: Định nghĩa các API endpoints cho cấp phát.
- `server/controllers/requestController.js`: **[QUAN TRỌNG]** Chứa logic nghiệp vụ xử lý yêu cầu, duyệt và xuất kho.
- `server/controllers/allocationController.js`: Quản lý các phiếu cấp phát đã tạo.
- `server/config/db.js`: Cấu hình kết nối cơ sở dữ liệu MySQL.
- `server/utils/notificationHelper.js`: Hỗ trợ gửi thông báo cho người dùng.

### Frontend (Client)
- `client/src/pages/RequestsPage.tsx`: Giao diện danh sách, tạo và xử lý yêu cầu.
- `client/src/pages/AllocationsPage.tsx`: Giao diện quản lý các phiếu cấp phát.
- `client/src/services/requestService.ts`: Các hàm gọi API liên quan đến yêu cầu.
- `client/src/types/index.ts`: Định nghĩa kiểu dữ liệu (Interfaces) cho Request và Allocation.

---

## 2. Luồng Xử Lý (Workflow)

Sơ đồ đường đi của dữ liệu:
**UI** (`RequestsPage.tsx`) $\rightarrow$ **Service** (`requestService.ts`) $\rightarrow$ **Route** (`routes/requests.js`) $\rightarrow$ **Controller** (`requestController.js`) $\rightarrow$ **Database** (`config/db.js`)

### Giai đoạn 1: Khởi tạo
1. Người dùng điền Form tại `RequestsPage.tsx`.
2. `requestService.createRequest` gửi dữ liệu lên Server.
3. Controller `createRequest` sinh mã phiếu (`YCCF-...`) và lưu vào DB với trạng thái `CHO_DUYET`.

### Giai đoạn 2: Phê duyệt
1. Quản lý xem danh sách và nhấn Duyệt/Từ chối.
2. Controller `approveDept` hoặc `approveManager` cập nhật trạng thái phiếu.

### Giai đoạn 3: Cấp phát (Xuất kho)
1. Thủ kho nhấn "Xử lý cấp phát".
2. Controller `processRequestItems` thực hiện:
   - Kiểm tra tồn kho trong bảng `ton_kho`.
   - Cập nhật số lượng kho (Trừ tồn kho, tăng số lượng đang dùng nếu là thiết bị Reusable).
   - Tạo phiếu cấp phát chính thức trong bảng `phieu_cap_phat`.
   - Cập nhật trạng thái phiếu yêu cầu thành `DA_CAP_PHAT`.

---

## 3. Ví dụ Minh Họa Cụ thể

**Kịch bản:** Khoa Cấp Cứu yêu cầu 02 Máy thở.

1. **Tạo:** Phiếu `YCCF-001` được tạo, trạng thái `CHO_DUYET`.
2. **Duyệt:** Trưởng khoa nhấn Duyệt $\rightarrow$ Trạng thái thành `DA_DUYET`.
3. **Cấp phát:** Thủ kho nhấn Xuất kho:
   - Kho đang có 10 máy $\rightarrow$ Cập nhật còn 8 máy.
   - Số lượng đang dùng tăng từ 0 lên 2.
   - Hệ thống tự sinh phiếu `CP-001` để theo dõi việc thu hồi sau này.
   - Phiếu `YCCF-001` chuyển sang trạng thái `DA_CAP_PHAT` (Hoàn tất).

---

## 4. Vai trò của API Service Layer (`api.ts`)

File `client/src/services/api.ts` đóng vai trò là **Cầu nối giao tiếp trung tâm**, đảm nhận các nhiệm vụ:
- **Quản lý URL tập trung:** Định nghĩa địa chỉ gốc của Backend (API_BASE).
- **Xác thực tự động:** Tự động đính kèm JWT Token vào Header của mọi yêu cầu để chứng thực người dùng.
- **Xử lý lỗi toàn cục:** Kiểm tra phản hồi từ máy chủ và trích xuất thông báo lỗi đồng nhất.
- **Chế độ Mock/Real:** Linh hoạt chuyển đổi giữa dữ liệu giả lập (localStorage) và dữ liệu thật (MySQL) tùy theo cấu hình môi trường.

---
*Ghi chú: Tài liệu này được tổng hợp để hỗ trợ việc hiểu mã nguồn và bảo trì hệ thống.*

Frontend: ReactJS, TypeScript (để tránh lỗi kiểu dữ liệu), Tailwind CSS (để giao diện đẹp/vibe).
Backend: Node.js, Express.
Database: MySQL.
Icons: Lucide-react (cho các biểu tượng đẹp).