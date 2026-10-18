import { pool } from "./config/db.js";

export function detectNhomThietBi(tenThietBi = "", loaiThietBi = "TAI_SU_DUNG", nhomProvided = "") {
  if (nhomProvided && ['KHAM_BENH', 'PHAU_THUAT', 'CAP_CUU', 'VAT_TU_TIEU_HAO', 'KHAC'].includes(nhomProvided)) {
    return nhomProvided;
  }
  if (loaiThietBi === "VAT_TU_TIEU_HAO") {
    return "VAT_TU_TIEU_HAO";
  }

  const name = (tenThietBi || "").toLowerCase();

  // 1. Phẫu thuật & Ngoại khoa
  if (/(phẫu thuật|dao mổ|kẹp|forceps|scalpel|hút dịch phẫu thuật|tiểu phẫu|phong mổ)/i.test(name)) {
    return "PHAU_THUAT";
  }

  // 2. Cấp cứu & Hồi sức (ICU)
  if (/(thở|ventilator|phá rung|sốc tim|aed|monitor|theo dõi|bơm tiêm điện|oxy|giường bệnh|hồi sức|cấp cứu)/i.test(name)) {
    return "CAP_CUU";
  }

  // 3. Khám & Chẩn đoán
  if (/(khám|siêu âm|x-quang|điện tim|ecg|huyết áp|ống nghe|nội soi|chẩn đoán|thân nhiệt)/i.test(name)) {
    return "KHAM_BENH";
  }

  return "KHAC";
}

async function migrate() {
  console.log("🚀 Starting equipment category migration...");

  // 1. Add column nhom_thiet_bi if not exists
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'thiet_bi' AND COLUMN_NAME = 'nhom_thiet_bi'`
  );

  if (cols.length === 0) {
    console.log("Adding column nhom_thiet_bi to table thiet_bi...");
    await pool.query(
      `ALTER TABLE thiet_bi ADD COLUMN nhom_thiet_bi VARCHAR(50) DEFAULT 'KHAC' AFTER loai_thiet_bi`
    );
    console.log("✅ Column nhom_thiet_bi added successfully.");
  } else {
    console.log("ℹ️ Column nhom_thiet_bi already exists.");
  }

  // 2. Update existing equipment with smart categories
  const [equipments] = await pool.query("SELECT ma_thiet_bi, ten_thiet_bi, loai_thiet_bi FROM thiet_bi");
  console.log(`Classifying ${equipments.length} equipments in database...`);

  for (const eq of equipments) {
    const nhom = detectNhomThietBi(eq.ten_thiet_bi, eq.loai_thiet_bi);
    await pool.query(
      "UPDATE thiet_bi SET nhom_thiet_bi = ? WHERE ma_thiet_bi = ?",
      [nhom, eq.ma_thiet_bi]
    );
    console.log(`- [${nhom}] ${eq.ma_thiet_bi}: ${eq.ten_thiet_bi}`);
  }

  console.log("🎉 Migration completed successfully!");
  process.exit(0);
}

migrate().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
