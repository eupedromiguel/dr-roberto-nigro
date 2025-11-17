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
  const [showInputDia, setShowInputDia] = useState(false);
  const [showGerador, setShowGerador] = useState(false);
  const [confirmDeleteDayOpen, setConfirmDeleteDayOpen] = useState(false);
  const [diaParaExcluir, setDiaParaExcluir] = useState(null);
  const [deletingDay, setDeletingDay] = useState(false);



async function excluirDiaCompleto(dia) {
  try {
    setDeletingDay(true);

    // Todos os slots do dia
    const slotsDoDia = slots.filter(s => s.data === dia);

    const deletarFn = httpsCallable(functions, "medicos-deletarSlot");

    let ok = 0, fail = 0;

    for (const slot of slotsDoDia) {
      try {
        await deletarFn({ slotId: slot.id });
        ok++;
      } catch (e) {
        fail++;
      }
    }

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
        notify(`✅ Horário ${hora} adicionado em ${formatarDataCompleta(dia)}.`, "success");
        carregarSlots();
      } else notify(res.data?.mensagem || "Erro ao criar horário.", "error");
    } catch (err) {
      console.error("Erro ao criar:", err);
      notify("Erro ao criar horário.", "error");
    }
  }


  async function criarVariosSlots(lista) {
    try {
      const criarFn = httpsCallable(functions, "medicos-criarSlot");
      let okCount = 0;
      let failCount = 0;

      for (const item of lista) {
        try {
          await criarFn({
            medicoId,
            data: item.data,
            hora: item.hora
          });
          okCount++;
        } catch (e) {
          failCount++;
          console.warn("Falhou:", item.data, item.hora);
        }
      }

      notify(`${okCount} horários criados. ${failCount > 0 ? failCount + " falharam." : ""}`, "success");

      carregarSlots();
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
          {diasFuturos.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum dia disponível.</p>
          ) : (
            diasFuturos.map((dia) => (
              <div key={dia} className="border rounded-md p-4 bg-gray-50">


                
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">

  {/* Título da data */}
  <h3 className="font-semibold text-gray-700">
    📅 {formatarDataCompleta(dia)}
  </h3>

  <div className="flex items-center gap-3">
    {/* Botão adicionar horário */}
    <AdicionarHorarioButton
      dia={dia}
      onAdd={adicionarHorario}
      notify={notify}
    />

    {/* Botão EXCLUIR DIA */}
    <Button
  type="button"
  onClick={() => {
    setDiaParaExcluir(dia);
    setConfirmDeleteDayOpen(true);
  }}
  className="!text-xs !px-3 !py-2 !border !border-gray-950 !bg-white !text-gray-950 hover:!bg-red-100 !max-w-[150px] truncate"
>
  Excluir dia
</Button>

  </div>
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

      <GerarSlotsModal
        open={showGerador}
        onClose={() => setShowGerador(false)}
        onGenerate={criarVariosSlots}
      />


     
      <ConfirmModal
        open={confirmDeleteDayOpen}
        title="Excluir dia inteiro"
        message="Tem certeza? Todos os horários deste dia serão cancelados (livres e ocupados)."
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



    </>
  );
}

// Adicionar Horário 

function AdicionarHorarioButton({ dia, onAdd, notify }) {
  const [hora, setHora] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);

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
      className="!text-xs !px-5 !py-2 !border !border-gray-950 !bg-white !text-gray-950 hover:!bg-yellow-100 whitespace-nowrap flex-shrink"
    >
      Adicionar Horário
    </Button>
    

  );
}

function GerarSlotsModal({
  open,
  onClose,
  onGenerate
}) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("18:00");
  const [intervalo, setIntervalo] = useState(60); // minutos
  const [creating, setCreating] = useState(false);
  const [diasSemana, setDiasSemana] = useState
    ({
      dom: false,
      seg: true,
      ter: true,
      qua: true,
      qui: true,
      sex: true,
      sab: false
    });
  const [preview, setPreview] = useState([]);

  if (!open) return null;

  function gerarPreview() {
    const resultado = [];

    const dtInicio = new Date(dataInicio);
    const dtFim = new Date(dataFim);

    if (isNaN(dtInicio) || isNaN(dtFim) || dtFim < dtInicio) {
      alert("Período inválido");
      return;
    }

    const diasSemanaMap = {
      0: "dom",
      1: "seg",
      2: "ter",
      3: "qua",
      4: "qui",
      5: "sex",
      6: "sab"
    };

    const cursor = new Date(dtInicio);

    while (cursor <= dtFim) {
      const nomeDia = diasSemanaMap[cursor.getDay()];

      if (diasSemana[nomeDia]) {
        // gerando horários do dia
        let horaAtual = horaInicio;

        while (horaAtual <= horaFim) {
          resultado.push({
            data: cursor.toISOString().slice(0, 10), // yyyy-mm-dd
            hora: horaAtual
          });

          // avança intervalo
          const [H, M] = horaAtual.split(":").map(Number);
          const next = new Date(cursor);
          next.setHours(H, M + intervalo, 0, 0);
          horaAtual = `${String(next.getHours()).padStart(2, "0")}:${String(next.getMinutes()).padStart(2, "0")}`;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    setPreview(resultado);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !creating && onClose()}
      />


      <div className="relative bg-white w-[95%] max-w-2xl rounded-xl p-6 shadow-xl space-y-4 z-[201]">

        <h2 className="text-xl font-semibold">Gerar Vários Horários</h2>

        {/* PERÍODO */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium">Data início:</p>
            <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
              className="w-full border px-2 py-1 rounded" />
          </div>

          <div>
            <p className="text-sm font-medium">Data fim:</p>
            <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
              className="w-full border px-2 py-1 rounded" />
          </div>
        </div>

        {/* DIAS DA SEMANA */}
        <div>
          <p className="text-sm font-medium mb-1">Dias da semana:</p>
          <div className="grid grid-cols-7 gap-1 text-center">
            {Object.keys(diasSemana).map((d) => (
              <button
                key={d}
                className={`px-2 py-1 border rounded text-sm 
                  ${diasSemana[d] ? "bg-yellow-400 text-black" : "bg-gray-200"}`}
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
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}
              className="w-full border px-2 py-1 rounded" />
          </div>

          <div>
            <p className="text-sm font-medium">Hora fim:</p>
            <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)}
              className="w-full border px-2 py-1 rounded" />
          </div>

          <div>
            <p className="text-sm font-medium">Intervalo (min):</p>
            <input type="number" min="5" value={intervalo}
              onChange={(e) => setIntervalo(Number(e.target.value))}
              className="w-full border px-2 py-1 rounded" />
          </div>
        </div>

        {/* BOTÃO PREVIEW */}
        <button
          onClick={gerarPreview}
          className="w-full bg-gray-900 text-white py-2 rounded hover:bg-yellow-500 transition"
        >
          Gerar pré-visualização
        </button>

        {/* LISTA DE PREVIEW */}
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

        {/* BOTÕES FINAIS */}
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 bg-gray-300 rounded"
            onClick={() => !creating && onClose()}
            disabled={creating}
          >
            Cancelar
          </button>


          <button
            className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2"
            disabled={preview.length === 0 || creating}
            onClick={async () => {
              setCreating(true);
              await onGenerate(preview);
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

            {creating ? "Criando horários..." : "Confirmar criação"}
          </button>

        </div>

      </div>
    </div>
  );
}

