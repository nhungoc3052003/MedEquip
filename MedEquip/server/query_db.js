import { pool } from "./config/db.js";

async function queryDB() {
  try {
    const [rows] = await pool.query("SELECT id, anh_chung_minh FROM chi_tiet_phieu_tra ORDER BY id DESC LIMIT 5");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit(0);
  }
}

queryDB();
