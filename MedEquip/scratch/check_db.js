
import mysql from "mysql2/promise";

async function checkData() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "3107",
    database: "medequip_db",
    port: 3307
  });

  console.log("--- THIET BI ---");
  const [thietBi] = await connection.query("SELECT ma_thiet_bi, ten_thiet_bi, don_vi_nhap, don_vi_co_so, he_so_quy_doi FROM thiet_bi");
  console.table(thietBi);

  console.log("--- CHI TIET NHAP KHO ---");
  const [nhapKho] = await connection.query("SELECT ma_thiet_bi, so_luong_giao_dich, so_luong_co_so, don_vi_giao_dich FROM chi_tiet_nhap_kho LIMIT 10");
  console.table(nhapKho);

  await connection.end();
}

checkData().catch(console.error);
