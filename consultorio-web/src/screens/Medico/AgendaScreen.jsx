import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";
import Button from "../../components/Button";
import Input from "../../components/Input";
import { IMaskInput } from "react-imask";
import { useAuth } from "../../context/AuthContext";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";



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
            {t.type === "error" && <span>⚠️</span>}
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
    const nomeDia = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });
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
    carregarSlots();
  }, [medicoId]);


  function adicionarDia() {
    if (!novoDia?.trim()) return;
    let dataFormatada = "";
    if (novoDia.includes("/")) {
      const [dd, mm, yyyy] = novoDia.split("/");
      dataFormatada = `${yyyy}-${mm}-${dd}`;
    } else {
      dataFormatada = novoDia;
    }
    if (isPastDay(dataFormatada)) return notify("Você não pode adicionar um dia que já passou.", "error");
    if (diasLocais.includes(dataFormatada)) return notify("Esse dia já foi adicionado.", "error");
    setDiasLocais((prev) => [...prev, dataFormatada]);
    setNovoDia("");
    notify("Dia adicionado à pré-lista. Lembre-se de incluir horários.", "success");
  }

  async function reabrirSlot(slotId) {
    setReabrindoId(slotId);
    try {
      const reativarFn = httpsCallable(functions, "medicos-reativarSlot");
      const res = await reativarFn({ slotId });
      if (res.data?.sucesso) {
        setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: "livre" } : s)));
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
      notify("⛔ O horário deve estar entre 00:00 e 23:59.", "error");
      return;
    }
    if (isPastDateTime(dia, hora)) {
      notify("⚠️ Você não pode adicionar um horário no passado.", "error");
      return;
    }
    try {
      const criarFn = httpsCallable(functions, "medicos-criarSlot");
      const res = await criarFn({ medicoId, data: dia, hora });
      if (res.data?.sucesso) {
        notify(`✅ Horário ${hora} adicionado em ${formatarDataCompleta(dia)}.`, "success");
        carregarSlots();
      } else notify(res.data?.mensagem || "Erro ao criar horário.", "error");
    } catch (err) {
      console.error("Erro ao criar:", err);
      notify("Erro ao criar horário.", "error");
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
  const diasFuturos = todosOsDias.filter((dia) => dia >= todayStr());

  return (
    <>
      <Toaster ref={toastRef} />

      {loading ? (
        <div className="max-w-4xl mx-auto bg-white shadow rounded-md p-6 animate-pulse space-y-6">
          <div className="h-6 bg-slate-300 rounded w-1/3"></div>
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

            {/* Campo + Botão Adicionar Dia */}
            <div className="w-full md:w-auto flex flex-col sm:flex-row gap-4 items-end md:items-center">
              <div className="w-full sm:w-auto">
                <IMaskInput
                  mask="00/00/0000"
                  value={novoDia}
                  onAccept={(v) => setNovoDia(v)}
                  placeholder="DD/MM/AAAA"
                  className="w-full border border-gray-400 rounded-md px-3 py-2 bg-gray-50 
                   focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <Button
                className="w-full sm:w-auto !bg-gray-800 hover:!bg-yellow-400 text-white font-medium px-6 py-2 rounded-md transition"
                onClick={adicionarDia}
              >
                Adicionar Dia
              </Button>
            </div>
          </div>


          {/* Listagem */}
          {diasFuturos.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum dia disponível.</p>
          ) : (
            diasFuturos.map((dia) => (
              <div key={dia} className="border rounded-md p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-700">📅 {formatarDataCompleta(dia)}</h3>
                  <AdicionarHorarioButton dia={dia} onAdd={adicionarHorario} notify={notify} />
                </div>

                <ul className="divide-y">
                  {slotsPorData[dia]?.length ? (
                    slotsPorData[dia].map((slot) => (
                      <li key={slot.id} className="py-2 flex justify-between items-center">
                        <span>
                          ⏰ {slot.hora} —{" "}
                          <b
                            className={
                              slot.status === "livre"
                                ? "text-green-600"
                                : slot.status === "ocupado"
                                  ? "text-blue-600"
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
                              : "text-gray-950 hover:underline"
                              }`}
                          >
                            {reabrindoId === slot.id && (
                              <svg
                                className="animate-spin h-4 w-4 text-emerald-600"
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
                            {reabrindoId === slot.id ? "Reabrindo..." : "Reabrir"}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setConfirmOpen(true);
                              setConfirmTargetId(slot.id);
                            }}
                            className="text-sm text-gray-950 hover:underline"
                          >
                            Remover
                          </button>
                        )}
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-gray-500 italic">Nenhum horário ainda.</li>
                  )}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

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
    </>
  );
}

// ===============================================
// Adicionar Horário (IMaskInput + Tooltip + notify erros)
// ===============================================
function AdicionarHorarioButton({ dia, onAdd, notify }) {
  const [hora, setHora] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hora) return;
    if (hora < "00:00" || hora > "23:59") {
      notify("⛔ O horário deve estar entre 00:00 e 23:59.", "error");
      return;
    }
    if (dia === todayStr() && hora <= nowTimeStr()) {
      notify("⚠️ Não é possível adicionar horário no passado.", "error");
      return;
    }

    setSaving(true);
    await onAdd(dia, hora);
    setSaving(false);
    setHora("");
    setShowInput(false);
  };

  if (showInput)
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
          className="border border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 "
          required
        />
        <button
          type="submit"
          disabled={saving}
          className="text-sm px-3 py-1 border border-gray-950 rounded-md bg-white text-gray-950 hover:bg-yellow-100 transition-all disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          onClick={() => setShowInput(false)}
          className="text-sm px-3 py-1 border border-gray-950 rounded-md bg-white text-gray-950 hover:bg-red-100 transition-all"
        >
          Cancelar
        </button>
      </form>
    );

  return (
    <Button
      type="button"
      onClick={() => setShowInput(true)}
      className="!text-xs !px-3 !py-2 !border !border-gray-950 !bg-white !text-gray-950 hover:!bg-yellow-100 !max-w-[150px] truncate"
    >
      Adicionar horário
    </Button>

  );
}
