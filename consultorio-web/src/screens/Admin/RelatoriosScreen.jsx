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
  const modoGeral = useMemo(() => medicoId === "__ALL__", [medicoId]);





  function pertenceAoMesSelecionado(item) {
    const raw = item.dataConsulta || item.appointmentOriginalCreatedAt;
    if (!raw) return false;

    const d = raw.toDate ? raw.toDate() : new Date(raw);
    if (isNaN(d.getTime())) return false;

    const mesConsulta = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    return mesConsulta === mes;
  }


  function getRetornoText(idConsulta) {
    const ap = appointmentsMap[idConsulta];
    return ap?.hasRetorno ? "Sim" : "Não";
  }


  function pickValor(ap) {
    if (ap.tipoConsulta === "teleconsulta") {
      return ap.valorteleConsulta ?? ap.valorConsulta ?? 0;
    }
    return ap.valorConsulta ?? 0;
  }


  function getNomeMedico(id) {
    return medicos.find(m => m.id === id)?.nome || "Desconhecido";
  }


  function formatMoney(value) {
    if (value === null || value === undefined || value === "") return "R$ 0,00";
    const num = Number(value);
    if (isNaN(num)) return "R$ 0,00";

    return num.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }


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




    if (!mes) {
      setErro("Selecione o mês.");
      return;
    }

    if (!medicoId) {
      setErro("Selecione o médico ou 'Todos os médicos'.");
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

      const qDone = modoGeral
        ? doneCol
        : query(doneCol, where("medicoId", "==", medicoId));

      const qCanceled = modoGeral
        ? canceledCol
        : query(canceledCol, where("medicoId", "==", medicoId));


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



      const concluidasFiltradas = concluidasData.filter(pertenceAoMesSelecionado);
      const canceladasFiltradas = canceladasData.filter(pertenceAoMesSelecionado);

      setConcluidas(concluidasFiltradas);
      setCanceladas(canceladasFiltradas);




      // Buscar dados reais das consultas (appointments)
      const allIds = [
        ...concluidasFiltradas.map((c) => c.idConsulta),
        ...canceladasFiltradas.map((c) => c.idConsulta),
      ];



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

        // =========================
        // VERIFICAR SUBCOLEÇÃO RETORNO
        // =========================
        const retornoMap = {};

        await Promise.all(
          Object.keys(map).map(async (idConsulta) => {
            const ref = collection(db, "appointments", idConsulta, "retorno");
            const snap = await getDocs(ref);
            retornoMap[idConsulta] = !snap.empty;
          })
        );


        Object.keys(map).forEach(id => {
          map[id].hasRetorno = retornoMap[id] || false;
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

  const totalRetornos = useMemo(() => {
    return concluidas.filter(c => {
      const ap = appointmentsMap[c.idConsulta];
      return ap?.hasRetorno === true;
    }).length;
  }, [concluidas, appointmentsMap]);

  const totalConclusoesSemRetorno = useMemo(() => {
    return concluidas.filter(c => {
      const ap = appointmentsMap[c.idConsulta];
      return ap?.hasRetorno !== true;
    }).length;
  }, [concluidas, appointmentsMap]);

  const taxaRetorno =
    totalConcluidas > 0
      ? ((totalRetornos / totalConcluidas) * 100).toFixed(1)
      : "0.0";

  const taxaSemRetorno =
    totalConcluidas > 0
      ? ((totalConclusoesSemRetorno / totalConcluidas) * 100).toFixed(1)
      : "0.0";


  const taxaCancelamento =
    total > 0 ? ((totalCanceladas / total) * 100).toFixed(1) : "0.0";

  const taxaConclusao =
    total > 0 ? ((totalConcluidas / total) * 100).toFixed(1) : "0.0";


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
  // CALCULAR A RECEITA TOTAL
  // ======================================

  const totalReceitaParticular = useMemo(() => {
    if (modoGeral) return 0;

    return concluidas.reduce((acc, c) => {
      const ap = appointmentsMap[c.idConsulta];
      if (!ap) return acc;
      if (ap.tipoAtendimento !== "particular") return acc;

      const number = Number(pickValor(ap));
      return isNaN(number) ? acc : acc + number;
    }, 0);
  }, [concluidas, appointmentsMap, modoGeral]);


  // ======================================
  // CALCULAR A RECEITA TOTAL GERAL
  // ======================================

  const totalReceitaParticularGeral = useMemo(() => {
    if (!modoGeral) return 0;

    return concluidas.reduce((acc, c) => {
      const ap = appointmentsMap[c.idConsulta];
      if (!ap) return acc;
      if (ap.tipoAtendimento !== "particular") return acc;

      const number = Number(pickValor(ap));
      return isNaN(number) ? acc : acc + number;
    }, 0);
  }, [concluidas, appointmentsMap, modoGeral]);



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
        "Status",
        "Consulta ID",
        "Médico",
        "Tipo de Atendimento",
        "Tipo de Consulta",
        "Convênio / Categoria",
        "Valor",
        "Data da Consulta",
        "Agendada em",
        "Retorno"
      ]);


      concluidas.forEach((c) => {
        const by =
          c.concludedBy === "admin"
            ? "Admin"
            : c.concludedBy === "doctor"
              ? (modoGeral ? getNomeMedico(c.medicoId) : medicoSelecionado?.nome)
              : "Sistema";

        const ap = appointmentsMap[c.idConsulta] || {};

        const tipoAtendimento = ap.tipoAtendimento || "-";
        const tipoConsulta = ap.tipoConsulta || "-";

        let convenioInfo = "-";
        let valor = "-";

        if (tipoAtendimento === "convenio") {
          convenioInfo = `${ap.convenio || "-"} / ${ap.categoria || "-"}`;
        } else if (tipoAtendimento === "particular") {
          const bruto = pickValor(ap);
          valor = bruto > 0 ? String(bruto).replace(".", ",") : "-";

        }


        rows.push([
          "Concluída",
          c.idConsulta || c.id,
          modoGeral ? getNomeMedico(c.medicoId) : (medicoSelecionado?.nome || "")
          ,
          tipoAtendimento,
          tipoConsulta,
          convenioInfo,
          valor,
          formatDateTime(getDataConsultaReal(c)),
          formatDateTime(c.appointmentOriginalCreatedAt),
          getRetornoText(c.idConsulta)
        ]);

      });

      canceladas.forEach((c) => {
        let by = "";
        if (c.canceledBy === "patient") by = "Paciente";
        else if (c.canceledBy === "doctor")
          by = modoGeral ? getNomeMedico(c.medicoId) : medicoSelecionado?.nome
            || "Médico";
        else if (c.canceledBy === "admin") by = "Admin";
        else by = c.canceledBy || "";

        const ap = appointmentsMap[c.idConsulta] || {};

        const tipoAtendimento = ap.tipoAtendimento || "-";
        const tipoConsulta = ap.tipoConsulta || "-";

        let convenioInfo = "-";
        let valor = "-";

        if (tipoAtendimento === "convenio") {

          convenioInfo = `${ap.convenio || "-"} / ${ap.categoria || "-"}`;
        } else if (tipoAtendimento === "particular") {
          const bruto = pickValor(ap);
          valor = bruto > 0 ? String(bruto).replace(".", ",") : "-";

        }

        rows.push([
          "Cancelada",
          c.idConsulta || c.id,
          modoGeral ? getNomeMedico(c.medicoId) : medicoSelecionado?.nome
            || "",
          tipoAtendimento,
          tipoConsulta,
          convenioInfo,
          valor,
          formatDateTime(getDataConsultaReal(c)),
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
      const medicoNomeSafe = (modoGeral
        ? "todos_medicos"
        : (medicoSelecionado?.nome || "medico")
      )

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

    // Prioridade: relatório
    if (item.dataConsulta) return item.dataConsulta;

    // Fallback: appointments
    if (ap?.horario) return ap.horario;
    if (ap?.dataConsulta) return ap.dataConsulta;

    return null;
  }




  // INICIO DO RETURN

  return (
    <div className="p-0 space-y-2 print:bg-white print-container">
      <h1 className="text-sm font-bold mb-2 text-white print:text-gray-800">{modoGeral ? "Relatório Geral Mensal" : "Relatório Mensal"}</h1>
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
              <option value="__ALL__">Todos os médicos</option>

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
                    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
                    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
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
  <div className="w-full mt-2 flex justify-center">
    <span className="text-red-700 text-sm px-3 py-1 rounded-md font-semibold">
      {erro}
    </span>
  </div>
)}


      </div>

      {/* INFO DO MÉDICO / MÊS */}
      {(medicoSelecionado || mes) && (
        <div className="text-sm text-white print:text-gray-800">
          {modoGeral ? (
            <span className="mr-3">
              <b>Médicos:</b> Todos
            </span>
          ) : medicoSelecionado ? (
            <span className="mr-3">
              <b>Médico:</b> {medicoSelecionado.nome}
            </span>
          ) : null}

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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 print-dashboard">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl print-card">
              <p className="text-xs uppercase text-emerald-700 font-semibold">
                Concluídas
              </p>
              <p className="text-xl font-bold text-emerald-900 mt-1">
                {totalConcluidas}
              </p>
            </div>


            <div className="p-3 bg-red-50 border border-red-200 rounded-xl print-card">
              <p className="text-xs uppercase text-red-700 font-semibold">
                Canceladas
              </p>
              <p className="text-xl font-bold text-red-900 mt-1">
                {totalCanceladas}
              </p>
            </div>


            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl print-card">
              <p className="text-xs uppercase text-slate-600 font-semibold">
                Total de atendimentos
              </p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {total}
              </p>
            </div>


            <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl print-card">
              <p className="text-xs uppercase text-violet-700 font-semibold">
                Retornos
              </p>

              <p className="text-xl font-bold text-violet-900 mt-1">
                {totalRetornos}
              </p>

              <p className="text-xs text-violet-700 mt-1">
                {taxaRetorno}% das conclusões
              </p>

              <div className="mt-1 h-1.5 rounded-full bg-violet-100 overflow-hidden">
                <div
                  className="h-full bg-violet-500"
                  style={{ width: `${taxaRetorno}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl print-card">
              <p className="text-xs uppercase text-indigo-700 font-semibold">
                Concluídas s/retorno
              </p>

              <p className="text-xl font-bold text-indigo-900 mt-1">
                {totalConclusoesSemRetorno}
              </p>

              <p className="text-xs text-indigo-700 mt-1">
                {taxaSemRetorno}% das conclusões
              </p>

              <div className="mt-1 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500"
                  style={{ width: `${taxaSemRetorno}%` }}
                />
              </div>
            </div>


          </div>



          {/* "Gráfico" simplificado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <h3 className="text-sm font-semibold mb-3">
                Concluídas / Canceladas
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
                        Dia {String(dia).padStart(2, "0")}
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

                      {modoGeral && (
                        <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                          Médico
                        </th>
                      )}

                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Data Consulta
                      </th>

                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Concluída por
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Agendado em
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Atendimento</th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Consulta</th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Convênio / Categoria</th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Valor</th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Retorno
                      </th>


                    </tr>
                  </thead>
                  <tbody>
                    {concluidasOrdenadas.map((c) => {
                      const by =
                        c.concludedBy === "admin"
                          ? "Admin"
                          : modoGeral ? getNomeMedico(c.medicoId) : medicoSelecionado?.nome
                            || "Médico";
                      const ap = appointmentsMap[c.idConsulta] || {};

                      const tipoAtendimento = ap.tipoAtendimento || "-";
                      const tipoConsulta = ap.tipoConsulta || "-";

                      let convenioInfo = "-";
                      let valor = "-";

                      if (tipoAtendimento === "convenio") {
                        convenioInfo = `${ap.convenio || "-"} / ${ap.categoria || "-"}`;
                      } else if (tipoAtendimento === "particular") {
                        const bruto = pickValor(ap);
                        valor = bruto > 0 ? String(bruto).replace(".", ",") : "-";

                      }

                      return (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 border-b">
                            {c.idConsulta || c.id}
                          </td>
                          {modoGeral && (
                            <td className="px-3 py-2 border-b">
                              {getNomeMedico(c.medicoId)}
                            </td>
                          )}

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
                          <td className="px-3 py-2 border-b">{tipoAtendimento}</td>
                          <td className="px-3 py-2 border-b">{tipoConsulta}</td>

                          <td className="px-3 py-2 border-b">{convenioInfo}</td>
                          <td className="px-3 py-2 border-b">{valor}</td>
                          <td className="px-3 py-2 border-b">
                            {getRetornoText(c.idConsulta)}
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

                      {modoGeral && (
                        <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                          Médico
                        </th>
                      )}

                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Data Consulta
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Cancelada por
                      </th>

                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">
                        Agendado em
                      </th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Atendimento</th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Consulta</th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Convênio / Categoria</th>
                      <th className="px-3 py-2 text-left border-b text-xs font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canceladasOrdenadas.map((c) => {
                      let by = "";
                      if (c.canceledBy === "patient") by = "Paciente";
                      else if (c.canceledBy === "doctor") by = modoGeral ? getNomeMedico(c.medicoId) : medicoSelecionado?.nome
                        || "Médico";
                      else if (c.canceledBy === "admin") by = "Admin";

                      const ap = appointmentsMap[c.idConsulta] || {};

                      const tipoAtendimento = ap.tipoAtendimento || "-";
                      const tipoConsulta = ap.tipoConsulta || "-";

                      let convenioInfo = "-";
                      let valor = "-";

                      if (tipoAtendimento === "convenio") {
                        convenioInfo =
                          ap.convenio ||
                          ap.nomeConvenio ||
                          "-";

                        if (ap.categoria) {
                          convenioInfo += ` / ${ap.categoria}`;
                        }
                      }

                      if (tipoAtendimento === "particular") {
                        const bruto = pickValor(ap);
                        valor = bruto > 0 ? String(bruto).replace(".", ",") : "-";

                      }



                      return (
                        <tr key={c.id}>
                          <td className="px-3 py-2 border-b">{c.idConsulta || c.id}</td>
                          {modoGeral && (
                            <td className="px-3 py-2 border-b">
                              {getNomeMedico(c.medicoId)}
                            </td>
                          )}

                          <td className="px-3 py-2 border-b">{formatDateTime(getDataConsultaReal(c))}</td>
                          <td className="px-3 py-2 border-b">{by}</td>
                          <td className="px-3 py-2 border-b">{formatDateTime(c.appointmentOriginalCreatedAt)}</td>
                          <td className="px-3 py-2 border-b">{tipoAtendimento}</td>
                          <td className="px-3 py-2 border-b">{tipoConsulta}</td>
                          <td className="px-3 py-2 border-b">{convenioInfo}</td>
                          <td className="px-3 py-2 border-b">{valor}</td>

                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>
            )}
          </div>

          {!modoGeral && totalReceitaParticular > 0 && (
            <div className="mt-6 p-4 border border-green-300 rounded-xl bg-green-50 text-green-900 font-semibold text-lg print:border-black print:bg-white">
              Total de receita (via particular): {formatMoney(totalReceitaParticular)}
            </div>
          )}

          {modoGeral && totalReceitaParticularGeral > 0 && (
            <div className="mt-6 p-4 border border-green-300 rounded-xl bg-green-50 text-green-900 font-semibold text-lg print:border-black print:bg-white">
              Total de receita (via particular): {formatMoney(totalReceitaParticularGeral)}
            </div>
          )}


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
