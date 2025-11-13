const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Inicializa o Admin SDK apenas uma vez
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * ==========================================================
 * Criar slot de disponibilidade
 * ==========================================================
 */
exports.criarSlot = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");

  const role = request.auth.token.role;
  const uid = request.auth.uid;
  const { data, hora, status = "livre", medicoId } = request.data || {};

  if (!data || !hora) {
    throw new HttpsError("invalid-argument", "Campos obrigatórios: data e hora.");
  }

  // Médico pode criar seus próprios slots; admin pode criar para outros médicos
  const targetMedicoId = role === "doctor" ? uid : medicoId;

  if (role !== "doctor" && role !== "admin") {
    throw new HttpsError("permission-denied", "Apenas médicos ou administradores podem criar slots.");
  }

  if (role === "admin" && !targetMedicoId) {
    throw new HttpsError("invalid-argument", "O campo 'medicoId' é obrigatório para administradores.");
  }

  try {
    // Formata data (YYYY-MM-DD → DD-MM-YYYY)
    const partes = data.split("-");
    if (partes.length !== 3)
      throw new HttpsError("invalid-argument", "Formato de data inválido (esperado YYYY-MM-DD).");
    const dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;

    // Bloqueia slots no passado
    const agora = new Date();
    const todayISO = agora.toISOString().split("T")[0];
    const nowHM = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    const [ddF, mmF, yyyyF] = dataFormatada.split("-");
    const iso = `${yyyyF}-${mmF}-${ddF}`;
    if (iso < todayISO || (iso === todayISO && hora <= nowHM)) {
      throw new HttpsError("failed-precondition", "Não é permitido criar slot no passado.");
    }

    // Verifica conflito
    const conflitoSnap = await db
      .collection("availability_slots")
      .where("medicoId", "==", targetMedicoId)
      .where("data", "==", dataFormatada)
      .where("hora", "==", hora)
      .limit(1)
      .get();

    if (!conflitoSnap.empty) {
      const existente = conflitoSnap.docs[0];
      if (existente.data().status === "cancelado") {
        await existente.ref.update({
          status: "livre",
          atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`♻️ Slot reativado: ${dataFormatada} ${hora} — médico ${targetMedicoId}`);
        return { sucesso: true, mensagem: "Slot reaberto com sucesso." };
      }
      throw new HttpsError("already-exists", "Já existe um slot para este dia e hora.");
    }

    await db.collection("availability_slots").add({
      medicoId: targetMedicoId,
      data: dataFormatada,
      hora,
      status,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Slot criado: ${dataFormatada} às ${hora} — médico ${targetMedicoId}`);
    return { sucesso: true, mensagem: "Slot criado com sucesso." };
  } catch (error) {
    console.error("❌ Erro ao criar slot:", error);
    throw new HttpsError("internal", "Erro ao criar o slot.", error.message);
  }
});


/**
 * ==========================================================
 * Atualizar slot (médico autenticado ou admin)
 * ==========================================================
 */
exports.atualizarSlot = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");

  const role = request.auth.token.role;
  const uid = request.auth.uid;
  const { slotId, status, data, hora } = request.data || {};

  if (!slotId)
    throw new HttpsError("invalid-argument", "O campo 'slotId' é obrigatório.");

  if (role !== "doctor" && role !== "admin")
    throw new HttpsError(
      "permission-denied",
      "Apenas médicos ou administradores podem atualizar slots."
    );

  try {
    const slotRef = db.collection("availability_slots").doc(slotId);
    const snap = await slotRef.get();

    if (!snap.exists) throw new HttpsError("not-found", "Slot não encontrado.");

    const slot = snap.data();

    // Médico só pode atualizar seus próprios slots
    if (role === "doctor" && slot.medicoId !== uid) {
      throw new HttpsError(
        "permission-denied",
        "Você só pode atualizar seus próprios slots."
      );
    }

    // Admin pode atualizar qualquer slot
    const updates = {};

    if (typeof status === "string") updates.status = status;

    if (typeof data === "string") {
      const partes = data.split("-");
      // Se vier em formato YYYY-MM-DD, converte para DD-MM-YYYY
      updates.data =
        partes.length === 3 && partes[0].length === 4
          ? `${partes[2]}-${partes[1]}-${partes[0]}`
          : data;
    }

    if (typeof hora === "string") updates.hora = hora;

    updates.atualizadoEm = admin.firestore.FieldValue.serverTimestamp();

    await slotRef.update(updates);

    console.log(`✏️ Slot atualizado (${slotId}) por ${role} ${uid}:`, updates);
    return { sucesso: true, mensagem: "Slot atualizado com sucesso." };
  } catch (error) {
    console.error("❌ Erro ao atualizar slot:", error);
    throw new HttpsError("internal", "Erro ao atualizar o slot.", error.message);
  }
});


/**
 * ==========================================================
 * Cancelar slot (sem excluir)
 * ==========================================================
 */
exports.deletarSlot = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");

  const role = request.auth.token.role;
  const uid = request.auth.uid;
  const { slotId } = request.data || {};

  if (!slotId)
    throw new HttpsError("invalid-argument", "O campo 'slotId' é obrigatório.");

  if (role !== "doctor" && role !== "admin")
    throw new HttpsError("permission-denied", "Apenas médicos ou administradores podem cancelar slots.");

  try {
    const slotRef = db.collection("availability_slots").doc(slotId);
    const snap = await slotRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Slot não encontrado.");

    const slot = snap.data();

    // Admin pode cancelar qualquer slot; médico só o próprio
    if (role === "doctor" && slot.medicoId !== uid)
      throw new HttpsError("permission-denied", "Você só pode cancelar seus próprios slots.");

    // Cancela consultas associadas
    const consultasSnap = await db
      .collection("appointments")
      .where("slotId", "==", slotId)
      .get();

    for (const doc of consultasSnap.docs) {
      await doc.ref.update({
        status: "cancelada",
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    await slotRef.update({
      status: "cancelado",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`🟡 Slot ${slotId} cancelado (por ${role} ${uid})`);
    return { sucesso: true, mensagem: "Slot cancelado com sucesso." };
  } catch (error) {
    console.error("❌ Erro ao cancelar slot:", error);
    throw new HttpsError("internal", "Erro ao cancelar o slot.", error.message);
  }
});


/**
 * ==========================================================
 * Reativar slot (cancelado → livre)
 * ==========================================================
 */
exports.reativarSlot = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");

  const role = request.auth.token.role;
  const uid = request.auth.uid;
  const { slotId } = request.data || {};

  if (!slotId)
    throw new HttpsError("invalid-argument", "O campo 'slotId' é obrigatório.");

  if (role !== "doctor" && role !== "admin")
    throw new HttpsError("permission-denied", "Apenas médicos ou administradores podem reabrir slots.");

  try {
    const slotRef = db.collection("availability_slots").doc(slotId);
    const snap = await slotRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Slot não encontrado.");

    const slot = snap.data();

    if (slot.status !== "cancelado")
      throw new HttpsError("failed-precondition", "Slot não está cancelado.");

    // Médico só reabre o próprio; admin pode reabrir qualquer um
    if (role === "doctor" && slot.medicoId !== uid)
      throw new HttpsError("permission-denied", "Você só pode alterar seus próprios slots.");

    await slotRef.update({
      status: "livre",
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`♻️ Slot ${slotId} reaberto (por ${role} ${uid})`);
    return { sucesso: true, mensagem: "Slot reaberto com sucesso." };
  } catch (error) {
    console.error("❌ Erro ao reabrir slot:", error);
    throw new HttpsError("internal", "Erro ao reabrir o slot.", error.message);
  }
});


/**
 * ==========================================================
 * Listar slots do médico (médico autenticado ou admin)
 * ==========================================================
 */
exports.listarMeusSlots = onCall(async (request) => {
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");

  const role = request.auth.token.role;
  const uid = request.auth.uid;

  // Admin pode passar o ID de outro médico
  const { medicoId } = request.data || {};
  const targetId = role === "doctor" ? uid : medicoId;

  // Verificações de permissão
  if (role !== "doctor" && role !== "admin")
    throw new HttpsError("permission-denied", "Apenas médicos ou administradores podem listar slots.");

  if (role === "admin" && !targetId)
    throw new HttpsError("invalid-argument", "O campo 'medicoId' é obrigatório para administradores.");

  try {
    const snap = await db
      .collection("availability_slots")
      .where("medicoId", "==", targetId)
      .get();

    const slots = snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`📅 ${slots.length} slots retornados para médico ${targetId}`);
    return { sucesso: true, slots };
  } catch (error) {
    console.error("❌ Erro ao listar slots:", error);
    throw new HttpsError("internal", "Erro ao listar slots.", error.message);
  }
});


/**
 * ==========================================================
 * Listar slots públicos (para pacientes)
 * ==========================================================
 */
exports.listarSlotsPublicos = onCall(async (request) => {
  try {
    const snap = await db
      .collection("availability_slots")
      .where("status", "==", "livre")
      .get();

    const slots = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { sucesso: true, slots };
  } catch (error) {
    console.error("Erro ao listar slots públicos:", error);
    throw new HttpsError("internal", "Erro ao listar slots públicos.");
  }
});
