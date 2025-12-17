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

// ======================================================
// Envio de e-mail de confirmação de retorno agendado
// ======================================================
exports.sendRetornoConfirmationEmail = async (retornoData, pacienteInfo, medicoInfo) => {
  if (!retornoData.email) {
    console.warn("Retorno sem e-mail do paciente. Não foi possível enviar notificação de retorno.");
    return;
  }

  // Formatar data e hora
  const formatarDataHora = (data, hora) => {
    if (!data || !hora) return "Não informado";
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano} às ${hora}`;
  };

  // Traduzir tipo de retorno
  const traduzirTipoRetorno = (tipo) => {
    return tipo === "teleconsulta" ? "Teleconsulta" : "Presencial";
  };

  // Construir linhas de informação
  const infos = [];

  infos.push(`<p style="margin: 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
    <strong>Data/Hora:</strong> ${formatarDataHora(retornoData.novaData, retornoData.novoHorario)}
  </p>`);

  if (retornoData.tipoRetorno) {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Tipo de Atendimento:</strong> ${traduzirTipoRetorno(retornoData.tipoRetorno)}
    </p>`);
  }

  if (retornoData.unidade && retornoData.unidade !== "Não informado") {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Local:</strong> ${retornoData.unidade}
    </p>`);
  }

  if (retornoData.observacoes && retornoData.observacoes.trim() !== "") {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Observações:</strong> ${retornoData.observacoes}
    </p>`);
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Retorno Agendado</title>
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
      <h1>Você tem um Retorno Agendado</h1>
    </div>
    <div class="content">
      <p>
        Olá, <strong>${pacienteInfo.nome || "Paciente"}</strong>!
      </p>
      <p>
        Seu retorno foi agendado com sucesso na <strong>Clínica Dr. Roberto Nigro</strong>.
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
        <p class="info-box-title">Detalhes do Retorno</p>
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
        to: retornoData.email,
        subject: "Retorno Agendado — Clínica Dr. Roberto Nigro",
        html,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
        },
      });

      console.log(`E-mail de confirmação de retorno enviado para ${retornoData.email} (tentativa ${tentativa})`);
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

// ======================================================
// Envio de e-mail de cancelamento de consulta
// ======================================================
exports.sendAppointmentCancellationEmail = async (appointmentData, pacienteInfo, medicoInfo) => {
  if (!appointmentData.email) {
    console.warn("Appointment sem e-mail do paciente. Não foi possível enviar notificação de cancelamento.");
    return;
  }

  // Formatar data e hora
  const formatarDataHora = (horarioStr) => {
    if (!horarioStr) return "Não informado";
    const [data, hora] = horarioStr.split(" ");
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano} às ${hora}`;
  };

  // Traduzir tipo de consulta
  const traduzirTipoConsulta = (tipo) => {
    return tipo === "teleconsulta" ? "Teleconsulta" : "Presencial";
  };

  // Construir linhas de informação
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

  if (appointmentData.cancelReason && appointmentData.cancelReason.trim() !== "") {
    infos.push(`<p style="margin: 8px 0 0; color: #1f2937; font-size: 15px; line-height: 1.6;">
      <strong>Motivo:</strong> ${appointmentData.cancelReason}
    </p>`);
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cancelamento de Consulta</title>
  <style>
    body { margin:0; padding:0; background-color:#f5f7fa; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#333; }
    .container { max-width:520px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden; }
    .header { background:linear-gradient(135deg,#dc2626,#b91c1c); padding:24px; text-align:center; color:#fff; }
    .header h1 { font-size:20px; margin:0; font-weight:600; }
    .content { padding:32px 28px; }
    .content p { font-size:15px; line-height:1.6; margin:12px 0; color:#1f2937; }
    .info-box { background-color:#fef2f2; padding:20px; border-radius:8px; margin:25px 0; border-left:4px solid #dc2626; }
    .info-box-title { margin:0 0 15px; color:#991b1b; font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
    .medico-box { background:linear-gradient(135deg,#1c2636,#222d3f); padding:20px; border-radius:8px; margin:25px 0; text-align:center; }
    .cta-button { display:inline-block; margin:25px 0; padding:14px 28px; background-color:#030712; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; text-align:center; }
    .footer { padding:16px; text-align:center; font-size:13px; color:#777; background-color:#f9fafb; border-top:1px solid #e5e7eb; }
    @media (max-width:480px){ .container{margin:20px;} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Cancelamento de Consulta</h1>
    </div>
    <div class="content">
      <p>
        Prezado(a) <strong>${pacienteInfo.nome || "Paciente"}</strong>,
      </p>
      <p>
        Lamentamos informar que sua consulta agendada com <strong>${medicoInfo.nome || "Dr(a). Médico"}</strong> precisou ser cancelada.
      </p>
      <p>
        Infelizmente, não conseguiremos atendê-lo(a) no horário previamente marcado. Pedimos sinceras desculpas pelo transtorno causado.
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
        <p class="info-box-title">Detalhes da Consulta Cancelada</p>
        ${infos.join("\n        ")}
      </div>

      <p style="text-align:center; margin:25px 0;">
        <strong>Agende um novo horário pelo nosso site:</strong>
      </p>
      <p style="text-align:center; margin:0;">
        <a href="https://consultorio-app-2156a.web.app"
           style="display:inline-block; margin:10px 0; padding:14px 28px; background-color:#030712; color:#ffffff !important; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px;">
          Acessar Site
        </a>
      </p>
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
        to: appointmentData.email,
        subject: "Cancelamento de Consulta — Clínica Dr. Roberto Nigro",
        html,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
        },
      });

      console.log(`E-mail de cancelamento de consulta enviado para ${appointmentData.email} (tentativa ${tentativa})`);
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


// ======================================================
// Envio de e-mail de recusa de convênio
// ======================================================
exports.sendConvenioRecusadoEmail = async (appointmentData, pacienteInfo, medicoInfo) => {
  if (!appointmentData.email) {
    console.error("E-mail do paciente não fornecido.");
    return;
  }

  // Formatar data e horário
  const horarioCompleto = appointmentData.horario || "Data não informada";
  const dataHoraParts = horarioCompleto.split(" ");
  const data = dataHoraParts[0] || "Data não informada";
  const horario = dataHoraParts[1] || "Horário não informado";

  // Formatar data brasileira
  let dataBrasileira = data;
  try {
    const [ano, mes, dia] = data.split("-");
    dataBrasileira = `${dia}/${mes}/${ano}`;
  } catch (err) {
    console.warn("Erro ao formatar data:", err);
  }

  const tipoConsulta = appointmentData.tipoConsulta === "teleconsulta"
    ? "Teleconsulta"
    : "Presencial";

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Informação sobre sua Consulta</title>
  <style>
    body { margin:0; padding:0; background-color:#f5f7fa; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#333; }
    .container { max-width:600px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden; }
    .header { background:linear-gradient(135deg,#1c2636,#222d3f); padding:24px; text-align:center; color:#fff; }
    .header h1 { font-size:20px; margin:0; font-weight:600; }
    .content { padding:32px 28px; }
    .content p { font-size:15px; line-height:1.6; margin:12px 0; }
    .info-box { background-color:#f9fafb; border-left:4px solid #ef4444; padding:16px; margin:20px 0; border-radius:4px; }
    .info-box h3 { margin:0 0 12px; font-size:16px; color:#991b1b; }
    .info-row { margin:8px 0; font-size:14px; }
    .info-row strong { color:#1f2937; }
    .suggestions { background-color:#fef3c7; border-left:4px solid #f59e0b; padding:16px; margin:20px 0; border-radius:4px; }
    .suggestions h3 { margin:0 0 12px; font-size:16px; color:#92400e; }
    .suggestions ul { margin:8px 0; padding-left:20px; }
    .suggestions li { margin:6px 0; font-size:14px; color:#78350f; }
    .cta { background-color:#f0fdf4; border-left:4px solid #10b981; padding:16px; margin:20px 0; border-radius:4px; text-align:center; }
    .button { display:inline-block; margin:12px 0; padding:14px 28px; background-color:#030712; color:#fff !important; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; }
    .footer { padding:20px 28px; text-align:center; font-size:13px; color:#777; background-color:#f9fafb; border-top:1px solid #e5e7eb; }
    @media (max-width:600px){ .container{margin:20px;} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Clínica Dr. Roberto Nigro</h1>
    </div>
    <div class="content">
      <p>Prezado(a) <strong>${pacienteInfo.nome}</strong>,</p>

      <p>
        Informamos que a consulta agendada para o dia <strong>${dataBrasileira}</strong>
        às <strong>${horario}</strong> não pôde ser confirmada devido a incompatibilidade
        com o convênio informado.
      </p>

      <div class="info-box">
        <h3>Dados do Agendamento</h3>
        <div class="info-row"><strong>Médico:</strong> ${medicoInfo.nome}${medicoInfo.especialidade ? ` - ${medicoInfo.especialidade}` : ''}</div>
        <div class="info-row"><strong>Tipo:</strong> ${tipoConsulta}</div>
        <div class="info-row"><strong>Convênio:</strong> ${appointmentData.convenio || "Não informado"}</div>
        <div class="info-row"><strong>Categoria:</strong> ${appointmentData.categoria || "Não informada"}</div>
        <div class="info-row"><strong>Carteirinha:</strong> ${appointmentData.carteirinha || "Não informada"}</div>
      </div>

      <div class="suggestions">
        <h3>Possíveis Motivos</h3>
        <ul>
          <li>O convênio informado não é aceito pelo médico selecionado</li>
          <li>Os dados da carteirinha podem estar incorretos</li>
          <li>A categoria do convênio pode não corresponder ao plano cadastrado</li>
        </ul>
      </div>

      <div class="suggestions">
        <h3>O que você pode fazer?</h3>
        <ul>
          <li>Verifique se os dados da sua carteirinha foram inseridos corretamente</li>
          <li>Confirme se o convênio informado é aceito pelo médico escolhido</li>
          <li>Considere agendar uma consulta particular caso preferir</li>
        </ul>
      </div>

      <div class="cta">
        <p style="margin:0 0 16px; font-size:15px; color:#065f46;">
          <strong>Agende novamente no nosso site</strong>
        </p>
        <a href="https://clinicadrrobertonigro.com" class="button">
          Novo Agendamento
        </a>
      </div>

      <p style="margin-top:24px; font-size:14px; color:#6b7280;">
        Em caso de dúvidas, entre em contato conosco pelos canais abaixo.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0 0 10px; color:#1f2937; font-size:15px; font-weight:600;">
        Clínica Dr. Roberto Nigro
      </p>
      <p style="margin:0; line-height:1.6;">
        Contato: (11) 96572-1206<br>
        E-mail: admclinicarobertonigro@gmail.com<br>
        Site: www.clinicadrrobertonigro.com.br
      </p>
      <p style="margin:15px 0 0; color:#9ca3af; font-size:12px;">
        Esta é uma mensagem automática. Não é necessário respondê-la.<br/>
        © 2025 Clínica Dr. Roberto Nigro — Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `Clínica Dr. Roberto Nigro <${EMAIL_USER}>`,
    to: appointmentData.email,
    subject: "Informação sobre sua Consulta - Convênio",
    html,
  });

  console.log(`E-mail de recusa de convênio enviado para: ${appointmentData.email}`);
};


// ======================================================
// Envio de e-mail de exclusão de conta
// ======================================================
exports.sendAccountDeletionEmail = async ({ email, nome }) => {
  if (!email) {
    console.error("E-mail do usuário não fornecido.");
    return;
  }

  const dataExclusao = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmação de Exclusão de Conta</title>
  <style>
    body { margin:0; padding:0; background-color:#f5f7fa; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#333; }
    .container { max-width:600px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden; }
    .header { background:linear-gradient(135deg,#1c2636,#222d3f); padding:24px; text-align:center; color:#fff; }
    .header h1 { font-size:20px; margin:0; font-weight:600; }
    .content { padding:32px 28px; }
    .content p { font-size:15px; line-height:1.6; margin:12px 0; }
    .alert-box { background-color:#fef2f2; border-left:4px solid #ef4444; padding:16px; margin:20px 0; border-radius:4px; }
    .alert-box h3 { margin:0 0 12px; font-size:16px; color:#991b1b; }
    .alert-box p { margin:8px 0; font-size:14px; color:#7f1d1d; }
    .info-box { background-color:#f9fafb; border-left:4px solid #6b7280; padding:16px; margin:20px 0; border-radius:4px; }
    .info-box p { margin:8px 0; font-size:14px; color:#374151; }
    .info-box strong { color:#1f2937; }
    .footer { padding:20px 28px; text-align:center; font-size:13px; color:#777; background-color:#f9fafb; border-top:1px solid #e5e7eb; }
    @media (max-width:600px){ .container{margin:20px;} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Clínica Dr. Roberto Nigro</h1>
    </div>
    <div class="content">
      <p>Prezado(a) <strong>${nome}</strong>,</p>

      <p>
        Confirmamos que sua conta foi <strong>excluída com sucesso</strong> do sistema da
        Clínica Dr. Roberto Nigro.
      </p>

      <div class="alert-box">
        <h3>Conta Excluída</h3>
        <p>
          Todos os seus dados pessoais foram permanentemente removidos de nosso sistema.
          Esta ação é irreversível.
        </p>
      </div>

      <div class="info-box">
        <p><strong>Data e Hora da Exclusão:</strong> ${dataExclusao}</p>
        <p><strong>E-mail da Conta:</strong> ${email}</p>
      </div>

      <p>
        <strong>O que foi excluído:</strong>
      </p>
      <ul style="margin:8px 0 20px 20px; font-size:14px; line-height:1.8; color:#4b5563;">
        <li>Seus dados pessoais (nome, CPF, telefone, data de nascimento)</li>
        <li>Seu histórico de consultas</li>
        <li>Suas credenciais de acesso</li>
      </ul>

      <p style="margin-top:24px; font-size:14px; color:#6b7280;">
        Se você não solicitou esta exclusão ou acredita que foi um erro,
        entre em contato conosco <strong>imediatamente</strong>.
      </p>

      <p style="margin-top:20px; font-size:14px; color:#6b7280;">
        Agradecemos por ter utilizado nossos serviços.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0 0 10px; color:#1f2937; font-size:15px; font-weight:600;">
        Clínica Dr. Roberto Nigro
      </p>
      <p style="margin:0; line-height:1.6;">
        Contato: (11) 96572-1206<br>
        E-mail: admclinicarobertonigro@gmail.com<br>
        Site: www.clinicadrrobertonigro.com.br
      </p>
      <p style="margin:15px 0 0; color:#9ca3af; font-size:12px;">
        Esta é uma mensagem automática. Não é necessário respondê-la.<br/>
        © 2025 Clínica Dr. Roberto Nigro — Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: `Clínica Dr. Roberto Nigro <${EMAIL_USER}>`,
    to: email,
    subject: "Confirmação de Exclusão de Conta - Clínica Dr. Roberto Nigro",
    html,
  });

  console.log(`E-mail de exclusão de conta enviado para: ${email}`);
};
