-- ============================================
-- MedEquip Database v4 — MySQL
-- Hệ thống Quản lý Kho Thiết bị Y tế Bệnh viện
-- ============================================

CREATE DATABASE IF NOT EXISTS medequip_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medequip_db;

-- 1. Bảng Khoa (Cần tạo trước vì nhiều bảng khác tham chiếu tới)
CREATE TABLE IF NOT EXISTS khoa (
    ma_khoa VARCHAR(20) PRIMARY KEY,
    ten_khoa VARCHAR(100) NOT NULL,
    mo_ta TEXT,
    trang_thai BOOLEAN DEFAULT TRUE,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Bảng Nhà cung cấp
CREATE TABLE IF NOT EXISTS nha_cung_cap (
    ma_nha_cung_cap VARCHAR(20) PRIMARY KEY,
    ten_nha_cung_cap VARCHAR(200) NOT NULL,
    dia_chi TEXT,
    so_dien_thoai VARCHAR(20),
    email VARCHAR(100),
    trang_thai BOOLEAN DEFAULT TRUE,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Bảng Người dùng (Tham chiếu tới Bảng Khoa)
CREATE TABLE IF NOT EXISTS nguoi_dung (
    ma_nguoi_dung VARCHAR(20) PRIMARY KEY,
    ho_ten VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    mat_khau VARCHAR(255) NOT NULL,
    vai_tro ENUM('ADMIN','NV_KHO','TRUONG_KHOA','QL_KHO') NOT NULL DEFAULT 'TRUONG_KHOA',
    ma_khoa VARCHAR(20) NULL,
    trang_thai BOOLEAN DEFAULT TRUE,
    so_lan_dang_nhap_sai INT DEFAULT 0,
    khoa_den DATETIME NULL,
    so_dien_thoai VARCHAR(20) NULL,
    dia_chi TEXT NULL,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ma_khoa) REFERENCES khoa(ma_khoa)
);

-- 4. Bảng Thiết bị (Tham chiếu tới Nhà cung cấp)
CREATE TABLE IF NOT EXISTS thiet_bi (
    ma_thiet_bi VARCHAR(20) PRIMARY KEY,
    ten_thiet_bi VARCHAR(200) NOT NULL,
    loai_thiet_bi ENUM('VAT_TU_TIEU_HAO', 'TAI_SU_DUNG') NOT NULL DEFAULT 'TAI_SU_DUNG',
    don_vi_co_so VARCHAR(50) DEFAULT 'Cái',
    don_vi_nhap VARCHAR(50) DEFAULT 'Hộp',
    he_so_quy_doi INT DEFAULT 1 COMMENT '1 hộp = N cái',
    serial_number VARCHAR(100) DEFAULT NULL COMMENT 'Chỉ dùng cho TAI_SU_DUNG',
    nguong_canh_bao INT DEFAULT 10 COMMENT 'Cảnh báo khi tồn kho xuống dưới mức này',
    mo_ta TEXT,
    ma_nha_cung_cap VARCHAR(20),
    hinh_anh VARCHAR(500) DEFAULT NULL COMMENT 'URL ảnh từ internet',
    trang_thai BOOLEAN DEFAULT TRUE,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ma_nha_cung_cap) REFERENCES nha_cung_cap(ma_nha_cung_cap)
);

-- 5. Bảng Tồn kho
CREATE TABLE IF NOT EXISTS ton_kho (
    ma_ton_kho VARCHAR(20) PRIMARY KEY,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    so_luong_kho INT DEFAULT 0,
    so_luong_hu INT DEFAULT 0,
    so_luong_dang_dung INT DEFAULT 0,
    ngay_cap_nhat DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi)
);

-- 6. Bảng Phiếu yêu cầu cấp phát
CREATE TABLE IF NOT EXISTS phieu_yeu_cau (
    ma_phieu VARCHAR(30) PRIMARY KEY,
    ma_nguoi_yeu_cau VARCHAR(20) NOT NULL,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    ma_khoa VARCHAR(20) NOT NULL,
    so_luong_yeu_cau INT NOT NULL,
    ly_do TEXT,
    trang_thai ENUM('CHO_DUYET','DA_DUYET','TU_CHOI','DA_CAP_PHAT') DEFAULT 'CHO_DUYET',
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_duyet DATETIME NULL,
    nguoi_duyet VARCHAR(20) NULL,
    ly_do_tu_choi TEXT NULL,
    ma_phieu_cap_phat_cu VARCHAR(30) NULL COMMENT 'Dùng khi yêu cầu GIA HẠN',
    FOREIGN KEY (ma_nguoi_yeu_cau) REFERENCES nguoi_dung(ma_nguoi_dung),
    FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi),
    FOREIGN KEY (ma_khoa) REFERENCES khoa(ma_khoa)
);

CREATE TABLE IF NOT EXISTS chi_tiet_yeu_cau (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu_yeu_cau VARCHAR(30) NOT NULL,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    so_luong INT NOT NULL,
    don_vi_tinh VARCHAR(50) DEFAULT 'Cái',
    so_luong_co_so INT NOT NULL,
    trang_thai ENUM('CHO_DUYET','DA_DUYET','TU_CHOI') DEFAULT 'CHO_DUYET',
    ly_do_tu_choi TEXT NULL,
    ngay_tra_du_kien DATE NULL,
    FOREIGN KEY (ma_phieu_yeu_cau) REFERENCES phieu_yeu_cau(ma_phieu),
    FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi)
);

-- 7. Bảng Phiếu cấp phát
CREATE TABLE IF NOT EXISTS phieu_cap_phat (
    ma_phieu VARCHAR(30) PRIMARY KEY,
    ma_phieu_yeu_cau VARCHAR(30) NOT NULL,
    ma_nguoi_cap VARCHAR(20) NOT NULL,
    ma_khoa_nhan VARCHAR(20) NOT NULL,
    ngay_cap DATETIME DEFAULT CURRENT_TIMESTAMP,
    ghi_chu TEXT,
    FOREIGN KEY (ma_phieu_yeu_cau) REFERENCES phieu_yeu_cau(ma_phieu),
    FOREIGN KEY (ma_nguoi_cap) REFERENCES nguoi_dung(ma_nguoi_dung),
    FOREIGN KEY (ma_khoa_nhan) REFERENCES khoa(ma_khoa)
);

CREATE TABLE IF NOT EXISTS chi_tiet_cap_phat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu_cap_phat VARCHAR(30) NOT NULL,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    so_luong INT NOT NULL,
    don_vi_tinh VARCHAR(50) DEFAULT 'Cái',
    so_luong_co_so INT NOT NULL,
    ngay_tra_du_kien DATE DEFAULT NULL,
    trang_thai_tra ENUM('CHUA_TRA', 'YEU_CAU_TRA', 'DA_TRA', 'DA_GIA_HAN') DEFAULT 'CHUA_TRA',
    ly_do_gia_han TEXT DEFAULT NULL,
    FOREIGN KEY (ma_phieu_cap_phat) REFERENCES phieu_cap_phat(ma_phieu),
    FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi)
);

-- 8. Bảng Phiếu nhập kho
CREATE TABLE IF NOT EXISTS phieu_nhap_kho (
    ma_phieu VARCHAR(30) PRIMARY KEY,
    ma_nguoi_nhap VARCHAR(20) NOT NULL,
    ma_nha_cung_cap VARCHAR(20) NOT NULL,
    ngay_nhap DATETIME DEFAULT CURRENT_TIMESTAMP,
    ghi_chu TEXT,
    trang_thai ENUM('CHO_DUYET', 'DA_DUYET', 'TU_CHOI') DEFAULT 'CHO_DUYET',
    nguoi_duyet VARCHAR(20) DEFAULT NULL,
    ly_do_tu_choi TEXT DEFAULT NULL,
    ngay_duyet DATETIME DEFAULT NULL,
    tong_so_loai INT DEFAULT 0,
    tong_so_luong INT DEFAULT 0,
    tong_gia_tri DECIMAL(20,2) DEFAULT 0,
    chung_tu_dinh_kem LONGTEXT DEFAULT NULL,
    FOREIGN KEY (ma_nguoi_nhap) REFERENCES nguoi_dung(ma_nguoi_dung),
    FOREIGN KEY (ma_nha_cung_cap) REFERENCES nha_cung_cap(ma_nha_cung_cap)
);

CREATE TABLE IF NOT EXISTS chi_tiet_nhap_kho (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu_nhap VARCHAR(30) NOT NULL,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    so_luong_giao_dich INT NOT NULL,
    so_luong_co_so INT NULL,
    don_gia DECIMAL(15,2) DEFAULT 0,
    don_vi_giao_dich VARCHAR(50) DEFAULT 'Cái',
    so_lo VARCHAR(50) NULL,
    han_su_dung DATE NULL,
    url_anh VARCHAR(500) DEFAULT NULL COMMENT 'URL ảnh từ internet',
    FOREIGN KEY (ma_phieu_nhap) REFERENCES phieu_nhap_kho(ma_phieu),
    FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi)
);

-- 9. Bảng Phiếu xuất kho
CREATE TABLE IF NOT EXISTS phieu_xuat_kho (
    ma_phieu VARCHAR(30) PRIMARY KEY,
    ma_nguoi_xuat VARCHAR(20) NOT NULL,
    ma_khoa_nhan VARCHAR(20) NULL,
    ngay_xuat DATETIME DEFAULT CURRENT_TIMESTAMP,
    ly_do TEXT,
    ghi_chu TEXT,
    trang_thai ENUM('DA_LAP','DA_XUAT','DA_HUY') DEFAULT 'DA_LAP',
    nguoi_duyet VARCHAR(20) DEFAULT NULL,
    ngay_duyet DATETIME NULL,
    tong_so_loai INT DEFAULT 0,
    tong_so_luong INT DEFAULT 0,
    tong_gia_tri DECIMAL(20,2) DEFAULT 0,
    chung_tu_dinh_kem LONGTEXT DEFAULT NULL,
    FOREIGN KEY (ma_nguoi_xuat) REFERENCES nguoi_dung(ma_nguoi_dung)
);

CREATE TABLE IF NOT EXISTS chi_tiet_xuat_kho (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu_xuat VARCHAR(30) NOT NULL,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    don_vi_tinh VARCHAR(50) DEFAULT 'Cái',
    so_luong_giao_dich INT NOT NULL,
    so_luong_co_so INT NOT NULL,
    so_luong INT NOT NULL,
    FOREIGN KEY (ma_phieu_xuat) REFERENCES phieu_xuat_kho(ma_phieu),
    FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi)
);

-- 10. Bảng Báo hư hỏng
CREATE TABLE IF NOT EXISTS phieu_bao_hu_hong (
    ma_phieu VARCHAR(30) PRIMARY KEY,
    ma_nguoi_bao VARCHAR(20) NOT NULL,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    ma_khoa VARCHAR(20),
    mo_ta TEXT NOT NULL,
    so_luong_hu INT DEFAULT 1,
    muc_do ENUM('NHE','TRUNG_BINH','NANG') DEFAULT 'TRUNG_BINH',
    trang_thai ENUM('CHO_XU_LY','DANG_XU_LY','DA_XU_LY') DEFAULT 'CHO_XU_LY',
    hinh_anh LONGTEXT,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_xu_ly DATETIME NULL,
    nguoi_xu_ly VARCHAR(20) NULL,
    ket_qua_xu_ly TEXT NULL,
    FOREIGN KEY (ma_nguoi_bao) REFERENCES nguoi_dung(ma_nguoi_dung),
    FOREIGN KEY (ma_thiet_bi) REFERENCES thiet_bi(ma_thiet_bi),
    FOREIGN KEY (ma_khoa) REFERENCES khoa(ma_khoa)
);

-- 11. Bảng Thông báo
CREATE TABLE IF NOT EXISTS thong_bao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tieu_de VARCHAR(200) NOT NULL,
    noi_dung TEXT NOT NULL,
    loai ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    nguoi_nhan VARCHAR(20) NOT NULL,
    da_doc BOOLEAN DEFAULT FALSE,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (nguoi_nhan) REFERENCES nguoi_dung(ma_nguoi_dung)
);

-- 12. Bảng Phiếu trả thiết bị
CREATE TABLE IF NOT EXISTS phieu_tra_thiet_bi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu_tra VARCHAR(50) UNIQUE NOT NULL,
    ma_phieu_cap_phat VARCHAR(30) NOT NULL,
    ma_truong_khoa VARCHAR(20) NOT NULL,
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    trang_thai ENUM('CHO_XAC_NHAN', 'DA_TRA', 'TU_CHOI', 'HUY') DEFAULT 'CHO_XAC_NHAN',
    qr_data TEXT COMMENT 'JSON encode danh sách thiết bị trả',
    ghi_chu TEXT,
    FOREIGN KEY (ma_phieu_cap_phat) REFERENCES phieu_cap_phat(ma_phieu),
    FOREIGN KEY (ma_truong_khoa) REFERENCES nguoi_dung(ma_nguoi_dung)
);

CREATE TABLE IF NOT EXISTS chi_tiet_phieu_tra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ma_phieu_tra INT NOT NULL,
    ma_thiet_bi VARCHAR(20) NOT NULL,
    so_luong INT NOT NULL DEFAULT 1,
    don_vi_tinh VARCHAR(50) DEFAULT 'Cái',
    so_luong_co_so INT NOT NULL DEFAULT 1,
    tinh_trang_khi_tra ENUM('NGUYEN_SEAL', 'DA_BOC_SEAL', 'HONG') DEFAULT 'DA_BOC_SEAL',
    anh_chung_minh LONGTEXT COMMENT 'URL hoặc Base64 ảnh chứng minh',
    FOREIGN KEY (ma_phieu_tra) REFERENCES phieu_tra_thiet_bi(id)
);

-- 13. Bảng Phiếu yêu cầu nhập
CREATE TABLE IF NOT EXISTS phieu_yeu_cau_nhap (
    ma_phieu VARCHAR(30) PRIMARY KEY,
    ma_nguoi_yeu_cau VARCHAR(20) NOT NULL,
    ten_thiet_bi VARCHAR(200) NOT NULL,
    loai_thiet_bi VARCHAR(50),
    don_vi_tinh VARCHAR(20),
    so_luong INT NOT NULL,
    muc_dich_su_dung TEXT,
    trang_thai ENUM('CHO_DUYET','DA_DUYET','TU_CHOI','DA_NHAP') DEFAULT 'CHO_DUYET',
    ngay_tao DATETIME DEFAULT CURRENT_TIMESTAMP,
    ngay_duyet DATETIME NULL,
    nguoi_duyet VARCHAR(20) NULL,
    ly_do_tu_choi TEXT NULL,
    FOREIGN KEY (ma_nguoi_yeu_cau) REFERENCES nguoi_dung(ma_nguoi_dung),
    FOREIGN KEY (nguoi_duyet) REFERENCES nguoi_dung(ma_nguoi_dung)
);

-- ============================================
-- DỮ LIỆU MẪU (mật khẩu: 123456)
-- ============================================

INSERT IGNORE INTO khoa (ma_khoa, ten_khoa, mo_ta) VALUES
('K-001', 'Khoa Nội', 'Khoa Nội tổng hợp'),
('K-002', 'Khoa Ngoại', 'Khoa Ngoại tổng hợp'),
('K-003', 'Khoa Sản', 'Khoa Sản phụ khoa'),
('K-004', 'Khoa Nhi', 'Khoa Nhi đồng'),
('K-005', 'Khoa Cấp cứu', 'Khoa Cấp cứu và hồi sức');

INSERT IGNORE INTO nguoi_dung (ma_nguoi_dung, ho_ten, email, mat_khau, vai_tro, ma_khoa) VALUES
('ND-001', 'Nguyễn Văn Admin', 'admin@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'ADMIN', NULL),
('ND-002', 'Trần Thị Kho', 'kho@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'NV_KHO', NULL),
('ND-003', 'Trưởng khoa Nội', 'khoanoi@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'TRUONG_KHOA', 'K-001'),
('ND-004', 'Trưởng khoa Ngoại', 'khoangoai@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'TRUONG_KHOA', 'K-002'),
('ND-005', 'Trưởng khoa Sản', 'khoasan@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'TRUONG_KHOA', 'K-003'),
('ND-006', 'Lê Văn Quản Lý', 'qlkho@benhvien.vn', '$2b$10$z04YEefPoGr2UnW5g.aS9uGaSqO0I.PelKqY0FH4nNVSs9M/W3VP.', 'QL_KHO', NULL);

INSERT IGNORE INTO nha_cung_cap (ma_nha_cung_cap, ten_nha_cung_cap, dia_chi, so_dien_thoai) VALUES
('NCC-001', 'Công ty Phương Nam', '123 Đường ABC, Quận 1, TP.HCM', '02838000001'),
('NCC-002', 'Công ty thiết bị Việt', '456 Đường XYZ, Hà Nội', '02439000002');


INSERT IGNORE INTO thiet_bi (ma_thiet_bi, ten_thiet_bi, loai_thiet_bi, don_vi_co_so, don_vi_nhap, ma_nha_cung_cap) VALUES
('TB-001', 'Máy đo huyết áp', 'TAI_SU_DUNG', 'Cái', 'Hộp', 'NCC-001'),
('TB-002', 'Ống nghe y khoa', 'TAI_SU_DUNG', 'Cái', 'Hộp', 'NCC-001'),
('TB-003', 'Máy siêu âm', 'TAI_SU_DUNG', 'Bộ', 'Bộ', 'NCC-002');

INSERT IGNORE INTO ton_kho (ma_ton_kho, ma_thiet_bi, so_luong_kho, so_luong_hu, so_luong_dang_dung) VALUES
('TK-001', 'TB-001', 50, 0, 30),
('TK-002', 'TB-002', 100, 0, 80),
('TK-003', 'TB-003', 10, 0, 5);

INSERT IGNORE INTO thong_bao (tieu_de, noi_dung, loai, nguoi_nhan, da_doc) VALUES
('Hệ thống đã nâng cấp', 'MedEquip đã được cập nhật lên v4.', 'info', 'ND-001', FALSE);
