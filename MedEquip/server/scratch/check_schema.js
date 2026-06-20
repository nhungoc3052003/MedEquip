import { pool } from '../config/db.js';

async function check() {
  try {
    const [rows] = await pool.query("SHOW CREATE TABLE phieu_yeu_cau");
    console.log(rows[0]['Create Table']);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
