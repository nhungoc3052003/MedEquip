import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getUserNotifications, markAsRead, markAllAsRead } from "../controllers/notificationController.js";

const router = Router();

router.get("/", authMiddleware, getUserNotifications);
router.put("/read-all", authMiddleware, markAllAsRead);
router.put("/:id/read", authMiddleware, markAsRead);

export default router;
