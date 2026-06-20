import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { getAllUsers, getUserById, createUser, updateUser, deactivateUser, activateUser, changeUserRole, deleteUser } from "../controllers/userController.js";

const router = Router();

router.get("/", authMiddleware, getAllUsers);
router.get("/:id", authMiddleware, getUserById);
router.post("/", authMiddleware, roleMiddleware("ADMIN"), createUser);
router.put("/:id", authMiddleware, updateUser);
router.put("/:id/deactivate", authMiddleware, roleMiddleware("ADMIN"), deactivateUser);
router.put("/:id/activate", authMiddleware, roleMiddleware("ADMIN"), activateUser);
router.put("/:id/role", authMiddleware, roleMiddleware("ADMIN"), changeUserRole);
router.delete("/:id", authMiddleware, roleMiddleware("ADMIN"), deleteUser);

export default router;
