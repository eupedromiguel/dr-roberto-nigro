import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function GerenciarAgendas() {
  const db = getFirestore();
  const navigate = useNavigate();

  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [medicoSelecionado, setMedicoSelecionado] = useState("");

  // Carrega todos os médicos do Firestore
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
      // Redireciona para a página de consultas do médico
      navigate(`/medico/consultas/${id}`);
    }
  }

  return (
    <div className="max-w-lg mx-auto p-6 text-white">
      <h2 className="text-2xl font-semibold mb-4">Gerenciar Agendas</h2>

      {erro && <p className="text-red-400 mb-3">{erro}</p>}

      {loading ? (
        <p className="text-gray-400">Carregando médicos...</p>
      ) : (
        <>
          <label className="block mb-2 text-gray-300 text-sm font-medium">
            Selecione o médico:
          </label>

          {/* Contêiner relativo para a seta customizada */}
          <div className="relative">
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

            {/* Ícone da seta */}
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}
