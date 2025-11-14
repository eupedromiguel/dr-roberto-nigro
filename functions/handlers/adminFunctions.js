const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { admin, db } = require("./firebaseAdmin");


// LISTAR USUÁRIOS

exports.listarUsuarios = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Apenas administradores podem listar usuários."
    );
  }

  try {
    const snap = await db.collection("usuarios").get();

    const usuarios = snap.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    return { usuarios };
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    throw new HttpsError("internal", "Erro ao listar usuários.");
  }
});


// DEFINIR PAPEL (role)

exports.definirRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Apenas administradores podem definir papéis."
    );
  }

  const { uid, role } = request.data || {};
  if (!uid || !role) {
    throw new HttpsError(
      "invalid-argument",
      "É necessário fornecer UID e novo papel."
    );
  }

  const rolesPermitidas = ["patient", "doctor", "admin"];
  if (!rolesPermitidas.includes(role)) {
    throw new HttpsError("invalid-argument", "Papel inválido fornecido.");
  }

  try {
    // Define o claim no Auth
    await admin.auth().setCustomUserClaims(uid, { role });

    // Atualiza no Firestore
    await db.collection("usuarios").doc(uid).set({ role }, { merge: true });

    return {
      sucesso: true,
      mensagem: `Papel do usuário ${uid} atualizado para ${role}.`,
    };
  } catch (error) {
    console.error("Erro ao definir papel:", error);
    throw new HttpsError("internal", "Erro ao definir papel.");
  }
});


// REMOVER USUÁRIO

exports.removerUsuario = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Você precisa estar autenticado para executar esta ação."
    );
  }

  if (request.auth.token.role !== "admin") {
    throw new HttpsError(
      "permission-denied",
      "Apenas administradores podem remover usuários."
    );
  }

  const { uid } = request.data || {};
  if (!uid) {
    throw new HttpsError(
      "invalid-argument",
      "É necessário fornecer o UID do usuário."
    );
  }

  try {
    // Remove do Auth
    await admin.auth().deleteUser(uid);

    // Remove do Firestore
    await db.collection("usuarios").doc(uid).delete();

    return {
      sucesso: true,
      mensagem: `Usuário ${uid} removido com sucesso.`,
    };
  } catch (error) {
    console.error("Erro ao remover usuário:", error);
    throw new HttpsError(
      "internal",
      "Erro ao remover o usuário.",
      error.message
    );
  }
});
