import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Menu,
  X,
  Hospital,
  User,
  Calendar,
  ClipboardList,
  LogIn,
  LogOut,
  UserPlus,
  MapPin,
  Stethoscope,
  Instagram,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import SidebarAdmin from "./SidebarAdmin";

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  if (user && role === "admin") {
    return <SidebarAdmin />;
  }

  // Menus por tipo de usuário
  const menusByRole = {
    patient: [
      { label: "Meu perfil", path: "/perfil", icon: User },
      { label: "Marcar", path: "/paciente/agendar", icon: Calendar },
      { label: "Agendamentos", path: "/paciente/agendamentos", icon: ClipboardList },
    ],
    doctor: [
      { label: "Slots", path: "/medico/agenda", icon: Calendar },
      { label: "Consultas", path: "/medico/consultas", icon: ClipboardList },
      { label: "Meu perfil", path: "/perfil", icon: User },
    ],
    admin: [
      { label: "Gerenciar usuários", path: "/admin/usuarios", icon: User },
      { label: "Gerenciar médicos", path: "/admin/medicos", icon: Stethoscope },
      { label: "Meu perfil", path: "/perfil", icon: User },
    ],
  };

  // Menus públicos
  const publicMenus = [
    { label: "Entrar", path: "/login", icon: LogIn },
    { label: "Cadastrar-se", path: "/register", icon: UserPlus },
  ];

  const menus = user ? menusByRole[role] || [] : publicMenus;

  // Links sociais
  const socialLinks = {
    instagram: "https://www.instagram.com/clinicadr.robertonigro/",
    whatsapp: "https://wa.me/5511965721206",
  };

  // Função de classe ativa
  function linkClasses(path) {
    const isActive = location.pathname === path;
    return `px-2 py-2 rounded-md text-sm font-medium transition ${isActive ? "bg-yellow-400 text-white font-semibold" : "hover:bg-yellow-400"
      }`;
  }

  return (
    <nav className="bg-gray-800 text-white shadow-md relative">
      <div className="max-w-6xl mx-auto px-5 py-3 flex justify-between items-center">
        <Link
          to="/"
          className="flex items-center gap-3 group transition-all duration-300"
        >
          <div className="relative">
            <img
              src="https://img.icons8.com/fluency/48/caduceus.png"
              alt="caduceus"
              className="w-7 h-7 group-hover:rotate-12 transition-transform duration-300 relative z-10"
            />
            <div className="absolute inset-0 bg-yellow-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-sm"></div>
          </div>
          <div className="flex flex-col">
            <span className="font-ubuntu font-medium text-lg leading-tight text-white group-hover:text-yellow-400 transition-colors duration-300">
              Clínica Dr. Roberto Nigro
            </span>
            <span className="font-ubuntu text-[10px] text-gray-400 tracking-wider uppercase">
              Excelência em Saúde
            </span>
          </div>
        </Link>

        {/* Botão Mobile */}
        <button
          className="md:hidden text-white focus:outline-none"
          onClick={() => setMenuOpen((p) => !p)}
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Menu Desktop */}
        <div className="hidden md:flex items-center space-x-4">
          {menus.map(({ label, path, icon: Icon }) => (
            <Link key={path} to={path} className={`flex items-center gap-2 ${linkClasses(path)}`}>
              <Icon size={16} />
              {label}
            </Link>
          ))}

          {user && (
            <button
              onClick={handleLogout}
              className="ml-0 hover:bg-yellow-400 px-3 py-1 rounded-md text-sm font-medium transition flex items-center gap-2"
            >
              <LogOut size={16} />
              Sair
            </button>
          )}

          {/* Redes sociais */}
          <div className="flex items-center ml-4 space-x-3">
            <a
              href={socialLinks.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group"
            >
              <Instagram
                size={21}
                className="text-white hover:text-pink-400 transition"
              />
              <span className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                Siga no Instagram
              </span>
            </a>

            <a
              href={socialLinks.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="relative group"
            >
              <FaWhatsapp
                size={22}
                className="text-white hover:text-green-400 transition"
              />
              <span className="absolute bottom-[-30px] left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                Fale conosco no WhatsApp
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Menu Mobile */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden bg-gray-700 border-t border-white overflow-hidden"
          >
            <div className="flex flex-col p-3 space-y-2">
              {menus.map(({ label, path, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${location.pathname === path
                      ? "bg-yellow-400 text-white font-semibold"
                      : "hover:bg-yellow-400"
                    }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}

              {user && (
                <button
                  onClick={async () => {
                    await handleLogout();
                    setMenuOpen(false);
                  }}
                  className="w-full mt-2 bg-gray-400 hover:bg-yellow-400 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sair
                </button>
              )}

              {/* Ícones sociais mobile */}
              <div className="flex justify-center mt-3 space-x-6 border-t border-gray-500 pt-3">
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-pink-400 transition"
                  aria-label="Instagram"
                >
                  <Instagram size={24} />
                </a>
                <a
                  href={socialLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-green-400 transition"
                  aria-label="WhatsApp"
                >
                  <FaWhatsapp size={24} />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
