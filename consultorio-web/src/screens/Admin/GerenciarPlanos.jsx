import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";

/* ----------------------------------------------------------
   MODAL DE CONFIRMAÇÃO — COMPONENTE GLOBAL
---------------------------------------------------------- */
function ConfirmModal({ open, message, onConfirm, onCancel, loadingDelete }) {
  if (!open) return null;

  useEffect(() => {
    function handleKeyDown(e) {
      if (loadingDelete && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loadingDelete]);


  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-5 w-[90%] max-w-md text-gray-900 shadow-xl">
        <h3 className="text-lg font-semibold mb-3">Confirmar ação</h3>
        <p className="text-sm mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loadingDelete}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            disabled={loadingDelete}
            className={`px-4 py-2 rounded-md bg-red-600 text-white 
              ${loadingDelete ? "opacity-50 cursor-not-allowed" : "hover:bg-red-700"}`}
          >
            {loadingDelete ? "Aguarde..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------
   PÁGINA PRINCIPAL
---------------------------------------------------------- */
export default function GerenciarPlanos() {
  const navigate = useNavigate();
  const db = getFirestore();

  const [convenios, setConvenios] = useState([]);
  const [novoConvenio, setNovoConvenio] = useState("");

  const [novaCategoria, setNovaCategoria] = useState("");
  const [convenioSelecionado, setConvenioSelecionado] =
    useState(null);
  const [medicos, setMedicos] = useState([]);
  const [categoriaAberta, setCategoriaAberta] = useState(null);


  // Modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(() => () => { });
  const [loadingDelete, setLoadingDelete] = useState(false);


  /* ----------------------------------------------------------
     CARREGAR CONVÊNIOS + CATEGORIAS
  ---------------------------------------------------------- */
  async function carregarConvenios() {
    const ref = collection(db, "planos_saude");
    const snapshot = await getDocs(ref);

    const lista = [];

    for (const convenioDoc of snapshot.docs) {
      const categoriasRef = collection(
        db,
        `planos_saude/${convenioDoc.id}/categorias`
      );
      const categoriasSnap = await getDocs(categoriasRef);

      lista.push({
        id: convenioDoc.id,
        ...convenioDoc.data(),
        categorias: categoriasSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })),
      });
    }

    setConvenios(lista);
  }

  useEffect(() => {
    carregarConvenios();
  }, []);

  // CARREGAR MÉDICOS

  async function carregarMedicos() {
    const snap = await getDocs(collection(db, "usuarios"));
    const lista = [];

    snap.forEach((docu) => {
      const data = docu.data();
      if (data.role === "doctor") lista.push({ id: docu.id, ...data });
    });

    setMedicos(lista);
  }

  useEffect(() => {
    carregarMedicos();
  }, []);

  async function atualizarMedicosCategoria(convenioId, categoriaId, lista) {
    await updateDoc(
      doc(db, `planos_saude/${convenioId}/categorias`, categoriaId),
      { medicos: lista }
    );
    carregarConvenios(); // atualizar state da tela
  }


  /* ----------------------------------------------------------
     CRUD
  ---------------------------------------------------------- */

  async function adicionarConvenio() {
    if (!novoConvenio.trim()) return;

    await addDoc(collection(db, "planos_saude"), {
      nome: novoConvenio.trim(),
      ativo: true,
      criadoEm: new Date(),
    });

    setNovoConvenio("");
    carregarConvenios();
  }

  async function removerConvenio(id) {
    const refCats = collection(db, `planos_saude/${id}/categorias`);
    const catsSnap = await getDocs(refCats);

    for (const cat of catsSnap.docs) {
      await deleteDoc(doc(db, `planos_saude/${id}/categorias`, cat.id));
    }

    await deleteDoc(doc(db, "planos_saude", id));
    carregarConvenios();
  }

  // Recebe o ID do convênio direto
  async function adicionarCategoria(convenioId) {
    if (!novaCategoria.trim()) return;

    await addDoc(
      collection(db, `planos_saude/${convenioId}/categorias`),
      {
        nome: novaCategoria.trim(),
        medicos: []
      }
    );

    setNovaCategoria("");
    carregarConvenios();
  }

  async function removerCategoria(convenioId, categoriaId) {
    await deleteDoc(
      doc(db, `planos_saude/${convenioId}/categorias`, categoriaId)
    );

    carregarConvenios();
  }

  /* ----------------------------------------------------------
     RENDER
  ---------------------------------------------------------- */
  return (
    <div className="max-w-3xl mx-auto bg-gray-900 shadow rounded-md p-7 text-white">

      <h2 className="text-xl font-semibold mb-3">Gerenciar Convênios e Categorias</h2>

      {/* Criar novo convênio */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Nome do convênio..."
          value={novoConvenio}
          onChange={(e) => setNovoConvenio(e.target.value)}
          className="flex-1 px-3 py-2 rounded-md border border-gray-400 bg-gray-100 text-black focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
        />

        <Button
          onClick={adicionarConvenio}
          className="!bg-gray-800 hover:!bg-yellow-400 text-white font-medium px-6 py-2 rounded-md w-full sm:w-auto"
        >
          Adicionar Convênio
        </Button>
      </div>

      {/* Listagem */}
      <ul className="space-y-4">
        {convenios.map((conv) => {
          const isOpen = convenioSelecionado === conv.id;

          return (
            <li
              key={conv.id}
              className="bg-gray-800 p-4 rounded-md cursor-pointer transition"
            >
              {/* Linha inicial — sempre visível */}
              <div
                className="flex justify-between items-center"
                onClick={() => {
                  setConvenioSelecionado(isOpen ? null : conv.id);
                  setNovaCategoria("");
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">{conv.nome}</span>

                  {/* BADGE DE CATEGORIAS */}
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300">
                    {conv.categorias.length} {conv.categorias.length === 1 ? "categoria" : "categorias"}
                  </span>
                </div>

                <span className="text-yellow-400 text-sm">
                  {isOpen ? "▲" : "▼"}
                </span>
              </div>

              {/* Conteúdo expandido */}
              <div
                className={`
    transition-all duration-300 overflow-hidden
    ${isOpen
                    ? "max-h-[2000px] mt-4 pt-4 border-t border-gray-700"
                    : "max-h-0 mt-0 pt-0 border-transparent"
                  }
  `}
              >


                {/* Botão remover convênio */}
                <Button
                  className="!text-xs !px-3 !py-2 
                         !bg-red-500 !text-white hover:!bg-red-700 
                         !max-w-[150px] truncate mb-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmMessage(
                      `Tem certeza que deseja remover o convênio "${conv.nome}" e TODAS as suas categorias?`
                    );
                    setConfirmAction(() => () => removerConvenio(conv.id));
                    setConfirmOpen(true);
                  }}
                >
                  Remover Convênio
                </Button>

                {/* Categorias */}
                <p className="font-medium mb-1">Categorias:</p>

                <ul className="space-y-1">
                  {conv.categorias.length === 0 && (
                    <li className="text-sm text-gray-400">
                      Nenhuma categoria foi adicionada.
                    </li>
                  )}

                  {conv.categorias.map((cat) => {

                    const isCatOpen = categoriaAberta === cat.id;

                    return (
                      <li key={cat.id} className="bg-gray-700 px-3 py-3 rounded space-y-3">

                        {/* Cabeçalho da categoria */}
                        <div
                          className="flex justify-between items-center cursor-pointer"
                          onClick={() => setCategoriaAberta(isCatOpen ? null : cat.id)}
                        >
                          <span className="text-lg">{cat.nome}</span>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmMessage(`Deseja remover a categoria "${cat.nome}"?`);
                                setConfirmAction(() => () => removerCategoria(conv.id, cat.id));
                                setConfirmOpen(true);
                              }}
                              className="text-yellow-400 hover:text-yellow-700 text-sm"
                            >
                              Remover categoria
                            </button>

                            <span className="text-yellow-400 text-sm">
                              {isCatOpen ? "▲" : "▼"}
                            </span>
                          </div>
                        </div>

                        {/* CONTEÚDO EXPANDIDO */}
                        <div
                          className={`
    transition-all duration-300 overflow-hidden
    ${isCatOpen
                              ? "max-h-[2000px] mt-3 bg-gray-800 p-3 rounded-md space-y-3"
                              : "max-h-0 p-0 mt-0"
                            }
  `}
                        >


                          <p className="text-sm text-gray-300">Médicos que atendem:</p>

                          {cat.medicos?.length > 0 ? (
                            <ul className="space-y-1">
                              {cat.medicos.map((id) => {
                                const medico = medicos.find((m) => m.id === id);

                                return (
                                  <li
                                    key={id}
                                    className="flex justify-between items-center bg-gray-900 px-2 py-2 rounded"
                                  >
                                    <span>{medico?.nome || "(Removido)"}</span>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmMessage(
                                          `Deseja remover o médico "${medico?.nome}" da categoria "${cat.nome}"?`
                                        );
                                        setConfirmAction(() => () => {
                                          const novaLista = cat.medicos.filter((m) => m !== id);
                                          atualizarMedicosCategoria(conv.id, cat.id, novaLista);
                                        });
                                        setConfirmOpen(true);
                                      }}
                                      className="text-red-400 hover:text-red-200 text-xs"
                                    >
                                      Remover médico
                                    </button>

                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="text-gray-400 text-sm">Nenhum médico vinculado.</p>
                          )}

                          {/* Adicionar médico */}
                          <div className="mt-3">
                            <p className="text-sm text-gray-300 mb-1">Adicionar médico:</p>

                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <select
                                  className="w-full bg-green-500 text-white p-2 rounded border border-gray-600 
                             appearance-none pr-10 focus:outline-none focus:ring-2 
                             focus:ring-gray-800 focus:border-gray-800"
                                  onChange={(e) => {
                                    const novoId = e.target.value;
                                    if (!novoId) return;

                                    const novaLista = [...(cat.medicos || []), novoId];
                                    atualizarMedicosCategoria(conv.id, cat.id, novaLista);

                                    e.target.value = "";
                                  }}
                                >
                                  <option value="">Clique e selecione</option>
                                  {medicos
                                    .filter((m) => !cat.medicos?.includes(m.id))
                                    .map((m) => (
                                      <option key={m.id} value={m.id}>
                                        {m.nome}
                                      </option>
                                    ))}
                                </select>

                                {/* seta SVG personalizada */}
                                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4 h-4 text-gray-300"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>

                      </li>
                    );
                  })}




                </ul>

                {/* Adicionar categoria */}
                <div className="flex flex-col sm:flex-row gap-3 mt-3 w-full">
                  <input
                    onKeyDown={(e) => e.key === "Enter" && adicionarCategoria(conv.id)}
                    type="text"
                    placeholder="Adicionar categoria"
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-gray-100 text-black 
                           focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  />

                  <Button
                    onClick={async () => {
                      await adicionarCategoria(conv.id);
                    }}
                    className="w-full sm:w-auto !bg-green-600 hover:!bg-green-500 !px-4 !py-2 text-sm"
                  >
                    Salvar
                  </Button>
                </div>

              </div>
            </li>
          );
        })}
      </ul>

      <style>
        {`
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn .2s ease-out;
}
`}
      </style>

      {/* MODAL DE CONFIRMAÇÃO */}
      <ConfirmModal
        open={confirmOpen}
        message={confirmMessage}
        loadingDelete={loadingDelete}
        onConfirm={async () => {
          setLoadingDelete(true);
          await confirmAction();
          setLoadingDelete(false);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
