const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Criar consulta 
 */
exports.criarConsulta = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const role = request.auth.token.role;
  if (role !== "patient") {
    throw new HttpsError(
      "permission-denied",
      "Apenas pacientes podem agendar consultas."
    );
  }


  if (!request.auth.token.email_verified) {
    throw new HttpsError(
      "failed-precondition",
      "Você precisa verificar seu e-mail antes de agendar uma consulta."
    );
  }


  const pacienteId = request.auth.uid;
  const {
    medicoId,
    slotId,
    horario,
    sintomas,
    tipoAtendimento,
    convenio,
    categoria,
    carteirinha,
    tipoConsulta,
    unidade,
  } = request.data || {};




  // Validação de médico, slot e horário
  if (!medicoId || !slotId || !horario) {
    throw new HttpsError(
      "invalid-argument",
      "Campos obrigatórios: medicoId, slotId e horario."
    );
  }

  // Validação da unidade médica
  if (tipoConsulta !== "teleconsulta" && (!unidade || unidade.trim() === "")) {
    throw new HttpsError(
      "invalid-argument",
      "Unidade médica é obrigatória para consultas presenciais."
    );
  }

  // Se for teleconsulta, define unidade padrão
  const unidadeFinal =
    tipoConsulta === "teleconsulta"
      ? "Atendimento remoto - Teleconsulta"
      : unidade;



  if (tipoAtendimento === "convenio") {
    if (!categoria || categoria.trim() === "") {
      throw new HttpsError("invalid-argument", "Categoria do convênio é obrigatória.");
    }

    if (!carteirinha || carteirinha.trim() === "") {
      throw new HttpsError("invalid-argument", "Número da carteirinha é obrigatório.");
    }

    if (carteirinha.length > 20) {
      throw new HttpsError("invalid-argument", "A carteirinha deve ter no máximo 20 caracteres.");
    }
  }






  try {
    // Verifica se o horário já está ocupado
    const conflitoSnap = await db
      .collection("appointments")
      .where("medicoId", "==", medicoId)
      .where("horario", "==", horario)
      .where("status", "in", ["agendado", "concluida"])
      .limit(1)
      .get();

    if (!conflitoSnap.empty) {
      throw new HttpsError("already-exists", "Esse horário já está ocupado.");
    }

    // Impede novo agendamento com o mesmo médico se houver retorno pendente ou consulta ativa
    const conflitoMesmoMedico = await db
      .collection("appointments")
      .where("pacienteId", "==", pacienteId)
      .where("medicoId", "==", medicoId)
      .where("status", "in", ["agendado", "confirmado", "retorno"])
      .limit(1)
      .get();

    if (!conflitoMesmoMedico.empty) {
      // Verifica se o conflito é um retorno
      const consultaConflito = conflitoMesmoMedico.docs[0].data();
      if (consultaConflito.status === "retorno") {
        throw new HttpsError(
          "failed-precondition",
          "Você já possui um retorno agendado com este médico. Aguarde a conclusão antes de marcar novamente."
        );
      } else {
        throw new HttpsError(
          "failed-precondition",
          "Você já possui uma consulta ativa com este médico. Aguarde a conclusão antes de marcar novamente."
        );
      }
    }


    // Busca o valor da consulta no perfil do médico
    const medicoSnap = await db.collection("usuarios").doc(medicoId).get();
    const medicoData = medicoSnap.exists ? medicoSnap.data() : {};

    const valorConsulta = medicoData?.valorConsulta || null;
    const valorteleConsulta = medicoData?.valorteleConsulta || null;

    // Cria a consulta com os valores do médico
    const ref = await db.collection("appointments").add({
      pacienteId,
      medicoId,
      slotId,
      horario,
      tipoConsulta: tipoConsulta || "presencial",
      sintomas: sintomas || null,
      tipoAtendimento: tipoAtendimento || "particular",


      convenio: tipoAtendimento === "convenio" ? convenio || null : null,
      categoria: tipoAtendimento === "convenio" ? categoria || null : null,
      carteirinha: tipoAtendimento === "convenio" ? carteirinha || null : null,

      unidade: unidadeFinal || "Não informado",
      valorConsulta: tipoAtendimento === "particular" ? valorConsulta : null,
      valorteleConsulta: tipoAtendimento === "particular" ? valorteleConsulta : null,

      status: "agendado",
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });



    // Atualiza o slot para "ocupado"
    await db.collection("availability_slots").doc(slotId).update({
      status: "ocupado",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Retorna o ID do documento criado
    return {
      sucesso: true,
      id: ref.id,
      mensagem: "Consulta criada com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao criar consulta:", error);
    throw new HttpsError("internal", "Erro ao criar a consulta.", error.message);
  }
});

/**

 * Cancelar consulta
 * ----------------------------------------------------------
 * - Paciente OU médico podem cancelar
 * - Marca como "cancelada" em vez de deletar
 */
exports.cancelarConsulta = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const { consultaId } = request.data || {};
  if (!consultaId) {
    throw new HttpsError("invalid-argument", "O campo 'consultaId' é obrigatório.");
  }

  try {
    const consultaRef = db.collection("appointments").doc(consultaId);
    const snap = await consultaRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Consulta não encontrada.");
    }

    const consulta = snap.data();
    const uid = request.auth.uid;
    const role = request.auth.token.role;

    if (
      consulta.pacienteId !== uid &&
      consulta.medicoId !== uid &&
      role !== "admin"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Apenas o médico, o paciente ou um administrador podem cancelar esta consulta."
      );
    }


    // Atualiza o status
    await consultaRef.update({
      status: "cancelada",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Libera o slot novamente (se existir)
    if (consulta.slotId) {
      await db.collection("availability_slots").doc(consulta.slotId).update({
        status: "livre",
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log(`🟠 Consulta ${consultaId} marcada como cancelada.`);
    return { sucesso: true, mensagem: "Consulta cancelada com sucesso." };
  } catch (error) {
    console.error("Erro ao cancelar consulta:", error);
    throw new HttpsError("internal", "Erro ao cancelar a consulta.", error.message);
  }
});

/**
 * ==========================================================
 * Marcar como concluída
 * ----------------------------------------------------------
 * - Apenas o médico pode concluir
 * - Atualiza o status para "concluida"
 * ==========================================================
 */
exports.marcarComoConcluida = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const { consultaId } = request.data || {};
  if (!consultaId) {
    throw new HttpsError("invalid-argument", "O campo 'consultaId' é obrigatório.");
  }

  try {
    const consultaRef = db.collection("appointments").doc(consultaId);
    const snap = await consultaRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Consulta não encontrada.");
    }

    const consulta = snap.data();
    const uid = request.auth.uid;
    const role = request.auth.token.role;

    if (consulta.medicoId !== uid && role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Apenas o médico responsável ou um administrador podem concluir esta consulta."
      );
    }


    await consultaRef.update({
      status: "concluida",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🟢 Consulta ${consultaId} marcada como concluída.`);
    return {
      sucesso: true,
      mensagem: "Consulta marcada como concluída com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao marcar como concluída:", error);
    throw new HttpsError("internal", "Erro ao concluir a consulta.", error.message);
  }
});

/**
 * ==========================================================
 * Listar consultas (para paciente, médico ou admin)
 * ----------------------------------------------------------
 * - Pacientes → vêem apenas as próprias
 * - Médicos → vêem apenas as suas
 * - Admin → vê TODAS as consultas
 * - Inclui dados de retorno (subcoleção)
 * ==========================================================
 */
exports.listarConsultas = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const uid = request.auth.uid;
  const role = request.auth.token.role || null;
  let query;

  try {
    if (role === "patient") {
      query = db.collection("appointments").where("pacienteId", "==", uid);
    } else if (role === "doctor") {
      query = db.collection("appointments").where("medicoId", "==", uid);
    } else if (role === "admin") {
      query = db.collection("appointments");
    } else {
      throw new HttpsError(
        "permission-denied",
        "Apenas pacientes, médicos ou administradores podem listar consultas."
      );
    }

    const snap = await query.get();
    const consultas = [];

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const consulta = { id: docSnap.id, ...data };

      // Buscar dados do paciente
      if (data.pacienteId) {
        try {
          const pacienteSnap = await db.collection("usuarios").doc(data.pacienteId).get();
          if (pacienteSnap.exists) {
            const p = pacienteSnap.data();
            consulta.paciente = {
              nome: p.nome || "Paciente sem nome",
              telefone: p.telefone || "",
              dataNascimento: p.dataNascimento || null,
              cpf: p.cpf || "",
              sexoBiologico: p.sexoBiologico || "",
            };
          } else {
            consulta.paciente = { nome: "Paciente não encontrado" };
          }
        } catch (err) {
          console.error("Erro ao buscar paciente:", err);
          consulta.paciente = { nome: "Erro ao buscar dados" };
        }
      }

      // Buscar dados do médico (para admins ou pacientes)
      if (role !== "doctor" && data.medicoId) {
        try {
          const medicoSnap = await db.collection("usuarios").doc(data.medicoId).get();
          if (medicoSnap.exists) {
            const m = medicoSnap.data();
            consulta.medico = {
              nome: m.nome || "Médico sem nome",
              especialidade: m.especialidade || "",
            };
          } else {
            consulta.medico = { nome: "Médico não encontrado" };
          }
        } catch (err) {
          console.error("Erro ao buscar médico:", err);
          consulta.medico = { nome: "Erro ao buscar dados" };
        }
      }

      // Buscar retorno agendado (subcoleção)
      try {
        const retornoSnap = await db
          .collection("appointments")
          .doc(consulta.id)
          .collection("retorno")
          .limit(1)
          .get();

        if (!retornoSnap.empty) {
          const r = retornoSnap.docs[0].data();
          consulta.retornoAgendado = {
            novaData: r.novaData,
            novoHorario: r.novoHorario,
            observacoes: r.observacoes || null,
            tipoRetorno: r.tipoRetorno || "presencial",
            unidade: r.unidade || null,
          };

        } else {
          consulta.retornoAgendado = null;
        }
      } catch (err) {
        console.error("Erro ao buscar retorno:", err);
        consulta.retornoAgendado = null;
      }

      consultas.push(consulta);
    }

    console.log(`Usuário ${uid} (${role}) listou ${consultas.length} consultas.`);
    return { sucesso: true, consultas };
  } catch (error) {
    console.error("Erro ao listar consultas:", error);
    throw new HttpsError("internal", "Erro ao listar consultas.", error.message);
  }
});

/**
 * ==========================================================
 * Marcar como "retorno"
 * ----------------------------------------------------------
 * - Atualiza o status para "retorno"
 * ==========================================================
 */
exports.marcarComoRetorno = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const { consultaId } = request.data || {};
  if (!consultaId) {
    throw new HttpsError("invalid-argument", "O campo 'consultaId' é obrigatório.");
  }

  try {
    const consultaRef = db.collection("appointments").doc(consultaId);
    const snap = await consultaRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Consulta não encontrada.");
    }

    const consulta = snap.data();
    const uid = request.auth.uid;
    const role = request.auth.token.role;

    if (consulta.medicoId !== uid && role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Apenas o médico responsável ou um administrador podem marcar esta consulta como retorno."
      );
    }


    // Atualiza o status
    await consultaRef.update({
      status: "retorno",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🔵 Consulta ${consultaId} marcada como retorno pelo médico ${uid}.`);
    return {
      sucesso: true,
      mensagem: "Consulta marcada como retorno com sucesso.",
    };
  } catch (error) {
    console.error("Erro ao marcar como retorno:", error);
    throw new HttpsError("internal", "Erro ao marcar como retorno.", error.message);
  }
});

/**
 * ==========================================================
 * Agendar ou remarcar retorno
 * ----------------------------------------------------------
 * - Apenas o médico responsável pode agendar ou remarcar
 * - Salva na subcoleção appointments/{consultaId}/retorno
 * - Armazena tipo (presencial/teleconsulta) e unidade (se aplicável)
 * ==========================================================
 */
exports.agendarRetorno = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const { consultaId, novaData, novoHorario, observacoes, tipoRetorno, unidade } =
    request.data || {};

  if (!consultaId || !novaData || !novoHorario || !tipoRetorno) {
    throw new HttpsError(
      "invalid-argument",
      "Campos obrigatórios ausentes (consultaId, novaData, novoHorario, tipoRetorno)."
    );
  }

  // Validação de unidade — obrigatória se presencial
  if (tipoRetorno === "presencial" && (!unidade || unidade.trim() === "")) {
    throw new HttpsError(
      "invalid-argument",
      "A unidade médica é obrigatória para retornos presenciais."
    );
  }

  const unidadeFinal =
    tipoRetorno === "teleconsulta"
      ? "Atendimento remoto - Teleconsulta"
      : unidade;

  try {
    const consultaRef = db.collection("appointments").doc(consultaId);
    const snap = await consultaRef.get();

    if (!snap.exists) throw new HttpsError("not-found", "Consulta não encontrada.");

    const consulta = snap.data();
    const uid = request.auth.uid;
    const role = request.auth.token.role;

    if (consulta.medicoId !== uid && role !== "admin") {
      throw new HttpsError(
        "permission-denied",
        "Apenas o médico responsável ou um administrador podem agendar o retorno."
      );
    }


    const retornoRef = consultaRef.collection("retorno");
    const retornoSnap = await retornoRef.limit(1).get();

    const payload = {
      novaData,
      novoHorario,
      observacoes: observacoes || null,
      tipoRetorno,
      unidade: unidadeFinal,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (!retornoSnap.empty) {
      // Atualiza o retorno existente
      const docId = retornoSnap.docs[0].id;
      await retornoRef.doc(docId).update(payload);
    } else {
      // Cria novo retorno
      await retornoRef.add({
        ...payload,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Atualiza status da consulta principal
    await consultaRef.update({
      status: "retorno",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🔵 Retorno salvo para consulta ${consultaId}. Tipo: ${tipoRetorno}`);
    return { sucesso: true, mensagem: "Retorno agendado com sucesso." };
  } catch (error) {
    console.error("Erro ao agendar retorno:", error);
    throw new HttpsError("internal", "Erro ao agendar o retorno.", error.message);
  }
});


