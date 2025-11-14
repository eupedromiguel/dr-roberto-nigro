import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function UnidadesScreen() {
  const unidades = [
    {
      nome: "Unidade Pompéia",
      endereco:
        "Rua Apinajés, 1100 - Conj. 803/804 - Pompeia, São Paulo - SP (Edifício Silver Tower)",
      telefone: "(11) 96572-1206 / (11) 3871-9186 / (11) 3675-0130",
      horario: "Seg a Sex: 7h às 17h",
      slides: [
        "/img-consultorio1.png",
        "/img-consultorio2.png",
        "/img-consultorio3.png",
        "/img-consultorio4.png",
        "/img-consultorio5.png",
        "/img-consultorio6.png",
      ],
      mapa: "https://www.google.com/maps?q=Rua+Apinaj%C3%A9s,+1100+-+Conj.+803+-+Pompeia,+S%C3%A3o+Paulo+-+SP&hl=pt-BR&z=16&output=embed",
      mapsLink:
        "https://www.google.com/maps/place/Rua+Apinaj%C3%A9s,+1100+-+Pompeia,+S%C3%A3o+Paulo+-+SP",
    },
    {
      nome: "Unidade Cayowaá",
      endereco:
        "Rua Cayowaá, 1071 - 10º Andar Conj. 102/103 - Perdizes, São Paulo - SP",
      telefone: "(11) 3673-2899 / (11) 96338-0861",
      horario: "Seg a Sab: 8h às 17h",
      slides: [
        "/unidade-cayowaa-1.png",
        "/unidade-cayowaa-2.png",
      ],
      mapa: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3657.854716237287!2d-46.68534362467041!3d-23.537727278816014!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce57ef0bba731d%3A0x6631bc338bd55449!2sRua%20Cayowa%C3%A1%2C%201071%20-%20Perdizes%2C%20S%C3%A3o%20Paulo%20-%20SP%2C%2005018-001!5e0!3m2!1spt-BR!2sbr!4v1761675089205!5m2!1spt-BR!2sbr",
      mapsLink:
        "https://www.google.com/maps/place/Rua+Cayowa%C3%A1,+1071+-+Perdizes,+S%C3%A3o+Paulo+-+SP",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-800 text-white">
      {/* Cabeçalho */}
      <section className="text-center py-12 px-6 bg-gray-800 border-b border-gray-200">
        <h1 className="text-4xl font-momo mb-3">Nossas Unidades</h1>
        <p className="max-w-2xl mx-auto text-white">
          Conheça as unidades da Clínica Dr. Roberto Nigro e escolha a mais próxima de você.
        </p>
      </section>

      {/* Unidades */}
      {unidades.map((uni, i) => (
        <motion.section
          key={uni.nome}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className={`max-w-6xl mx-auto py-16 px-6 grid md:grid-cols-2 gap-10 items-center ${
            i % 2 ? "md:flex-row-reverse" : ""
          }`}
        >
          {/* SLIDES com título acima */}
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold mb-5 text-white text-center md:text-left">
              {uni.nome}
            </h2>
            <SlideShow slides={uni.slides} />
          </div>

          {/* Dados da unidade */}
          <div>
            <p className="mb-1">{uni.endereco}</p>
            <p className="font-medium text-white">{uni.telefone}</p>
            <p className="mb-4 text-white">{uni.horario}</p>

            {/* Mapa com spinner */}
            <MapWithSpinner src={uni.mapa} />

            <a
              href={uni.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gray-950 hover:bg-yellow-400 text-white font-medium px-4 py-2 rounded-md transition"
            >
              Ver no Google Maps
            </a>
          </div>
        </motion.section>
      ))}
    </div>
  );
}


// Componente com spinner de carregamento do mapa

function MapWithSpinner({ src }) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative w-full h-[250px] mb-3 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <iframe
        src={src}
        width="100%"
        height="250"
        allowFullScreen
        loading="lazy"
        onLoad={() => setLoading(false)}
        className="rounded-xl"
      ></iframe>
    </div>
  );
}


// SlideShow com spinner e indicadores

function SlideShow({ slides }) {
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Quando todas as imagens forem carregadas, remove o spinner
  useEffect(() => {
    if (loadedCount === slides.length) {
      setLoading(false);
    }
  }, [loadedCount, slides.length]);

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-md h-100 w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {slides.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          onLoad={() => setLoadedCount((prev) => prev + 1)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
        />
      ))}

      {/* Indicadores */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`w-3 h-3 rounded-full transition ${
              i === index ? "bg-yellow-400" : "bg-white/60"
            }`}
          ></button>
        ))}
      </div>
    </div>
  );
}
