import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getAllInventory, getLowStock } from "../controllers/inventoryController.js";

const router = Router();

router.get("/", authMiddleware, getAllInventory);
router.get("/low-stock", authMiddleware, getLowStock);

export default router;
