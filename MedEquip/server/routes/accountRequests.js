import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { uploadProfileDocs } from "../middleware/upload.js";
import {
  getAllAccountRequests,
  createAccountRequest,
  approveAccountRequest,
  rejectAccountRequest,
  resendUserCredentials,
} from "../controllers/accountRequestController.js";

const router = Router();

// Lấy danh sách yêu cầu cấp tài khoản (Admin lấy hết, Khoa lấy theo khoa)
router.get("/", authMiddleware, getAllAccountRequests);

// Gửi yêu cầu cấp tài khoản mới (Hỗ trợ upload kèm file hồ sơ)
router.post("/", authMiddleware, uploadProfileDocs.array("files", 5), createAccountRequest);

// Phê duyệt và khởi tạo tài khoản (Admin)
router.put("/:id/approve", authMiddleware, roleMiddleware("ADMIN"), approveAccountRequest);

// Từ chối yêu cầu (Admin)
router.put("/:id/reject", authMiddleware, roleMiddleware("ADMIN"), rejectAccountRequest);

// Cấp lại mật khẩu tạm thời & gửi email (Admin)
router.post("/resend-credentials/:id", authMiddleware, roleMiddleware("ADMIN"), resendUserCredentials);

export default router;
