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
    "Configurações de e-mail ausentes. Use: firebase functions:config:set email.user '...' email.pass '...'"
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

    console.log(`E-mail de verificação enviado para ${user.email}`);
  } catch (error) {
    console.error("Erro ao enviar e-mail de verificação:", error);
  }
};

// ======================================================
// Envio de e-mail de confirmação de agendamento
// ======================================================
exports.sendAppointmentConfirmationEmail = async (appointmentData, pacienteInfo, medicoInfo) => {
  if (!pacienteInfo.email) {
    console.warn("Paciente sem e-mail cadastrado. Não foi possível enviar notificação.");
    return;
  }

  // Formatar data e hora
  const formatarDataHora = (horarioStr) => {
    if (!horarioStr) return "Não informado";
    const [data, hora] = horarioStr.split(" ");
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano} às ${hora}`;
  };

  // Formatar valor monetário
  const formatarValor = (valor) => {
    if (!valor) return null;
    return `R$ ${parseFloat(valor).toFixed(2).replace(".", ",")}`;
  };

  // Traduzir status
  const traduzirStatus = (status) => {
    const traducoes = {
      "agendado": "Agendado",
      "confirmado": "Confirmado",
      "cancelada": "Cancelada",
      "concluida": "Concluída",
      "retorno": "Retorno",
    };
    return traducoes[status] || status;
  };

  // Traduzir tipo de consulta
  const traduzirTipoConsulta = (tipo) => {
    return tipo === "teleconsulta" ? "Teleconsulta" : "Presencial";
  };

  // Traduzir tipo de atendimento
  const traduzirTipoAtendimento = (tipo) => {
    return tipo === "convenio" ? "Convênio" : "Particular";
  };

  // Construir linhas de informação dinamicamente
  const infos = [];

  infos.push(`<p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
    <strong>Data/Hora:</strong> ${formatarDataHora(appointmentData.horario)}
  </p>`);

  if (appointmentData.tipoConsulta) {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Tipo de Consulta:</strong> ${traduzirTipoConsulta(appointmentData.tipoConsulta)}
    </p>`);
  }

  if (appointmentData.unidade && appointmentData.unidade !== "Não informado") {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Local:</strong> ${appointmentData.unidade}
    </p>`);
  }

  if (appointmentData.tipoAtendimento) {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Tipo de Atendimento:</strong> ${traduzirTipoAtendimento(appointmentData.tipoAtendimento)}
    </p>`);
  }

  // Se for convênio, mostrar dados do convênio
  if (appointmentData.tipoAtendimento === "convenio") {
    if (appointmentData.convenio) {
      infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
        <strong>Convênio:</strong> ${appointmentData.convenio}
      </p>`);
    }
    if (appointmentData.categoria) {
      infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
        <strong>Categoria/Plano:</strong> ${appointmentData.categoria}
      </p>`);
    }
    if (appointmentData.carteirinha) {
      infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
        <strong>Carteirinha:</strong> ${appointmentData.carteirinha}
      </p>`);
    }
  }

  // Se for particular, mostrar valor apropriado
  if (appointmentData.tipoAtendimento === "particular") {
    if (appointmentData.tipoConsulta === "teleconsulta" && appointmentData.valorteleConsulta) {
      infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
        <strong>Valor:</strong> ${formatarValor(appointmentData.valorteleConsulta)}
      </p>`);
    } else if (appointmentData.tipoConsulta === "presencial" && appointmentData.valorConsulta) {
      infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
        <strong>Valor:</strong> ${formatarValor(appointmentData.valorConsulta)}
      </p>`);
    }
  }

  if (appointmentData.status) {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Status:</strong> ${traduzirStatus(appointmentData.status)}
    </p>`);
  }

  if (appointmentData.sintomas && appointmentData.sintomas.trim() !== "") {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Sintomas/Informações Adicionais:</strong> ${appointmentData.sintomas}
    </p>`);
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Consulta Agendada</title>
  <style>
    body { margin:0; padding:0; background-color:#f5f7fa; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#333; }
    .container { max-width:520px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden; }
    .header { background:linear-gradient(135deg,#1c2636,#222d3f); padding:24px; text-align:center; color:#fff; }
    .header h1 { font-size:20px; margin:0; font-weight:600; }
    .content { padding:32px 28px; }
    .content p { font-size:15px; line-height:1.6; margin:12px 0; color:#1f2937; }
    .info-box { background-color:#f9fafb; padding:20px; border-radius:8px; margin:25px 0; }
    .info-box-title { margin:0 0 15px; color:#6b7280; font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .medico-box { background:linear-gradient(135deg,#1c2636,#222d3f); padding:20px; border-radius:8px; margin:25px 0; text-align:center; }
    .footer { padding:16px; text-align:center; font-size:13px; color:#777; background-color:#f9fafb; border-top:1px solid #e5e7eb; }
    @media (max-width:480px){ .container{margin:20px;} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Consulta Agendada com Sucesso</h1>
    </div>
    <div class="content">
      <p>
        Olá, <strong>${pacienteInfo.nome || "Paciente"}</strong>!
      </p>
      <p>
        Sua consulta foi agendada com sucesso na <strong>Clínica Dr. Roberto Nigro</strong>.
      </p>

      <div class="medico-box">
        <p style="margin:0; color:#ffffff; font-size:16px; font-weight:600;">
          ${medicoInfo.nome || "Médico"}
        </p>
        ${medicoInfo.especialidade ? `<p style="margin:8px 0 0; color:#ffffff; font-size:14px; opacity:0.9;">
          ${medicoInfo.especialidade}
        </p>` : ""}
      </div>

      <div class="info-box">
        <p class="info-box-title">Detalhes da Consulta</p>
        ${infos.join("\n        ")}
      </div>

      <p style="margin:25px 0 15px; color:#4b5563; font-size:14px; line-height:1.6;">
        <strong>Importante:</strong>
      </p>
      <ul style="margin:0 0 25px; padding-left:20px; color:#4b5563; font-size:14px; line-height:1.8;">
        <li>Chegue com 15 minutos de antecedência</li>
        <li>Traga documentos pessoais e carteirinha do convênio (se aplicável)</li>
        <li>Em caso de imprevistos, entre em contato conosco com antecedência</li>
      </ul>
    </div>
    <div class="footer">
      <p>
        <strong>Clínica Dr. Roberto Nigro</strong><br/>
        Contato: (11) 96572-1206<br/>
        E-mail: admclinicarobertonigro@gmail.com<br/>
        Site: www.clinicadrrobertonigro.com.br
      </p>
      <p style="margin-top:10px; font-size:12px; color:#9ca3af;">
        © ${new Date().getFullYear()} Clínica Dr. Roberto Nigro — Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  // Envio com retry (máximo 3 tentativas)
  const maxTentativas = 3;
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      await transporter.sendMail({
        from: `Clínica Dr. Roberto Nigro <${EMAIL_USER}>`,
        to: pacienteInfo.email,
        subject: "Consulta Agendada — Clínica Dr. Roberto Nigro",
        html,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
        },
      });

      console.log(`E-mail de confirmação de agendamento enviado para ${pacienteInfo.email} (tentativa ${tentativa})`);
      return; // Sucesso, sair da função
    } catch (error) {
      console.error(`Tentativa ${tentativa} de envio de e-mail falhou:`, error);

      if (tentativa === maxTentativas) {
        console.error("Falha ao enviar e-mail após todas as tentativas:", error);
        throw error;
      }

      // Aguardar antes de tentar novamente (backoff exponencial)
      await new Promise((resolve) => setTimeout(resolve, 1000 * tentativa));
    }
  }
};
