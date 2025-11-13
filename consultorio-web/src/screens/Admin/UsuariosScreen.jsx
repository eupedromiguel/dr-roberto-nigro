import { useEffect, useState, useMemo } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";
import { motion } from "framer-motion";
import { Search, Filter, CheckCircle, XCircle, RefreshCw } from "lucide-react";

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [loading, setLoading] = useState(true);
  const [filtroRole, setFiltroRole] = useState("todos");
  const [busca, setBusca] = useState("");
  const [atualizandoUid, setAtualizandoUid] = useState(null);
  const [recarregando, setRecarregando] = useState(false);

  // Carrega lista de usuários (usado no mount e no botão de recarregar)
  async function carregarUsuarios() {
    setErro("");
    setMensagem("");
    setLoading(true);
    try {
      const listarUsuarios = httpsCallable(functions, "admin-listarUsuarios");
      const res = await listarUsuarios();
      setUsuarios(res.data?.usuarios || []);
    } catch (e) {
      console.error(e);
      setErro(e.message || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  // Carrega na primeira renderização
  useEffect(() => {
    carregarUsuarios();
  }, []);

  // Filtragem dinâmica (busca + filtro por papel)
  const usuariosFiltrados = useMemo(() => {
    let filtrados = [...usuarios];
    if (filtroRole !== "todos") {
      filtrados = filtrados.filter((u) => u.role === filtroRole);
    }
    if (busca.trim()) {
      const termo = busca.toLowerCase();
      filtrados = filtrados.filter(
        (u) =>
          u.nome?.toLowerCase().includes(termo) ||
          u.email?.toLowerCase().includes(termo) ||
          u.role?.toLowerCase().includes(termo)
      );
    }
    return filtrados;
  }, [usuarios, filtroRole, busca]);

  // Atualizar papel inline
  async function handleRoleChange(uid, novoRole) {
    setErro("");
    setMensagem("");
    setAtualizandoUid(uid);
    try {
      const definirRole = httpsCallable(functions, "admin-definirRole");
      await definirRole({ uid, role: novoRole });
      setUsuarios((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: novoRole } : u))
      );
      setMensagem("Função atualizada com sucesso!");
    } catch (e) {
      console.error(e);
      setErro(e.message || "Erro ao atualizar função.");
    } finally {
      setAtualizandoUid(null);
    }
  }

  // Recarregar lista manualmente
  async function handleRecarregar() {
    setRecarregando(true);
    setErro("");
    setMensagem("");
    await carregarUsuarios();
    setTimeout(() => setRecarregando(false), 500);
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">
          Usuários Cadastrados
        </h2>

        {/* Botão Recarregar */}
        <button
          onClick={handleRecarregar}
          disabled={loading || recarregando}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border transition ${recarregando
            ? "border-slate-300 bg-slate-100 text-slate-500 cursor-not-allowed"
            : "border-slate-50 text-slate-50 hover:bg-yellow-400 hover:text-white"
            }`}
        >
          <RefreshCw
            size={16}
            className={`${recarregando ? "animate-spin" : ""}`}
          />
          {recarregando ? "Atualizando..." : "Recarregar Lista"}
        </button>
      </div>

      {/* Barra de busca e filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-1/2">
          <Search className="absolute left-3 top-2.5 text-slate-50" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou papel..."
            className="pl-9 pr-3 py-2 border border-slate-50 rounded-md w-full text-sm text-slate-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-50" />

          {/* container para posicionar a seta */}
          <div className="relative">
            <select
              value={filtroRole}
              onChange={(e) => setFiltroRole(e.target.value)}
              className="appearance-none border border-slate-300 rounded-md p-2 pr-8 text-sm text-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              <option value="patient">Pacientes</option>
              <option value="doctor">Médicos</option>
              <option value="admin">Administradores</option>
            </select>

            {/* Ícone de seta customizado */}
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
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
        </div>
      </div>

      {/* Mensagens */}
      {erro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-100 text-red-700 px-4 py-2 rounded-md mb-4 flex items-center gap-2"
        >
          <XCircle size={18} /> {erro}
        </motion.div>
      )}
      {mensagem && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-green-100 text-green-700 px-4 py-2 rounded-md mb-4 flex items-center gap-2"
        >
          <CheckCircle size={18} /> {mensagem}
        </motion.div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-400" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm"
        >
          <table className="min-w-full text-sm">
            <thead className="bg-gray-700 text-white">
              <tr>
                <th className="px-4 py-2 text-left">Nome</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Telefone</th>
                <th className="px-4 py-2 text-left">Função</th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length > 0 ? (
                usuariosFiltrados.map((u, i) => (
                  <tr
                    key={u.uid}
                    className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"
                      } hover:bg-yellow-50 transition`}
                  >
                    <td className="px-4 py-2">{u.nome || "(sem nome)"}</td>
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">{u.telefone || "—"}</td>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {atualizandoUid === u.uid ? (
                        <span className="flex items-center gap-2 text-slate-500">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400" />
                          Atualizando...
                        </span>
                      ) : (

                        <div className="relative inline-block">
                          <select
                            value={u.role || ""}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                            className="appearance-none border border-slate-300 rounded-md px-3 py-1.5 pr-8 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400 cursor-pointer"
                          >
                            <option value="">—</option>
                            <option value="patient">Paciente</option>
                            <option value="doctor">Médico</option>
                            <option value="admin">Administrador</option>
                          </select>

                          {/* Ícone de seta customizada */}
                          <svg
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
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



                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="4"
                    className="text-center py-4 text-slate-500 italic"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
