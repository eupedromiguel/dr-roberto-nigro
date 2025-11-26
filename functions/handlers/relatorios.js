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

        console.log("STATUS:", after.status);
        console.log("CANCELED BY:", after.canceledBy);
        console.log("DOC:", JSON.stringify(after));
        const status = String(after.status || "").toLowerCase().trim();



        if (before.status === after.status) return;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const monthDoc = `${year}_${month}`;

        const db = admin.firestore();
        const appointmentId = event.params.id;

        // ========================
        // CONCLUÍDA
        // ========================
        if (status === "concluida") {


            const ref = db
                .collection("appointments_done")
                .doc(monthDoc)
                .collection("items")
                .doc(appointmentId);

            await ref.set({
                idConsulta: appointmentId,
                medicoId: after.medicoId,
                pacienteId: after.pacienteId,
                dataConsulta: after.dataConsulta || null,
                especialidade: after.especialidade || null,
                valor: after.valor || 0,
                status: "concluida",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            console.log(`CONCLUÍDA → appointments_done/${monthDoc}/items/${appointmentId}`);
        }


        // ========================
        // CANCELADA PELO PACIENTE
        // ========================
        const canceledBy = String(after.canceledBy || "").toLowerCase().trim();

        if (status === "cancelada" && canceledBy === "patient") {

            const ref = db
                .collection("appointments_canceled_patient")
                .doc(monthDoc)
                .collection("items")
                .doc(appointmentId);

            await ref.set({
                idConsulta: appointmentId,
                medicoId: after.medicoId,
                pacienteId: after.pacienteId,
                dataConsulta: after.dataConsulta || null,
                motivo: after.cancelReason || null,
                canceledBy: "patient",
                status: "cancelada",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });

            console.log(`CANCELADA → appointments_canceled_patient/${monthDoc}/items/${appointmentId}`);
        }


        return;
    }
);
