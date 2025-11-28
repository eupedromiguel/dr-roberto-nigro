import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";

// Helper: formata dd/mm/yyyy HH:MM a partir de Timestamp ou string
function formatDateTime(value) {
  if (!value) return "-";

  // Firestore Timestamp
  if (value.toDate) {
    const d = value.toDate();
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // String "2025-11-28 08:00"
  if (typeof value === "string") {
    const [dStr, hStr] = value.split(" ");
    if (!dStr) return value;
    const [year, month, day] =
      dStr.includes("-") && dStr.indexOf("-") === 4
        ? dStr.split("-").map((x) => parseInt(x, 10))
        : [null, null, null];

    if (year && month && day) {
      const d = new Date(year, month - 1, day);
      const data = d.toLocaleDateString("pt-BR");
      return hStr ? `${data} ${hStr}` : data;
    }

    return value;
  }

  // Fallback
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString("pt-BR");
    }
  } catch (_) {
    return String(value);
  }

  return String(value);
}

// Helper: extrair dia (1–31) para agrupar por dia
function extractDay(value) {
  if (!value) return null;

  if (value.toDate) {
    const d = value.toDate();
    return d.getDate();
  }

  if (typeof value === "string") {
    const [dStr] = value.split(" ");
    if (!dStr) return null;

    // "2025-11-28"
    if (dStr.indexOf("-") === 4) {
      const parts = dStr.split("-");
      const day = parseInt(parts[2], 10);
      return isNaN(day) ? null : day;
    }

    // "28/11/2025"
    if (dStr.indexOf("/") === 2) {
      const parts = dStr.split("/");
      const day = parseInt(parts[0], 10);
      return isNaN(day) ? null : day;
    }
  }

  return null;
}

export default function RelatoriosScreen() {
  const [medicos, setMedicos] = useState([]);
  const [medicoId, setMedicoId] = useState("");
  const [mes, setMes] = useState(""); // "2025-11"
  const [concluidas, setConcluidas] = useState([]);
  const [canceladas, setCanceladas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [erro, setErro] = useState("");
  const [appointmentsMap, setAppointmentsMap] = useState({});
  const [buscou, setBuscou] = useState(false);
  const [openMonth, setOpenMonth] = useState(false);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());






  function formatarMes(valor) {
  if (!valor || !valor.includes("-")) return "";

  const [ano, mes] = valor.split("-");
  const index = Number(mes) - 1;

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  if (index < 0 || index > 11) return valor;

  return `${meses[index]} / ${ano}`;
}



  // ======================================
  // BUSCA MÉDICOS (role === "doctor")
  // ======================================
  useEffect(() => {
    async function loadMedicos() {
      try {
        const snap = await getDocs(collection(db, "usuarios"));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => u.role === "doctor")
          .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
        setMedicos(list);
      } catch (e) {
        console.error(e);
        setErro("Erro ao carregar médicos.");
      }
    }
    loadMedicos();
  }, []);

  const medicoSelecionado = useMemo(
    () => medicos.find((m) => m.id === medicoId) || null,
    [medicos, medicoId]
  );

  const concluidasOrdenadas = useMemo(() => {
    return [...concluidas].sort((a, b) => {
      const da = new Date(getDataConsultaReal(a) || 0);
      const db = new Date(getDataConsultaReal(b) || 0);
      return da - db;
    });
  }, [concluidas, appointmentsMap]);

  const canceladasOrdenadas = useMemo(() => {
    return [...canceladas].sort((a, b) => {
      const da = new Date(getDataConsultaReal(a) || 0);
      const db = new Date(getDataConsultaReal(b) || 0);
      return da - db;
    });
  }, [canceladas, appointmentsMap]);


  // ======================================
  // BUSCAR RELATÓRIO MENSAL
  // ======================================
  async function buscarRelatorio() {
    setBuscou(true);
    setErro("");
    setConcluidas([]);
    setCanceladas([]);
    setAppointmentsMap({});




    if (!medicoId || !mes) {
      setErro("Selecione o médico e o mês.");
      return;
    }

    try {
      setLoading(true);

      const monthDoc = mes.replace("-", "_"); // "2025-11" -> "2025_11"

      const doneCol = collection(
        db,
        "relatorios",
        "appointments_done",
        monthDoc
      );
      const canceledCol = collection(
        db,
        "relatorios",
        "appointments_canceled",
        monthDoc
      );

      const qDone = query(doneCol, where("medicoId", "==", medicoId));
      const qCanceled = query(
        canceledCol,
        where("medicoId", "==", medicoId)
      );

      const [doneSnap, canceledSnap] = await Promise.all([
        getDocs(qDone),
        getDocs(qCanceled),
      ]);

      const concluidasData = doneSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const canceladasData = canceledSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));



      setConcluidas(concluidasData);
      setCanceladas(canceladasData);



      // Buscar dados reais das consultas (appointments)
      const allIds = [
        ...concluidasData.map((c) => c.idConsulta),
        ...canceladasData.map((c) => c.idConsulta),
      ].filter(Boolean);

      if (allIds.length > 0) {
        const uniqueIds = Array.from(new Set(allIds));

        const chunks = [];
        while (uniqueIds.length) {
          chunks.push(uniqueIds.splice(0, 30));
        }

        const appointmentsSnapList = await Promise.all(
          chunks.map((ids) =>
            getDocs(query(collection(db, "appointments"), where("__name__", "in", ids)))
          )
        );

        const map = {};
        appointmentsSnapList.forEach((snap) => {
          snap.docs.forEach((doc) => {
            map[doc.id] = doc.data();
          });
        });

        setAppointmentsMap(map);
      }




    } catch (e) {
      console.error(e);
      setErro("Erro ao buscar relatórios do mês.");
    } finally {
      setLoading(false);
    }
  }

  // ======================================
  // MÉTRICAS / DASHBOARD
  // ======================================
  const totalConcluidas = concluidas.length;
  const totalCanceladas = canceladas.length;
  const total = totalConcluidas + totalCanceladas;

  const taxaCancelamento =
    total > 0 ? ((totalCanceladas / total) * 100).toFixed(1) : "0.0";

  // Distribuição por dia (usando appointmentOriginalCreatedAt ou dataConsulta)
  const atendimentosPorDia = useMemo(() => {
    const map = {};

    const acumular = (lista) => {
      lista.forEach((item) => {
        const dataReal = getDataConsultaReal(item);
        const dia = extractDay(dataReal);
        if (!dia) return;
        map[dia] = (map[dia] || 0) + 1;
      });
    };

    acumular(concluidas);
    acumular(canceladas);

    const dias = Object.keys(map)
      .map((d) => parseInt(d, 10))
      .sort((a, b) => a - b);

    return dias.map((dia) => ({ dia, total: map[dia] }));
  }, [concluidas, canceladas, appointmentsMap]);


  const maxAtendimentosDia =
    atendimentosPorDia.length > 0
      ? Math.max(...atendimentosPorDia.map((d) => d.total))
      : 0;

  // ======================================
  // EXPORTAR CSV (Excel abre)
  // ======================================
  function exportarCSV() {
    if (!total) {
      alert("Não há dados para exportar.");
      return;
    }

    setLoadingExport(true);

    try {
      const rows = [];
      rows.push([
        "Tipo",
        "Consulta ID",
        "Médico ID",
        "Paciente ID",
        "Data consulta",
        "Status",
        "Concluída por / Cancelada por",
        "Agendado em",
      ]);

      concluidas.forEach((c) => {
        const by =
          c.concludedBy === "admin"
            ? "Admin"
            : medicoSelecionado?.nome || "Médico";
        rows.push([
          "Concluída",
          c.idConsulta || c.id,
          c.medicoId,
          c.pacienteId,
          formatDateTime(getDataConsultaReal(c)),
          c.status,
          by,
          formatDateTime(c.appointmentOriginalCreatedAt),
        ]);
      });

      canceladas.forEach((c) => {
        let by = "";
        if (c.canceledBy === "patient") by = "Paciente";
        else if (c.canceledBy === "doctor")
          by = medicoSelecionado?.nome || "Médico";
        else if (c.canceledBy === "admin") by = "Admin";
        else by = c.canceledBy || "";

        rows.push([
          "Cancelada",
          c.idConsulta || c.id,
          c.medicoId,
          c.pacienteId,
          formatDateTime(getDataConsultaReal(c)),
          c.status,
          by,
          formatDateTime(c.appointmentOriginalCreatedAt),
        ]);
      });

      const csvContent = rows
        .map((row) =>
          row
            .map((field) => {
              const value = field == null ? "" : String(field);
              // Escapar aspas
              return `"${value.replace(/"/g, '""')}"`;
            })
            .join(";")
        )
        .join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      const medicoNomeSafe = (medicoSelecionado?.nome || "medico")
        .replace(/\s+/g, "_")
        .toLowerCase();
      const mesSafe = mes || "mes";
      link.href = url;
      link.download = `relatorio_${medicoNomeSafe}_${mesSafe}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar CSV.");
    } finally {
      setLoadingExport(false);
    }
  }

  // ======================================
  // EXPORTAR PDF (via impressão do navegador)
  // ======================================
  function exportarPDF() {
    if (!total) {
      alert("Não há dados para exportar.");
      return;
    }
    window.print();
  }

  // ======================================
  // PEGA DATA DO APPOINTMENT 
  // ======================================

  function getDataConsultaReal(item) {
    const ap = appointmentsMap[item.idConsulta];

    if (!ap) return item.dataConsulta || null;

    if (ap.horario) return ap.horario;
    if (ap.dataConsulta) return ap.dataConsulta;
    return item.dataConsulta || null;
  }



  // INICIO DO RETURN

  return (
    <div className="p-0 space-y-2 print:bg-white print-container">
      <h1 className="text-sm font-bold mb-2 text-white print:text-gray-800">Relatórios Mensais</h1>
      {/* FILTROS */}
      <div className="flex flex-wrap gap-2 items-end bg-white border border-slate-200 rounded-xl p-4 shadow-sm print:hidden">
        <div className="flex flex-col">
          <label className="text-sm font-medium text-slate-700 mb-1">
            Médico
          </label>
          <div className="relative min-w-[220px]">
            <select
              value={medicoId}
              onChange={(e) => setMedicoId(e.target.value)}
              className="appearance-none border rounded-md px-3 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent w-full bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">Selecione o médico</option>
              {medicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome || m.email || m.id}
                </option>
              ))}
            </select>

            {/* SETINHA CUSTOM */}
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-500">
              <svg
                className="w-4 h-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.2l3.71-3.97a.75.75 0 111.08 1.04l-4.24 4.53a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium text-slate-700 mb-1">
            Mês
          </label>
          <input
            type="text"
            value={formatarMes(mes)}
            readOnly
            placeholder="Selecione mês e ano"
            onClick={() => setOpenMonth(true)}
            className="border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent cursor-pointer"
          />

          {openMonth && (
  <div
    className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
    onClick={() => setOpenMonth(false)}
  >
    <div
      className="bg-white p-4 rounded-xl w-72"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          className="text-lg"
          onClick={() => setAnoSelecionado(a => a - 1)}
        >
          ◀
        </button>

        <span className="font-semibold">{anoSelecionado}</span>

        <button
          className="text-lg"
          onClick={() => setAnoSelecionado(a => a + 1)}
        >
          ▶
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        {[
          "Jan","Fev","Mar","Abr","Mai","Jun",
          "Jul","Ago","Set","Out","Nov","Dez"
        ].map((m, i) => {
          const valor = `${anoSelecionado}-${String(i + 1).padStart(2, "0")}`;

          return (
            <button
              key={m}
              onClick={() => {
                setMes(valor);
                setOpenMonth(false);
              }}
              className="border rounded py-2 text-sm hover:bg-yellow-400"
            >
              {m}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setOpenMonth(false)}
        className="mt-4 text-sm text-gray-500 w-full"
      >
        Cancelar
      </button>
    </div>
  </div>
)}





        </div>

        <button
          onClick={buscarRelatorio}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-yellow-400 disabled:opacity-60"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>

        {erro && (
          <p className="text-sm text-red-600 ml-auto">{erro}</p>
        )}
      </div>

      {/* INFO DO MÉDICO / MÊS */}
      {(medicoSelecionado || mes) && (
        <div className="text-sm text-white print:text-gray-800">
          {medicoSelecionado && (
            <span className="mr-3">
              <b className="print:hidden
">Médico:</b> {medicoSelecionado.nome}
              {medicoSelecionado.especialidade
                ? ` — ${medicoSelecionado.especialidade}`
                : ""}
            </span>
          )}
          {mes && (
  <span>
    <b>Mês:</b> {formatarMes(mes)}
  </span>
)}

        </div>
      )}

      {/* DASHBOARD */}
      {total > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 print-dashboard">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl print-card">
              <p className="text-xs uppercase text-emerald-700 font-semibold">
                Concluídas
              </p>
              <p className="text-2xl font-bold text-emerald-900 mt-1">
                {totalConcluidas}
              </p>
            </div>

            <div className="p-4 bg-red-50 border border-red-200 rounded-xl print-card">
              <p className="text-xs uppercase text-red-700 font-semibold">
                Canceladas
              </p>
              <p className="text-2xl font-bold text-red-900 mt-1">
                {totalCanceladas}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl print-card">
              <p className="text-xs uppercase text-slate-600 font-semibold">
                Total de atendimentos
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {total}
              </p>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl print-card">
              <p className="text-xs uppercase text-amber-700 font-semibold">
                % Cancelamento
              </p>
              <p className="text-2xl font-bold text-amber-900 mt-1">
                {taxaCancelamento}%
              </p>
              <div className="mt-2 h-2 rounded-full bg-amber-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${taxaCancelamento}%` }}
                />
              </div>
            </div>
          </div>

          {/* "Gráfico" Pizza simplificado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <h3 className="text-sm font-semibold mb-3">
                Distribuição Concluídas / Canceladas
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Concluídas</span>
                  <span>
                    {totalConcluidas} (
                    {total
                      ? ((totalConcluidas / total) * 100).toFixed(1)
                      : "0.0"}
                    %)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${total
                        ? (totalConcluidas / total) * 100
                        : 0
                        }%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs mt-3">
                  <span>Canceladas</span>
                  <span>
                    {totalCanceladas} (
                    {total
                      ? ((totalCanceladas / total) * 100).toFixed(1)
                      : "0.0"}
                    %)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${total
                        ? (totalCanceladas / total) * 100
                        : 0
                        }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Gráfico barra por dia */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <h3 className="text-sm font-semibold mb-3">
                Atendimentos por dia
              </h3>
              {atendimentosPorDia.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Ainda não há dados suficientes para este mês.
                </p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {atendimentosPorDia.map(({ dia, total }) => (
                    <div
                      key={dia}
                      className="flex items-center gap-2 text-xs"
                    >
                      <div className="w-10 text-right text-slate-600">
                        {String(dia).padStart(2, "0")}
                      </div>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{
                            width: `${maxAtendimentosDia
                              ? (total / maxAtendimentosDia) * 100
                              : 0
                              }%`,
                          }}
                        />
                      </div>
                      <div className="w-6 text-right text-slate-700">
                        {total}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* LISTAGENS */}
      {total > 0 && (
        <div className="space-y-0 mt-2">
          {/* TABELA CONCLUÍDAS */}
          <div>
            <h2 className="text-lg font-semibold text-white print:text-gray-950 mb-2">
              Consultas Concluídas
            </h2>
            {concluidas.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma consulta concluída neste mês para este médico.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-green-200 shadow-sm avoid-break">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Consulta ID
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Data Consulta
                      </th>

                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Concluída por
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Agendado em
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {concluidasOrdenadas.map((c) => {
                      const by =
                        c.concludedBy === "admin"
                          ? "Admin"
                          : medicoSelecionado?.nome || "Médico";
                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 border-b">
                            {c.idConsulta || c.id}
                          </td>
                          <td className="px-3 py-2 border-b">
                            {formatDateTime(getDataConsultaReal(c))
                            }
                          </td>

                          <td className="px-3 py-2 border-b">{by}</td>
                          <td className="px-3 py-2 border-b">
                            {formatDateTime(
                              c.appointmentOriginalCreatedAt
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TABELA CANCELADAS */}
          <div>
            <h2 className="text-lg font-semibold text-white print:text-gray-950 mb-2">
              Consultas Canceladas
            </h2>
            {canceladas.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nenhuma consulta cancelada neste mês para este médico.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-red-200 shadow-sm avoid-break">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Consulta ID
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Data Consulta
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Cancelada por
                      </th>

                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Agendado em
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {canceladasOrdenadas.map((c) => {
                      let by = "";
                      if (c.canceledBy === "patient") by = "Paciente";
                      else if (c.canceledBy === "doctor")
                        by = medicoSelecionado?.nome || "Médico";
                      else if (c.canceledBy === "admin") by = "Admin";
                      else by = c.canceledBy || "";

                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 border-b">
                            {c.idConsulta || c.id}
                          </td>
                          <td className="px-3 py-2 border-b">
                            {formatDateTime(getDataConsultaReal(c))
                            }
                          </td>
                          <td className="px-3 py-2 border-b">{by}</td>

                          <td className="px-3 py-2 border-b">
                            {formatDateTime(
                              c.appointmentOriginalCreatedAt
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* BOTÕES DE EXPORTAÇÃO */}
          <div className="flex gap-3 mt-4 print:hidden">
            <button
              onClick={exportarCSV}
              disabled={loadingExport}
              className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-yellow-400 disabled:opacity-60"
            >
              {loadingExport ? "Gerando CSV..." : "Exportar Excel (CSV)"}
            </button>
            <button
              onClick={exportarPDF}
              className="px-4 py-2 rounded-md bg-gray-800 text-white text-sm font-medium hover:bg-yellow-400"
            >
              Imprimir / PDF
            </button>
          </div>
        </div>

      )}

      {buscou && total === 0 && !loading && !erro && (

        <p className="text-sm text-slate-300">
          Nenhum registro encontrado para este médico neste mês.
        </p>
      )}
    </div>
  );
}
