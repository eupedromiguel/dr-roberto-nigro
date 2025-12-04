const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./firebaseAdmin");


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
  const { nome, telefone, cpf, dataNascimento, sexoBiologico, role } = request.data || {};


  if (typeof role !== "undefined") {
    throw new HttpsError(
      "permission-denied",
      "Campo 'role' não pode ser alterado pelo cliente."
    );
  }

  const updates = {};
  if (typeof nome === "string") updates.nome = nome;
  if (typeof telefone === "string") updates.telefone = telefone;
  if (typeof cpf === "string") updates.cpf = cpf;
  if (typeof dataNascimento === "string") updates.dataNascimento = dataNascimento;
  if (typeof sexoBiologico === "string") updates.sexoBiologico = sexoBiologico;
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
