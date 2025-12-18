const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { admin, db } = require("./firebaseAdmin");
const nodemailer = require("nodemailer");

// Definir secrets no escopo do módulo
const emailUserSecret = defineSecret("EMAIL_USER");
const emailPassSecret = defineSecret("EMAIL_PASS");


// =====================================================
// Validar duplicatas (sem autenticação) → usada no registro antes do SMS
// =====================================================
exports.validarDuplicatas = onCall(async (request) => {
  const { email, telefone, cpf } = request.data || {};

  console.log("Solicitada validação de duplicatas:", request.data);

  if (!email && !telefone && !cpf) {
    throw new HttpsError("invalid-argument", "Campos obrigatórios ausentes.");
  }

  try {
    // Verifica duplicidade de e-mail no Authentication
    if (email) {
      try {
        await admin.auth().getUserByEmail(email);
        console.warn("E-mail já cadastrado:", email);
        throw new HttpsError("already-exists", "E-mail já cadastrado.");
      } catch (err) {
        if (err.code !== "auth/user-not-found") {
          throw err;
        }
      }
    }

    // Verifica duplicidade de telefone
    if (telefone) {
      const telSnap = await db.collection("usuarios").where("telefone", "==", telefone).get();
      if (!telSnap.empty) {
        console.warn("Telefone já cadastrado:", telefone);
        throw new HttpsError("already-exists", "Telefone já cadastrado.");
      }
    }

    // Verifica duplicidade de CPF
    if (cpf) {
      const cpfSnap = await db.collection("usuarios").where("cpf", "==", cpf).get();
      if (!cpfSnap.empty) {
        console.warn("CPF já cadastrado:", cpf);
        throw new HttpsError("already-exists", "CPF já cadastrado.");
      }
    }

    console.log("Nenhuma duplicidade encontrada.");
    return { valid: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      console.error("Erro de validação:", error.message);
      throw error;
    }

    console.error("Erro interno na verificação de duplicatas:", error);
    throw new HttpsError("internal", "Erro ao verificar duplicatas.");
  }
});


// =====================================================
// Criar/atualizar usuário (com LOGS de debug + verificação de duplicidade)
// =====================================================
exports.criarUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const uid = request.auth.uid;
  const { nome, telefone, cpf, dataNascimento, sexoBiologico, ...rest } = request.data || {};


  // LOG — o que chegou do front
  console.log("Dados recebidos do front:", request.data);

  if (rest && typeof rest.role !== "undefined") {
    throw new HttpsError(
      "permission-denied",
      "Campo 'role' não pode ser definido pelo cliente."
    );
  }

  try {
    // =====================================================
    // Verificação de duplicidade (telefone e CPF)
    // =====================================================
    if (telefone) {
      const telSnap = await db
        .collection("usuarios")
        .where("telefone", "==", telefone)
        .get();

      if (!telSnap.empty) {
        const duplicado = telSnap.docs.some((doc) => doc.id !== uid);
        if (duplicado) {
          console.warn("Telefone já cadastrado:", telefone);
          throw new HttpsError("already-exists", "Telefone já cadastrado.");
        }
      }
    }

    if (cpf) {
      const cpfSnap = await db.collection("usuarios").where("cpf", "==", cpf).get();

      if (!cpfSnap.empty) {
        const duplicado = cpfSnap.docs.some((doc) => doc.id !== uid);
        if (duplicado) {
          console.warn("CPF já cadastrado:", cpf);
          throw new HttpsError("already-exists", "CPF já cadastrado.");
        }
      }
    }

    // =====================================================
    // Busca usuário autenticado e define o role se ainda não existir
    // =====================================================
    const userRecord = await admin.auth().getUser(uid);
    let role = (userRecord.customClaims && userRecord.customClaims.role) || null;

    if (!role) {
      await admin.auth().setCustomUserClaims(uid, { role: "patient" });
      role = "patient";
    }

    const ref = db.collection("usuarios").doc(uid);
    const snap = await ref.get();

    // =====================================================
    // Monta os dados para salvar no Firestore
    // =====================================================
    const dados = {
      nome: typeof nome === "string" ? nome : null,
      telefone: typeof telefone === "string" ? telefone : null,
      cpf: typeof cpf === "string" ? cpf : null,
      dataNascimento: typeof dataNascimento === "string" ? dataNascimento : null,
      sexoBiologico: typeof sexoBiologico === "string" ? sexoBiologico : null,
      role,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!snap.exists) {
      dados.criadoEm = admin.firestore.FieldValue.serverTimestamp();
    }

    // LOG — o que será salvo no Firestore
    console.log("Gravando no Firestore:", dados);

    await ref.set(dados, { merge: true });

    console.log("Usuário salvo com sucesso:", uid);

    return {
      sucesso: true,
      mensagem: "Usuário criado/atualizado com sucesso.",
      roleAtribuida: role,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      console.error("Erro de validação:", error.message);
      throw error;
    }

    console.error("Erro ao criar usuário:", error);
    throw new HttpsError("internal", "Erro ao criar usuário.");
  }
});


// =====================================================
// Meu Perfil
// =====================================================
exports.meuPerfil = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const uid = request.auth.uid;

  try {
    const snap = await db.collection("usuarios").doc(uid).get();

    if (!snap.exists) {
      return {
        sucesso: true,
        perfil: {},
        role: request.auth?.token?.role || null,
      };
    }

    const dados = snap.data();
    return {
      sucesso: true,
      perfil: dados,
      role: dados.role || request.auth?.token?.role || null,
    };
  } catch (error) {
    console.error("Erro ao obter perfil:", error);
    throw new HttpsError("internal", "Erro ao obter o perfil do usuário.");
  }
});


// =====================================================
// Atualizar usuário 
// =====================================================
exports.atualizarUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const uid = request.auth.uid;
  const {
    nome,
    telefone,
    cpf,
    dataNascimento,
    sexoBiologico,
    email,
    emailVerificado,
    role,
  } = request.data || {};

  if (typeof role !== "undefined") {
    throw new HttpsError(
      "permission-denied",
      "Campo 'role' não pode ser alterado pelo cliente."
    );
  }

  // BLOQUEIA qualquer tentativa de alterar email por esta função
  if (typeof email !== "undefined") {
    throw new HttpsError(
      "permission-denied",
      "Alteração de e-mail deve ser feita através do link oficial enviado por email."
    );
  }

  // BLOQUEIA qualquer tentativa de alterar telefone por esta função
  if (typeof telefone !== "undefined") {
    throw new HttpsError(
      "permission-denied",
      "Alteração de telefone deve ser feita através da função trocarTelefone com verificação SMS."
    );
  }

  const updates = {};

  if (typeof nome === "string") updates.nome = nome;
  if (typeof cpf === "string") updates.cpf = cpf;
  if (typeof dataNascimento === "string") updates.dataNascimento = dataNascimento;
  if (typeof sexoBiologico === "string") updates.sexoBiologico = sexoBiologico;

  // Permite atualizar emailVerificado (mas não o email em si)
  if (typeof emailVerificado === "boolean") {
    // SEGURANÇA: Valida se o email está realmente verificado no Auth
    if (emailVerificado === true) {
      const userRecord = await admin.auth().getUser(uid);
      if (userRecord.emailVerified) {
        updates.emailVerificado = true;
      } else {
        throw new HttpsError(
          "failed-precondition",
          "E-mail não está verificado no Authentication."
        );
      }
    }
  }

  updates.atualizadoEm = admin.firestore.FieldValue.serverTimestamp();

  if (Object.keys(updates).length === 1) {
    throw new HttpsError(
      "invalid-argument",
      "Nenhum campo válido para atualização."
    );
  }

  try {
    console.log("Atualizando usuário:", uid, updates);
    await db.collection("usuarios").doc(uid).set(updates, { merge: true });
    return { sucesso: true, mensagem: "Dados atualizados com sucesso." };
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    throw new HttpsError("internal", "Erro ao atualizar usuário.");
  }
});


// =====================================================
// Deletar usuário (Firestore + Authentication + Log de auditoria)
// =====================================================
exports.deletarUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const uid = request.auth.uid;
  const { senha } = request.data || {};
  const ip = request.rawRequest?.ip || "IP não identificado";

  try {
    const ref = db.collection("usuarios").doc(uid);
    const snap = await ref.get();

    const dadosAntigos = snap.exists ? snap.data() : null;

    if (snap.exists) {
      await ref.delete();
      console.log(`Documento Firestore deletado: ${uid}`);
    } else {
      console.warn(`Documento não encontrado no Firestore: ${uid}`);
    }

    await admin.auth().deleteUser(uid);
    console.log(`Usuário ${uid} removido do Authentication.`);

    const logRef = db.collection("logs_delecoes").doc();
    await logRef.set({
      uid,
      email: request.auth.token.email || null,
      ip,
      dadosAntigos: dadosAntigos || {},
      data: admin.firestore.FieldValue.serverTimestamp(),
      mensagem: "Conta excluída (Firestore + Auth).",
    });

    console.log(`Log de auditoria criado: ${logRef.id}`);

    return {
      sucesso: true,
      mensagem: "Conta e dados excluídos com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    throw new HttpsError("internal", "Erro ao excluir completamente a conta.");
  }
});



// =====================================================
// SINCRONIZAR E-MAIL APÓS RECUPERAÇÃO
// =====================================================

exports.usuariosSyncRecoverEmail = onCall(async (request) => {
  const { email } = request.data;

  // Validação
  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "E-mail não informado."
    );
  }

  console.log("Iniciando sincronização de recuperação para:", email);

  try {
    // 1. Busca o usuário pelo email no Auth
    let userAuth;
    try {
      userAuth = await admin.auth().getUserByEmail(email);
    } catch (error) {
      console.error("Usuário não encontrado no Auth:", error);
      throw new HttpsError(
        "not-found",
        "Usuário não encontrado no Authentication."
      );
    }

    const uid = userAuth.uid;
    console.log("Usuário encontrado:", { uid, email: userAuth.email });

    // 2. SEGURANÇA: Busca dados atuais no Firestore
    const docRef = admin.firestore().collection("usuarios").doc(uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Documento do usuário não encontrado no Firestore."
      );
    }

    const firestoreData = docSnap.data();
    const emailAtualFirestore = firestoreData.email;

    console.log("Comparação:", {
      emailFirestore: emailAtualFirestore,
      emailAuth: userAuth.email,
      emailRecebido: email
    });

    // 3. VALIDAÇÃO CRÍTICA: Só sincroniza se houve MUDANÇA REAL no Auth
    // Isso previne ataques onde alguém tenta forçar a troca enviando emails aleatórios
    if (emailAtualFirestore === userAuth.email) {
      console.log("Emails já estão sincronizados. Nenhuma ação necessária.");
      return {
        success: true,
        message: "Emails já sincronizados",
        uid: uid,
        email: userAuth.email
      };
    }

    // 4. VALIDAÇÃO EXTRA: Verifica se o email do Auth corresponde ao solicitado
    if (userAuth.email !== email) {
      console.error("Email do Auth não corresponde ao solicitado:", {
        esperado: email,
        encontrado: userAuth.email
      });
      throw new HttpsError(
        "failed-precondition",
        "Email no Authentication não corresponde ao solicitado."
      );
    }

    // 5. REGISTRO DE AUDITORIA: Salva log da mudança antes de aplicar
    const logRef = admin.firestore().collection("logs_seguranca").doc();
    await logRef.set({
      tipo: "recuperacao_email",
      uid: uid,
      emailAnterior: emailAtualFirestore,
      emailNovo: userAuth.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: request.rawRequest?.ip || "unknown",
      userAgent: request.rawRequest?.headers?.["user-agent"] || "unknown"
    });

    // 6. Sincroniza Firestore com os dados do Auth
    await docRef.set(
      {
        email: userAuth.email,
        emailVerificado: userAuth.emailVerified,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    console.log("Email sincronizado com sucesso no Firestore!");

    return {
      success: true,
      uid: uid,
      email: userAuth.email,
      emailVerificado: userAuth.emailVerified
    };

  } catch (error) {
    console.error("Erro ao sincronizar recuperação:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "Erro ao processar recuperação de e-mail."
    );
  }
});

// =====================================================
// SINCRONIZAR E-MAIL APÓS ALTERAÇÃO
// =====================================================

exports.usuariosSyncChangeEmail = onCall(async (request) => {
  const { email } = request.data;

  // Validação
  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "E-mail não informado."
    );
  }

  console.log("Iniciando sincronização de alteração para:", email);

  try {
    // 1. Busca o usuário pelo novo email no Auth
    let userAuth;
    try {
      userAuth = await admin.auth().getUserByEmail(email);
    } catch (error) {
      console.error("Usuário não encontrado no Auth:", error);
      throw new HttpsError(
        "not-found",
        "Usuário não encontrado no Authentication."
      );
    }

    const uid = userAuth.uid;
    console.log("Usuário encontrado:", { uid, email: userAuth.email });

    // 2. SEGURANÇA: Busca dados atuais no Firestore
    const docRef = admin.firestore().collection("usuarios").doc(uid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Documento do usuário não encontrado no Firestore."
      );
    }

    const firestoreData = docSnap.data();
    const emailAtualFirestore = firestoreData.email;

    console.log("Comparação:", {
      emailFirestore: emailAtualFirestore,
      emailAuth: userAuth.email,
      emailRecebido: email
    });

    // 3. VALIDAÇÃO CRÍTICA: Só sincroniza se houve MUDANÇA REAL no Auth
    if (emailAtualFirestore === userAuth.email) {
      console.log("Emails já estão sincronizados. Nenhuma ação necessária.");
      return {
        success: true,
        message: "Emails já sincronizados",
        uid: uid,
        email: userAuth.email
      };
    }

    // 4. VALIDAÇÃO EXTRA: Verifica se o email do Auth corresponde ao solicitado
    if (userAuth.email !== email) {
      console.error("Email do Auth não corresponde ao solicitado:", {
        esperado: email,
        encontrado: userAuth.email
      });
      throw new HttpsError(
        "failed-precondition",
        "Email no Authentication não corresponde ao solicitado."
      );
    }

    // 5. REGISTRO DE AUDITORIA: Salva log da mudança
    const logRef = admin.firestore().collection("logs_seguranca").doc();
    await logRef.set({
      tipo: "alteracao_email",
      uid: uid,
      emailAnterior: emailAtualFirestore,
      emailNovo: userAuth.email,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: request.rawRequest?.ip || "unknown",
      userAgent: request.rawRequest?.headers?.["user-agent"] || "unknown"
    });

    // 6. Sincroniza Firestore com os dados do Auth
    await docRef.set(
      {
        email: userAuth.email,
        emailVerificado: userAuth.emailVerified,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    console.log("Email alterado e sincronizado com sucesso no Firestore!");

    return {
      success: true,
      uid: uid,
      email: userAuth.email,
      emailVerificado: userAuth.emailVerified
    };

  } catch (error) {
    console.error("Erro ao sincronizar alteração:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError(
      "internal",
      "Erro ao processar alteração de e-mail."
    );
  }
});

// =====================================================
// Mudar telefone
// =====================================================

exports.trocarTelefone = onCall(async (request) => {
  // 1. Validar autenticação
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const uid = request.auth.uid;
  const { novoTelefone } = request.data;

  console.log("Solicitação de troca de telefone:", { uid, novoTelefone });

  // 2. Validar formato
  if (!novoTelefone || typeof novoTelefone !== "string") {
    throw new HttpsError("invalid-argument", "Telefone inválido");
  }

  try {
    // 3. Verificar se o telefone foi REALMENTE vinculado no Auth
    const userRecord = await admin.auth().getUser(uid);

    // Formata o telefone recebido para o formato do Auth (+55XXXXXXXXXXX)
    const telefoneFormatado = "+55" + novoTelefone.replace(/\D/g, "");

    console.log("Comparação de telefones:", {
      authPhone: userRecord.phoneNumber,
      telefoneFormatado: telefoneFormatado,
      novoTelefone: novoTelefone
    });

    // Validação crítica: o telefone no Auth deve corresponder
    if (userRecord.phoneNumber !== telefoneFormatado) {
      throw new HttpsError(
        "failed-precondition",
        "Telefone não verificado no Authentication. Complete a verificação SMS primeiro."
      );
    }

    // 4. Verificar duplicatas no Firestore
    const existente = await db
      .collection("usuarios")
      .where("telefone", "==", novoTelefone)
      .get();

    if (!existente.empty) {
      const duplicado = existente.docs.some(doc => doc.id !== uid);
      if (duplicado) {
        throw new HttpsError("already-exists", "Telefone já cadastrado");
      }
    }

    // 5. Log de auditoria
    await db.collection("logs_seguranca").add({
      tipo: "troca_telefone",
      uid,
      telefoneNovo: novoTelefone,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: request.rawRequest?.ip || "unknown"
    });

    // 6. Atualizar Firestore
    await db.collection("usuarios").doc(uid).set(
      {
        telefone: novoTelefone,
        telefoneVerificadoEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    console.log("Telefone atualizado com sucesso:", uid);

    return { sucesso: true };

  } catch (error) {
    console.error("Erro ao trocar telefone:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Erro ao atualizar telefone");
  }
});


// =====================================================
// Notificar alteração de senha
// =====================================================
exports.notificarAlteracaoSenha = onCall({
  secrets: [emailUserSecret, emailPassSecret]
}, async (request) => {
  // 1. Validar autenticação
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado");
  }

  const uid = request.auth.uid;

  console.log("Notificação de alteração de senha solicitada para:", uid);

  try {
    // 2. Buscar dados do usuário no Firestore
    const userDoc = await db.collection("usuarios").doc(uid).get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "Dados do usuário não encontrados");
    }

    const userData = userDoc.data();

    // 3. Validar se o usuário tem e-mail
    if (!userData.email) {
      throw new HttpsError(
        "failed-precondition",
        "Usuário não possui e-mail cadastrado"
      );
    }

    // 4. Preparar dados para envio
    const emailData = {
      email: userData.email,
      nome: userData.nome || "Usuário",
      uid: uid
    };

    // 5. Configurar transporter com secrets

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUserSecret.value(),
        pass: emailPassSecret.value()
      },
    });

    const dataAtual = new Date().toLocaleString("pt-BR", {
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
  <title>Aviso de Segurança - Senha Alterada</title>
  <style>
    body { margin:0; padding:0; background-color:#f5f7fa; font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:#333; }
    .container { max-width:600px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); overflow:hidden; }
    .header { background:linear-gradient(135deg,#dc2626,#b91c1c); padding:24px; text-align:center; color:#fff; }
    .header h1 { font-size:20px; margin:0; font-weight:600; }
    .content { padding:32px 28px; }
    .content p { font-size:15px; line-height:1.6; margin:12px 0; }
    .alert-box { background-color:#fef2f2; border-left:4px solid #dc2626; padding:16px; margin:20px 0; border-radius:4px; }
    .alert-box p { margin:8px 0; font-size:14px; color:#7f1d1d; }
    .alert-box strong { color:#991b1b; }
    .success-box { background-color:#f0fdf4; border-left:4px solid #10b981; padding:16px; margin:20px 0; border-radius:4px; }
    .success-box p { margin:8px 0; font-size:14px; color:#065f46; }
    .info-box { background-color:#f9fafb; border-left:4px solid #6b7280; padding:16px; margin:20px 0; border-radius:4px; }
    .info-box p { margin:8px 0; font-size:14px; color:#374151; }
    .info-box strong { color:#1f2937; }
    .security-tips { background-color:#fef3c7; border-left:4px solid #f59e0b; padding:16px; margin:20px 0; border-radius:4px; }
    .security-tips h3 { margin:0 0 12px; font-size:16px; color:#92400e; }
    .security-tips ul { margin:8px 0; padding-left:20px; }
    .security-tips li { margin:6px 0; font-size:14px; color:#78350f; }
    .footer { padding:20px 28px; text-align:center; font-size:13px; color:#777; background-color:#f9fafb; border-top:1px solid #e5e7eb; }
    @media (max-width:600px){ .container{margin:20px;} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Aviso de Segurança</h1>
    </div>
    <div class="content">
      <p>Olá, <strong>${emailData.nome}</strong>!</p>

      <div class="success-box">
        <p style="margin:0; font-weight:600; font-size:16px;">
          ✓ Sua senha foi alterada com sucesso
        </p>
      </div>

      <p>
        Confirmamos que a senha da sua conta na <strong>Clínica Dr. Roberto Nigro</strong>
        foi alterada recentemente.
      </p>

      <div class="info-box">
        <p style="margin:0; font-weight:600;">
          Data e Hora da Alteração
        </p>
        <p style="margin:8px 0 0;">
          ${dataAtual}
        </p>
      </div>

      <div class="alert-box">
        <p style="margin:0 0 8px; font-weight:600;">
          Você não realizou esta alteração?
        </p>
        <p style="margin:0;">
          Se você <strong>NÃO solicitou</strong> esta mudança de senha, sua conta pode estar comprometida.
          Entre em contato conosco <strong>IMEDIATAMENTE</strong> pelos canais abaixo para proteger sua conta.
        </p>
      </div>

      <div class="security-tips">
        <h3>Dicas de Segurança</h3>
        <ul>
          <li>Nunca compartilhe sua senha com terceiros</li>
          <li>Use senhas fortes com letras, números e caracteres especiais</li>
          <li>Altere sua senha regularmente</li>
          <li>Não utilize a mesma senha em diferentes serviços</li>
          <li>Desconfie de e-mails solicitando suas credenciais</li>
        </ul>
      </div>

      <p style="margin-top:24px; font-size:14px; color:#6b7280;">
        Este é um e-mail automático de segurança. Se você realizou esta alteração,
        pode ignorar esta mensagem.
      </p>
    </div>
    <div class="footer">
      <p style="margin:0 0 10px; color:#1f2937; font-size:15px; font-weight:600;">
        Clínica Dr. Roberto Nigro
      </p>
      <p style="margin:0; line-height:1.6;">
        <strong>URGENTE - Entre em contato:</strong><br>
        Contato: (11) 96572-1206<br>
        E-mail: admclinicarobertonigro@gmail.com<br>
        Site: www.clinicadrrobertonigro.com.br
      </p>
      <p style="margin:15px 0 0; color:#9ca3af; font-size:12px;">
        Esta é uma mensagem automática. Não é necessário respondê-la.<br/>
        © ${new Date().getFullYear()} Clínica Dr. Roberto Nigro — Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    await transporter.sendMail({
      from: `Clínica Dr. Roberto Nigro <${emailUserSecret.value()}>`,
      to: emailData.email,
      subject: "Aviso de Segurança - Senha Alterada — Clínica Dr. Roberto Nigro",
      html,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
      },
    });

    console.log(`E-mail de alteração de senha enviado para ${emailData.email}`);

    // 6. Atualizar campo senhaAlteradaEm no Firestore (backup para trigger)
    await db.collection("usuarios").doc(uid).set(
      {
        senhaAlteradaEm: admin.firestore.FieldValue.serverTimestamp(),
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    return { sucesso: true };

  } catch (error) {
    console.error("Erro ao notificar alteração de senha:", error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError("internal", "Erro ao enviar notificação de alteração de senha");
  }
});


