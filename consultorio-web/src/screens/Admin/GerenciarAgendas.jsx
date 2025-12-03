import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function GerenciarAgendas() {
  const db = getFirestore();
  const navigate = useNavigate();

  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [medicoSelecionado, setMedicoSelecionado] = useState("");

  const [idBusca, setIdBusca] = useState("");
  const [consultaEncontrada, setConsultaEncontrada] = useState(null);
  const [medicoConsulta, setMedicoConsulta] = useState(null);
  const [carregandoBusca, setCarregandoBusca] = useState(false);

  // Carrega todos os médicos
  async function carregarMedicos() {
    try {
      setLoading(true);

      const snap = await getDocs(collection(db, "usuarios"));
      const lista = [];

      snap.forEach((docu) => {
        const data = docu.data();

        if (data.role === "doctor") {
          lista.push({
            id: docu.id,
            nome: data.nome || "Sem nome",
            especialidade: data.especialidade || "—",
          });
        }
      });

      setMedicos(lista);
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar médicos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarMedicos();
  }, []);

  function handleSelecionarMedico(e) {
    const id = e.target.value;
    setMedicoSelecionado(id);

    if (id) {
      navigate(`/medico/consultas/${id}`);
    }
  }

  async function buscarConsultaPorId() {
    const id = idBusca.trim();

    if (!id) {
      setErro("Digite um ID válido.");
      return;
    }

    try {
      setErro("");
      setCarregandoBusca(true);

      const refConsulta = doc(db, "appointments", id);
      const snap = await getDoc(refConsulta);

      if (!snap.exists()) {
        setErro("Consulta não encontrada.");

      
        setTimeout(() => {
          setErro("");
        }, 2000);

        return;
      }


      const dados = snap.data();
      const medicoId = dados.medicoId;

      if (!medicoId) {
        setErro("Esta consulta não possui médico vinculado.");
        return;
      }

      const url = `/medico/consultas/${medicoId}?consulta=${encodeURIComponent(id)}`;

      // Abre com fallback automático (nunca bloqueia)
      abrirEmNovaAbaSeguro(url);

      setIdBusca("");

    } catch (e) {
      console.error("Erro ao buscar:", e);
      setErro("Erro ao buscar consulta.");
    } finally {
      setCarregandoBusca(false);
    }
  }

  function abrirEmNovaAbaSeguro(url) {
    // Tenta abrir pela forma tradicional
    const novaAba = window.open(url, "_blank");

    // Se foi bloqueado, usa fallback com <a>
    if (!novaAba) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }





  return (
    <div className="max-w-lg mx-auto p-6 text-white">
      <h2 className="text-2xl font-semibold mb-4">Gerenciar consultas</h2>

      {erro && <p className="text-red-400 mb-3">{erro}</p>}

      {loading ? (
        <p className="text-gray-400">Carregando médicos...</p>
      ) : (
        <>
          <label className="block mb-2 text-gray-300 text-sm font-medium">
            Selecione o médico:
          </label>

          <div className="relative mb-6">
            <select
              value={medicoSelecionado}
              onChange={handleSelecionarMedico}
              className="appearance-none w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-10"
            >
              <option value="">-- Escolha um médico --</option>
              {medicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} — {m.especialidade}
                </option>
              ))}
            </select>

            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <h3 className="text-sm text-gray-400 mb-2">Ou busque uma consulta por ID</h3>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={idBusca}
              onChange={(e) => setIdBusca(e.target.value)}
              placeholder="Digite aqui o ID"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />

            <button
              onClick={buscarConsultaPorId}
              disabled={carregandoBusca}
              className="bg-gray-700 hover:bg-yellow-400 text-white px-4 py-2 rounded-md font-medium"
            >
              {carregandoBusca ? "Buscando..." : "Buscar"}
            </button>
          </div>

        </>
      )}
    </div>
  );
}
