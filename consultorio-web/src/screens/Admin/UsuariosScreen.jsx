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
  const [paginaAtual, setPaginaAtual] = useState(1);
  const USUARIOS_POR_PAGINA = 50;
  const [modalConfirmOpen, setModalConfirmOpen] = useState(false);
  const [rolePendente, setRolePendente] = useState(null);
  const [usuarioPendente, setUsuarioPendente] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);


  useEffect(() => {
  if (!mensagem) return;

  const timer = setTimeout(() => {
    setMensagem("");
  }, 3000);

  return () => clearTimeout(timer);
}, [mensagem]);


  // Confirmar alteração de Role

  async function confirmarAlteracaoRole() {
    if (!usuarioPendente || !rolePendente) return;

    try {
      setConfirmLoading(true);

      await handleRoleChange(usuarioPendente.uid, rolePendente);

      setModalConfirmOpen(false);
      setUsuarioPendente(null);
      setRolePendente(null);
    } catch (e) {
      console.error(e);
    } finally {
      setConfirmLoading(false);
    }
  }



  // Paginação
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
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
      <nav className="flex items-center justify-center gap-2 flex-wrap mt-4">
        <button onClick={() => go(1)} disabled={current === 1} className={`${baseBtn} ${current === 1 ? "opacity-40 cursor-not-allowed" : idleBtn}`}>«</button>
        <button onClick={() => go(current - 1)} disabled={current === 1} className={`${baseBtn} ${current === 1 ? "opacity-40 cursor-not-allowed" : idleBtn}`}>‹</button>

        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={idx} className="px-2 text-gray-500">…</span>
          ) : (
            <button key={p} onClick={() => go(p)} className={`${baseBtn} ${p === current ? activeBtn : idleBtn}`}>
              {p}
            </button>
          )
        )}

        <button onClick={() => go(current + 1)} disabled={current === total} className={`${baseBtn} ${current === total ? "opacity-40 cursor-not-allowed" : idleBtn}`}>›</button>
        <button onClick={() => go(total)} disabled={current === total} className={`${baseBtn} ${current === total ? "opacity-40 cursor-not-allowed" : idleBtn}`}>»</button>
      </nav>
    );
  }



  // Carrega lista de usuários (usado no mount e no botão de recarregar)
  async function carregarUsuarios() {
    setErro("");
    setMensagem("");
    setLoading(true);
    try {
      const listarUsuarios = httpsCallable(functions, "admin-listarUsuarios");
      const res = await listarUsuarios();
      setUsuarios(res.data?.usuarios || []);
      setPaginaAtual(1);
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

  // RESETAR A PÁGINA QUANDO TROCAR BUSCA OU FILTRO

  useEffect(() => {
    setPaginaAtual(1);
  }, [busca, filtroRole]);


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
          u.role?.toLowerCase().includes(termo) ||
          u.uid?.toLowerCase().includes(termo)
      );

    }
    return filtrados;
  }, [usuarios, filtroRole, busca]);


  // Usuários por página

  const totalPaginas = Math.ceil(usuariosFiltrados.length / USUARIOS_POR_PAGINA);

  const usuariosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * USUARIOS_POR_PAGINA;
    const fim = inicio + USUARIOS_POR_PAGINA;
    return usuariosFiltrados.slice(inicio, fim);
  }, [usuariosFiltrados, paginaAtual]);


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




  function ConfirmRoleModal({ open, onClose, onConfirm, user, newRole, confirmLoading }) {
    if (!open || !user) return null;

    const map = {
      patient: "Paciente",
      doctor: "Médico",
      admin: "Administrador",
      "": "Sem papel",
    };

    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl p-6 w-[92%] max-w-md">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirmar alteração de função
          </h3>

          <p className="text-sm text-gray-700 mb-4">
            Tem certeza que deseja alterar o papel de:
          </p>

          <div className="border rounded-lg p-3 mb-4 text-sm bg-gray-50">
            <div><b>Nome:</b> {user.nome || "(sem nome)"}</div>
            <div><b>Email:</b> {user.email}</div>
            <div><b>Atual:</b> {map[user.role] || "Indefinido"}</div>
            <div className="mt-2 text-red-600">
              ➜ Novo papel: <b>{map[newRole]}</b>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={confirmLoading}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              onClick={onConfirm}
              disabled={confirmLoading}
              className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 justify-center text-white transition
    ${confirmLoading ? "bg-gray-400 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"}
  `}
            >
              {confirmLoading && (
                <svg
                  className="animate-spin h-4 w-4 text-white"
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

              {confirmLoading ? "Salvando..." : "Confirmar mudança"}
            </button>

          </div>
        </div>
      </div>
    );
  }






  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 shadow-sm">
        <div>
          <h2 className="text-xl font-light text-white">Usuários</h2>
          <p className="text-sm text-gray-400">
            Total de contas cadastradas: {usuarios.length}
          </p>

        </div>


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
          {recarregando ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {/* Barra de busca e filtro */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="relative w-full sm:w-1/2">
          <Search className="absolute left-3 top-2.5 text-slate-50" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, email ou ID"
            className="pl-9 pr-3 py-2 rounded-md w-full text-sm 
bg-gray-800 text-white border border-gray-700
placeholder-gray-400
focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent
hover:border-gray-500 transition"

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
                usuariosPaginados.map((u, i) => (
                  <tr
                    key={u.uid}
                    className={`border-b border-slate-100 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"
                      } hover:bg-yellow-50 transition`}
                  >


                    <td className="px-4 py-2">
                      <div className="flex flex-col">

                        {/* NOME */}
                        <span className="font-medium text-gray-900">
                          {u.nome || "(sem nome)"}
                        </span>

                        {/* UID */}
                        <span
                          className="text-[10px] text-gray-400 font-mono cursor-pointer select-all"
                          title="Clique para copiar o ID"
                          onClick={() => navigator.clipboard.writeText(u.uid)}
                        >
                          {u.uid}
                        </span>
                      </div>
                    </td>


                    <td className="px-4 py-2 text-gray-500 text-xs">
                      {u.email}
                    </td>

                    <td className="px-4 py-2 text-gray-700">
                      {u.telefone || "—"}
                    </td>




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
                            onChange={(e) => {
                              setUsuarioPendente(u);
                              setRolePendente(e.target.value);
                              setModalConfirmOpen(true);
                            }}

                            className="appearance-none min-w-[140px]
border border-gray-300 
rounded-full px-4 py-1.5 pr-8
text-sm font-medium
bg-white text-gray-800 shadow-sm
hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
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

          {totalPaginas > 1 && (
            <Pagination
              current={paginaAtual}
              total={totalPaginas}
              onChange={setPaginaAtual}
            />
          )}



        </motion.div>
      )}


      <ConfirmRoleModal
  open={modalConfirmOpen}
  user={usuarioPendente}
  newRole={rolePendente}
  onConfirm={confirmarAlteracaoRole}
  confirmLoading={confirmLoading}
  onClose={() => {
    setModalConfirmOpen(false);
    setUsuarioPendente(null);
    setRolePendente(null);
  }}
/>




    </div>
  );
}
