import { useEffect, useState } from "react";
import { getFirestore, collection, getDocs } from "firebase/firestore";

export default function ConveniosPublicPage() {
    const db = getFirestore();

    const [convenios, setConvenios] = useState([]);
    const [medicos, setMedicos] = useState([]);

    const [convenioAberto, setConvenioAberto] = useState(null);
    const [categoriaAberta, setCategoriaAberta] = useState(null);

    // CARREGAR CONVÊNIOS E CATEGORIAS
    async function carregarConvenios() {
        const ref = collection(db, "planos_saude");
        const snap = await getDocs(ref);

        const lista = [];

        for (const conv of snap.docs) {
            const categoriasRef = collection(db, `planos_saude/${conv.id}/categorias`);
            const categoriasSnap = await getDocs(categoriasRef);

            lista.push({
                id: conv.id,
                nome: conv.data().nome,
                categorias: categoriasSnap.docs.map((c) => ({
                    id: c.id,
                    ...c.data(),
                })),
            });
        }

        setConvenios(lista);
    }

    // CARREGAR MÉDICOS PÚBLICOS
    async function carregarMedicos() {
        const snap = await getDocs(collection(db, "medicos_publicos"));
        const lista = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
        }));

        setMedicos(lista);
    }


    useEffect(() => {
        carregarConvenios();
        carregarMedicos();
    }, []);

    return (
        <div className="bg-gray-800 py-16 px-4">


            {/* TÍTULO */}
            <div className="max-w-4xl mx-auto text-center mb-12">
                <h1 className="text-4xl font-momo text-yellow-400 mb-3">Convênios e Categorias</h1>
                <p className="text-white text-lg">
                    Consulte todos os convênios atendidos na clínica e veja quais médicos atuam em cada categoria.
                </p>
            </div>

            {/* LISTA DE CONVÊNIOS */}
            <ul className="max-w-4xl mx-auto space-y-6">
                {convenios.map((conv) => {
                    const aberto = convenioAberto === conv.id;

                    return (
                        <li
                            key={conv.id}
                            className={`bg-white shadow-md rounded-xl border border-gray-200 transition-all duration-300 overflow-hidden 
    ${aberto ? "p-6" : "p-4"}`}
                        >


                            {/* CABEÇALHO DO CONVÊNIO */}
                            <div
                                className="flex justify-between items-center cursor-pointer"
                                onClick={() => setConvenioAberto(aberto ? null : conv.id)}
                            >
                                <h2 className="text-xl font-semibold text-gray-800">{conv.nome}</h2>

                                <span className="text-yellow-500 text-lg">
                                    {aberto ? "▲" : "▼"}
                                </span>
                            </div>

                            {/* CATEGORIAS */}
                            <div
                                className={`transition-all duration-300 overflow-hidden 
  ${aberto ? "space-y-4" : "space-y-0"}

    ${aberto ? "max-h-[2000px] mt-4 pt-4 border-t border-gray-200" : "max-h-0 mt-0 pt-0 border-transparent"}`}
                            >


                                {conv.categorias.length === 0 && (
                                    <p className="text-gray-400">Nenhuma categoria cadastrada.</p>
                                )}

                                {conv.categorias.map((cat) => {
                                    const catAberta = categoriaAberta === cat.id;

                                    return (
                                        <div key={cat.id} className="bg-gray-100 p-4 rounded-lg">

                                            {/* CABEÇALHO DA CATEGORIA */}
                                            <div
                                                className="flex justify-between items-center cursor-pointer"
                                                onClick={() => setCategoriaAberta(catAberta ? null : cat.id)}
                                            >
                                                <span className="text-lg font-medium">{cat.nome}</span>

                                                <span className="text-yellow-500">
                                                    {catAberta ? "▲" : "▼"}
                                                </span>
                                            </div>

                                            {/* LISTA DE MÉDICOS */}
                                            {catAberta && (
                                                <div className="mt-3 bg-white p-4 rounded shadow-sm">
                                                    <p className="text-sm text-gray-600 mb-2">Médicos que atendem:</p>

                                                    {cat.medicos?.length > 0 ? (
                                                        <ul className="space-y-2">
                                                            {cat.medicos.map((id) => {
                                                                const medico = medicos.find((m) => m.id === id);

                                                                return (
                                                                    <li key={id} className="p-2 bg-gray-50 border rounded text-gray-800">

                                                                        {medico?.nome || "Médico removido"}
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    ) : (
                                                        <p className="text-gray-400 text-sm">Nenhum médico vinculado.</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
