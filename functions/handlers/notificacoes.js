// MODELOS DE E-MAIL's
const { logger } = require("firebase-functions"); // usa logger da v2
const { onCall, HttpsError } = require("firebase-functions/v2/https")
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inicializa o Admin SDK apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp();
}
const auth = admin.auth();

// Lê variáveis de ambiente

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!EMAIL_USER || !EMAIL_PASS) {
  logger.warn(
    "Variáveis de e-mail ausentes. Configure-as com: firebase functions:secrets:set EMAIL_USER EMAIL_PASS"
  );
}

// Configuração do transporte (Gmail + App Password)

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER || "placeholder@email.com",
    pass: EMAIL_PASS || "placeholder-pass",
  },
});

// Função genérica de envio de e-mail

async function sendEmail({ to, subject, html }) {
  try {
    await transporter.sendMail({
      from: `Clínica Dr. Roberto Nigro <${EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    logger.info(`E-mail enviado para ${to}: ${subject}`);
  } catch (err) {
    logger.error("Erro ao enviar e-mail:", err);
  }
}

// =====================================================
// Atualizar E-mail
// =====================================================

exports.solicitarTrocaEmail = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const uid = request.auth.uid;
  const novoEmail = request.data?.novoEmail;

  if (!novoEmail || typeof novoEmail !== "string") {
    throw new HttpsError("invalid-argument", "E-mail inválido.");
  }

  const user = await admin.auth().getUser(uid);

  if (user.email === novoEmail) {
    throw new HttpsError(
      "failed-precondition",
      "O novo e-mail deve ser diferente do atual."
    );
  }

  let link;

  try {
    link = await admin.auth().generateVerifyAndChangeEmailLink(novoEmail, {
      url: "https://consultorio-app-2156a.web.app/auth/action",
      handleCodeInApp: true,
    });
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      throw new HttpsError("already-exists", "Este e-mail já está em uso.");
    }

    throw new HttpsError("internal", "Erro ao gerar link de confirmação.");
  }

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "Aviso de segurança",
      html: `
        <p>Uma solicitação para alterar seu e-mail foi registrada.</p>
        <p><b>Novo e-mail:</b> ${novoEmail}</p>
      `
    });
  }

  await sendEmail({
    to: novoEmail,
    subject: "Confirme seu novo e-mail",
    html: `
      <p>Você solicitou alterar seu e-mail.</p>
      <p>Clique abaixo para confirmar:</p>
      <a href="${link}" target="_blank">Confirmar troca de e-mail</a>
    `
  });

  return { sucesso: true };
});



