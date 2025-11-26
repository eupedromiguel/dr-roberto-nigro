import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";

export default function RelatoriosScreen() {

  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [mes, setMes] = useState("");
  const [concluidas, setConcluidas] = useState([]);
  const [canceladas, setCanceladas] = useState([]);
  const [loading, setLoading] = useState(false);

  // =========================
  // BUSCA MÉDICOS
  // =========================
  useEffect(() => {
    async function loadMedicos() {
      const snap = await getDocs(collection(db, "usuarios"));
      const list = snap.docs
        .filter(doc => doc.data().role === "doctor")
        .map(d => ({ id: d.id, ...d.data() }));

      setMedicos(list);
    }

    loadMedicos();
  }, []);

  // =========================
  // BUSCA RELATÓRIOS
  // =========================
  async function buscarRelatorio() {
    if (!medicoId || !mes) return;

    setLoading(true);

    const doneRef = collection(db, "appointments_done", mes, "items");
    const canceledRef = collection(db, "appointments_canceled_patient", mes, "items");


    const qDone = query(doneRef, where("medicoId", "==", medicoId));
    const qCanceled = query(canceledRef, where("medicoId", "==", medicoId));

    const [doneSnap, canceledSnap] = await Promise.all([
      getDocs(qDone),
      getDocs(qCanceled)
    ]);

    setConcluidas(doneSnap.docs.map(d => d.data()));
    setCanceladas(canceledSnap.docs.map(d => d.data()));

    setLoading(false);
  }

  // =========================
  // MÉTRICAS
  // =========================
  const total = concluidas.length + canceladas.length;
  const percentual = total > 0 ? ((canceladas.length / total) * 100).toFixed(1) : 0;

  function formatDate(date) {
    if (!date) return "-";
    if (date.toDate) date = date.toDate();
    return new Date(date).toLocaleDateString("pt-BR");
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      <h1 className="text-3xl font-bold mb-2">Relatórios Mensais</h1>
      <p className="text-gray-500 mb-6">Análise de atendimentos por médico</p>

      {/* FILTROS */}
      <div className="bg-white shadow rounded-lg p-4 mb-6 flex flex-wrap gap-4">

        <select
          value={medicoId}
          onChange={e => setMedicoId(e.target.value)}
          className="border rounded p-2 min-w-[200px]"
        >
          <option value="">Selecione o médico</option>
          {medicos.map(m => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="border rounded p-2"
        />

        <button
          onClick={buscarRelatorio}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded"
        >
          Gerar Relatório
        </button>

      </div>

      {/* LOADING */}
      {loading && (
        <div className="text-center py-6">
          <div className="animate-pulse text-gray-500">Gerando relatório...</div>
        </div>
      )}

      {!loading && total === 0 && (
        <div className="text-center py-10 text-gray-400">
          Selecione um médico e o mês.
        </div>
      )}

      {/* DASHBOARD */}
      {!loading && total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">

          <div className="bg-green-100 rounded-lg p-4 text-green-800">
            <h2 className="text-sm uppercase">Concluídas</h2>
            <p className="text-3xl font-bold">{concluidas.length}</p>
          </div>

          <div className="bg-red-100 rounded-lg p-4 text-red-800">
            <h2 className="text-sm uppercase">Canceladas</h2>
            <p className="text-3xl font-bold">{canceladas.length}</p>
          </div>

          <div className="bg-yellow-100 rounded-lg p-4 text-yellow-800">
            <h2 className="text-sm uppercase">% Cancelamento</h2>
            <p className="text-3xl font-bold">{percentual}%</p>
          </div>

        </div>
      )}

      {/* TABELAS */}
      {!loading && concluidas.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-2">Consultas concluídas</h2>

          <div className="overflow-x-auto shadow rounded-lg mb-8">
            <table className="w-full">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                {concluidas.map((c, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-3">{c.nomePaciente || c.pacienteId}</td>
                    <td className="p-3">{formatDate(c.dataConsulta)}</td>
                    <td className="p-3">{formatMoney(c.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && canceladas.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-2">Canceladas pelo paciente</h2>

          <div className="overflow-x-auto shadow rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-100 text-left">
                <tr>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {canceladas.map((c, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-3">{c.nomePaciente || c.pacienteId}</td>
                    <td className="p-3">{formatDate(c.dataConsulta)}</td>
                    <td className="p-3">{c.motivo || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
