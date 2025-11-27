const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.logAppointmentStatus = onDocumentUpdated(
  "appointments/{id}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const status = String(after.status || "").toLowerCase().trim();
    const canceledBy = String(after.canceledBy || "").toLowerCase().trim();

    console.log("STATUS:", status);
    console.log("CANCELED BY:", canceledBy);

    // Se nada relevante mudou, não faz nada
    if (
      before.status === after.status &&
      before.canceledBy === after.canceledBy &&
      before.concludedBy === after.concludedBy
    ) {
      console.log("Nenhuma mudança relevante de status/canceledBy/concludedBy, saindo.");
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const monthDoc = `${year}_${month}`;

    const db = admin.firestore();
    const appointmentId = event.params.id;

    try {
      // ========================
      // CONCLUÍDA
      // ========================
      if (status === "concluida") {
        const ref = db
          .collection("relatorios")
          .doc("appointments_done")
          .collection(monthDoc)      
          .doc(appointmentId);

        console.log("🔥 ESCRITA DONE EM:", ref.path);

        await ref.set(
          {
            idConsulta: appointmentId,
            medicoId: after.medicoId,
            pacienteId: after.pacienteId,
            dataConsulta: after.dataConsulta || null,
            especialidade: after.especialidade || null,
            valor: after.valor || 0,
            status: "concluida",
            concludedBy: after.concludedBy || "doctor",
            appointmentOriginalCreatedAt: after.criadoEm || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log(
          `CONCLUÍDA → relatorios/appointments_done/${monthDoc}/${appointmentId}`
        );
      }

      // ========================
      // CANCELADAS
      // ========================
      if (status === "cancelada") {
        if (!canceledBy) {
          console.warn("Cancelamento ignorado sem canceledBy");
          return;
        }

        const ref = db
          .collection("relatorios")
          .doc("appointments_canceled")
          .collection(monthDoc)      
          .doc(appointmentId);

        console.log("🔥 ESCRITA CANCELED EM:", ref.path);

        await ref.set(
          {
            idConsulta: appointmentId,
            medicoId: after.medicoId,
            pacienteId: after.pacienteId,
            dataConsulta: after.dataConsulta || null,
            motivo: after.cancelReason || null,
            canceledBy,
            status: "cancelada",
            appointmentOriginalCreatedAt: after.criadoEm || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log(
          `CANCELADA → relatorios/appointments_canceled/${monthDoc}/${appointmentId}`
        );
      }
    } catch (err) {
      console.error("Erro ao gravar relatório:", err);
    }

    return;
  }
);
