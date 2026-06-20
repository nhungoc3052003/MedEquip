import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { getAllExports, exportToExcel, createExportManual, approveExport } from "../controllers/exportController.js";

const router = Router();

// Lấy lịch sử xuất kho
router.get("/", authMiddleware, getAllExports);

// Xuất lịch sử ra file Excel (Hỗ trợ lọc theo danh sách ID)
router.post("/excel", authMiddleware, exportToExcel);

// Tạo phiếu xuất kho thủ công qua form UI (Hoặc lập phiếu chờ duyệt cho NV_KHO)
router.post("/", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), createExportManual);

// Xóa nhiều phiếu xuất
import { deleteMultipleExports } from "../controllers/exportController.js";
router.post("/delete-multiple", authMiddleware, roleMiddleware("QL_KHO"), deleteMultipleExports);


// Duyệt hoặc hủy phiếu xuất kho (Admin/QL_KHO)
router.put("/approval/:id", authMiddleware, roleMiddleware("QL_KHO"), approveExport);

export default router;
