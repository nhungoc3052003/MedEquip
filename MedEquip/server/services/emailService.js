import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

/**
 * Khởi tạo transporter với Gmail SMTP
 */
function getTransporter() {
  dotenv.config();
  const user = process.env.SMTP_USER || "nhungoc3052003@gmail.com";
  const pass = process.env.SMTP_PASS || "faloulporgzvjlkx";

  if (user && pass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user,
        pass,
      },
    });
  }
  return null;
}

/**
 * Gửi email thông báo cấp tài khoản mới
 */
export async function sendAccountProvisioningEmail({
  toEmail,
  fullName,
  username,
  tempPassword,
  roleName,
  departmentName,
}) {
  const subject = `[MedEquip] Thông báo cấp tài khoản hệ thống quản lý thiết bị y tế`;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="background-color: #0284c7; padding: 20px; text-align: center; color: white;">
        <h2 style="margin: 0; font-size: 22px;">BỆNH VIỆN ĐA KHOA - HỆ THỐNG MEDEQUIP</h2>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Hệ thống Quản lý & Điều phối Trang thiết bị Y tế</p>
      </div>

      <div style="padding: 24px;">
        <p>Kính gửi <strong>${fullName}</strong>,</p>
        <p>Tài khoản công tác của bạn trên Hệ thống <strong>MedEquip</strong> đã được Ban Quản trị phê duyệt và khởi tạo thành công theo đề xuất từ khoa/phòng.</p>

        <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 16px; margin: 20px 0; border-radius: 4px;">
          <h4 style="margin: 0 0 10px; color: #0f172a;">Thông tin tài khoản đăng nhập:</h4>
          <p style="margin: 4px 0;"><strong>Khoa/Phòng:</strong> ${departmentName || "Ban quản trị / Kho"}</p>
          <p style="margin: 4px 0;"><strong>Vai trò / Vị trí:</strong> ${roleName}</p>
          <p style="margin: 4px 0;"><strong>Tên đăng nhập (Email):</strong> <span style="color: #0284c7; font-weight: bold;">${toEmail}</span></p>
          <p style="margin: 4px 0;"><strong>Mật khẩu tạm thời:</strong> <span style="background: #e2e8f0; padding: 3px 8px; font-family: monospace; font-size: 16px; font-weight: bold; border-radius: 4px; color: #b91c1c;">${tempPassword}</span></p>
        </div>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 6px; color: #991b1b; font-size: 13px;">
          ⚠️ <strong>LƯU Ý BẢO MẬT:</strong><br/>
          Mật khẩu trên chỉ có hiệu lực tạm thời. Ngay trong lần đăng nhập đầu tiên, hệ thống sẽ yêu cầu bạn <strong>bắt buộc thiết lập mật khẩu mới</strong> để kích hoạt quyền sử dụng. Tuyệt đối không chia sẻ mật khẩu này cho người khác.
        </div>

        <p style="margin-top: 24px;">Trân trọng,<br/><strong>Ban Quản trị Hệ thống MedEquip</strong></p>
      </div>

      <div style="background-color: #f1f5f9; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        Email này được gửi tự động từ hệ thống MedEquip. Vui lòng không phản hồi lại email này.
      </div>
    </div>
  `;

  console.log(`\n================== [MEDEQUIP EMAIL DISPATCH] ==================`);
  console.log(`To: ${toEmail} (${fullName})`);
  console.log(`Subject: ${subject}`);
  console.log(`Temp Password: ${tempPassword}`);
  console.log(`=================================================================\n`);

  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: true,
      sent: false,
      mode: "DEMO_MODE",
      message: "Chế độ demo: Thông tin mật khẩu tạm thời đã được ghi nhận trong console hệ thống.",
      tempPassword,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"MedEquip Bệnh Viện" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject,
      html: htmlContent,
    });
    return { success: true, sent: true, messageId: info.messageId, tempPassword };
  } catch (error) {
    console.error("❌ Lỗi khi gửi email thực tế qua SMTP:", error.message);
    return {
      success: true,
      sent: false,
      mode: "FALLBACK_DEMO",
      error: error.message,
      message: "Không thể kết nối máy chủ SMTP. Mật khẩu tạm vẫn có thể dùng để bàn giao thử nghiệm.",
      tempPassword,
    };
  }
}
