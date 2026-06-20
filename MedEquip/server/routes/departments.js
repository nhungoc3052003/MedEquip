import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment } from "../controllers/departmentController.js";

const router = Router();

router.get("/", authMiddleware, getAllDepartments);
router.post("/", authMiddleware, roleMiddleware("QL_KHO"), createDepartment);
router.put("/:id", authMiddleware, roleMiddleware("QL_KHO"), updateDepartment);
router.delete("/:id", authMiddleware, roleMiddleware("QL_KHO"), deleteDepartment);

export default router;
