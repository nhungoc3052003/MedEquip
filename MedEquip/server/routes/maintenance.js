import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import {
  getAllMaintenance,
  startMaintenance,
  completeMaintenance,
  getMaintenanceHistory,
  saveOrUpdateMaintenanceRecord
} from "../controllers/maintenanceController.js";

const router = Router();

// GET /api/maintenance — Danh sách thiết bị và trạng thái bảo trì
router.get("/", authMiddleware, getAllMaintenance);

// POST /api/maintenance/start — Đưa vào bảo trì
router.post("/start", authMiddleware, roleMiddleware("ADMIN", "NV_KHO", "QL_KHO"), startMaintenance);

// POST /api/maintenance/complete — Nghiệm thu bảo trì
router.post("/complete", authMiddleware, roleMiddleware("ADMIN", "NV_KHO", "QL_KHO"), completeMaintenance);

// GET /api/maintenance/history/:maThietBi — Xem lịch sử bảo trì
router.get("/history/:maThietBi", authMiddleware, getMaintenanceHistory);

// PUT /api/maintenance/record — Cập nhật/Lưu biên bản bàn giao & nghiệm thu (chỉ Kỹ thuật / Quản lý kho)
router.put("/record", authMiddleware, roleMiddleware("ADMIN", "NV_KHO", "QL_KHO"), saveOrUpdateMaintenanceRecord);

export default router;
