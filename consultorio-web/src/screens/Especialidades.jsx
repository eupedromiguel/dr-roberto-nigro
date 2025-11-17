import { Stethoscope, Activity, Microscope, HeartPulse, Syringe, Radiation, Bone, Brain } from "lucide-react";

export default function EspecialidadesPage() {
  const data = [
    {
      nome: "Dr. Roberto Nigro",
      especialidades: [
        { titulo: "Cirurgia videolaparoscópica", descricao: "Procedimentos minimamente invasivos realizados com pequenas incisões e câmera de alta definição.",},
        { titulo: "Cirurgia da obesidade mórbida", descricao: "Tratamentos cirúrgicos avançados para redução de peso e controle metabólico.",},
        { titulo: "Oncologia gastrointestinal", descricao: "Atendimento especializado para tumores do trato digestivo, com abordagem precisa e moderna.",},
        { titulo: "Cirurgia laparoscópica colorretal", descricao: "Cirurgias do cólon e reto com técnicas minimamente invasivas.",},
        { titulo: "Cirurgia oncológica do cólon, reto e ânus", descricao: "Tratamentos cirúrgicos completos para câncer colorretal e anorretal.",},
        { titulo: "Cirurgia coloproctológica", descricao: "Procedimentos dedicados às doenças do intestino grosso, reto e ânus.",},
        { titulo: "Cirurgia de vesícula", descricao: "Tratamento moderno da colelitíase e inflamações da vesícula biliar." },
      ],
      icon: <Stethoscope className="w-10 h-10 text-yellow-500" />,
    },
    {
      nome: "Dra. Rosária Cunha",
      especialidades: [
        { titulo: "Diabetologia", descricao: "Acompanhamento completo para diagnóstico e controle do diabetes.",},
        { titulo: "Patologias da tireoide", descricao: "Avaliação e tratamento de disfunções e nódulos da tireoide.",},
        { titulo: "Reposição hormonal", descricao: "Terapia hormonal personalizada para equilíbrio metabólico.",},
        { titulo: "Metabolismo mineral e ósseo", descricao: "Tratamento de osteoporose e distúrbios do cálcio.",},
        { titulo: "Diabetologia", descricao: "Acompanhamento completo para diagnóstico e controle do diabetes." },
        { titulo: "Patologias da tireoide", descricao: "Avaliação e tratamento de disfunções e nódulos da glândula tireoide." },
        { titulo: "Reposição hormonal", descricao: "Terapia hormonal personalizada para equilíbrio metabólico e bem-estar." },
        { titulo: "Metabolismo mineral e ósseo", descricao: "Tratamento de doenças como osteoporose e distúrbios do cálcio e vitamina D." },
      ],
      icon: <Activity className="w-10 h-10 text-yellow-500" />,
    },
    {
      nome: "Dra. Bruna Nigro",
      especialidades: [
        { titulo: "Proctologia", descricao: "Cuidados especializados para doenças do ânus e reto.",},
        { titulo: "Cirurgia Robótica", descricao: "Procedimentos com alta precisão utilizando robôs cirúrgicos.",},
        { titulo: "Cirurgia Videolaparoscópica", descricao: "Cirurgias minimamente invasivas com recuperação rápida.",},
        { titulo: "Oncologia Gastrointestinal", descricao: "Atendimento especializado para tumores do sistema digestivo.",},
        { titulo: "Proctologia", descricao: "Cuidados especializados para doenças do ânus, reto e intestino grosso." },
        { titulo: "Cirurgia Robótica", descricao: "Procedimentos com alta precisão utilizando tecnologia robótica de última geração." },
        { titulo: "Cirurgia Videolaparoscópica", descricao: "Cirurgias minimamente invasivas com recuperação rápida e menos dor." },
        { titulo: "Oncologia Gastrointestinal", descricao: "Atendimento especializado para tumores do sistema digestivo." },
      ],
      icon: <Microscope className="w-10 h-10 text-yellow-500" />,
    },
    {
      nome: "Dr. Danilo Castro Nagato",
      especialidades: [
        { titulo: "Litíase e cálculos urinários", descricao: "Tratamentos modernos para pedras nos rins.",},
        { titulo: "Câncer da bexiga, próstata e rim", descricao: "Abordagem completa para tumores urológicos.",},
        { titulo: "Doenças dos rins e aparelho urinário", descricao: "Diagnóstico e tratamento de disfunções renais.",},
        { titulo: "Doenças testiculares e urológicas", descricao: "Atendimento especializado em saúde masculina.",},
        { titulo: "Litíase, cirurgia robótica e cálculos urinários", descricao: "Tratamentos modernos para pedras nos rins, incluindo técnicas robóticas." },
        { titulo: "Câncer da bexiga, próstata e rim", descricao: "Abordagem completa e atualizada para os principais tumores urológicos." },
        { titulo: "Doenças dos rins e aparelho urinário", descricao: "Diagnóstico e tratamento de disfunções renais e urinárias." },
        { titulo: "Doenças testiculares, urológicas e da próstata", descricao: "Atendimento especializado em patologias masculinas e saúde urológica." },
      ],
      icon: <HeartPulse className="w-10 h-10 text-yellow-500" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-800 py-16 px-4">
      {/* Título */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <h1 className="text-4xl md:text-3xl font-momo text-yellow-400 mb-4">
          Especialidades & Tratamentos
        </h1>
        <p className="text-white text-lg">
          Conheça nossas principais áreas de atuação e os profissionais que oferecem
          atendimento especializado com excelência.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10">
        {data.map((doctor, index) => (
          <div
            key={index}
            className="bg-white rounded-3xl shadow-lg p-8 transition hover:shadow-xl hover:-translate-y-1 duration-300 border border-gray-100"
          >
            <div className="flex items-center gap-4 mb-6">
              {doctor.icon}
              <h2 className="text-2xl font-semibold text-gray-800">
                {doctor.nome}
              </h2>
            </div>

            <ul className="space-y-4 text-gray-700">
              {doctor.especialidades.map((esp, i) => (
                <li key={i} className="text-lg">
                  <div className='flex items-center gap-2'>
                    {esp.icon}
                    <p className="font-semibold text-gray-800">{esp.titulo}</p>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mt-1">{esp.descricao}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
