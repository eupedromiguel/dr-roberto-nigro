import { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { XCircle, CheckCircle, AlertCircle } from "lucide-react";

export default function AdminNotificacoes() {
  const [notificacoes, setNotificacoes] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "appointments"),
      where("tipoAtendimento", "==", "convenio"),
      where("status", "==", "agendado"),
      orderBy("criadoEm", "desc")
    );


    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setNotificacoes(data);
    });

    return () => unsub();
  }, []);

  const recusarConsulta = async (appointmentId) => {
    const ref = doc(db, "appointments", appointmentId);
    await updateDoc(ref, {
      status: "cancelada",
      notificacaoStatus: "recusado",
    });

    // Cloud Function enviará o e-mail automaticamente
  };

  return (
    <div className="text-white px-4 py-4">
      <h1 className="text-3xl font-normal text-white mb-6">
        Consultas por Convênio
      </h1>

      {notificacoes.length === 0 ? (
        <p className="text-slate-400">Nenhuma consulta pendente.</p>
      ) : (
        <div className="space-y-4">
          {notificacoes.map((item) => (
            <div
              key={item.id}
              className="bg-gray-800 p-4 rounded-lg shadow flex flex-col md:flex-row justify-between"
            >
              <div>
                <p className="text-lg font-semibold">
                  Convênio: <span className="text-yellow-400">{item.convenio}</span>
                </p>
                <p>Categoria: {item.categoria}</p>
                <p>Carteirinha: {item.carteirinha}</p>
                <p>Status:
                  <span className="text-green-400 ml-1">{item.status}</span>
                </p>
                <p className="text-sm text-slate-400">ID: {item.id}</p>

              </div>


              <div className="flex gap-3 items-center mt-4 md:mt-0">
                <button
                  onClick={() => recusarConsulta(item.id)}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition"
                >
                  <XCircle size={18} />
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
