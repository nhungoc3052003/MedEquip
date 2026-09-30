import { pool } from "./db.js";

async function addColumns() {
  try {
    await pool.query("ALTER TABLE phieu_cap_phat ADD COLUMN IF NOT EXISTS anh_minh_chung LONGTEXT;");
    console.log("Added anh_minh_chung to phieu_cap_phat");
  } catch (err) {
    console.log("Error phieu_cap_phat:", err.message);
  }

  try {
    await pool.query("ALTER TABLE phieu_tra_thiet_bi ADD COLUMN IF NOT EXISTS anh_minh_chung LONGTEXT;");
    console.log("Added anh_minh_chung to phieu_tra_thiet_bi");
  } catch (err) {
    console.log("Error phieu_tra_thiet_bi:", err.message);
  }

  process.exit();
}

addColumns();
