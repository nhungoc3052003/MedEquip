import express from "express";
import { 
  getAllInstances, 
  lookupInstance, 
  getAvailableInstances, 
  getDepartmentInstances 
} from "../controllers/instanceController.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getAllInstances);
router.get("/lookup/:code", lookupInstance);
router.get("/available/:maThietBi", getAvailableInstances);
router.get("/department/:maKhoa", getDepartmentInstances);

export default router;
