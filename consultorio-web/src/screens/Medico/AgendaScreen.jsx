import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { IMaskInput } from "react-imask";
import { useAuth } from "../../context/AuthContext";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarCheck } from "lucide-react"



// ------------------------------
// Helpers globais
// ------------------------------
function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function nowTimeStr() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function isPastDateTime(dia, hora) {
  const agora = new Date();
  const [yyyy, mm, dd] = dia.split("-");
  const [HH, MM] = hora.split(":");
  const dt = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(HH), Number(MM), 0, 0);
  return dt.getTime() <= agora.getTime();
}


// ------------------------------
// Modal simples
// ------------------------------
function ConfirmModal({
  open,
  title = "Confirmar",
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onClose,
  loading = false,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative z-[101] w-[92%] max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 p-5">
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 text-sm"
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700 text-sm disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Cancelando..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------
// Toaster (sem libs)
// ------------------------------
const Toaster = forwardRef(function Toaster(_props, ref) {
  const [items, setItems] = useState([]);
  function remove(id) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }
  useImperativeHandle(ref, () => ({
    push({ message, type = "default", duration = 4000 }) {
      const id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), duration);
    },
  }));
  const styleByType = (type) => {
    switch (type) {
      case "success":
        return "border-green-500 bg-green-50 text-green-700";
      case "error":
        return "border-red-500 bg-red-50 text-red-700";
      default:
        return "border-gray-300 bg-white text-gray-800";
    }
  };
  return (
    <div className="fixed top-20 right-4 z-[120] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`w-[320px] max-w-[90vw] rounded-xl border shadow-md px-4 py-3 animate-[fadeIn_.25s_ease-out] ${styleByType(
            t.type
          )}`}
        >
          <div className="flex items-start gap-3">
            {t.type === "success" && <span></span>}
            {t.type === "error" && <span></span>}
            <div className="flex-1 text-sm">{t.message}</div>
            <button
              onClick={() => remove(t.id)}
              className="text-gray-500 hover:text-gray-800 text-xs"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(8px);} to { opacity:1; transform: translateY(0);} }`}</style>
    </div>
  );
});



function Pagination({ current, total, onChange }) {
  if (total <= 1) return null;

  const getPages = () => {
    const pages = [];
    const maxAround = 1;
    const push = (v) => pages.push(v);

    const start = Math.max(2, current - maxAround);
    const end = Math.min(total - 1, current + maxAround);

    push(1);
    if (start > 2) push("...");
    for (let p = start; p <= end; p++) push(p);
    if (end < total - 1) push("...");
    if (total > 1) push(total);

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    return pages;
  };

  const pages = getPages();

  const baseBtn =
    "px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400";
  const activeBtn = "bg-yellow-400 text-white";
  const idleBtn = "bg-gray-200 text-gray-800 hover:bg-gray-300";

  const go = (n) => {
    if (n < 1 || n > total || n === current) return;
    onChange(n);
  };

  return (
    <nav className="flex items-center justify-center gap-2 flex-wrap mt-4">
      <button
        onClick={() => go(1)}
        disabled={current === 1}
        className={`${baseBtn} ${current === 1 ? "opacity-40 cursor-not-allowed" : idleBtn}`}
      >
        «
      </button>
      <button
        onClick={() => go(current - 1)}
        disabled={current === 1}
        className={`${baseBtn} ${current === 1 ? "opacity-40 cursor-not-allowed" : idleBtn}`}
      >
        ‹
      </button>

      {pages.map((p, idx) =>
        p === "..." ? (
          <span key={idx} className="px-2 text-gray-500">…</span>
        ) : (
          <button
            key={p}
            onClick={() => go(p)}
            className={`${baseBtn} ${p === current ? activeBtn : idleBtn}`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => go(current + 1)}
        disabled={current === total}
        className={`${baseBtn} ${current === total ? "opacity-40 cursor-not-allowed" : idleBtn}`}
      >
        ›
      </button>
      <button
        onClick={() => go(total)}
        disabled={current === total}
        className={`${baseBtn} ${current === total ? "opacity-40 cursor-not-allowed" : idleBtn}`}
      >
        »
      </button>
    </nav>
  );
}



// ===============================================
// Componente principal
// ===============================================
export default function AgendaScreen() {
  const [slots, setSlots] = useState([]);
  const [diasLocais, setDiasLocais] = useState([]);
  const [novoDia, setNovoDia] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [reabrindoId, setReabrindoId] = useState(null);
  const { uid } = useParams();
  const { user, role } = useAuth();
  const medicoId = role === "doctor" ? user?.uid : uid;
  const [nomeMedico, setNomeMedico] = useState("");
  const db = getFirestore();
  const navigate = useNavigate();
  const [especialidade, setEspecialidade] = useState("");
  const [showInputDia, setShowInputDia] = useState(false);
  const [showGerador, setShowGerador] = useState(false);
  const [confirmDeleteDayOpen, setConfirmDeleteDayOpen] = useState(false);
  const [diaParaExcluir, setDiaParaExcluir] = useState(null);
  const [deletingDay, setDeletingDay] = useState(false);
  const [modalBloqueioDia, setModalBloqueioDia] = useState(false);
  const [diasOcultos, setDiasOcultos] = useState([]);
  const [confirmDeleteDefinitivoOpen, setConfirmDeleteDefinitivoOpen] = useState(false);
  const [diaParaRemoverDefinitivo, setDiaParaRemoverDefinitivo] = useState(null);
  const [removendoDefinitivo, setRemovendoDefinitivo] = useState(false);
  const [modalAppointmentOpen, setModalAppointmentOpen] = useState(false);
  const [appointmentSelecionado, setAppointmentSelecionado] = useState(null);
  const [diaComInputAberto, setDiaComInputAberto] = useState(null);
  const [filtroData, setFiltroData] = useState("");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [diasAbertos, setDiasAbertos] = useState({});



  function toggleDia(dia) {
    setDiasAbertos(prev => ({
      ...prev,
      [dia]: !prev[dia]
    }));
  }


  // Função que limita o número da página ao intervalo válido
  function goToPage(n) {
    if (totalPaginas === 0) return; // evita erro quando ainda não há dias
    const paginaValida = Math.max(1, Math.min(n, totalPaginas));
    setPaginaAtual(paginaValida);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }







  async function abrirAppointmentDoSlot(slotId) {
    try {
      const fn = httpsCallable(functions, "medicos-buscarAppointmentPorSlot");
      const res = await fn({ slotId });

      if (!res.data?.sucesso || !res.data?.appointment) {
        notify("Não foi possível localizar a consulta deste horário.", "error");
        return;
      }

      const consultaId = res.data.appointment.id;

      // Base da URL depende se é médico ou admin
      const basePath =
        role === "admin"
          ? `/medico/consultas/${medicoId}`
          : "/medico/consultas";

      const url = `${basePath}?consulta=${encodeURIComponent(consultaId)}`;

      // Abrir em nova aba
      window.open(url, "_blank", "noopener,noreferrer");

    } catch (e) {
      console.error(e);
      notify("Erro ao buscar dados da consulta.", "error");
    }
  }




  async function excluirDiaCompleto(dia) {
    try {
      setDeletingDay(true);

      // Todos os slots do dia
      const slotsDoDia = slots.filter(s => s.data === dia);

      const deletarFn = httpsCallable(functions, "medicos-deletarSlot");

      let ok = 0;
      let fail = 0;

      await Promise.all(
        slotsDoDia.map(async (s) => {
          try {
            await deletarFn({ slotId: s.id });
            ok++;
          } catch {
            fail++;
          }
        })
      );

      notify(
        `Dia excluído: ${ok} horários cancelados${fail ? `, ${fail} falharam` : ""}.`,
        fail ? "error" : "success"
      );


      setDiasLocais(prev => prev.filter(d => d !== dia));

      // Atualiza agenda
      await carregarSlots();

    } catch (e) {
      console.error(e);
      notify("Erro ao excluir dia completo.", "error");
    } finally {
      setDeletingDay(false);
      setConfirmDeleteDayOpen(false);
      setDiaParaExcluir(null);
    }
  }




  useEffect(() => {
    async function carregarNomeMedico() {
      if (role !== "admin" || !uid) return;

      try {
        const ref = doc(db, "usuarios", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setNomeMedico(data.nome || "Médico");
          setEspecialidade(data.especialidade || "");
        }
      } catch (e) {
        console.error("Erro ao buscar médico:", e);
      }
    }

    carregarNomeMedico();
  }, [role, uid, db]);




  // Quando mudar de médico/visão, reseta a paginação
  useEffect(() => {
    setPaginaAtual(1);
  }, [medicoId]);






  const toastRef = useRef(null);
  const notify = (message, type = "default") => toastRef.current?.push({ message, type });

  function isPastDay(dateStr) {
    const [yyyy, mm, dd] = dateStr.split("-");
    return `${yyyy}-${mm}-${dd}` < todayStr();
  }



  function formatarDataCompleta(dataStr) {
    if (!dataStr) return "";

    const [yyyy, mm, dd] = dataStr.split("-");
    const dataObj = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);

    let nomeDia = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });

    nomeDia = nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1);

    return `${nomeDia}, ${dd}/${mm}/${yyyy}`;
  }



  async function carregarSlots() {
    if (!medicoId) return;
    try {
      const listarSlots = httpsCallable(functions, "medicos-listarMeusSlots");
      const res = await listarSlots({ medicoId });
      if (res.data?.sucesso) {


        const normalizados = res.data.slots.map((s) => {
          const partes = s.data.split("-");
          if (partes[0].length !== 4) {
            const [dd, mm, yyyy] = partes;
            return { ...s, data: `${yyyy}-${mm}-${dd}` };
          }
          return s;
        });
        const ordenados = [...normalizados].sort((a, b) => {
          const dataA = new Date(a.data);
          const dataB = new Date(b.data);
          if (dataA.getTime() !== dataB.getTime()) return dataA - dataB;
          return a.hora.localeCompare(b.hora);
        });
        setSlots(ordenados);
      } else notify("Erro ao carregar slots.", "error");
    } catch (err) {
      console.error("Erro:", err);
      notify("Erro ao carregar slots.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!medicoId) return;
    setLoading(true);
    carregarSlots();
  }, [medicoId]);





  async function removerDiaCompletoDefinitivo(dia) {
    try {
      const slotsDoDia = slots.filter(s => s.data === dia);

      const removerFn = httpsCallable(functions, "medicos-removerSlotDefinitivo");

      let ok = 0, fail = 0;

      for (const slot of slotsDoDia) {
        try {
          await removerFn({ slotId: slot.id });
          ok++;
        } catch {
          fail++;
        }
      }

      notify(
        `Dia removido: ${ok} slots apagados definitivamente${fail ? `, ${fail} falharam` : ""}.`,
        fail ? "error" : "success"
      );


      await carregarSlots();


      setDiasLocais(prev => prev.filter(d => d !== dia));

    } catch (e) {
      console.error(e);
      notify("Erro ao remover dia.", "error");
    }
  }




  async function confirmarRemocaoDefinitiva() {
    if (!diaParaRemoverDefinitivo) return;

    try {
      setRemovendoDefinitivo(true);

      await removerDiaCompletoDefinitivo(diaParaRemoverDefinitivo);

    } catch (e) {
      console.error(e);
      notify("Erro ao remover dia.", "error");
    } finally {
      setRemovendoDefinitivo(false);
      setConfirmDeleteDefinitivoOpen(false);
      setDiaParaRemoverDefinitivo(null);
    }
  }






  function adicionarDia() {
    if (!novoDia?.trim()) {
      notify("Informe uma data.", "error");
      return false;
    }

    // Verifica formato DD/MM/AAAA usando regex
    const regexData = /^([0-3][0-9])\/([0-1][0-9])\/(\d{4})$/;
    const match = novoDia.match(regexData);

    if (!match) {
      notify("Formato inválido. Use DD/MM/AAAA.", "error");
      return false;
    }

    const [, ddStr, mmStr, yyyyStr] = match;
    const dd = Number(ddStr);
    const mm = Number(mmStr);
    const yyyy = Number(yyyyStr);

    // Valida ranges reais
    if (dd < 1 || dd > 31) {
      notify("Dia inválido.", "error");
      return false;
    }
    if (mm < 1 || mm > 12) {
      notify("Mês inválido.", "error");
      return false;
    }
    if (yyyy < 2020 || yyyy > new Date().getFullYear() + 5) {
      notify("Ano inválido.", "error");
      return false;
    }

    // Confere se a data realmente existe (ex: 31/02 não existe)
    const dataObj = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (isNaN(dataObj.getTime())) {
      notify("Data inexistente.", "error");
      return false;
    }

    // Confere dia/mês real (Date pode ajustar sozinho)
    if (
      dataObj.getFullYear() !== yyyy ||
      dataObj.getMonth() + 1 !== mm ||
      dataObj.getDate() !== dd
    ) {
      notify("Data inválida.", "error");
      return false;
    }

    // Converte para ISO
    const dataISO = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

    // Bloqueia datas passadas
    if (dataISO < todayStr()) {
      notify("Você não pode adicionar um dia que já passou.", "error");
      return false;
    }

    // Bloqueia duplicados
    if (diasLocais.includes(dataISO)) {
      notify("Esse dia já foi adicionado.", "error");
      return false;
    }

    // OK — adiciona dia
    setDiasLocais((prev) => [...prev, dataISO]);
    setNovoDia("");
    notify(`Dia ${novoDia} adicionado com sucesso.`, "success");

    return true;
  }


  async function reabrirSlot(slotId) {
    setReabrindoId(slotId);
    try {
      const reativarFn = httpsCallable(functions, "medicos-reativarSlot");
      const res = await reativarFn({ slotId });
      if (res.data?.sucesso) {
        setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: "livre" } : s)));
        await carregarSlots();
        notify("Horário reaberto com sucesso.", "success");
      } else notify("Erro ao reabrir horário.", "error");
    } catch (err) {
      console.error("Erro ao reabrir:", err);
      notify("Erro ao reabrir horário.", "error");
    } finally {
      setReabrindoId(null);
    }
  }

  async function adicionarHorario(dia, hora) {
    if (!hora) return;
    if (hora < "00:00" || hora > "23:59") {
      notify("O horário deve estar entre 00:00 e 23:59.", "error");
      return;
    }
    if (isPastDateTime(dia, hora)) {
      notify("Você não pode adicionar um horário no passado.", "error");
      return;
    }
    try {
      const criarFn = httpsCallable(functions, "medicos-criarSlot");
      const res = await criarFn({ medicoId, data: dia, hora });

      if (res.data?.sucesso) {
        notify(`Horário ${hora} adicionado em ${formatarDataCompleta(dia)}.`, "success");
        await carregarSlots();
        return;
      }

      // Mensagem específica do backend
      const msg = res.data?.mensagem || "";

      if (msg.includes("Já existe um slot para este dia e hora")) {
        notify(`O horário ${hora} já existe em ${formatarDataCompleta(dia)}.`, "error");
        return;
      }

      if (msg.includes("Slot reaberto com sucesso")) {
        notify(`O horário ${hora} foi reaberto com sucesso.`, "success");
        await carregarSlots();
        return;
      }

      notify(msg || "Erro ao criar horário.", "error");

    } catch (err) {
      console.error("Erro ao criar:", err);

      if (err.code === "already-exists") {
        notify(`O horário ${hora} já existe em ${formatarDataCompleta(dia)}.`, "error");
        return;
      }

      if (err.code === "failed-precondition") {
        notify("Não é permitido criar horário no passado.", "error");
        return;
      }

      notify(err.message || "Erro ao criar horário.", "error");
    }

  }

  async function criarVariosSlots(lista) {
    try {
      const criarVariosFn = httpsCallable(functions, "medicos-criarVariosSlots");

      const res = await criarVariosFn({
        medicoId,
        slots: lista.map((s) => ({
          data: s.data,  // YYYY-MM-DD vindo do gerador
          hora: s.hora   // HH:mm
        }))
      });

      const { criados, ignorados, falharam } = res.data;

      notify(
        `${criados} criados • ${ignorados} ignorados • ${falharam} falharam`,
        falharam ? "error" : "success"
      );

      await carregarSlots();
      setShowGerador(false);

    } catch (err) {
      console.error(err);
      notify("Erro ao gerar múltiplos horários.", "error");
    }
  }





  async function deletarSlotConfirmado() {
    try {
      setConfirmLoading(true);
      const deletarFn = httpsCallable(functions, "medicos-deletarSlot");
      const res = await deletarFn({ slotId: confirmTargetId });
      if (res.data?.sucesso) {
        setSlots((prev) =>
          prev.map((s) => (s.id === confirmTargetId ? { ...s, status: "cancelado" } : s))
        );
        notify("Horário cancelado.", "success");
        await carregarSlots();
      } else notify("Erro ao cancelar horário.", "error");
    } catch (err) {
      console.error("Erro ao cancelar:", err);
      notify("Erro ao cancelar horário.", "error");

    } finally {
      setConfirmLoading(false);
      setConfirmOpen(false);
      setConfirmTargetId(null);
    }
  }

  const slotsPorData = slots.reduce((acc, s) => {
    if (!acc[s.data]) acc[s.data] = [];
    acc[s.data].push(s);
    return acc;
  }, {});
  const todosOsDias = Array.from(new Set([...Object.keys(slotsPorData), ...diasLocais])).sort(
    (a, b) => new Date(a) - new Date(b)
  );
  const diasFuturos = todosOsDias.filter(
    (dia) => dia >= todayStr() && !diasOcultos.includes(dia)
  );


  // Filtro por data digitada (DD/MM/AAAA)
  const diasFiltrados = filtroData.trim()
    ? diasFuturos.filter((d) => {
      const [yyyy, mm, dd] = d.split("-");
      const formatoBR = `${dd}/${mm}/${yyyy}`;
      return formatoBR.startsWith(filtroData);
    })
    : diasFuturos;



  const diasPorPagina = 15;
  const totalPaginas = Math.ceil(diasFiltrados.length / diasPorPagina);
  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas || 1);
    }
  }, [totalPaginas]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroData]);


  const indiceInicial = (paginaAtual - 1) * diasPorPagina;
  const indiceFinal = indiceInicial + diasPorPagina;
  const diasPaginados = diasFiltrados.slice(indiceInicial, indiceFinal);




  return (
    <>
      <Toaster ref={toastRef} />




      {/* MODAL — Dia não pode ser excluído */}
      {
        modalBloqueioDia && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[200]">
            <div className="bg-white rounded-xl p-6 max-w-md w-[90%] shadow-xl text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Não é possível excluir este dia
              </h3>

              <p className="text-gray-700 mb-6 text-sm">
                Você só pode cancelar dias sem compromissos.
                Antes, verifique-os na seção <b>Agenda / Consultas</b>, ou clique sobre o slot ocupado,
                cancele consultas ou remarque os retornos, e depois tente novamente.
              </p>

              <button
                onClick={() => setModalBloqueioDia(false)}
                className="bg-gray-900 hover:bg-yellow-500 text-white px-5 py-2 rounded-md text-sm"
              >
                Entendi
              </button>
            </div>
          </div>
        )
      }





      {loading ? (
        <div className="max-w-4xl mx-auto bg-gray-900 shadow rounded-md p-7 space-y-6">

          {/* Título */}
          <div className="h-6 w-40 bg-gray-700 rounded animate-pulse"></div>

          {/* Botões */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="h-10 w-full md:w-40 bg-gray-700 rounded animate-pulse"></div>
            <div className="h-10 w-full md:w-40 bg-gray-700 rounded animate-pulse"></div>
          </div>

          {/* Barra de busca */}
          <div className="h-11 w-full bg-gray-800 rounded-lg animate-pulse"></div>

          {/* Skeleton de vários dias */}
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-gray-800 border border-gray-700 rounded-md p-5 space-y-4 animate-pulse"
              >
                {/* Cabeçalho do dia */}
                <div className="flex items-center justify-between">
                  <div className="h-5 w-52 bg-gray-600 rounded"></div>
                  <div className="h-8 w-32 bg-gray-700 rounded"></div>
                </div>

                {/* Lista de horários */}
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="flex justify-between items-center pt-2">
                      <div className="h-4 w-32 bg-gray-600 rounded"></div>
                      <div className="h-6 w-20 bg-gray-700 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      ) : (



        <div className="max-w-4xl mx-auto bg-gray-900 shadow rounded-md p-7 space-y-2">



          <h2 className="text-2xl font-semibold text-white text-center md:text-left">
            {role === "doctor" ? "Minha Agenda" : `Agenda de ${nomeMedico}`}
          </h2>

          {role !== "doctor" && especialidade && (
            <p className="text-white text-sm mb-2 text-center md:text-left">
              Especialidade: {especialidade}
            </p>
          )}


          {/* HEADER — VOLTAR + ADICIONAR DIA */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 mt-4">

            {/* Botão Voltar */}
            {role === "admin" && (
              <button
                onClick={() => navigate("/admin/slots")}
                className="bg-gray-800 hover:bg-yellow-400 text-white font-medium px-6 py-2 rounded-md transition w-full md:w-auto"
              >
                ← Voltar
              </button>
            )}

            {/* ADICIONAR DIA — versão com campo escondido */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 items-end md:items-center">

              <Button
                className="w-full sm:w-auto !bg-gray-800 hover:!bg-yellow-400 text-white font-medium px-6 py-2 rounded-md transition"
                onClick={() => setShowGerador(true)}
              >
                Gerar vários horários
              </Button>



              {!showInputDia ? (
                // BOTÃO: MOSTRAR INPUT
                <Button
                  className="w-full sm:w-auto !bg-gray-800 hover:!bg-yellow-400 text-white font-medium px-6 py-2 rounded-md transition"
                  onClick={() => setShowInputDia(true)}
                >
                  Adicionar dia
                </Button>
              ) : (
                // INPUT VISÍVEL APÓS CLICAR
                <div className="flex flex-col sm:flex-row gap-2 items-end">

                  <IMaskInput
                    mask="00/00/0000"
                    value={novoDia}
                    onAccept={(v) => setNovoDia(v)}
                    placeholder="DD/MM/AAAA"
                    className="border border-gray-400 rounded-md px-3 py-2 bg-gray-50 
                 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />

                  {/* Botão Salvar */}
                  <Button
                    className="!bg-green-600 hover:!bg-green-700 text-white px-4 py-2 rounded-md"
                    onClick={() => {
                      const ok = adicionarDia();
                      if (ok) setShowInputDia(false);
                    }}
                  >
                    Salvar
                  </Button>

                  {/* Botão Cancelar */}
                  <Button
                    className="!bg-gray-300 hover:!bg-gray-400 text-gray-800 px-4 py-2 rounded-md"
                    onClick={() => {
                      setShowInputDia(false);
                      setNovoDia("");
                    }}
                  >
                    Cancelar
                  </Button>

                </div>
              )}

            </div>


          </div>


          {/* Listagem */}

          {/* Listagem */}
          {diasFuturos.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum dia disponível.</p>
          ) : (
            <>



              {/* BARRA DE BUSCA POR DATA */}
              <div className="flex justify-center mb-1">
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg border border-gray-300 px-4 py-3 w-full shadow-sm">

                  <IMaskInput
                    mask="00/00/0000"
                    value={filtroData}
                    onAccept={(v) => setFiltroData(v)}
                    placeholder="Buscar data (DD/MM/AAAA)"
                    className="flex-1 outline-none text-gray-100 text-sm"
                  />
                  {filtroData && (
                    <button
                      onClick={() => setFiltroData("")}
                      className="text-gray-100 hover:text-gray-800 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>



              {/* PAGINAÇÃO — TOPO (uma vez só) */}
              {totalPaginas > 1 && (
                <Pagination
                  current={paginaAtual}
                  total={totalPaginas}
                  onChange={goToPage}
                />



              )}

              <div className="mt-4"></div>

              {/* DIAS PAGINADOS */}
              {diasPaginados.map((dia) => {
                const slotsDoDia = slotsPorData[dia] || [];
                const totalCancelados = slotsDoDia.filter(s => s.status === "cancelado").length;
                const totalOcupados = slotsDoDia.filter(s => s.status === "ocupado").length;
                const totalLivres = slotsDoDia.filter(s => s.status === "livre").length;
                const totalGeral = slotsDoDia.length;


                const podeOcultar = slotsDoDia.every(
                  (s) => s.status === "livre" || s.status === "cancelado"
                );

                return (

                  // HEADER DOS DIAS //
                  <div key={dia} className="bg-gray-800 border border-gray-700 rounded-md p-3 mb-2 px-3">

                    <div
                      className="flex items-center justify-between cursor-pointer mb-2"
                      onClick={() => toggleDia(dia)}
                    >
                      <div className="flex items-center gap-2 select-none">
                        <CalendarCheck className="text-white" size={17} />
                        <h3 className="font-semibold text-sm text-white">
                          {formatarDataCompleta(dia)}
                        </h3>
                        <div className="flex items-center gap-4 relative group">



                          {/* CONTADORES */}
                          {!diasAbertos[dia] && totalOcupados > 0 && (
                            <div
                              className="flex items-center gap-3 text-sm font-semibold"
                              title={`Cancelados: ${totalCancelados} • Ocupados: ${totalOcupados} • Livres: ${totalLivres}`}
                            >

                              <span className="text-blue-500">
                                {String(totalOcupados).padStart(2, "0")}
                              </span>

                            </div>
                          )}



                        </div>

                      </div>

                      {podeOcultar && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDiaParaRemoverDefinitivo(dia);
                            setConfirmDeleteDefinitivoOpen(true);
                          }}
                          className="text-red-400 hover:text-red-500 text-xs font-semibold px-2 py-1 rounded transition hover:bg-red-500/10"
                          title="Apagar definitivo"
                        >
                          Deletar
                        </button>
                      )}
                    </div>

                    {/* QUANDO ABERTO — TUDO DENTRO DO CARD */}
                    {diasAbertos[dia] && (
                      <>
                        <div
                          className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-2 mb-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AdicionarHorarioButton
                            dia={dia}
                            onAdd={adicionarHorario}
                            notify={notify}
                            diaComInputAberto={diaComInputAberto}
                            setDiaComInputAberto={setDiaComInputAberto}
                          />

                          {diaComInputAberto !== dia && (
                            <Button
                              type="button"
                              onClick={() => {
                                const existeOcupado = slotsDoDia.some(s => s.status === "ocupado");
                                if (existeOcupado) {
                                  setModalBloqueioDia(true);
                                  return;
                                }
                                setDiaParaExcluir(dia);
                                setConfirmDeleteDayOpen(true);
                              }}
                              className="!text-xs !px-5 !py-2 !border !border-transparent !bg-gray-700 !text-white hover:!bg-yellow-400 whitespace-nowrap flex-shrink"
                            >
                              Cancelar todos horários
                            </Button>
                          )}
                        </div>


                        <ul className="divide-y">
                          {slotsDoDia.length ? (
                            slotsDoDia.map((slot) => (
                              <li key={slot.id} className="py-2 flex justify-between items-center">

                                <span
                                  onClick={() => {
                                    if (slot.status !== "ocupado") return;

                                    const consultaId = slot.appointmentId;
                                    if (!consultaId) {
                                      notify("Este horário ocupado não possui appointmentId.", "error");
                                      return;
                                    }

                                    const basePath =
                                      role === "admin"
                                        ? `/medico/consultas/${medicoId}`
                                        : "/medico/consultas";

                                    const url = `${basePath}?consulta=${encodeURIComponent(consultaId)}`;

                                    window.open(url, "_blank", "noopener,noreferrer");
                                  }}
                                  className={`${slot.status === "ocupado" ? "cursor-pointer hover:underline" : ""} text-white font-medium`}
                                >
                                  {slot.hora} -{" "}
                                  <b
                                    className={
                                      slot.status === "ocupado"
                                        ? "text-blue-600"
                                        : slot.status === "livre"
                                          ? "text-white"
                                          : "text-red-600"
                                    }
                                  >
                                    {slot.status}
                                  </b>
                                </span>


                                {slot.status === "cancelado" ? (
                                  <button
                                    onClick={() => reabrirSlot(slot.id)}
                                    disabled={reabrindoId === slot.id}
                                    className={`text-sm flex items-center gap-1 ${reabrindoId === slot.id
                                      ? "text-gray-400 cursor-not-allowed"
                                      : "text-white hover:underline"
                                      }`}
                                  >
                                    {reabrindoId === slot.id ? "Reabrindo..." : "Reabrir"}
                                  </button>
                                ) : slot.status === "ocupado" ? null : (
                                  <button
                                    onClick={() => {
                                      setConfirmOpen(true);
                                      setConfirmTargetId(slot.id);
                                    }}
                                    className="text-sm text-white hover:underline"
                                  >
                                    Cancelar
                                  </button>
                                )}

                              </li>
                            ))
                          ) : (
                            <li className="text-sm text-gray-500 italic">Nenhum horário ainda.</li>
                          )}
                        </ul>




                      </>
                    )}

                  </div>

                );
              })}

              {/* PAGINAÇÃO — RODAPÉ (uma vez só) */}
              {totalPaginas > 1 && (
                <Pagination
                  current={paginaAtual}
                  total={totalPaginas}
                  onChange={goToPage}
                />

              )}
            </>
          )}



        </div>
      )}



      {/* MODAIS */}
      <GerarSlotsModal
        open={showGerador}
        onClose={() => setShowGerador(false)}
        onGenerate={criarVariosSlots}
      />

      <ConfirmModal
        open={confirmDeleteDayOpen}
        title="Cancelar todos horários"
        message="Tem certeza? Todos os horários deste dia serão cancelados."
        confirmText="Excluir dia"
        cancelText="Voltar"
        loading={deletingDay}
        onConfirm={() => excluirDiaCompleto(diaParaExcluir)}
        onClose={() => !deletingDay && setConfirmDeleteDayOpen(false)}
      />

      <ConfirmModal
        open={confirmOpen}
        title="Cancelar horário"
        message="Tem certeza que deseja cancelar este horário?"
        confirmText="Cancelar horário"
        cancelText="Voltar"
        onConfirm={deletarSlotConfirmado}
        onClose={() => !confirmLoading && setConfirmOpen(false)}
        loading={confirmLoading}
      />

      <ConfirmModal
        open={confirmDeleteDefinitivoOpen}
        title="Remover definitivamente"
        message="Tem certeza? TODOS os slots deste dia serão APAGADOS do sistema. Esta ação não pode ser desfeita."
        confirmText="Apagar dia"
        cancelText="Cancelar"
        loading={removendoDefinitivo}
        onConfirm={confirmarRemocaoDefinitiva}
        onClose={() => !removendoDefinitivo && setConfirmDeleteDefinitivoOpen(false)}
      />

      {modalAppointmentOpen && appointmentSelecionado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[300]">
          {/* conteúdo */}
        </div>
      )}
    </>
  );
}   // fecha AgendaScreen SÓ UMA VEZ




// Adicionar Horário 

function AdicionarHorarioButton({
  dia,
  onAdd,
  notify,
  diaComInputAberto,
  setDiaComInputAberto
}) {
  const [hora, setHora] = useState("");
  const [saving, setSaving] = useState(false);

  const aberto = diaComInputAberto === dia; // controla se o input desse dia está aberto

  const handleSubmit = async (e) => {
    e.preventDefault();

    const regexHora = /^[0-2][0-9]:[0-5][0-9]$/;

    if (!regexHora.test(hora)) {
      notify("Formato inválido. Use HH:MM (ex: 09:30).", "error");
      return;
    }

    const [H, M] = hora.split(":").map(Number);
    if (H > 23 || M > 59) {
      notify("Horário inválido. Máximo permitido é 23:59.", "error");
      return;
    }

    if (dia === todayStr() && hora <= nowTimeStr()) {
      notify("Não é possível adicionar horário no passado.", "error");
      return;
    }

    setSaving(true);
    await onAdd(dia, hora);
    setSaving(false);
    setHora("");
    setDiaComInputAberto(null); // fecha o input depois de salvar
  };

  // Se NÃO estiver aberto para esse dia, mostra só o botão
  if (!aberto) {
    return (
      <Button
        type="button"
        onClick={() => {
          setHora("");
          setDiaComInputAberto(dia)
        }}
        className="!text-xs !px-5 !py-2 !border !border-transparent !bg-gray-700 !text-white hover:!bg-yellow-400 whitespace-nowrap flex-shrink"
      >
        Adicionar horário
      </Button>
    );
  }

  // Se estiver aberto para esse dia, mostra o form
  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
      title="Informe o horário no formato HH:MM (00:00–23:59). Horários passados não são permitidos."
    >
      <IMaskInput
        mask="00:00"
        value={hora}
        onAccept={(v) => setHora(v)}
        placeholder="HH:MM"
        className="border border-gray-400 text-white rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        required
      />
      <button
        type="submit"
        disabled={saving}
        className="text-sm px-3 py-1 border border-gray-950 rounded-md bg-white text-gray-950 hover:bg-green-100 transition-all disabled:opacity-60"
      >
        {saving ? "Salvando..." : "Salvar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setHora("");
          setDiaComInputAberto(null); // fecha sem salvar
        }}
        className="text-sm px-3 py-1 border border-gray-950 rounded-md bg-white text-gray-950 hover:bg-red-100 transition-all"
      >
        Cancelar
      </button>
    </form>
  );
}


function GerarSlotsModal({ open, onClose, onGenerate }) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [intervalo, setIntervalo] = useState(60);
  const [creating, setCreating] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [finalError, setFinalError] = useState("");
  const [diasSemana, setDiasSemana] = useState({
    dom: false,
    seg: true,
    ter: true,
    qua: true,
    qui: true,
    sex: true,
    sab: false
  });
  const [preview, setPreview] = useState([]);
  const [erro, setErro] = useState("");



  useEffect(() => {
    if (!open) {
      setPreview([]);
      setPreviewError("");
      setFinalError("");
      setDataInicio("");
      setDataFim("");
      setHoraInicio("08:00");
      setHoraFim("18:00");
      setIntervalo(60);
    }
  }, [open]);


  useEffect(() => {
    if (open) {
      setPreview([]);
      setPreviewError("");
      setFinalError("");
    }
  }, [
    dataInicio,
    dataFim,
    horaInicio,
    horaFim,
    intervalo,
    diasSemana,
    open
  ]);




  if (!open) return null;



  function showFinalError(msg) {
    setFinalError(msg);
    setTimeout(() => setFinalError(""), 4000);
  }


  function gerarPreview() {
    setPreviewError("");
    setFinalError("");

    if (intervalo < 30) {
      setPreviewError("O intervalo deve ser maior que 30 minutos.");
      return;
    }

    if (!dataInicio || !dataFim) {
      setPreviewError("Selecione as datas de início e fim.");
      return;
    }

    // ==================================================
    // CONVERSÃO SEGURA DE DATAS (sem UTC)
    // ==================================================
    const [iY, iM, iD] = dataInicio.split("-").map(Number);
    const [fY, fM, fD] = dataFim.split("-").map(Number);

    const dtInicio = new Date(iY, iM - 1, iD);
    const dtFim = new Date(fY, fM - 1, fD);
    const hoje = new Date();

    // ==================================================
    // Bloqueio de datas passadas (comparação ISO real)
    // ==================================================
    const hojeISO = todayStr(); // já está YYYY-MM-DD

    const inicioISO = `${iY}-${String(iM).padStart(2, "0")}-${String(iD).padStart(2, "0")}`;

    if (inicioISO < hojeISO) {
      setPreviewError("Não é permitido gerar horários em dias que já passaram.");
      return;
    }

    if (dtFim < dtInicio) {
      setPreviewError("A data final deve ser igual ou maior que a inicial.");
      return;
    }

    const resultado = [];

    const diasSemanaMap = {
      0: "dom",
      1: "seg",
      2: "ter",
      3: "qua",
      4: "qui",
      5: "sex",
      6: "sab"
    };

    // ==================================================
    // CURSOR SEM PROBLEMAS DE TIMEZONE
    // ==================================================
    let cursor = new Date(iY, iM - 1, iD);

    while (cursor.getTime() <= dtFim.getTime()) {
      const diaSemana = diasSemanaMap[cursor.getDay()];

      if (diasSemana[diaSemana]) {
        let [h, m] = horaInicio.split(":").map(Number);
        const [endH, endM] = horaFim.split(":").map(Number);

        let atualMin = h * 60 + m;
        const fimMin = endH * 60 + endM;

        while (atualMin <= fimMin) {
          const hh = String(Math.floor(atualMin / 60)).padStart(2, "0");
          const mm = String(atualMin % 60).padStart(2, "0");
          const horaStr = `${hh}:${mm}`;

          // GERA ISO SEM UTC
          const dataISO =
            cursor.getFullYear() +
            "-" +
            String(cursor.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(cursor.getDate()).padStart(2, "0");

          resultado.push({
            data: dataISO,
            hora: horaStr
          });

          atualMin += intervalo;
        }
      }

      // SOMA +1 DIA (sem afetar horário)
      cursor.setDate(cursor.getDate() + 1);
    }

    if (resultado.length === 0) {
      setPreviewError("Nenhum horário válido foi gerado.");
      return;
    }

    setPreview(resultado);
  }



  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!creating) onClose();
        }}
      />


      <div className="relative bg-white w-[95%] max-w-2xl rounded-xl p-6 shadow-xl space-y-4 z-[201]">

        <h2 className="text-xl font-semibold">Gerar Vários Horários</h2>

        {finalError && (
          <div className="border border-red-400 bg-red-50 text-red-700 rounded-md px-3 py-2 text-sm animate-[fadeIn_.25s_ease-out]">
            ⚠ {finalError}
          </div>
        )}




        {erro && (
          <div className="border border-red-400 bg-red-50 text-red-700 rounded-md px-3 py-2 text-sm">
            ⚠ {erro}
          </div>
        )}

        {/* CAMPOS */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Data início:</p>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full border px-2 py-1 rounded"
            />
          </div>

          <div>
            <p className="text-sm font-medium">Data fim:</p>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full border px-2 py-1 rounded"
            />
          </div>
        </div>

        {/* DIAS DA SEMANA */}

        <div>
          <p className="text-sm font-medium mb-1">Dias da semana:</p>

          <div className="grid grid-cols-6 gap-1 text-center">
            {["seg", "ter", "qua", "qui", "sex", "sab"].map((d) => (
              <button
                key={d}
                className={`px-2 py-1 border rounded text-sm ${diasSemana[d] ? "bg-yellow-400 text-black" : "bg-gray-200"
                  }`}
                onClick={() =>
                  setDiasSemana((prev) => ({ ...prev, [d]: !prev[d] }))
                }
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        </div>


        {/* HORÁRIOS */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm font-medium">Hora início:</p>
            <IMaskInput
              mask="00:00"
              value={horaInicio}
              onAccept={(v) => setHoraInicio(v)}
              placeholder="HH:MM"
              className="w-full border px-2 py-1 rounded"
            />

          </div>

          <div>
            <p className="text-sm font-medium">Hora fim:</p>
            <IMaskInput
              mask="00:00"
              value={horaFim}
              onAccept={(v) => setHoraFim(v)}
              placeholder="HH:MM"
              className="w-full border px-2 py-1 rounded"
            />

          </div>

          <div>
            <p className="text-sm font-medium">Intervalo (min):</p>
            <IMaskInput
              mask={Number}
              scale={0}
              min={30}
              max={60}
              thousandsSeparator=""
              value={String(intervalo)}
              onAccept={(v) => {
                const n = Number(v);
                setIntervalo(isNaN(n) ? 0 : n);
              }}
              placeholder="Minutos (mín 30)"
              className="w-full border px-2 py-1 rounded"
            />


          </div>
        </div>

        {/* BOTÃO PREVIEW */}
        <button
          onClick={gerarPreview}
          className="w-full bg-gray-900 text-white py-2 rounded hover:bg-yellow-500 transition"
        >
          Gerar pré-visualização
        </button>

        {previewError && (
          <p className="text-red-600 text-sm">{previewError}</p>
        )}


        {/* LISTA PREVIEW */}
        {preview.length > 0 && (
          <div className="max-h-48 overflow-y-auto border p-3 rounded bg-gray-50">
            <p className="text-sm font-medium mb-2">{preview.length} horários gerados:</p>
            <ul className="text-sm divide-y">
              {preview.map((p, i) => (
                <li key={i} className="py-1">
                  {p.data.split("-").reverse().join("/")} — {p.hora}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AÇÕES */}
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded"
            onClick={() => {
              if (creating) return;

              // limpa tudo ao fechar
              setPreview([]);
              setPreviewError("");
              setFinalError("");
              setDataInicio("");
              setDataFim("");
              setHoraInicio("08:00");
              setHoraFim("18:00");
              setIntervalo(60);

              onClose();
            }}
            disabled={creating}
          >
            Cancelar
          </button>


          <button
            className={`px-4 py-2 rounded flex items-center gap-2 text-white 
    ${creating ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
            disabled={creating}
            onClick={async () => {

              if (intervalo < 30) {
                showFinalError("O intervalo deve ser maior que 30 minutos.");
                return;
              }


              if (preview.length === 0) {
                showFinalError("Gere a pré-visualização antes de confirmar.");
                return;
              }


              setFinalError("");
              setCreating(true);

              try {
                await onGenerate(preview);
              } catch {
                setFinalError("Erro ao criar horários. Tente novamente.");
              }

              setCreating(false);
            }}
          >
            {creating && (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l3 3-3 3v-4a8 8 0 01-8-8z"
                ></path>
              </svg>
            )}

            {creating ? "Criando horários..." : "Confirmar"}
          </button>








        </div>
      </div>
    </div>
  );
}