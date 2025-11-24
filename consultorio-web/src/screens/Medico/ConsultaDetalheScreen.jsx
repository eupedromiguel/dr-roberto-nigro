import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../services/firebase";

export default function ConsultaDetalheScreen() {
  const { id } = useParams();
  const [consulta, setConsulta] = useState(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    try {
      const fn = httpsCallable(functions, "consultas-listarConsultas");
      const res = await fn({});

      if (!res.data?.sucesso) {
        setLoading(false);
        return;
      }

      const achada = res.data.consultas.find((c) => c.id === id);
      setConsulta(achada || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  if (loading) {
    return <p className="text-white p-6">Carregando consulta...</p>;
  }

  if (!consulta) {
    return <p className="text-white p-6">Consulta não encontrada.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Consulta {consulta.id}</h2>

      <div className="bg-gray-800 p-4 rounded-lg space-y-2">
        <p><b>Status:</b> {consulta.status}</p>
        <p><b>Horário:</b> {consulta.horario}</p>

        {consulta.paciente && (
          <>
            <p><b>Paciente:</b> {consulta.paciente.nome}</p>
            <p><b>Telefone:</b> {consulta.paciente.telefone}</p>
            <p><b>CPF:</b> {consulta.paciente.cpf}</p>
          </>
        )}

        {consulta.medico && (
          <p><b>Médico:</b> {consulta.medico.nome}</p>
        )}
      </div>
    </div>
  );
}
