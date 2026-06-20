import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'server', '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medequip_db',
    port: process.env.DB_PORT || 3306
};

async function migrate() {
    const conn = await mysql.createConnection(dbConfig);
    console.log('Connected to database...');

    try {
        // 1. Update thong_bao table
        console.log('Updating thong_bao table...');
        await conn.query(`
            ALTER TABLE thong_bao 
            MODIFY id INT AUTO_INCREMENT;
        `);

        // 2. Update phieu_nhap_kho
        console.log('Updating phieu_nhap_kho table...');
        await conn.query(`
            ALTER TABLE phieu_nhap_kho 
            ADD COLUMN IF NOT EXISTS tong_so_loai INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tong_so_luong INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tong_gia_tri DECIMAL(20,2) DEFAULT 0;
        `);

        // 3. Update phieu_xuat_kho
        console.log('Updating phieu_xuat_kho table...');
        await conn.query(`
            ALTER TABLE phieu_xuat_kho 
            ADD COLUMN IF NOT EXISTS tong_so_loai INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tong_so_luong INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS tong_gia_tri DECIMAL(20,2) DEFAULT 0;
        `);

        // 4. Backfill phieu_nhap_kho
        console.log('Backfilling phieu_nhap_kho...');
        const [imports] = await conn.query("SELECT ma_phieu FROM phieu_nhap_kho");
        for (const imp of imports) {
            const [details] = await conn.query(
                "SELECT COUNT(*) as loai, SUM(so_luong_giao_dich) as qty, SUM(so_luong_giao_dich * don_gia) as value FROM chi_tiet_nhap_kho WHERE ma_phieu_nhap = ?",
                [imp.ma_phieu]
            );
            if (details[0].loai > 0) {
                await conn.query(
                    "UPDATE phieu_nhap_kho SET tong_so_loai = ?, tong_so_luong = ?, tong_gia_tri = ? WHERE ma_phieu = ?",
                    [details[0].loai, details[0].qty || 0, details[0].value || 0, imp.ma_phieu]
                );
            }
        }

        // 5. Backfill phieu_xuat_kho
        console.log('Backfilling phieu_xuat_kho...');
        const [exports] = await conn.query("SELECT ma_phieu FROM phieu_xuat_kho");
        for (const exp of exports) {
             const [details] = await conn.query(
                "SELECT COUNT(*) as loai, SUM(so_luong) as qty FROM chi_tiet_xuat_kho WHERE ma_phieu_xuat = ?",
                [exp.ma_phieu]
            );
            if (details[0].loai > 0) {
                // For exports, we might not have a direct price, but we can try to join with chi_tiet_nhap_kho or thiet_bi if prices were stored there.
                // For now, let's just use 0 or try to calculate from recent imports.
                await conn.query(
                    "UPDATE phieu_xuat_kho SET tong_so_loai = ?, tong_so_luong = ? WHERE ma_phieu = ?",
                    [details[0].loai, details[0].qty || 0, exp.ma_phieu]
                );
            }
        }

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await conn.end();
    }
}

migrate();
