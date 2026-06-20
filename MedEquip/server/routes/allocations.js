import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { getAllAllocations, createAllocation, extendRequest, extendApprove, consumeAllocation } from "../controllers/allocationController.js";

const router = Router();

router.get("/", authMiddleware, getAllAllocations);
router.post("/", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), createAllocation);

// TK gửi yêu cầu gia hạn
router.post("/:id/extend-request", authMiddleware, roleMiddleware("TRUONG_KHOA"), extendRequest);

// NV_KHO chấp nhận/từ chối gia hạn
router.put("/:id/extend-approve", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), extendApprove);
// TK xác nhận tiêu hao (TRO_LY cũng được phép)
router.put("/:id/consume", authMiddleware, roleMiddleware("TRUONG_KHOA", "TRO_LY"), consumeAllocation);

export default router;
