import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { createReturn, getAllReturns, getMyReturns, confirmReturn, deleteReturn, cancelReturn, extendReturn, approveExtension, approveReturnDept, approveReturnManager, remindOverdue } from "../controllers/returnController.js";

const router = Router();

// TK tạo phiếu trả -> Bây giờ là Trợ lý (TRO_LY) tạo
router.post("/create", authMiddleware, roleMiddleware("TRO_LY"), createReturn);

// NV_KHO xem danh sách phiếu trả
router.get("/", authMiddleware, roleMiddleware("ADMIN", "NV_KHO", "QL_KHO"), getAllReturns);

// TK xem phiếu trả của mình -> Cả TK và TRO_LY đều có thể xem
router.get("/my", authMiddleware, roleMiddleware("TRUONG_KHOA", "TRO_LY"), getMyReturns);

// Trưởng khoa duyệt
router.put("/:id/approve-dept", authMiddleware, roleMiddleware("TRUONG_KHOA"), approveReturnDept);

// Quản lý kho duyệt
router.put("/:id/approve-mgr", authMiddleware, roleMiddleware("QL_KHO"), approveReturnManager);

// NV_KHO xác nhận nhận thiết bị
router.put("/:id/confirm", authMiddleware, roleMiddleware("NV_KHO"), confirmReturn);

// Xóa (ẩn) phiếu trả
router.delete("/:id", authMiddleware, roleMiddleware("QL_KHO"), deleteReturn);

// Hủy yêu cầu trả (chỉ dành cho Trợ lý)
router.post("/:id/cancel", authMiddleware, roleMiddleware("TRO_LY"), cancelReturn);

// Gia hạn
router.post("/extend", authMiddleware, roleMiddleware("TRUONG_KHOA", "TRO_LY"), extendReturn);
router.post("/approve-extension", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), approveExtension);
// Nhắc nhở quá hạn
router.post("/remind", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), remindOverdue);

export default router;
