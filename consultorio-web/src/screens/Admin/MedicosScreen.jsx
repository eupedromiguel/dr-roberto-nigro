import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs, addDoc, doc, deleteDoc, updateDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Button from "../../components/Button";
import { motion, AnimatePresence } from "framer-motion";

export default function MedicosScreen() {
  const db = getFirestore();
  const storage = getStorage();

  const [medicos, setMedicos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);

  const [loadedImages, setLoadedImages] = useState({});

  const [formData, setFormData] = useState({
    nome: "",
    especialidade: "",
    foto: null,
    fotoURL: "",
    valorConsulta: "",
    valorteleConsulta: "",
    novaFotoSelecionada: false,
  });

  // marca imagem como carregada
  const handleImageLoad = (id) => {
    setLoadedImages((prev) => ({ ...prev, [id]: true }));
  };

  // Carregar médicos do Firestore
  async function carregarMedicos() {
    try {
      setLoading(true);
      const snap = await getDocs(collection(db, "usuarios"));
      const lista = [];
      snap.forEach((docu) => {
        const data = docu.data();
        if (data.role === "doctor") lista.push({ id: docu.id, ...data });
      });
      setMedicos(lista);
    } catch (e) {
      setErro("Erro ao carregar médicos.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarMedicos();
  }, []);

  // Upload da imagem
  async function handleUpload(file) {
    if (!file) return "";
    const fileRef = ref(storage, `medicos/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  }

  // Salvar novo médico ou editar existente
  async function handleSalvar(e) {
    e.preventDefault();
    try {
      let fotoURL = formData.fotoURL;

      if (formData.foto) fotoURL = await handleUpload(formData.foto);

      // Atualiza dados privados do Firestore (/usuarios)
      if (editando) {
        await updateDoc(doc(db, "usuarios", editando), {
          nome: formData.nome,
          especialidade: formData.especialidade,
          fotoPerfil: fotoURL,
          valorConsulta: formData.valorConsulta || null,
          valorteleConsulta: formData.valorteleConsulta || null,
        });

        // CRIAR / ATUALIZAR DOCUMENTO PÚBLICO
        await updateDoc(doc(db, "medicos_publicos", editando), {
          nome: formData.nome,
          especialidade: formData.especialidade,
          fotoPerfil: fotoURL,
          valorConsulta: formData.valorConsulta || null,
          valorteleConsulta: formData.valorteleConsulta || null,
        }).catch(async () => {
          // se o doc ainda não existir, cria
          await setDoc(doc(db, "medicos_publicos", editando), {
            nome: formData.nome,
            especialidade: formData.especialidade,
            fotoPerfil: fotoURL,
            valorConsulta: formData.valorConsulta || null,
            valorteleConsulta: formData.valorteleConsulta || null,
          });
        });
      }

      // Resetar form
      setModalAberto(false);
      setEditando(null);
      setFormData({
        nome: "",
        especialidade: "",
        foto: null,
        fotoURL: "",
        valorConsulta: "",
        valorteleConsulta: "",
        novaFotoSelecionada: false,
      });

      await carregarMedicos();

    } catch (err) {
      console.error(err);
      setErro("Erro ao salvar médico.");
    }
  }


  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-semibold text-white mb-4">
        Gerenciar Médicos
      </h2>

      {erro && (
        <div className="bg-red-100 text-red-700 p-2 rounded">{erro}</div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-200 rounded-md"></div>
          ))}
        </div>
      ) : medicos.length === 0 ? (
        <p className="text-gray-400 mt-3">Nenhum médico cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {medicos.map((m) => {
            const foto =
              m.fotoPerfil ||
              "https://cdn-icons-png.flaticon.com/512/3774/3774299.png";
            const isLoaded = !!loadedImages[m.id];

            return (
              <motion.div
                key={m.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden hover:shadow-lg transition-all"
              >
                {/* Foto com spinner */}
                <div className="w-full h-64 bg-gray-100 overflow-hidden relative flex items-center justify-center">
                  {!isLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  <img
                    src={foto}
                    alt={m.nome}
                    onLoad={() => handleImageLoad(m.id)}
                    className={`w-full h-full object-cover transition-all duration-700 ease-out ${isLoaded
                        ? "opacity-100 blur-0 scale-100"
                        : "opacity-0 blur-md scale-105"
                      }`}
                  />
                </div>

                {/* Dados */}
                <div className="p-5 flex flex-col justify-between h-52">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                      {m.nome}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">
                      {m.especialidade}
                    </p>
                    {m.valorConsulta && (
                      <p className="text-sm text-gray-800 mt-2">
                        Consulta presencial particular:{" "}
                        <span className="font-semibold">
                          R$ {parseFloat(m.valorConsulta).toFixed(2)}
                        </span>
                      </p>
                    )}
                    {m.valorteleConsulta && (
                      <p className="text-sm text-gray-800 mt-2">
                        Teleconsulta particular:{" "}
                        <span className="font-semibold">
                          R$ {parseFloat(m.valorteleConsulta).toFixed(2)}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between mt-auto gap-2">
                    <Button
                      onClick={() => {
                        setEditando(m.id);
                        setFormData({
                          nome: m.nome,
                          especialidade: m.especialidade,
                          foto: null,
                          fotoURL: m.fotoPerfil || "",
                          valorConsulta: m.valorConsulta || "",
                          valorteleConsulta: m.valorteleConsulta || "",
                          novaFotoSelecionada: false,
                        });
                        setModalAberto(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-1 rounded-md"
                    >
                      Editar
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* MODAL EDITAR MÉDICO */}
      <AnimatePresence>
        {modalAberto && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl p-6 w-[90%] max-w-md shadow-2xl relative"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Editar Médico
              </h3>

              <form onSubmit={handleSalvar} className="space-y-3">
                <label className="block text-sm">
                  Nome público:
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) =>
                      setFormData({ ...formData, nome: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    required
                  />
                </label>

                <label className="block text-sm">
                  Especialidade:
                  <input
                    type="text"
                    value={formData.especialidade}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        especialidade: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    required
                  />
                </label>

                {/* Valor da consulta particular */}
                <label className="block text-sm">
                  Valor da consulta presencial particular:
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ex: 450.00"
                    value={formData.valorConsulta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        valorConsulta: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </label>
                {/* Valor da teleconsulta particular */}
                <label className="block text-sm">
                  Valor da teleconsulta particular:
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ex: 450.00"
                    value={formData.valorteleConsulta}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        valorteleConsulta: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </label>

                {/* Upload customizado */}
                <div className="block text-sm">
                  <p className="mb-1">Foto de perfil:</p>
                  <label className="flex items-center justify-center border-2 border-dashed border-gray-400 rounded-md py-3 cursor-pointer hover:border-yellow-500 transition">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const previewURL = URL.createObjectURL(file);
                          setFormData((prev) => ({
                            ...prev,
                            foto: file,
                            fotoURL: previewURL,
                            novaFotoSelecionada: true,
                          }));
                        }
                      }}
                      className="hidden"
                    />
                    <span className="text-gray-700 text-sm">
                      {formData.novaFotoSelecionada
                        ? "📷 Nova foto selecionada — clique em Salvar para atualizar"
                        : "📷 Escolher arquivo"}
                    </span>
                  </label>

                  {formData.fotoURL && (
                    <img
                      src={formData.fotoURL}
                      alt="Prévia"
                      className="w-28 h-28 rounded-md object-cover border mt-3 mx-auto"
                    />
                  )}
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    className="bg-gray-300 text-gray-800 px-3 py-1 rounded-md hover:bg-gray-400"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gray-950 hover:bg-yellow-400 text-white px-3 py-1 rounded-md"
                  >
                    Salvar
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
