const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inicializa Admin SDK com segurança
if (!admin.apps.length) {
  admin.initializeApp();
}

// Lê variáveis de ambiente
const EMAIL_USER = functions.config().email?.user;
const EMAIL_PASS = functions.config().email?.pass;

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn(
    "⚠️ Configurações de e-mail ausentes. Use: firebase functions:config:set email.user '...' email.pass '...'"
  );
}

// Configura transporte do Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
});

// ======================================================
// Envio de e-mail de verificação no cadastro
// ======================================================
exports.sendVerificationEmail = async (user) => {
  if (!user.email) return;

  const auth = admin.auth();
  const link = await auth.generateEmailVerificationLink(user.email, {
    url: "https://consultorio-app-2156a.web.app/auth/action",
    handleCodeInApp: true,
  });

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verifique seu e-mail</title>
  <style>
    body { margin:0; padding:0; background-color:#f5f7fa; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#333; }
    .container { max-width:520px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden; }
    .header { background:linear-gradient(135deg,#1c2636,#222d3f); padding:24px; text-align:center; color:#fff; }
    .header h1 { font-size:20px; margin:0; font-weight:600; }
    .content { padding:32px 28px; text-align:center; }
    .content p { font-size:15px; line-height:1.6; margin:12px 0; }
    .button { display:inline-block; margin:28px 0; padding:14px 28px; background-color:#030712; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; }
    .button:hover { background-color:#facc15; color:#ffffff; }
    .footer { padding:16px; text-align:center; font-size:13px; color:#777; background-color:#f9fafb; border-top:1px solid #e5e7eb; }
    @media (max-width:480px){ .container{margin:20px;} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Clínica Dr. Roberto Nigro</h1>
    </div>
    <div class="content">
      <p>
        Seja bem-vindo(a) à <b>Clínica Dr. Roberto Nigro</b>!<br/>
        Antes de continuar, precisamos confirmar que este e-mail pertence a você.
      </p>
      <a href="${link}" target="_blank"
        style="
            display:inline-block;
            margin:28px 0;
            padding:14px 28px;
            background-color:#030712;
            color:#ffffff !important;
            text-decoration:none;
            border-radius:8px;
            font-weight:600;
            font-size:15px;
            transition:all 0.2s ease-in-out;
        "
        onmouseover="this.style.backgroundColor='#facc15'; this.style.color='#ffffff';"
        onmouseout="this.style.backgroundColor='#030712'; this.style.color='#ffffff';"

        >
        Verificar meu e-mail
        </a>

      <p>Caso o botão não funcione, copie e cole o link abaixo no seu navegador:</p>
      <p style="font-size:13px; color:#555; word-break:break-all;">${link}</p>
    </div>
    <div class="footer">
      <p>
        Esta é uma mensagem automática. Não é necessário respondê-la.<br/>
        © 2025 Clínica Dr. Roberto Nigro — Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `Clínica Dr. Roberto Nigro <${EMAIL_USER}>`,
      to: user.email,
      subject: "Verifique seu e-mail — Clínica Dr. Roberto Nigro",
      html,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
    });

    console.log(`📨 E-mail de verificação enviado para ${user.email}`);
  } catch (error) {
    console.error("❌ Erro ao enviar e-mail de verificação:", error);
  }
};
