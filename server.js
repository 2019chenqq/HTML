const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function createTransporter() {
  const requiredEnvVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "CONTACT_TO"];
  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

  if (missingEnvVars.length > 0) {
    throw new Error(`Missing mail configuration: ${missingEnvVars.join(", ")}`);
  }

  if (String(process.env.SMTP_PASS).includes("your_app_password_here")) {
    throw new Error("SMTP_APP_PASSWORD_NOT_SET");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

app.post("/api/contact", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const organization = String(req.body.organization || "").trim();
  const email = String(req.body.email || "").trim();
  const phone = String(req.body.phone || "").trim();
  const message = String(req.body.message || "").trim();

  if (!name || !organization || !email || !message) {
    return res.status(400).json({ error: "請填寫姓名、公司名稱、電子信箱與合作需求內容。" });
  }

  try {
    const transporter = createTransporter();

    await transporter.sendMail({
      from: `心域官網表單 <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO,
      replyTo: email,
      subject: "心域官網合作表單新來信",
      text: [
        `姓名：${name}`,
        `單位 / 公司名稱：${organization}`,
        `電子信箱：${email}`,
        `聯絡電話：${phone || "未提供"}`,
        "",
        "合作需求內容：",
        message,
      ].join("\n"),
      html: `
        <h2>心域官網合作表單新來信</h2>
        <p><strong>姓名：</strong>${name}</p>
        <p><strong>單位 / 公司名稱：</strong>${organization}</p>
        <p><strong>電子信箱：</strong>${email}</p>
        <p><strong>聯絡電話：</strong>${phone || "未提供"}</p>
        <p><strong>合作需求內容：</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[contact] send failed", error);

    if (error.message === "SMTP_APP_PASSWORD_NOT_SET") {
      return res.status(500).json({ error: "SMTP 尚未設定完成：請在 .env 的 SMTP_PASS 填入 Gmail App Password。" });
    }

    if (error.code === "EAUTH") {
      return res.status(500).json({ error: "SMTP 驗證失敗：請確認 Gmail App Password 是否正確，且未包含空白。" });
    }

    if (error.code === "ESOCKET" || error.code === "ECONNECTION") {
      return res.status(500).json({ error: "無法連線到郵件伺服器，請檢查網路或 SMTP_HOST/SMTP_PORT 設定。" });
    }

    return res.status(500).json({ error: "郵件送出失敗，請稍後再試。" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Innera site running at http://localhost:${port}`);
});