import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { getAllRequests, createRequest, approveDept, approveManager, scanRequest, processRequestItems, confirmReceived, deleteRequest, cancelRequest } from "../controllers/requestController.js";

const router = Router();

router.get("/", authMiddleware, getAllRequests);
router.post("/", authMiddleware, createRequest);
router.put("/:id/approve-dept", authMiddleware, roleMiddleware("TRUONG_KHOA", "QL_KHO"), approveDept);
router.put("/:id/approve-mgr", authMiddleware, roleMiddleware("QL_KHO"), approveManager);
router.get("/:id/scan", authMiddleware, scanRequest);
router.post("/:id/process-items", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), processRequestItems);
router.put("/:id/confirm", authMiddleware, confirmReceived);

router.put("/:id/cancel", authMiddleware, cancelRequest);
router.delete("/:id", authMiddleware, roleMiddleware("QL_KHO"), deleteRequest);

export default router;
