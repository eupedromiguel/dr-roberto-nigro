import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import Button from "../../components/Button";
import {
  CheckCircle2,
  ClipboardList,
  Calendar,
  User,
  Video,
  Home,
  Stethoscope,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";

export default function ConsultaConfirmadaScreen({ tipo = "presencial" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: paramId } = useParams();
  const db = getFirestore();

  // Inferir tipo pela URL como fallback adicional
  const tipoDaRota = useMemo(() => {
    const p = location.pathname || "";
    if (p.includes("/online/")) return "teleconsulta";
    if (p.includes("/presencial/")) return "presencial";
    return undefined;
  }, [location.pathname]);

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [medico, setMedico] = useState("Médico(a)");
  const [especialidade, setEspecialidade] = useState("Especialidade não informada");
  const [dataConsulta, setDataConsulta] = useState("—");
  const [hora, setHora] = useState("—");
  const [tipoConsulta, setTipoConsulta] = useState(tipo);
  const [tipoAtendimento, setTipoAtendimento] = useState("particular");
  const [unidade, setUnidade] = useState("");
  const [valorConsulta, setValorConsulta] = useState(null);
  const [valorTeleconsulta, setValorTeleconsulta] = useState(null);


  // Formata data (YYYY-MM-DD ou DD-MM-YYYY → terça-feira, DD/MM/YYYY)
  function formatarDataCompleta(dataStr) {
    if (!dataStr || dataStr === "—") return dataStr;
    const partes = String(dataStr).split("-");
    let ano, mes, dia;

    if (partes.length === 3 && partes[0].length === 4) {
      [ano, mes, dia] = partes; // ISO
    } else if (partes.length === 3) {
      [dia, mes, ano] = partes; // humano
    } else {
      return dataStr;
    }

    const dataObj = new Date(`${ano}-${mes}-${dia}T00:00:00`);
    if (isNaN(dataObj.getTime())) return dataStr;

    const diaSemana = dataObj.toLocaleDateString("pt-BR", { weekday: "long" });
    return `${diaSemana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(
      2,
      "0"
    )}/${ano}`;
  }

  // Normaliza data/hora independente de como vieram
  function extrairDataHora(dados) {
    // 1) horario: "YYYY-MM-DD HH:mm"
    if (typeof dados?.horario === "string" && dados.horario.includes(" ")) {
      const [d, h] = dados.horario.split(" ");
      return { data: d, hora: h };
    }
    // 2) Campos separados
    if (dados?.data && dados?.hora) return { data: dados.data, hora: dados.hora };
    // 3) Data/hora dentro do slot
    if (dados?.slot?.data && dados?.slot?.hora)
      return { data: dados.slot.data, hora: dados.slot.hora };
    return { data: "—", hora: "—" };
  }

  // Normaliza dados do médico vindos do documento ou carrega do Firestore
  async function preencherMedico(dados) {
    // Preferências: medicoNome / medicoEspecialidade / medico.{nome,especialidade}
    if (dados?.medicoNome) setMedico(dados.medicoNome);
    if (dados?.medicoEspecialidade) setEspecialidade(dados.medicoEspecialidade);

    if (dados?.medico?.nome) setMedico(dados.medico.nome);
    if (dados?.medico?.especialidade) setEspecialidade(dados.medico.especialidade);

    // Se ainda faltar, buscar em usuarios/{medicoId}
    if ((medico === "Médico(a)" || especialidade === "Especialidade não informada") && dados?.medicoId) {
      try {
        const mSnap = await getDoc(doc(db, "usuarios", dados.medicoId));
        if (mSnap.exists()) {
          const m = mSnap.data();
          if (medico === "Médico(a)") setMedico(m?.nome || "Médico(a) sem nome");
          if (especialidade === "Especialidade não informada")
            setEspecialidade(m?.especialidade || "Especialidade não informada");
        }
      } catch (e) {
        // Mantém fallbacks
      }
    }
  }

  // Tenta: 1) pegar appointments/{paramId}; 2) query por slotId == paramId
  useEffect(() => {
    let isMounted = true;

    async function carregar() {
      setLoading(true);
      setErro("");

      try {
        let dados = null;

        // 1) Tenta abrir diretamente o doc em appointments/{paramId}
        try {
          const directSnap = await getDoc(doc(db, "appointments", paramId));
          if (directSnap.exists()) {
            dados = { id: directSnap.id, ...directSnap.data() };
          }
        } catch (e) {
          // segue para o plano B
        }

        // 2) Se não achou, tenta pela query de slotId
        if (!dados) {
          const q = query(
            collection(db, "appointments"),
            where("slotId", "==", paramId)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const first = snap.docs[0];
            dados = { id: first.id, ...first.data() };
          }
        }

        if (!isMounted) return;

        if (!dados) {
          setErro(
            "Não encontramos dados da sua consulta. Se o problema persistir, verifique seus agendamentos."
          );
          setLoading(false);
          return;
        }

        // Tipo de consulta e atendimento
        const tipoFinal =
          dados.tipoConsulta || tipo || tipoDaRota || "presencial";
        setTipoConsulta(tipoFinal);
        setTipoAtendimento(dados.tipoAtendimento || "particular");

        // Data e hora
        const { data, hora } = extrairDataHora(dados);
        setDataConsulta(data || "—");
        setHora(hora || "—");

        // Médico
        await preencherMedico(dados);

        // Unidade
        setUnidade(dados.unidade || "—");

        // Se for particular, buscar o valor do médico
        if (dados.tipoAtendimento === "particular" && dados.medicoId) {
          try {
            const mSnap = await getDoc(doc(db, "usuarios", dados.medicoId));
            if (mSnap.exists()) {
              const m = mSnap.data();
              setValorConsulta(m?.valorConsulta || null);
              setValorTeleconsulta(m?.valorteleConsulta || null);
            }
          } catch (e) {
            console.warn("Erro ao buscar valores do médico:", e);
          }
        }


      } catch (e) {
        console.error("Erro ao carregar consulta confirmada:", e);
        setErro("Erro ao carregar informações da consulta.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    carregar();

    return () => {
      isMounted = false;
    };
  }, [db, paramId, tipoDaRota, tipo]); // reexecuta se mudar id/rota/prop

  const data = formatarDataCompleta(dataConsulta);

  // Skeleton
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-10 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-2/3 mx-auto"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
        <div className="h-6 bg-slate-200 rounded w-full"></div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-slate-200 rounded w-full"></div>
          ))}
        </div>
        <div className="h-10 bg-slate-300 rounded-full w-1/3 mx-auto mt-6"></div>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md mt-6 mb-10"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Cabeçalho */}
      <div className="text-center mb-6">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-3" />
        <h2 className="text-2xl font-semibold text-gray-950">
          Consulta confirmada com sucesso!
        </h2>
        <p className="text-gray-600 mt-1">
          Sua consulta foi agendada e você receberá as informações em breve.
        </p>
      </div>

      {/* Mensagem sutil de erro (sem sair da página) */}
      {erro && (
        <div className="mb-4 flex items-start gap-2 text-red-700 bg-red-50 border border-red-200 rounded p-3">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div className="text-sm">{erro}</div>
        </div>
      )}

      {/* Detalhes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-yellow-500" /> Detalhes da Consulta
        </h3>

        <div className="space-y-1 text-gray-800">
          <p className="flex items-center gap-2">
            <User className="w-4 h-4 text-gray-600" /> <b>Médico:</b> {medico}
          </p>
          <p className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-gray-600" />{" "}
            <b>Especialidade:</b> {especialidade}
          </p>
          <p>
            <b>Data:</b> {data}
          </p>
          <p>
            <b>Hora:</b> {hora}
          </p>
          <p>
            <b>Tipo de Consulta:</b>{" "}
            {tipoConsulta === "presencial" ? "Presencial" : "Teleconsulta"}
          </p>
          <p>
            <b>Atendimento:</b>{" "}
            {tipoAtendimento === "convenio" ? "Convênio" : "Particular"}
          </p>
          {unidade && unidade !== "—" && (
            <p>
              <b>Unidade médica:</b> {unidade}
            </p>
          )}

          {tipoAtendimento === "particular" && (
            <p className="mt-2">
              <b>Valor a ser pago na clínica:</b>{" "}
              {tipoConsulta === "presencial" && valorConsulta
                ? `R$ ${parseFloat(valorConsulta).toFixed(2)}`
                : tipoConsulta === "teleconsulta" && valorTeleconsulta
                  ? `R$ ${parseFloat(valorTeleconsulta).toFixed(2)}`
                  : "—"}
            </p>
          )}

        </div>
      </div>

      <hr className="my-5 border-gray-200" />

      {/* Preparos */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-yellow-500" />
          Como se preparar para sua consulta:
        </h3>

        {tipoConsulta === "presencial" ? (
          <ul className="list-disc list-inside text-gray-700 space-y-2 pl-2">
            <li>Leve ou compartilhe seus exames recentes.</li>
            <li>Venha com roupas confortáveis.</li>
            <li>Anote suas medicações, alergias e informações relevantes.</li>
            <li>Traga dúvidas e expectativas sobre seu atendimento.</li>
          </ul>
        ) : (
          <>
            <ul className="list-disc list-inside text-gray-700 space-y-2 pl-2">
              <li>
                Verifique se seus contatos estão atualizados na página{" "}
                <b>“Meu perfil”</b>.
              </li>
              <li>Teste sua conexão, microfone e câmera com antecedência.</li>
              <li>
                Escolha um ambiente silencioso e bem iluminado para a chamada.
              </li>
              <li>Tenha exames e documentos à mão.</li>
            </ul>

            <div className="mt-4 flex items-center gap-2 text-blue-700 text-sm">
              <Video className="w-4 h-4" />
              <p>
                O link para a teleconsulta será enviado por e-mail ou WhatsApp
                no horário agendado.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Botões finais */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
        <Button
          onClick={() => navigate("/paciente/agendamentos")}
          className="bg-gray-950 hover:bg-yellow-400 text-white px-6 py-3 rounded-full font-medium shadow-sm transition"
        >
          Ir para meus agendamentos
        </Button>

        <Button
          onClick={() => navigate("/")}
          className="bg-gray-950 border border-gray-300 text-gray-900 hover:bg-gray-950 px-6 py-3 rounded-full font-medium shadow-sm transition flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" /> Voltar para Home
        </Button>
      </div>
    </motion.div>
  );
}
