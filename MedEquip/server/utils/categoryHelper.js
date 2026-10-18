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
