import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getDashboard, getInventoryReport } from "../controllers/reportController.js";

const router = Router();

router.get("/dashboard", authMiddleware, getDashboard);
router.get("/inventory", authMiddleware, getInventoryReport);

export default router;
