import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Stethoscope } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import CardCarousel from "./CardCarousel";
import UnidadesScreen from "./UnidadesScreen";

export default function HomeScreen() {
  const { user } = useAuth();

  const SectionDivider = () => (
    <div className="flex items-center justify-center mb-2">
      <div className="w-16 h-[2px] bg-yellow-400 mr-3 rounded-full animate-pulse"></div>
      <Stethoscope className="w-8 h-8 text-yellow-500" strokeWidth={1.5} />
      <div className="w-16 h-[2px] bg-yellow-400 ml-3 rounded-full animate-pulse"></div>
    </div>
  );

  const slides = [
    {
      img: "/FOTOS-IA-1.png",
      title: "Ambiente moderno",
      desc: "Cada detalhe do nosso espaço foi pensado para o seu conforto e bem-estar.",
    },
    {
      img: "/FOTOS-IA-2.png",
      title: "Estrutura completa",
      desc: "Consultórios amplos, climatizados e equipados com tecnologia de ponta.",
    },
    {
      img: "/FOTOS-IA-3.png",
      title: "Cuidado em cada detalhe",
      desc: "Nosso ambiente transmite tranquilidade e segurança para o paciente.",
    },
    {
      img: "/FOTOS-IA-4.png",
      title: "Tecnologia e precisão",
      desc: "Equipamentos de última geração que garantem diagnósticos seguros.",
    },
    {
      img: "/FOTOS-IA-5.png",
      title: "Atendimento humanizado",
      desc: "Nossa equipe está sempre pronta para ouvir, acolher e cuidar.",
    },
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // === LISTA DE MÉDICOS ===
  const medicos = [
    {
      nome: "Dra. Maria Rosaria Cunha",
      img: "Rosaria-IA.png",
      subtitulo: "Endocrinologista | CRM 72825/SP - RQE 26853",
      descricao:
        "Especialista em Endocrinologia e Metabologia, membro da Sociedade Brasileira de Endocrinologia, doutora em Endocrinologia e Metabologia pela faculdade de Medicina de São Paulo, com vasta experiência em medicina de urgência, obesidade, diabetes e endocrinopatias. Autora de vários capítulos de livros médicos e trabalhos publicados e revistas nacionais e internacionais.",
      experiencia: `
- Diabetologia
- Patologias da tireoide
- Reposição hormonal
- Metabolismo mineral e ósseo

      `,
    },
    {
      nome: "Dr. Roberto Nigro",
      img: "Roberto-IA-1.jpg",
      subtitulo: "Gastroenterologista | CRM 59834/SP - RQE 24030 - RQE 24029",
      descricao:
        "Médico cirugião do aparelho digestivo com mais de 37 anos de experiência especializado em Coloproctologia, Gastroenterologista, Cirurgia Oncológica de Cólon, Reto e Ânus, Cirurgia da Obesidade Mórbida, Cirurgia Videolaparoscópica e Robótica.",
      experiencia: `
- Cirurgia videolaparoscópica
- Cirurgia da obesidade mórbida
- Oncologia gastrointestinal
- Cirurgia laparoscópica colorretal
- Cirurgia oncológica do cólon, reto e ânus
- Cirurgia coloproctologica
- Cirurgia de vesícula

      `,
    },
    {
      nome: "Dra. Bruna Nigro",
      img: "Bruna-IA-1.jpg",
      subtitulo: "Gastroenterologista | CRM 199354/SP - RQE 109961",
      descricao:
        "Cirurgiã geral e do aparelho digestivo pela Universidade de São Paulo (USP) HCFMUSP. Atuo principalmente nas áreas de gastrocirurgia e coloproctologia, resolvendo doenças do trato digestivo como obesidade, refluxo, apendicite, hemorróidas, cálculos de vesícula biliar, cânceres e outras afecções desse extenso e complexo sistema, sejam seus tratamentos cirúrgicos ou não.",
      experiencia: `
- Proctologia
- Cirurgia Robótica
- Cirurgia Videolaparoscópica
- Oncologia Gastrointestinal

      `,
    },
    {
      nome: "Dr. Danilo Castro Nagato",
      img: "Danilo-IA-1.jpg",
      subtitulo: "Urologista | CRM 210961/SP - RQE 135155",
      descricao:
        "Médico Preceptor da Divisão de Urologia do Hospital das Clínicas da Faculdade de Medicina da USP (HCFMUSP) Graduação em Medicina - Universidade Federal do Paraná (UFPR) Residência em Cirurgia Geral e Urologia - Hospital das Clínicas da Faculdade de Medicina da Universidade de São Paulo (HCFMUSP) Observership Hospital da Luz - Lisboa",
      experiencia: `
- Litíase, cirurgia robótica, cálculos urinários
- Câncer da bexiga, próstata e rim
- Doenças dos rins e aparelho urinário
- Doenças testiculares, urológicas e da próstata

      `,
    },
  ];

  return (
    <div className="rounded-[3rem] md:rounded-[4rem] shadow-xl mt-0 overflow-hidden">
  <div className="w-full">

      {/* CONTAINER PRINCIPAL - SLIM */}
      <div className="rounded-[3rem] md:rounded-[4rem] shadow-xl mt-0">


        {/* HERO SLIM */}
        <section className="relative w-full bg-gradient-to-b from-gray-950 to-gray-800 text-white py-10 md:py-14 overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/consultorio-hero.jpg"
              alt="Clínica Dr. Roberto Nigro"
              className="w-full h-full object-cover opacity-10"
              loading="lazy"
            />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
            <h1 className="text-4xl md:text-5xl font-momo mb-3">Bem-vindo</h1>
            <p className="text-slate-200 max-w-2xl mx-auto text-lg leading-relaxed">
              Cuide da sua saúde com praticidade. Agende consultas, visualize médicos e acompanhe seu histórico.
            </p>
          </div>
        </section>

        {/* CORPO CLÍNICO SLIM */}
        <section className="w-full bg-gray-800 text-gray-900">
          <div className="max-w-6xl mx-auto px-2 pt-6 pb-2">

            <SectionDivider />
            <h2 className="text-4xl text-white font-light mb-5 text-center">
              Conheça nosso corpo clínico
            </h2>

            <CardCarousel cards={medicos} />

          </div>
        </section>

        {/* CTA LOGIN / PERFIL */}
        <section className="flex flex-col items-center justify-center py-4 bg-gray-800 px-6">
          {!user ? (
            <>
              <h2 className="text-4xl font-light text-yellow-400 mb-4">
                Nosso compromisso é o seu bem-estar
              </h2>
              <p className="text-white text-lg max-w-2xl mb-6">
                Atendimento humanizado, equipe experiente e foco total na sua saúde.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/login"
                  className="bg-gray-950 text-white hover:bg-yellow-400 font-semibold px-6 py-3 rounded-lg shadow transition"
                >
                  Entrar
                </Link>
                <Link
                  to="/register"
                  className="bg-gray-950 text-white hover:bg-yellow-500 font-semibold px-6 py-3 rounded-lg shadow transition"
                >
                  Cadastrar-se
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-light text-yellow-400 mb-1">
                Olá, {user.displayName || user.email?.split("@")[0]}
              </h2>
              <p className="text-white mb-6">Seja bem-vindo de volta!</p>
              <Link
                to="/perfil"
                className="bg-gray-950 hover:bg-yellow-400 text-white font-semibold px-6 py-3 rounded-lg shadow transition"
              >
                Ir para meu perfil
              </Link>
            </>
          )}
        </section>


        {/* SLIDER FINAL (modern, slim) */}
        <section className="relative w-full bg-gray-800 text-white overflow-hidden pb-16">
          <div className="relative w-full h-[420px] sm:h-[520px] md:h-[600px] lg:h-[650px] overflow-hidden">
            {slides.map((slide, i) => (
              <img
                key={slide.img}
                src={slide.img}
                alt={slide.title}
                loading="lazy"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index ? "opacity-70" : "opacity-0"
                  }`}
              />
            ))}
          </div>

          <div className="relative z-10 max-w-5xl mx-auto px-6 text-center -mt-[300px] md:-mt-[330px]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h3 className="text-2xl md:text-3xl font-light mb-3 text-yellow-400 drop-shadow-lg">
                {slides[index].title}
              </h3>
              <p className="text-slate-200 text-base md:text-lg max-w-2xl mx-auto drop-shadow-md">
                {slides[index].desc}
              </p>
            </motion.div>
          </div>

          <div className="relative flex justify-center mt-14 space-x-3">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${i === index ? "bg-yellow-400 scale-125" : "bg-slate-500"
                  }`}
              ></button>
            ))}


          </div>
        </section>

        <UnidadesScreen></UnidadesScreen>

      </div>
    </div>
    </div>
  );
}
