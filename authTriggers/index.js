// Ponto Importante: Atualmente, os triggers de autenticação do Firebase são suportados apenas por Cloud Functions de 1ª Geração. Embora o Firebase esteja avançando para a 2ª Geração, pode ter funções de 1ª e 2ª Geração coexistindo no mesmo projeto. Para esse caso, isso significa que usamos a sintaxe e as bibliotecas da 1ª Geração para esses triggers específicos.
// =============================================
// Auth Triggers - Cloud Functions v1 (Node 20)
// =============================================
// - Usa Admin SDK compartilhado
// - Não sobrescreve dados vindos do front

const functions = require("firebase-functions");
const { admin, db } = require("./firebaseAdmin");
const { sendVerificationEmail, sendAppointmentConfirmationEmail } = require("./notificacoes");

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
    console.log(`Novo usuário criado: ${uid} (${user.email || "sem e-mail"})`);

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
      console.log(`E-mail detectado: ${user.email}`);
    }

    if (user.phoneNumber) {
      userDoc.telefone = user.phoneNumber;
      console.log(`Telefone detectado: ${user.phoneNumber}`);
    } else {
      console.log("Nenhum telefone detectado no momento (provavelmente será vinculado depois).");
    }

    if (user.displayName && user.displayName.trim() !== "") {
      userDoc.nome = user.displayName;
      console.log(`Nome detectado: ${user.displayName}`);
    } else {
      console.log("Nome ainda não definido (aguardando atualização via front-end).");
    }

    // Atualiza o Firestore SEM sobrescrever dados existentes
    await db.collection("usuarios").doc(uid).set(userDoc, { merge: true });
    console.log(`Documento 'usuarios/${uid}' criado/atualizado com segurança.`);

    // Envia e-mail de verificação (apenas se tiver e-mail)
    if (user.email) {
      try {
        await sendVerificationEmail(user);
        console.log(`E-mail de verificação enviado para: ${user.email}`);
      } catch (mailErr) {
        console.warn(`Falha ao enviar e-mail de verificação: ${mailErr.message}`);
      }
    } else {
      console.log("Usuário criado sem e-mail (ex: login via telefone). Nenhum e-mail enviado.");
    }

    return null;
  } catch (error) {
    console.error("Erro no gatilho onUserCreated:", error);
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
    console.log(`Documento 'usuarios/${uid}' removido.`);

    try {
      await admin.auth().revokeRefreshTokens(uid);
      console.log(`Tokens revogados para ${uid}`);
    } catch (revErr) {
      console.warn(`Erro ao revogar tokens de ${uid}:`, revErr);
    }

    return null;
  } catch (error) {
    console.error("Erro no gatilho onUserDelete:", error);
    return null;
  }
});


// =========================================================
// onAppointmentCreated
// =========================================================
// Dispara automaticamente quando um novo appointment é criado.
// - Busca dados do paciente (nome, email)
// - Busca dados do médico (nome) em usuarios
// - Busca especialidade do médico em medicos_publicos
// - Envia e-mail de confirmação para o paciente
// =========================================================
exports.onAppointmentCreated = functions.firestore
  .document("appointments/{appointmentId}")
  .onCreate(async (snap, context) => {
    const appointmentData = snap.data();
    const appointmentId = context.params.appointmentId;

    try {
      console.log(`Novo appointment criado: ${appointmentId}`);

      // 1. Buscar dados do paciente
      const pacienteId = appointmentData.pacienteId;
      if (!pacienteId) {
        console.error("Appointment sem pacienteId. Abortando envio de e-mail.");
        return null;
      }

      const pacienteDoc = await db.collection("usuarios").doc(pacienteId).get();
      if (!pacienteDoc.exists) {
        console.error(`Paciente ${pacienteId} não encontrado no Firestore.`);
        return null;
      }

      const pacienteData = pacienteDoc.data();
      const pacienteInfo = {
        nome: pacienteData.nome || "Paciente",
        email: pacienteData.email,
      };

      if (!pacienteInfo.email) {
        console.warn(`Paciente ${pacienteId} não possui e-mail cadastrado. Abortando envio.`);
        return null;
      }

      // 2. Buscar dados do médico
      const medicoId = appointmentData.medicoId;
      if (!medicoId) {
        console.error("Appointment sem medicoId. Abortando envio de e-mail.");
        return null;
      }

      const medicoDoc = await db.collection("usuarios").doc(medicoId).get();
      if (!medicoDoc.exists) {
        console.error(`Médico ${medicoId} não encontrado em 'usuarios'.`);
        return null;
      }

      const medicoData = medicoDoc.data();
      const medicoInfo = {
        nome: medicoData.nome || "Médico",
        especialidade: null,
      };

      // 3. Buscar especialidade do médico em medicos_publicos
      try {
        const medicoPublicoDoc = await db.collection("medicos_publicos").doc(medicoId).get();
        if (medicoPublicoDoc.exists) {
          const medicoPublicoData = medicoPublicoDoc.data();
          medicoInfo.especialidade = medicoPublicoData.especialidade || null;
        } else {
          console.warn(`Médico ${medicoId} não encontrado em 'medicos_publicos'. Especialidade não será exibida.`);
        }
      } catch (err) {
        console.warn(`Erro ao buscar especialidade do médico ${medicoId}:`, err);
      }

      // 4. Enviar e-mail de confirmação
      await sendAppointmentConfirmationEmail(appointmentData, pacienteInfo, medicoInfo);
      console.log(`E-mail de confirmação enviado com sucesso para ${pacienteInfo.email}`);

      return null;
    } catch (error) {
      console.error("Erro no gatilho onAppointmentCreated:", error);
      return null;
    }
  });
