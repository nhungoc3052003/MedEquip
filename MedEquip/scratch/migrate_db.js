import { pool } from "../server/config/db.js";

async function migrate() {
  try {
    console.log("Starting migration...");
    const columns = [
      "ADD COLUMN nguoi_duyet VARCHAR(20) DEFAULT NULL",
      "ADD COLUMN ly_do_tu_choi TEXT DEFAULT NULL",
      "ADD COLUMN ngay_duyet DATETIME DEFAULT NULL"
    ];

    for (const col of columns) {
      try {
        await pool.query(`ALTER TABLE phieu_xuat_kho ${col}`);
        console.log(`Successfully added: ${col.split(' ')[2]}`);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          console.log(`Column ${col.split(' ')[2]} already exists.`);
        } else {
          throw e;
        }
      }
    }
    console.log("Migration successful!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
