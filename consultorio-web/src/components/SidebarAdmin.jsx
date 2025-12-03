import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  Users,
  Stethoscope,
  Bell,
  Home,
  Settings,
  CalendarCog,
  BetweenHorizontalEnd,
  IdCardLanyard,
  Hospital,
  Menu,
  MapPin,
  ChartNoAxesCombined,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";

export default function SidebarAdmin() {
  const { logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const menus = [
    { label: "Início", path: "/", icon: Home },
    { label: "Notificações", path: "/admin/notificacoes", icon: Bell },
    { label: "Gerenciar usuários", path: "/admin/usuarios", icon: Users },
    { label: "Gerenciar médicos", path: "/admin/medicos", icon: Stethoscope },
    { label: "Gerenciar convênios", path: "/admin/planos", icon: IdCardLanyard },
    { label: "Gerenciar consultas", path: "/admin/agendas", icon: CalendarCog },
    { label: "Gerenciar slots", path: "/admin/slots", icon: BetweenHorizontalEnd },
    { label: "Relatórios", path: "/admin/relatorios", icon: ChartNoAxesCombined },
    { label: "Meu perfil", path: "/perfil", icon: Settings },
  ];

  const linkClasses = (path) =>
    `flex items-center gap-3 px-4 py-2 rounded-md transition text-sm ${
      location.pathname === path
        ? "bg-yellow-400 text-white font-semibold"
        : "text-white hover:bg-yellow-400 hover:text-white"
    }`;

  return (
    <>
      {/* ====================== */}
      {/* DESKTOP SIDEBAR FIXA */}
      {/* ====================== */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 bg-gray-800 border-r border-gray-800 flex-col">
        <div className="p-4 border-b border-gray-800 text-yellow-400 text-lg font-light print:hidden">
          Administrador
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menus.map(({ label, path, icon: Icon }) => (
            <Link key={path} to={path} className={linkClasses(path)}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 text-yellow-400 hover:text-white border-t border-gray-800 transition"
        >
          <LogOut size={18} /> Sair
        </button>
      </aside>

      {/* ====================== */}
      {/* MOBILE NAVBAR + MENU LISTA */}
      {/* ====================== */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-gray-800 border-b border-gray-800 z-50">
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="absolute left-1/2 transform -translate-x-1/2 text-yellow-400 font-light text-lg text-center print:hidden">
            Administrador
          </h1>

          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className="text-white focus:outline-none"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="bg-gray-700 border-t border-gray-600 overflow-hidden"
            >
              <nav className="flex flex-col p-2 space-y-1">
                {menus.map(({ label, path, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMenuOpen(false)}
                    className={linkClasses(path)}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ))}

                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2 text-yellow-400 bg-gray-400 hover:text-white hover:bg-yellow-400 rounded-md transition text-sm"
                >
                  <LogOut size={16} /> Sair
                </button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}
