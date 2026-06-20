import { Router } from "express";
import { authMiddleware, roleMiddleware } from "../middleware/auth.js";
import { getAllSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../controllers/supplierController.js";

const router = Router();

router.get("/", authMiddleware, getAllSuppliers);
router.post("/", authMiddleware, roleMiddleware("QL_KHO"), createSupplier);
router.put("/:id", authMiddleware, roleMiddleware("QL_KHO"), updateSupplier);
router.delete("/:id", authMiddleware, roleMiddleware("QL_KHO"), deleteSupplier);

export default router;
