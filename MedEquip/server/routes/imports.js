import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import multer from "multer";
import {
  getAllImports, deleteImport, deleteMultipleImports,
  parseExcelPreview, confirmImportFromExcel, downloadTemplate,
  approveImport
} from "../controllers/importController.js";

const router = Router();

// Multer: lưu trong bộ nhớ, không ghi ra ổ đĩa
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Lịch sử nhập kho
router.get("/", authMiddleware, getAllImports);

// Xóa lịch sử (Admin/QL_KHO)
router.delete("/:id", authMiddleware, roleMiddleware("QL_KHO"), deleteImport);

// Xóa nhiều phiếu (Admin/QL_KHO)
router.post("/delete-multiple", authMiddleware, roleMiddleware("QL_KHO"), deleteMultipleImports);

// Upload Excel → preview (chưa nhập vào DB)
router.post("/from-excel", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), upload.single("file"), parseExcelPreview);

// Xác nhận nhập kho từ preview đã duyệt (Hoặc lập phiếu chờ duyệt cho NV_KHO)
router.post("/confirm", authMiddleware, roleMiddleware("NV_KHO", "QL_KHO"), confirmImportFromExcel);

// Duyệt nhập kho (Admin/QL_KHO)
router.put("/approval/:id", authMiddleware, roleMiddleware("QL_KHO"), approveImport);

// Tải file Excel mẫu
router.get("/template", authMiddleware, downloadTemplate);

export default router;
