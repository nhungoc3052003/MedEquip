import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getAllDamageReports, createDamageReport, resolveDamageReport } from "../controllers/damageReportController.js";

const router = Router();

router.get("/", authMiddleware, getAllDamageReports);
router.post("/", authMiddleware, createDamageReport);
router.put("/:id/resolve", authMiddleware, resolveDamageReport);

export default router;
