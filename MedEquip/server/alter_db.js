import { pool } from "./config/db.js";

async function run() {
  try {
    await pool.query("ALTER TABLE phieu_tra_thiet_bi MODIFY COLUMN trang_thai ENUM('CHO_TRUONG_KHOA_DUYET', 'CHO_QL_KHO_DUYET', 'CHO_XAC_NHAN', 'DA_TRA', 'TU_CHOI', 'HUY') DEFAULT 'CHO_TRUONG_KHOA_DUYET'");
    console.log("Success");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
