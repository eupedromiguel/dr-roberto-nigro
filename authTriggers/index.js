// Ponto Importante: Atualmente, os triggers de autenticação do Firebase são suportados apenas por Cloud Functions de 1ª Geração. Embora o Firebase esteja avançando para a 2ª Geração, pode ter funções de 1ª e 2ª Geração coexistindo no mesmo projeto. Para esse caso, isso significa que usamos a sintaxe e as bibliotecas da 1ª Geração para esses triggers específicos.
// =============================================
// Auth Triggers - Cloud Functions v1 (Node 20)
// =============================================
// - Usa Admin SDK compartilhado
// - Não sobrescreve dados vindos do front

const functions = require("firebase-functions");
const { admin, db } = require("./firebaseAdmin");
const { sendVerificationEmail, sendAppointmentConfirmationEmail, sendRetornoConfirmationEmail, sendAppointmentCancellationEmail, sendConvenioRecusadoEmail, sendAccountDeletionEmail } = require("./notificacoes");

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
// - Busca dados do usuário antes de deletar
// - Envia e-mail de confirmação
// - Remove documento Firestore
// - Revoga tokens de login
// =========================================================
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
  const uid = user.uid;

  try {
    // 1. BUSCAR DADOS DO USUÁRIO ANTES DE DELETAR
    let userData = null;
    try {
      const userDoc = await db.collection("usuarios").doc(uid).get();
      if (userDoc.exists) {
        userData = userDoc.data();
        console.log(`Dados do usuário ${uid} recuperados antes da exclusão.`);
      }
    } catch (err) {
      console.warn(`Erro ao buscar dados do usuário ${uid}:`, err);
    }

    // 2. ENVIAR E-MAIL DE NOTIFICAÇÃO
    try {
      // Usar dados do Firestore se disponíveis, senão usar dados do Auth
      const emailDestino = userData?.email || user.email;
      const nomeUsuario = userData?.nome || user.displayName || "Usuário";

      if (emailDestino) {
        await sendAccountDeletionEmail({
          email: emailDestino,
          nome: nomeUsuario,
        });
        console.log(`E-mail de exclusão enviado para ${emailDestino}`);
      } else {
        console.warn(`Usuário ${uid} não possui e-mail. E-mail de exclusão não enviado.`);
      }
    } catch (emailErr) {
      console.error(`Erro ao enviar e-mail de exclusão para ${uid}:`, emailErr);
      // Não bloquear a exclusão se o e-mail falhar
    }

    // 3. DELETAR DOCUMENTO FIRESTORE (se ainda existir)
    try {
      await db.collection("usuarios").doc(uid).delete();
      console.log(`Documento 'usuarios/${uid}' removido.`);
    } catch (delErr) {
      console.warn(`Erro ao deletar documento 'usuarios/${uid}':`, delErr);
    }

    // 4. REVOGAR TOKENS
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


// =========================================================
// onAppointmentRetorno
// =========================================================
// Dispara automaticamente quando uma coleção retorno é
// criada ou sempre que os campos "novaData" e "novoHorario"
// forem atualizados.
// - Busca dados do paciente (nome, email)
// - Busca dados do médico (nome) em usuarios
// - Busca especialidade do médico em medicos_publicos
// - Envia e-mail para o paciente
// =========================================================
exports.onAppointmentRetorno = functions.firestore
  .document("appointments/{appointmentId}/retorno/{retornoId}")
  .onWrite(async (change, context) => {
    const appointmentId = context.params.appointmentId;
    const retornoId = context.params.retornoId;

    try {
      // Se o documento foi deletado, não fazer nada
      if (!change.after.exists) {
        console.log(`Retorno ${retornoId} do appointment ${appointmentId} foi deletado. Nenhuma ação necessária.`);
        return null;
      }

      const retornoData = change.after.data();
      const retornoBefore = change.before.exists ? change.before.data() : null;

      // Se é uma atualização, verificar se novaData ou novoHorario mudaram
      if (retornoBefore) {
        const dataChanged = retornoBefore.novaData !== retornoData.novaData;
        const horarioChanged = retornoBefore.novoHorario !== retornoData.novoHorario;

        if (!dataChanged && !horarioChanged) {
          console.log(`Retorno ${retornoId} atualizado, mas novaData e novoHorario não mudaram. Nenhum e-mail enviado.`);
          return null;
        }
      }

      console.log(`Retorno ${change.before.exists ? 'atualizado' : 'criado'}: ${retornoId} para appointment ${appointmentId}`);

      // 1. Buscar dados do appointment pai
      const appointmentDoc = await db.collection("appointments").doc(appointmentId).get();
      if (!appointmentDoc.exists) {
        console.error(`Appointment ${appointmentId} não encontrado.`);
        return null;
      }

      const appointmentData = appointmentDoc.data();
      const pacienteId = appointmentData.pacienteId;
      const medicoId = appointmentData.medicoId;

      if (!pacienteId || !medicoId) {
        console.error(`Appointment ${appointmentId} sem pacienteId ou medicoId.`);
        return null;
      }

      // 2. Buscar dados do paciente
      const pacienteDoc = await db.collection("usuarios").doc(pacienteId).get();
      if (!pacienteDoc.exists) {
        console.error(`Paciente ${pacienteId} não encontrado no Firestore.`);
        return null;
      }

      const pacienteData = pacienteDoc.data();
      const pacienteInfo = {
        nome: pacienteData.nome || "Paciente",
      };

      if (!pacienteData.email) {
        console.warn(`Paciente ${pacienteId} não possui e-mail cadastrado. Abortando envio.`);
        return null;
      }

      // 3. Buscar dados do médico
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

      // 4. Buscar especialidade do médico em medicos_publicos
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

      // 5. Preparar dados do retorno com e-mail do paciente
      const retornoComEmail = {
        ...retornoData,
        email: pacienteData.email,
      };

      // 6. Enviar e-mail de confirmação
      await sendRetornoConfirmationEmail(retornoComEmail, pacienteInfo, medicoInfo);
      console.log(`E-mail de confirmação de retorno enviado com sucesso para ${pacienteData.email}`);

      return null;
    } catch (error) {
      console.error("Erro no gatilho onAppointmentRetorno:", error);
      return null;
    }
  });


// =========================================================
// onAppointmentCancellation
// =========================================================
// Dispara automaticamente quando um appointment é cancelado
// pelo médico ou admin.
// - Verifica se canceledBy é "doctor" ou "admin"
// - Busca dados do paciente (nome, email)
// - Busca dados do médico (nome) em usuarios
// - Busca especialidade do médico em medicos_publicos
// - Envia e-mail para o paciente
// =========================================================
exports.onAppointmentCancellation = functions.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const appointmentId = context.params.appointmentId;
    const before = change.before.data();
    const after = change.after.data();

    try {
      // Verificar se foi um cancelamento (status mudou para "cancelada")
      if (before.status === "cancelada" || after.status !== "cancelada") {
        // Não é um cancelamento novo, ignorar
        return null;
      }

      console.log(`Appointment ${appointmentId} foi cancelado.`);

      // Verificar quem cancelou
      const canceledBy = after.canceledBy;

      if (canceledBy !== "doctor" && canceledBy !== "admin") {
        console.log(`Cancelamento feito por ${canceledBy}. E-mail não será enviado.`);
        return null;
      }

      console.log(`Cancelamento feito por ${canceledBy}. Enviando e-mail ao paciente.`);

      // 1. Buscar dados do paciente
      const pacienteId = after.pacienteId;
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
      };

      if (!pacienteData.email) {
        console.warn(`Paciente ${pacienteId} não possui e-mail cadastrado. Abortando envio.`);
        return null;
      }

      // 2. Buscar dados do médico
      const medicoId = after.medicoId;
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

      // 4. Preparar dados do appointment com e-mail do paciente
      const appointmentComEmail = {
        ...after,
        email: pacienteData.email,
      };

      // 5. Enviar e-mail de cancelamento
      await sendAppointmentCancellationEmail(appointmentComEmail, pacienteInfo, medicoInfo);
      console.log(`E-mail de cancelamento de consulta enviado com sucesso para ${pacienteData.email}`);

      return null;
    } catch (error) {
      console.error("Erro no gatilho onAppointmentCancellation:", error);
      return null;
    }
  });


// =========================================================
// onConvenioRecusado
// =========================================================
// Dispara automaticamente quando notificacaoStatus muda para "recusado".
// - Verifica mudança de status
// - Busca dados do paciente (nome, email)
// - Busca dados do médico (nome) em usuarios
// - Busca especialidade do médico em medicos_publicos
// - Envia e-mail para o paciente
// =========================================================
exports.onConvenioRecusado = functions.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const appointmentId = context.params.appointmentId;
    const before = change.before.data();
    const after = change.after.data();

    try {
      // Verificar se notificacaoStatus mudou para "recusado"
      if (before.notificacaoStatus === "recusado" || after.notificacaoStatus !== "recusado") {
        // Não é uma mudança para "recusado", ignorar
        return null;
      }

      console.log(`Convênio recusado para appointment ${appointmentId}`);

      // 1. Buscar dados do paciente
      const pacienteId = after.pacienteId;
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
      };

      if (!pacienteData.email) {
        console.warn(`Paciente ${pacienteId} não possui e-mail cadastrado. Abortando envio.`);
        return null;
      }

      // 2. Buscar dados do médico
      const medicoId = after.medicoId;
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

      // 4. Preparar dados do appointment com e-mail do paciente
      const appointmentComEmail = {
        ...after,
        email: pacienteData.email,
      };

      // 5. Enviar e-mail de recusa de convênio
      await sendConvenioRecusadoEmail(appointmentComEmail, pacienteInfo, medicoInfo);
      console.log(`E-mail de recusa de convênio enviado com sucesso para ${pacienteData.email}`);

      return null;
    } catch (error) {
      console.error("Erro no gatilho onConvenioRecusado:", error);
      return null;
    }
  });
