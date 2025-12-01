import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import Button from "../../components/Button";
import { Stethoscope, CalendarX2 } from "lucide-react";

// Toaster reutilizável

const Toaster = forwardRef(function Toaster(_props, ref) {
  const [items, setItems] = useState([]);
  function remove(id) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }
  useImperativeHandle(ref, () => ({
    push({ message, type = "default", duration = 5000 }) {
      const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
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

// ===============================
// Modal de confirmação
// ===============================
function ConfirmModal({
  open,
  title = "Confirmar ação",
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
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="relative z-[101] w-[92%] max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 p-5">
        <h4 className="text-lg font-semibold text-gray-900 mb-2">{title}</h4>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-800 hover:bg-gray-100 text-sm"
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
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

// =======================================
// Tela principal
// =======================================
export default function AgendamentosScreen() {
  const [consultas, setConsultas] = useState([]);
  const [medicosInfo, setMedicosInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingCancelar, setLoadingCancelar] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const db = getFirestore();
  const toastRef = useRef(null);
  const notify = (msg, type = "default") =>
    toastRef.current?.push({ message: msg, type, duration: 5000 });

  // Filtros de pesquisa
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroAno, setFiltroAno] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroDia, setFiltroDia] = useState("");


  function parseData(dataStr) {
    if (!dataStr) return null;
    const p = dataStr.split("-");
    if (p.length !== 3) return null;
    if (p[0].length === 4) return { y: +p[0], m: +p[1], d: +p[2] };
    return { d: +p[0], m: +p[1], y: +p[2] };
  }

  function formatarDataHora(horarioStr) {
    if (!horarioStr) return "";
    const [dataStr, hora] = horarioStr.split(" ");
    if (!dataStr || !hora) return horarioStr;
    const parsed = parseData(dataStr);
    if (!parsed) return horarioStr;
    const { d, m, y } = parsed;
    const data = new Date(y, m - 1, d);
    const diaSemana = data.toLocaleDateString("pt-BR", { weekday: "long" });
    const dataFormatada = `${String(d).padStart(2, "0")}/${String(m).padStart(
      2,
      "0"
    )}/${y}`;
    return `${diaSemana}, ${dataFormatada} - ${hora}`;
  }

  async function carregarConsultas() {
    try {
      const listar = httpsCallable(functions, "consultas-listarConsultas");
      const res = await listar();
      if (!res.data?.sucesso) {
        notify("Erro ao carregar seus agendamentos.", "error");
        return;
      }

      const consultasData = res.data.consultas || [];
      const ordenadas = [...consultasData].sort((a, b) => {
        const [dataA, horaA] = a.horario.split(" ");
        const [dataB, horaB] = b.horario.split(" ");
        const A = parseData(dataA);
        const B = parseData(dataB);
        if (A && B) {
          const dA = new Date(A.y, A.m - 1, A.d);
          const dB = new Date(B.y, B.m - 1, B.d);
          if (dA.getTime() !== dB.getTime()) return dA - dB;
        }
        return (horaA || "").localeCompare(horaB || "");
      });
      setConsultas(ordenadas);

      const ids = [...new Set(ordenadas.map((c) => c.medicoId))];
      const info = {};
      for (const id of ids) {
        try {
          const snap = await getDoc(doc(db, "medicos_publicos", id));
          if (snap.exists()) {
            const data = snap.data();
            info[id] = {
              nome: data.nome || "Médico sem nome",
              especialidade: data.especialidade || "(especialidade não informada)",
              valorConsulta: data.valorConsulta || null,
              valorteleConsulta: data.valorteleConsulta || null,

            };
          } else {
            info[id] = { nome: "Médico não encontrado", especialidade: "" };
          }
        } catch {
          info[id] = { nome: "Erro ao buscar médico", especialidade: "" };
        }
      }
      setMedicosInfo(info);
    } catch (e) {
      console.error(e);
      notify("Erro ao carregar seus agendamentos.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarConsultas();
  }, []);

  // Modal → Cancelar
  function solicitarCancelar(id) {
    setConfirmTarget(id);
    setConfirmOpen(true);
  }

  async function confirmarCancelamento() {
    if (!confirmTarget) return;
    try {
      setLoadingCancelar(confirmTarget);
      const cancelar = httpsCallable(functions, "consultas-cancelarConsulta");
      const res = await cancelar({ consultaId: confirmTarget });
      if (res.data?.sucesso) {
        setConsultas((prev) =>
          prev.map((c) =>
            c.id === confirmTarget ? { ...c, status: "cancelada" } : c
          )
        );
        notify("Consulta cancelada com sucesso.", "success");
      } else {
        notify("Erro ao cancelar consulta.", "error");
      }
    } catch {
      notify("Erro ao cancelar consulta.", "error");
    } finally {
      setLoadingCancelar(null);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 animate-pulse space-y-4">
        <div className="h-6 bg-slate-300 rounded w-1/3"></div>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="border border-slate-200 rounded-md bg-white shadow-sm p-4 space-y-3"
          >
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  const futuras = consultas.filter(
    (c) => c.status === "agendado" || c.status === "retorno"
  );
  const passadas = consultas.filter((c) => c.status === "concluida");
  const canceladas = consultas.filter((c) => c.status === "cancelada");
  const nenhuma =
    futuras.length === 0 && passadas.length === 0 && canceladas.length === 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h2 className="text-2xl font-semibold text-white mb-4">
        Meus Agendamentos
      </h2>

      {nenhuma && (
        <div className="text-center bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="flex justify-center mb-3 text-gray-400">
            <CalendarX2 size={56} />
          </div>

          <p className="text-gray-700 text-lg font-medium">
            Você ainda não possui consultas agendadas.
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Quando marcar uma consulta, ela aparecerá aqui.
          </p>
        </div>
      )}

      {/* Consultas Futuras */}
      {futuras.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">
            Consultas e retornos
          </h3>
          <ul className="space-y-3">
            {futuras.map((c) => {
              const medico = medicosInfo[c.medicoId];
              return (
                <li
                  key={c.id}
                  className="border p-4 rounded-md bg-white shadow-sm hover:bg-yellow-50 transition"
                >
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <Stethoscope className="text-gray-700" size={20} />
                    {medico?.nome || "Carregando..."}
                  </p>

                  <p className="text-sm text-gray-600 mb-1">
                    {medico?.especialidade}
                  </p>
                  <p className="text-sm text-gray-700">
                    {formatarDataHora(c.horario)}
                  </p>
                  <br />

                  {/* Unidade */}
                  {c.unidade && (
                    <p className="text-sm text-gray-700">
                      <b>Unidade:</b> {c.unidade}
                    </p>
                  )}

                  {/* Tipo */}
                  <p className="text-sm text-gray-700 mt-1">
                    <b>Tipo:</b>{" "}
                    <span
                      className={`${c.tipoConsulta === "teleconsulta"
                        ? "text-purple-700"
                        : "text-blue-700"
                        }`}
                    >
                      {c.tipoConsulta === "teleconsulta"
                        ? "Teleconsulta"
                        : "Presencial"}
                    </span>
                  </p>

                  {/* Tipo de atendimento */}
                  {c.tipoAtendimento && (
                    <p className="text-sm text-gray-700 mt-1">
                      <b>Tipo de atendimento:</b>{" "}
                      <span
                        className={`${c.tipoAtendimento === "particular"
                          ? "text-gray-700"
                          : "text-gray-700"
                          }`}
                      >
                        {c.tipoAtendimento === "particular"
                          ? "Particular"
                          : "Convênio"}
                      </span>
                    </p>
                  )}

                  {/* Convênio */}
                  {c.tipoAtendimento === "convenio" && (
                    <>
                      <p className="text-sm text-gray-700 ml-0">
                        <b>Convênio:</b> {c.convenio}
                      </p>

                      {c.categoria && (
                        <p className="text-sm text-gray-700 ml-0">
                          <b>Categoria:</b> {c.categoria}
                        </p>
                      )}

                      {c.carteirinha && (
                        <p className="text-sm text-gray-700 ml-0">
                          <b>Nº da carteirinha:</b> {c.carteirinha}
                        </p>
                      )}
                    </>
                  )}


                  {/* Valores */}
                  {c.tipoAtendimento === "particular" && (
                    <>
                      {c.tipoConsulta === "teleconsulta" && medico?.valorteleConsulta && (
                        <p className="text-sm text-gray-700 mt-1">
                          <b>Valor da teleconsulta:</b>{" "}
                          <span className="font-normal text-gray-950">
                            R$ {parseFloat(medico.valorteleConsulta).toFixed(2)}
                          </span>
                        </p>
                      )}

                      {c.tipoConsulta === "presencial" && medico?.valorConsulta && (
                        <p className="text-sm text-gray-700 mt-1">
                          <b>Valor da consulta presencial:</b>{" "}
                          <span className="font-normal text-gray-950">
                            R$ {parseFloat(medico.valorConsulta).toFixed(2)}
                          </span>
                        </p>
                      )}
                    </>
                  )}

                  {/* Status */}
                  <p className="text-gray-700 mt-1 text-sm">
                    <b>Status:</b>{" "}
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {c.status}
                    </span>
                  </p>

                  {/* Detalhes do Retorno */}
                  {c.status === "retorno" && c.retornoAgendado && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-gray-200 rounded-lg text-sm text-blue-900">
                      <p className="font-medium mb-1"> <b>Detalhes do Retorno</b></p>

                      <p>
                        <b>Data e horário:</b>{" "}
                        {formatarDataHora(
                          `${c.retornoAgendado.novaData} ${c.retornoAgendado.novoHorario}`
                        )}
                      </p>

                      <p>
                        <b>Tipo de retorno:</b>{" "}
                        {c.retornoAgendado.tipoRetorno === "teleconsulta"
                          ? "Teleconsulta"
                          : "Presencial"}
                      </p>

                      {c.retornoAgendado.unidade && (
                        <p>
                          <b>Unidade do retorno:</b> {c.retornoAgendado.unidade}
                        </p>
                      )}

                      {c.retornoAgendado.observacoes && (
                        <p>
                          <b>Observações do retorno:</b> {c.retornoAgendado.observacoes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Aviso para retornos */}
                  {c.status === "retorno" && (
                    <div className="mt-3 text-sm bg-orange-50 border border-gray-200 rounded-md p-3 text-gray-700">
                      Se o paciente não puder comparecer ao retorno, favor entrar em contato no{" "}
                      <a
                        href="https://wa.me/5511965721206"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        WhatsApp da clínica
                      </a>{" "}
                      para solicitar reagendamento.
                    </div>
                  )}

                  {/* Botão de Cancelar (desabilitado para retornos) */}
                  <div className="mt-3">
                    {c.status === "retorno" ? (
                      <button
                        disabled
                        className="bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm cursor-not-allowed"
                        title="O cancelamento de retornos deve ser solicitado à clínica."
                      >
                        Cancelamento indisponível
                      </button>
                    ) : (
                      <Button
                        onClick={() => solicitarCancelar(c.id)}
                        disabled={loadingCancelar === c.id}
                        className={`bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm ${loadingCancelar === c.id
                          ? "opacity-70 cursor-not-allowed"
                          : ""
                          }`}
                      >
                        {loadingCancelar === c.id ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Cancelando...</span>
                          </div>
                        ) : (
                          "Cancelar"
                        )}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}


      {/* Consultas Passadas */}
      {passadas.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">
            Consultas Passadas
          </h3>
          <ul className="space-y-3">
            {passadas.map((c) => {
              const medico = medicosInfo[c.medicoId];
              return (
                <li
                  key={c.id}
                  className="border p-4 rounded-md bg-white shadow-sm hover:bg-gray-50 transition"
                >
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <Stethoscope className="text-gray-700" size={20} />
                    {medico?.nome || "Carregando..."}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    {medico?.especialidade}
                  </p>
                  <p className="text-sm text-gray-700">
                    {formatarDataHora(c.horario)}
                  </p>
                  <br />

                  {/* Unidade */}
                  {c.unidade && (
                    <p className="text-sm text-gray-700">
                      <b>Unidade:</b> {c.unidade}
                    </p>
                  )}

                  {/* Tipo da consulta */}
                  <p className="text-sm text-gray-700 mt-1">
                    <b>Tipo:</b>{" "}
                    <span
                      className={`${c.tipoConsulta === "teleconsulta"
                        ? "text-gray-700"
                        : "text-gray-700"
                        }`}
                    >
                      {c.tipoConsulta === "teleconsulta"
                        ? "Teleconsulta"
                        : "Presencial"}
                    </span>
                  </p>

                  {/* Tipo de atendimento */}
                  {c.tipoAtendimento && (
                    <p className="text-sm text-gray-700 mt-1">
                      <b>Tipo de atendimento:</b>{" "}
                      <span
                        className={`${c.tipoAtendimento === "particular"
                          ? "text-gray-700"
                          : "text-gray-700"
                          }`}
                      >
                        {c.tipoAtendimento === "particular"
                          ? "Particular"
                          : "Convênio"}
                      </span>
                    </p>
                  )}

                  {/* Convênio */}
                  {c.tipoAtendimento === "convenio" && (
                    <>
                      <p className="text-sm text-gray-700 ml-0">
                        <b>Convênio:</b> {c.convenio}
                      </p>

                      {c.categoria && (
                        <p className="text-sm text-gray-700 ml-0">
                          <b>Categoria:</b> {c.categoria}
                        </p>
                      )}

                      {c.carteirinha && (
                        <p className="text-sm text-gray-700 ml-0">
                          <b>Nº da carteirinha:</b> {c.carteirinha}
                        </p>
                      )}
                    </>
                  )}


                  {/* Valores */}
                  {c.tipoAtendimento === "particular" && (
                    <>
                      {c.tipoConsulta === "teleconsulta" &&
                        medico?.valorteleConsulta && (
                          <p className="text-sm text-gray-700 mt-1">
                            <b>Valor da teleconsulta:</b>{" "}
                            <span className="font-normal text-gray-950">
                              R$ {parseFloat(medico.valorteleConsulta).toFixed(2)}
                            </span>
                          </p>
                        )}

                      {c.tipoConsulta === "presencial" && medico?.valorConsulta && (
                        <p className="text-sm text-gray-700 mt-1">
                          <b>Valor da consulta presencial:</b>{" "}
                          <span className="font-normal text-gray-950">
                            R$ {parseFloat(medico.valorConsulta).toFixed(2)}
                          </span>
                        </p>
                      )}
                    </>
                  )}

                  {/* Detalhes do Retorno */}
                  {c.retornoAgendado && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-gray-200 rounded-lg text-sm text-blue-900">
                      <p className="font-medium mb-1"> <b>Detalhes do Retorno</b></p>

                      <p>
                        <b>Data e horário:</b>{" "}
                        {formatarDataHora(
                          `${c.retornoAgendado.novaData} ${c.retornoAgendado.novoHorario}`
                        )}
                      </p>

                      <p>
                        <b>Tipo de retorno:</b>{" "}
                        {c.retornoAgendado.tipoRetorno === "teleconsulta"
                          ? "Teleconsulta"
                          : "Presencial"}
                      </p>

                      {c.retornoAgendado.unidade && (
                        <p>
                          <b>Unidade do retorno:</b> {c.retornoAgendado.unidade}
                        </p>
                      )}

                      {c.retornoAgendado.observacoes && (
                        <p>
                          <b>Observações do retorno:</b>{" "}
                          {c.retornoAgendado.observacoes}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Status */}
                  <p className="text-gray-700 mt-1 text-sm">
                    <b>Status:</b>{" "}
                    <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {c.status}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}



      {/* Consultas Canceladas */}
      {canceladas.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-white mb-2">
            Consultas Canceladas
          </h3>
          <ul className="space-y-3">
            {canceladas.map((c) => {
              const medico = medicosInfo[c.medicoId];
              return (
                <li
                  key={c.id}
                  className="border p-4 rounded-md bg-white shadow-sm opacity-85 hover:bg-gray-50 transition"
                >
                  <p className="font-semibold text-gray-900 flex items-center gap-2">
                    <Stethoscope className="text-gray-700" size={20} />
                    {medico?.nome || "Carregando..."}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    {medico?.especialidade}
                  </p>
                  <p className="text-sm text-gray-700">
                    {formatarDataHora(c.horario)}
                  </p>
                  <br />
                  {c.unidade && (
                    <p className="text-sm text-gray-700">
                      <b>Unidade:</b> {c.unidade}
                    </p>
                  )}

                  <p className="text-sm text-gray-700 mt-1">
                    <b>Tipo:</b>{" "}
                    <span
                      className={`${c.tipoConsulta === "teleconsulta"
                        ? "text-gray-700"
                        : "text-gray-700"
                        }`}
                    >
                      {c.tipoConsulta === "teleconsulta"
                        ? "Teleconsulta"
                        : "Presencial"}
                    </span>
                  </p>

                  {c.tipoAtendimento && (
                    <p className="text-sm text-gray-700 mt-1">
                      <b>Tipo de atendimento:</b>{" "}
                      <span
                        className={`${c.tipoAtendimento === "particular"
                          ? "text-gray-700"
                          : "text-gray-700"
                          }`}
                      >
                        {c.tipoAtendimento === "particular"
                          ? "Particular"
                          : "Convênio"}
                      </span>
                    </p>
                  )}

                  {/* Convênio */}
                  {c.tipoAtendimento === "convenio" && (
                    <>
                      <p className="text-sm text-gray-700 ml-0">
                        <b>Convênio:</b> {c.convenio}
                      </p>

                      {c.categoria && (
                        <p className="text-sm text-gray-700 ml-0">
                          <b>Categoria:</b> {c.categoria}
                        </p>
                      )}

                      {c.carteirinha && (
                        <p className="text-sm text-gray-700 ml-0">
                          <b>Nº da carteirinha:</b> {c.carteirinha}
                        </p>
                      )}
                    </>
                  )}


                  {c.tipoAtendimento === "particular" && (
                    <>
                      {c.tipoConsulta === "teleconsulta" &&
                        medico?.valorteleConsulta && (
                          <p className="text-sm text-gray-700 mt-1">
                            <b>Valor da teleconsulta:</b>{" "}
                            <span className="font-normal text-gray-950">
                              R$ {parseFloat(medico.valorteleConsulta).toFixed(2)}
                            </span>
                          </p>
                        )}

                      {c.tipoConsulta === "presencial" && medico?.valorConsulta && (
                        <p className="text-sm text-gray-700 mt-1">
                          <b>Valor da consulta presencial:</b>{" "}
                          <span className="font-normal text-gray-950">
                            R$ {parseFloat(medico.valorConsulta).toFixed(2)}
                          </span>
                        </p>
                      )}
                    </>
                  )}

                  <p className="mt-1 text-sm">
                    <b>Status:</b>{" "}
                    <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      {c.status}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}


      <ConfirmModal
        open={confirmOpen}
        title="Cancelar consulta"
        message="Tem certeza que deseja cancelar esta consulta? Essa ação é irreversível."
        confirmText="Cancelar consulta"
        cancelText="Voltar"
        onConfirm={confirmarCancelamento}
        onClose={() => !loadingCancelar && setConfirmOpen(false)}
        loading={loadingCancelar}
      />

      <Toaster ref={toastRef} />
    </div>
  );
}
