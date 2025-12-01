import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { httpsCallable } from "firebase/functions";
import { functions, auth } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import Button from "../../components/Button";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarSearch, ClockPlus } from "lucide-react";


// Toaster reutilizável

const Toaster = forwardRef(function Toaster(_props, ref) {
  const [items, setItems] = useState([]);

  function remove(id) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  useImperativeHandle(ref, () => ({
    push({ message, type = "default", duration = 5000 }) {
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => remove(id), duration);
    },
  }));

  const colorByType = (type) =>
    type === "success"
      ? "border-green-400"
      : type === "error"
        ? "border-red-400"
        : "border-gray-400";

  return (
    <div className="fixed top-20 right-4 z-[120] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`w-[320px] max-w-[90vw] rounded-xl bg-white/95 backdrop-blur border ${colorByType(
            t.type
          )} shadow-lg px-4 py-3 animate-[fadeIn_.2s_ease-out]`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 text-sm text-gray-950">{t.message}</div>
            <button
              onClick={() => remove(t.id)}
              className="text-gray-500 hover:text-gray-800 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <style>{`@keyframes fadeIn { from { opacity:.0; transform: translateY(6px) } to { opacity:1; transform: translateY(0) } }`}</style>
    </div>
  );
});

// ===============================================
// Componente principal
// ===============================================
export default function AgendarScreen() {
  const { role } = useAuth();
  const [slots, setSlots] = useState([]);
  const [medicosInfo, setMedicosInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [medicoSelecionado, setMedicoSelecionado] = useState(null);
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});
  const [loadingSlotId, setLoadingSlotId] = useState(null);
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const db = getFirestore();
  const [emailVerificado, setEmailVerificado] = useState(true);
  const [verificandoEmail, setVerificandoEmail] = useState(true);

  const notify = (msg, type = "default") =>
    toastRef.current?.push({ message: msg, type, duration: 5000 });

  const handleImageLoad = useCallback((id) => {
    setLoadedImages((prev) => ({ ...prev, [id]: true }));
  }, []);

  function formatarData(dataStr) {
    if (!dataStr) return "";
    let yyyy, mm, dd;
    const partes = dataStr.split("-");
    if (partes[0].length === 4) [yyyy, mm, dd] = partes;
    else[dd, mm, yyyy] = partes;
    const dataObj = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });
    return `${diaSemana}, ${String(dd).padStart(2, "0")}/${String(mm).padStart(
      2,
      "0"
    )}/${yyyy}`;
  }

  // Buscar slots disponíveis
  useEffect(() => {
    async function verificarEmailECarregar() {
      try {
        const user = auth.currentUser;
        if (!user) return;
        await user.reload(); // garante estado atualizado
        setEmailVerificado(user.emailVerified);

        if (user.emailVerified && role === "patient") {
          await carregarSlots();
        }
      } catch (e) {
        console.error("Erro ao verificar e-mail:", e);
        setErro("Erro ao verificar status do e-mail.");
      } finally {
        setVerificandoEmail(false);
        setLoading(false);
      }
    }

    async function carregarSlots() {
      try {
        const listarSlots = httpsCallable(functions, "medicos-listarSlotsPublicos");
        const res = await listarSlots();
        const allSlots = res.data.slots || [];

        const normalizados = allSlots.map((s) => {
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

        // Busca infos dos médicos
        const idsUnicos = [...new Set(ordenados.map((s) => s.medicoId))];
        const info = {};
        for (const id of idsUnicos) {
          try {
            const snap = await getDoc(doc(db, "medicos_publicos", id));

            if (snap.exists()) {
              const data = snap.data();
              info[id] = {
                nome: data.nome || "Médico(a) sem nome",
                especialidade: data.especialidade || "(especialidade não informada)",
                fotoPerfil: data.fotoPerfil || null,
              };
            } else {
              info[id] = {
                nome: "Médico(a) não encontrado",
                especialidade: "(sem especialidade)",
                fotoPerfil: null,
              };
            }

          } catch {
            info[id] = {
              nome: "Erro ao carregar",
              especialidade: "",
              fotoPerfil: null,
            };
          }
        }
        setMedicosInfo(info);
      } catch (e) {
        console.error("Erro ao carregar horários:", e);
        setErro("Erro ao carregar horários disponíveis.");
        notify("Erro ao carregar horários disponíveis.", "error");
      }
    }

    verificarEmailECarregar();
  }, [role]);


  // Bloqueio: não pode agendar se houver retorno pendente ou consulta ativa com o mesmo médico
  async function handleAgendar(slot) {
    try {
      setLoadingSlotId(slot.id); // ativa o spinner
      const userId = auth.currentUser?.uid;

      // Busca consultas ou retornos pendentes com o mesmo médico
      const q = query(
        collection(db, "appointments"),
        where("pacienteId", "==", userId),
        where("medicoId", "==", slot.medicoId),
        where("status", "in", ["agendado", "confirmado", "retorno"])
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        // Verifica se é um retorno pendente especificamente
        const temRetorno = snap.docs.some(
          (doc) => doc.data().status === "retorno"
        );

        if (temRetorno) {
          notify(
            "Você já tem um retorno agendado para este médico. Aguarde a conclusão antes de marcar novamente.",
            "error"
          );
        } else {
          notify(
            "Você já possui uma consulta ativa com este médico.",
            "error"
          );
        }
        return;
      }

      // Permite agendar normalmente se não houver retorno ou consulta ativa
      navigate(`/paciente/confirmar-agendamento/${slot.id}`);
    } catch (err) {
      console.error(err);
      notify("Erro ao verificar consultas ativas.", "error");
    } finally {
      setLoadingSlotId(null);
    }
  }


  // Agrupar slots por médico e data
  const slotsPorMedico = slots.reduce((acc, slot) => {
    if (!acc[slot.medicoId]) acc[slot.medicoId] = {};
    if (!acc[slot.medicoId][slot.data]) acc[slot.medicoId][slot.data] = [];
    acc[slot.medicoId][slot.data].push(slot);
    return acc;
  }, {});


  // Skeleton de carregamento global
  if (verificandoEmail || loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 animate-pulse space-y-6">
        <div className="h-6 bg-slate-300 rounded w-1/3"></div>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 space-y-3"
          >
            <div className="h-5 bg-slate-200 rounded w-1/2"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-8 bg-slate-200 rounded-md"></div>
              ))}
            </div>
          </div>
        ))}
        <p className="text-center text-slate-500 mt-4">
          Carregando informações...
        </p>
      </div>
    );
  }



  if (!emailVerificado) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white border border-yellow-300 rounded-xl shadow-md">
        <div className="text-5xl mb-3">📩</div>
        <p className="text-lg font-semibold text-gray-950 mb-2">
          Antes de marcar, verifique seu e-mail.
        </p>
        <p className="text-sm text-gray-600 mb-4">
          Vá até a página <b>Meu Perfil</b> e confirme seu e-mail para liberar o
          agendamento.
        </p>
      </div>
    );
  }



  if (role !== "patient") {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        <p className="text-slate-700">
          Apenas pacientes podem agendar consultas.
        </p>
      </div>
    );
  }

  // ================================
  // Etapa 1 — Escolher médico
  // ================================
  if (!medicoSelecionado) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h2 className="text-2xl font-semibold text-white mb-4">
          Escolha o médico
        </h2>

        {Object.keys(slotsPorMedico).length === 0 ? (
          <div className="text-center bg-white border border-gray-200 rounded-xl p-6 shadow-sm text-gray-700">
            Nenhum médico disponível no momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.keys(slotsPorMedico).map((medicoId) => {
              const medico = medicosInfo[medicoId];
              const foto =
                medico?.fotoPerfil ||
                "https://cdn-icons-png.flaticon.com/512/3774/3774299.png";
              const isLoaded = !!loadedImages[medicoId];

              return (
                <motion.div
                  key={medicoId}
                  whileHover={{ scale: 1.03 }}
                  className="bg-white border border-slate-200 rounded-2xl shadow-md hover:shadow-lg cursor-pointer overflow-hidden group"
                  onClick={() => setMedicoSelecionado(medicoId)}
                >
                  <div className="w-full h-64 bg-gray-100 overflow-hidden relative flex items-center justify-center">
                    {!isLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}

                    <img
                      src={foto}
                      alt={medico?.nome || "Médico(a)"}
                      onLoad={() => handleImageLoad(medicoId)}
                      className={`w-full h-full object-cover transition-all duration-700 ease-out ${isLoaded
                        ? "opacity-100 blur-0 scale-100"
                        : "opacity-0 blur-md scale-105"
                        } group-hover:scale-105`}
                    />
                  </div>

                  <div className="p-5 text-center h-48 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">
                        {medico?.nome}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 mb-4">
                        {medico?.especialidade}
                      </p>
                    </div>
                    <Button
                      onClick={() => setMedicoSelecionado(medicoId)}
                      className="bg-gray-950 hover:bg-yellow-400 text-white text-sm rounded-full px-5 py-1.5 transition-all"
                    >
                      Ver dias disponíveis
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <Toaster ref={toastRef} />
      </div>
    );
  }

  // ================================
  // Etapa 2 — Escolher dia
  // ================================
  if (medicoSelecionado && !diaSelecionado) {
    const medico = medicosInfo[medicoSelecionado];
    const hoje = new Date();
    const diasOrdenados = Object.keys(slotsPorMedico[medicoSelecionado])
      .filter((d) => new Date(d) >= hoje)
      .sort((a, b) => new Date(a) - new Date(b));

    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Button
          onClick={() => setMedicoSelecionado(null)}
          className="bg-gray-200 text-gray-800 px-4 py-1 rounded-md hover:bg-gray-300"
        >
          ← Voltar
        </Button>

        <h2 className="text-2xl font-semibold text-white mb-2">
          {medico?.nome}
        </h2>
        <p className="text-slate-400 mb-4">{medico?.especialidade}</p>

        {diasOrdenados.length === 0 ? (
          <p className="text-gray-500 italic">Nenhum dia disponível.</p>
        ) : (
          <div className="space-y-3">
            {diasOrdenados.map((data) => (
              <motion.button
                key={data}
                whileHover={{ scale: 1.02 }}
                onClick={() => setDiaSelecionado(data)}
                className="w-full text-left bg-white border border-slate-200 rounded-lg shadow-sm px-5 py-4 hover:bg-yellow-50 transition-all"
              >
                <span className="font-medium text-gray-800 flex items-center gap-1">
                  <CalendarSearch size={20} className="text-yellow-500" />
                  {formatarData(data)}
                </span>

                <p className="text-sm text-slate-500 mt-1">
                  {
                    slotsPorMedico[medicoSelecionado][data].length
                  }{" "}
                  horário(s) disponível(is)
                </p>
              </motion.button>
            ))}
          </div>
        )}
        <Toaster ref={toastRef} />
      </div>
    );
  }

  // ================================
  // Etapa 3 — Escolher horário
  // ================================
  if (medicoSelecionado && diaSelecionado) {
    const horarios = slotsPorMedico[medicoSelecionado][diaSelecionado].sort(
      (a, b) => a.hora.localeCompare(b.hora)
    );

    const agora = new Date();
    const horariosFuturos = horarios.filter((slot) => {
      const dataSlot = new Date(`${slot.data}T${slot.hora}:00`);
      return dataSlot >= agora;
    });

    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="">
          <Button
            onClick={() => setDiaSelecionado(null)}
            className="bg-gray-200 text-gray-800 px-4 py-1 rounded-md hover:bg-gray-300"
          >
            ← Voltar
          </Button>
          <h2 className="text-xl font-semibold text-gray-900">
            {formatarData(diaSelecionado)}
          </h2>
        </div>

        {horariosFuturos.length === 0 ? (
          <p className="text-gray-500 italic">
            Nenhum horário disponível neste dia.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {horariosFuturos.map((slot) => (
              <motion.div
                key={slot.id}
                whileHover={{ scale: 1.05 }}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-yellow-50 transition"
              >
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
                  <ClockPlus size={20} className="text-yellow-500" />
                  {slot.hora}
                </p>

                <Button
                  onClick={() => handleAgendar(slot)}
                  disabled={loadingSlotId === slot.id}
                  className={`text-sm bg-gray-950 text-white rounded-full px-4 py-1.5 w-full mt-2 transition-all ${loadingSlotId === slot.id
                    ? "opacity-70 cursor-not-allowed"
                    : "hover:bg-yellow-400"
                    }`}
                >
                  {loadingSlotId === slot.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    "Agendar"
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
        <Toaster ref={toastRef} />
      </div>
    );
  }
}
