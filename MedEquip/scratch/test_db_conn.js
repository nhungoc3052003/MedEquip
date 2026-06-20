import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config({ path: "./server/.env" });

async function testConnection() {
  console.log("Testing connection with:");
  console.log("Host:", process.env.DB_HOST);
  console.log("User:", process.env.DB_USER);
  console.log("Password:", process.env.DB_PASSWORD ? "****" : "(empty)");
  console.log("Database:", process.env.DB_NAME);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "medequip_db",
      port: parseInt(process.env.DB_PORT || "3306")
    });
    console.log("✅ Success! Connection established.");
    await connection.end();
  } catch (err) {
    console.error("❌ Connection failed:");
    console.error(err);
  }
}

testConnection();
