import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { login, logout, changePassword, getMe } from "../controllers/authController.js";

const router = Router();

router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getMe);
router.put("/change-password", authMiddleware, changePassword);

export default router;
