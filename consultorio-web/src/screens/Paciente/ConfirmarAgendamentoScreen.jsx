import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import Button from "../../components/Button";

export default function ConfirmarAgendamentoScreen() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const db = getFirestore();
  const [slot, setSlot] = useState(null);
  const [medicoNome, setMedicoNome] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [sintomas, setSintomas] = useState("");
  const [tipoAtendimento, setTipoAtendimento] = useState("convenio");
  const [tipoConsulta, setTipoConsulta] = useState("presencial");
  const [convenio, setConvenio] = useState("");
  const [erroConvenio, setErroConvenio] = useState("");
  const [erroCategoria, setErroCategoria] = useState("");
  const [erroCarteirinha, setErroCarteirinha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [valorConsulta, setValorConsulta] = useState(null);
  const [valorteleConsulta, setValorteleConsulta] = useState(null);
  const [unidade, setUnidade] = useState("");
  const [erroUnidade, setErroUnidade] = useState("");
  const [conveniosDisponiveis, setConveniosDisponiveis] = useState([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("");
  const [carteirinha, setCarteirinha] = useState("");




  useEffect(() => {
    if (tipoConsulta === "teleconsulta") {
      setUnidade("Atendimento remoto - Teleconsulta");
    }
  }, [tipoConsulta]);




  // Formatar data ISO → terça-feira, 25/10/2025
  function formatarData(dataStr) {
    if (!dataStr) return "";
    let yyyy, mm, dd;
    const partes = dataStr.split("-");
    if (partes[0].length === 4) [yyyy, mm, dd] = partes;
    else[dd, mm, yyyy] = partes;
    const dataObj = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });
    return `${diaSemana}, ${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;
  }

  // Carregar informações do slot e médico
  useEffect(() => {
    async function carregarSlot() {
      setErro("");
      setLoading(true);
      try {
        const listar = httpsCallable(functions, "medicos-listarSlotsPublicos");
        const res = await listar();
        const lista = Array.isArray(res?.data?.slots) ? res.data.slots : [];

        const normalizados = lista.map((s) => {
          const partes = s.data.split("-");
          if (partes[0].length !== 4) {
            const [dd, mm, yyyy] = partes;
            return { ...s, data: `${yyyy}-${mm}-${dd}` };
          }
          return s;
        });

        let encontrado = normalizados.find((s) => s.id === slotId);

        if (!encontrado) {
          const snap = await getDoc(doc(db, "availability_slots", slotId));
          if (snap.exists()) {
            const raw = { id: snap.id, ...snap.data() };
            const partes = raw.data?.split("-") || [];
            const dataNormalizada =
              partes.length === 3 && partes[0].length !== 4
                ? `${partes[2]}-${partes[1]}-${partes[0]}`
                : raw.data;
            encontrado = { ...raw, data: dataNormalizada };
          }
        }

        if (!encontrado) {
          setErro("Horário não encontrado ou indisponível.");
          setLoading(false);
          return;
        }

        setSlot(encontrado);

        if (encontrado.medicoId) {
          const medicoSnap = await getDoc(doc(db, "usuarios", encontrado.medicoId));
          if (medicoSnap.exists()) {
            const data = medicoSnap.data();
            setMedicoNome(data.nome || "Médico(a) sem nome");
            setEspecialidade(data.especialidade || "Especialidade não informada");
            setValorConsulta(data.valorConsulta || null);
            setValorteleConsulta(data.valorteleConsulta || null);

            carregarConveniosParaMedico(encontrado.medicoId);

          } else {
            setMedicoNome("Médico(a) não encontrado");
            setEspecialidade("(sem especialidade)");
            setValorConsulta(null);
            setValorteleConsulta(null);
          }
        }


      } catch (e) {
        console.error("[Confirmar] Erro ao carregar slot:", e);
        setErro("Erro ao carregar informações do horário.");
      } finally {
        setLoading(false);
      }
    }

    if (slotId) carregarSlot();
  }, [slotId, db]);



  // CarregarConveniosParaMédico

  async function carregarConveniosParaMedico(medicoId) {
    const conveniosRef = collection(db, "planos_saude");
    const conveniosSnap = await getDocs(conveniosRef);

    const listaFinal = [];

    for (const conv of conveniosSnap.docs) {
      const categoriasRef = collection(db, `planos_saude/${conv.id}/categorias`);
      const categoriasSnap = await getDocs(categoriasRef);

      const categoriasDoMedico = categoriasSnap.docs
        .map((c) => ({ id: c.id, ...c.data() }))
        .filter((cat) => cat.medicos?.includes(medicoId));

      if (categoriasDoMedico.length > 0) {
        listaFinal.push({
          id: conv.id,
          nome: conv.data().nome,
          categorias: categoriasDoMedico
        });
      }
    }

    setConveniosDisponiveis(listaFinal);
  }


  // Confirmar agendamento
  async function handleConfirmar() {
    if (!slot) return;
    if (tipoAtendimento === "convenio") {

      if (!convenio) {
        setErroConvenio("Selecione um convênio.");
        return;
      } else {
        setErroConvenio("");
      }

      if (!categoriaSelecionada) {
        setErroCategoria("Selecione a categoria / plano.");
        return;
      } else {
        setErroCategoria("");
      }

      if (!carteirinha.trim()) {
        setErroCarteirinha("Informe o número da carteirinha.");
        return;
      } else {
        setErroCarteirinha("");
      }

    }



    if (tipoConsulta !== "teleconsulta" && (!unidade || unidade === "")) {
      setErroUnidade("Por favor, selecione a unidade médica.");
      return;
    } else {
      setErroUnidade("");
    }


    const unidadeFinal =
      tipoConsulta === "teleconsulta"
        ? "Atendimento remoto - Teleconsulta"
        : unidade;




    setSalvando(true);
    setErro("");
    setMensagem("");

    try {

      // Descobrir o convênio selecionado (pelo ID)
      const convObj = conveniosDisponiveis.find(c => c.id === convenio);

      // Criar o objeto que será enviado ao backend
      const dadosConsulta = {
        medicoId: slot.medicoId,
        slotId: slot.id,
        horario: `${slot.data} ${slot.hora}`,
        tipoConsulta,
        sintomas: sintomas || "",
        tipoAtendimento,
        convenio: tipoAtendimento === "convenio" ? (convObj?.nome || "") : "",
        categoria: tipoAtendimento === "convenio" ? categoriaSelecionada : "",
        carteirinha: tipoAtendimento === "convenio" ? carteirinha : "",
        unidade: unidadeFinal,
      };


      // Enviar ao Firebase
      const criarConsulta = httpsCallable(functions, "consultas-criarConsulta");
      const res = await criarConsulta(dadosConsulta);

      const novaConsultaId = res.data?.id;
      setMensagem(res.data?.mensagem || "Consulta agendada com sucesso!");

      // Redirecionar
      setTimeout(() => {
        navigate(`/paciente/consulta-confirmada/${novaConsultaId}`);
      }, 1200);

    } catch (e) {
      console.error("[Confirmar] Erro ao confirmar:", e);
      setErro(
        e?.message?.includes("permission")
          ? "Você não tem permissão para agendar esta consulta."
          : "Erro ao confirmar o agendamento. Tente novamente."
      );
    } finally {
      setSalvando(false);
    }

  }

  if (loading) return <div className="p-6">Carregando informações...</div>;
  if (erro && !mensagem) return <div className="p-6 text-red-600 font-medium">{erro}</div>;
  if (!slot) return <div className="p-6">Horário não encontrado.</div>;

  const ocupado = String(slot.status).toLowerCase() === "ocupado";

  return (
    <div className="max-w-lg mx-auto bg-white shadow-md rounded-md p-6 space-y-4">
      <h2 className="text-xl font-semibold text-gray-950">Confirmar Agendamento</h2>

      {mensagem && (
        <div className="bg-green-50 text-green-700 p-2 rounded">{mensagem}</div>
      )}
      {erro && !mensagem && (
        <div className="bg-red-50 text-red-600 p-2 rounded">{erro}</div>
      )}

      {/* Informações do médico e horário */}
      <div className="border rounded p-3 bg-gray-50 space-y-1">
        <p><b>Médico:</b> {medicoNome || slot.medicoId}</p>
        <p><b>Especialidade:</b> {especialidade}</p>
        <p><b>Data:</b> {formatarData(slot.data)}</p>
        <p><b>Hora:</b> {slot.hora}</p>
        <p>
          <b>Status:</b>{" "}
          <span className={ocupado ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
            {slot.status || "livre"}
          </span>
        </p>
      </div>

      {/* Tipo de consulta */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Consulta
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tipoConsulta"
              value="presencial"
              checked={tipoConsulta === "presencial"}
              onChange={() => setTipoConsulta("presencial")}
            />
            Presencial
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tipoConsulta"
              value="teleconsulta"
              checked={tipoConsulta === "teleconsulta"}
              onChange={() => setTipoConsulta("teleconsulta")}
            />
            Teleconsulta
          </label>
        </div>
      </div>

      {/* Sintomas */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Sintomas e alergias (opcional)
        </label>
        <br />
        <textarea
          className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          rows={3}
          placeholder="Descreva seus sintomas ou alergias"
          value={sintomas}
          onChange={(e) => setSintomas(e.target.value)}
        />
      </div>

      {/* Tipo de atendimento */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Atendimento
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tipoAtendimento"
              value="convenio"
              checked={tipoAtendimento === "convenio"}
              onChange={() => {
                setTipoAtendimento("convenio");
                setErroConvenio("");
              }}
            />
            Convênio
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="tipoAtendimento"
              value="particular"
              checked={tipoAtendimento === "particular"}
              onChange={() => setTipoAtendimento("particular")}
            />
            Particular
          </label>
        </div>
      </div>

      {/* Exibe o valor apenas se for particular */}
      {tipoAtendimento === "particular" && tipoConsulta === "presencial" && valorConsulta && (
        <div className="p-3 border rounded text-gray-800">
          <p>
            Valor da consulta presencial:{" "}
            <span className="font-semibold text-gray-950">
              R$ {parseFloat(valorConsulta).toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {tipoAtendimento === "particular" && tipoConsulta === "teleconsulta" && valorteleConsulta && (
        <div className="p-3 border rounded text-gray-800">
          <p>
            Valor da teleconsulta:{" "}
            <span className="font-semibold text-gray-950">
              R$ {parseFloat(valorteleConsulta).toFixed(2)}
            </span>
          </p>
        </div>
      )}

      {/* Unidade Médica */}
      <div className="relative w-full">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Unidade Médica
        </label>

        <select
          className={`appearance-none w-full border rounded-md p-2 pr-8 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${erroUnidade ? "border-red-500" : "border-gray-300"
            } ${tipoConsulta === "teleconsulta" ? "bg-gray-100 cursor-not-allowed" : ""}`}
          value={unidade}
          onChange={(e) => {
            setUnidade(e.target.value);
            setErroUnidade("");
          }}
          disabled={tipoConsulta === "teleconsulta"}
        >
          {tipoConsulta === "teleconsulta" ? (
            <option value="Atendimento remoto - Teleconsulta">
              Atendimento remoto - Teleconsulta
            </option>
          ) : (
            <>
              <option value="">Selecione a unidade</option>
              <option value="Unidade Pompéia - Rua Apinajés, 1100 - Conj. 803/804">
                Unidade Pompéia - Rua Apinajés, 1100 - Conj. 803/804
              </option>
              <option value="Unidade Cayowaá - Rua Cayowaá, 1071 - 10º Andar Conj. 102/103">
                Unidade Cayowaá - Rua Cayowaá, 1071 - 10º Andar Conj. 102/103
              </option>
            </>
          )}
        </select>

        {/* Ícone da seta */}
        <svg
          className="absolute right-3 top-[37px] md:top-[45px] md:-translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>

        {erroUnidade && (
          <p className="text-red-600 text-sm mt-1">{erroUnidade}</p>
        )}
      </div>


      {/* Convênio */}
      {tipoAtendimento === "convenio" && (
        <div className="relative w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1 ">
            Selecione seu convênio
          </label>

          <select
            className={`appearance-none w-full border rounded-md p-2 pr-8 
    ${erroConvenio ? "border-red-500" : "border-gray-300"} focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent`}
            value={convenio}
            onChange={(e) => {
              setConvenio(e.target.value);
              setCategoriaSelecionada("");
              setErroConvenio("");
            }}

          >
            <option value="">Selecione</option>

            {conveniosDisponiveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          {convenio && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria / Plano
              </label>

              <select
                className={`appearance-none w-full border rounded-md p-2 pr-8 
      ${erroCategoria ? "border-red-500" : "border-gray-300"} 
      focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent`}
                value={categoriaSelecionada}
                onChange={(e) => {
                  setCategoriaSelecionada(e.target.value);
                  setErroCategoria("");
                }}
              >
                <option value="">Selecione</option>

                {conveniosDisponiveis
                  .find((c) => c.id === convenio)
                  ?.categorias.map((cat) => (
                    <option key={cat.id} value={cat.nome}>
                      {cat.nome}
                    </option>
                  ))}
              </select>

              {erroCategoria && (
                <p className="text-red-600 text-sm mt-1">{erroCategoria}</p>
              )}
            </div>
          )}


          {/* Número da carteirinha */}
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número da carteirinha
            </label>
            <input
              type="text"
              maxLength={20}
              className={`w-full border rounded-md p-2 
    ${erroCarteirinha ? "border-red-500" : "border-gray-300"}
  focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent`}
              value={carteirinha}
              onChange={(e) => setCarteirinha(e.target.value)}
            />

          </div>




          {/* Ícone de seta customizado */}
          <svg
            className="absolute right-3 top-[37px] md:top-[45px] md:-translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>

          {erroConvenio && (
            <p className="text-red-600 text-sm mt-1">{erroConvenio}</p>
          )}
        </div>
      )}


      {/* Botão principal */}
      <Button
        onClick={handleConfirmar}
        disabled={salvando || ocupado}
        className={`w-full ${ocupado
          ? "bg-gray-300 cursor-not-allowed"
          : "bg-gray-950 hover:bg-yellow-400"
          } text-white`}
      >
        {ocupado
          ? "Horário indisponível"
          : salvando
            ? "Confirmando..."
            : "Confirmar Agendamento"}
      </Button>
    </div>
  );
}
