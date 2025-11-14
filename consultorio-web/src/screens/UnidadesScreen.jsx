import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function UnidadesScreen() {
  const unidades = [
    {
      nome: "Unidade Pompéia",
      endereco:
        "Rua Apinajés, 1100 - Conj. 803/804, Pompéia - SP (Edifício Silver Tower)",
      telefone: "(11) 96572-1206 / (11) 3871-9186 / (11) 3675-0130",

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
        "Rua Cayowaá, 1071 - 10º Andar Conj. 102/103, Perdizes - SP",
      telefone: "(11) 3673-2899 / (11) 96338-0861",
      slides: ["/unidade-cayowaa-1.png", "/unidade-cayowaa-2.png"],
      mapa:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3657.854716237287!2d-46.68534362467041!3d-23.537727278816014!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce57ef0bba731d%3A0x6631bc338bd55449!2sRua%20Cayowa%C3%A1%2C%201071!5e0!3m2!1spt-BR!2sbr!4v1761675089205!5m2!1spt-BR!2sbr",
      mapsLink:
        "https://www.google.com/maps/place/Rua+Cayowa%C3%A1,+1071+-+Perdizes,+S%C3%A3o+Paulo+-+SP",
    },
  ];

  return (
    <div className="bg-gray-800 text-yellow-400">

      {unidades.map((uni) => (
        <motion.section
          key={uni.nome}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto px-3 py-10
                     grid md:grid-cols-2 gap-16
                     border-b border-gray-700"
        >

          {/* SLIDES + título */}
          <div>
            <h2 className="text-2xl font-light mb-5 text-yellow-400">
              {uni.nome}
            </h2>

            <SlideShow slides={uni.slides} />
          </div>

          {/* DADOS DA UNIDADE */}
          <div className="text-white text-sm flex flex-col justify-center mt-12">

  <MapWithSpinner src={uni.mapa} />

  <a
    href={uni.mapsLink}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-block bg-gray-900 hover:bg-yellow-400 text-white font-medium px-4 py-2 rounded-md transition mt-4"
  >
    Ver no Google Maps
  </a>

  <div className="mt-3 space-y-1">
    <p>{uni.endereco}</p>
    <p className="font-bold">{uni.telefone}</p>
    <p>{uni.horario}</p>
  </div>

</div>


        </motion.section>
      ))}

    </div>
  );
}

/* ===============================
   MAPA COM LOADING
================================ */
function MapWithSpinner({ src }) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative overflow-hidden rounded-xl h-64 w-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/40">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allowFullScreen
        loading="lazy"
        onLoad={() => setLoading(false)}
      ></iframe>
    </div>
  );
}

/* ===============================
   SLIDESHOW
================================ */
function SlideShow({ slides }) {
  const [index, setIndex] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((prev) => (prev + 1) % slides.length),
      4000
    );
    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(() => {
    if (loadedCount === slides.length) setLoading(false);
  }, [loadedCount, slides.length]);

  return (
    <div className="relative overflow-hidden rounded-xl h-64 md:h-80 lg:h-96 w-full">

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/40">
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
        />
      ))}

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
