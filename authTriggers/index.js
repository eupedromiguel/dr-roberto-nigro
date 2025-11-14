// Ponto Importante: Atualmente, os triggers de autenticação do Firebase são suportados apenas por Cloud Functions de 1ª Geração. Embora o Firebase esteja avançando para a 2ª Geração, pode ter funções de 1ª e 2ª Geração coexistindo no mesmo projeto. Para esse caso, isso significa que usamos a sintaxe e as bibliotecas da 1ª Geração para esses triggers específicos.
// =============================================
// Auth Triggers - Cloud Functions v1 (Node 20)
// =============================================
// - Usa Admin SDK compartilhado
// - Não sobrescreve dados vindos do front

const functions = require("firebase-functions");
const { admin, db } = require("./firebaseAdmin");
const { sendVerificationEmail } = require("./notificacoes");

const timestamp = admin.firestore.FieldValue.serverTimestamp();

// =========================================================
// onUserCreated
// =========================================================
// Dispara automaticamente quando um novo usuário é criado.
// - Define role "patient"
// - Cria/atualiza documento no Firestore com merge seguro
// - Envia e-mail de verificação (quando aplicável)
// =========================================================
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;

  try {
    console.log(`👤 Novo usuário criado: ${uid} (${user.email || "sem e-mail"})`);

    // Define custom claim padrão
    await admin.auth().setCustomUserClaims(uid, { role: "patient" });

    // Monta documento apenas com campos válidos
    const userDoc = {
      uid,
      role: "patient",
      criadoEm: timestamp,
      atualizadoEm: timestamp,
    };

    if (user.email) {
      userDoc.email = user.email;
      console.log(`📧 E-mail detectado: ${user.email}`);
    }

    if (user.phoneNumber) {
      userDoc.telefone = user.phoneNumber;
      console.log(`📱 Telefone detectado: ${user.phoneNumber}`);
    } else {
      console.log("ℹ️ Nenhum telefone detectado no momento (provavelmente será vinculado depois).");
    }

    if (user.displayName && user.displayName.trim() !== "") {
      userDoc.nome = user.displayName;
      console.log(`👤 Nome detectado: ${user.displayName}`);
    } else {
      console.log("ℹ️ Nome ainda não definido (aguardando atualização via front-end).");
    }

    // Atualiza o Firestore SEM sobrescrever dados existentes
    await db.collection("usuarios").doc(uid).set(userDoc, { merge: true });
    console.log(`✅ Documento 'usuarios/${uid}' criado/atualizado com segurança.`);

    // Envia e-mail de verificação (apenas se tiver e-mail)
    if (user.email) {
      try {
        await sendVerificationEmail(user);
        console.log(`📨 E-mail de verificação enviado para: ${user.email}`);
      } catch (mailErr) {
        console.warn(`⚠️ Falha ao enviar e-mail de verificação: ${mailErr.message}`);
      }
    } else {
      console.log("ℹ️ Usuário criado sem e-mail (ex: login via telefone). Nenhum e-mail enviado.");
    }

    return null;
  } catch (error) {
    console.error("❌ Erro no gatilho onUserCreated:", error);
    return null;
  }
});

// =========================================================
// onUserDelete
// =========================================================
// Dispara automaticamente ao deletar um usuário.
// - Remove documento Firestore
// - Revoga tokens de login
// =========================================================
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;

  try {
    await db.collection("usuarios").doc(uid).delete();
    console.log(`🗑️ Documento 'usuarios/${uid}' removido.`);

    try {
      await admin.auth().revokeRefreshTokens(uid);
      console.log(`🔒 Tokens revogados para ${uid}`);
    } catch (revErr) {
      console.warn(`⚠️ Erro ao revogar tokens de ${uid}:`, revErr);
    }

    return null;
  } catch (error) {
    console.error("❌ Erro no gatilho onUserDelete:", error);
    return null;
  }
});
