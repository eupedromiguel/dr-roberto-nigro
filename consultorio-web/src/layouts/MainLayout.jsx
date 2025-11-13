import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useAuth } from "../context/AuthContext";

export default function MainLayout({ children }) {
  const { user, role } = useAuth();

  // Se o admin estiver logado, ativa padding lateral no desktop
  const isAdmin = user && role === "admin";

  return (
    <div
      className={`min-h-screen flex flex-col bg-gray-900 text-slate-900 relative transition-all duration-300 ${
        isAdmin ? "md:pl-60" : ""
      }`}
    >
      {/* Navbar ou Sidebar */}
      <Navbar />

      {/* Conteúdo principal */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
