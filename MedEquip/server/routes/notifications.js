import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getUserNotifications, markAsRead, markAllAsRead, triggerCheckDueNotifications } from "../controllers/notificationController.js";

const router = Router();

router.get("/", authMiddleware, getUserNotifications);
router.post("/check-due", authMiddleware, triggerCheckDueNotifications);
router.put("/read-all", authMiddleware, markAllAsRead);
router.put("/:id/read", authMiddleware, markAsRead);

export default router;
