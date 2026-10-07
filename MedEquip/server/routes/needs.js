import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getAllNeeds, createNeed, closeNeed, reopenNeed } from "../controllers/needsController.js";

const router = Router();

router.get("/", authMiddleware, getAllNeeds);
router.post("/", authMiddleware, createNeed);
router.put("/:id/close", authMiddleware, closeNeed);
router.put("/:id/reopen", authMiddleware, reopenNeed);

export default router;

