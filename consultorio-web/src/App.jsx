import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { FaWhatsapp } from "react-icons/fa";

// ===============================
// Layouts
// ===============================
import MainLayout from "./layouts/MainLayout";
import PrivateLayout from "./layouts/PrivateLayout";

// ===============================
// Páginas públicas
// ===============================
import HomeScreen from "./screens/HomeScreen";
import LoginScreen from "./screens/Login/LoginScreen";
import RegisterScreen from "./screens/Login/RegisterScreen";
import UnidadesScreen from "./screens/UnidadesScreen";
import ActionHandler from "./screens/Auth/ActionHandler";

// ===============================
// Páginas privadas (gerais)
// ===============================
import PerfilScreen from "./screens/Perfil/PerfilScreen";

// ===============================
// Páginas de paciente
// ===============================
import AgendarScreen from "./screens/Paciente/AgendarScreen";
import ConfirmarAgendamentoScreen from "./screens/Paciente/ConfirmarAgendamentoScreen";
import AgendamentosScreen from "./screens/Paciente/AgendamentosScreen";
import ConsultaConfirmadaScreen from "./screens/Paciente/ConsultaConfirmadaScreen";

// ===============================
// Páginas de médico
// ===============================
import AgendaScreen from "./screens/Medico/AgendaScreen";
import ConsultasScreen from "./screens/Medico/ConsultasScreen";

// ===============================
// Páginas de administrador
// ===============================
import UsuariosScreen from "./screens/Admin/UsuariosScreen";
import MedicosScreen from "./screens/Admin/MedicosScreen";
import GerenciarAgendas from "./screens/Admin/GerenciarAgendas";
import GerenciarPlanos from "./screens/Admin/GerenciarPlanos";
import GerenciarSlots from "./screens/Admin/GerenciarSlots";
import Notificacoes from "./screens/Admin/Notificacoes";

// ===============================
// Rotas de controle
// ===============================
import PublicRoute from "./components/PublicRoute";
import PrivateRoute from "./components/PrivateRoute";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="relative min-h-screen">
          <Routes>
            {/* ========================================= */}
            {/* ROTAS PÚBLICAS */}
            {/* ========================================= */}
            <Route
              path="/"
              element={
                <MainLayout>
                  <HomeScreen />
                </MainLayout>
              }
            />

            <Route
              path="/login"
              element={
                <PublicRoute>
                  <MainLayout>
                    <LoginScreen />
                  </MainLayout>
                </PublicRoute>
              }
            />

            <Route
              path="/register"
              element={
                <PublicRoute>
                  <MainLayout>
                    <RegisterScreen />
                  </MainLayout>
                </PublicRoute>
              }
            />

            <Route
              path="/unidades"
              element={
                <MainLayout>
                  <UnidadesScreen />
                </MainLayout>
              }
            />

            {/* ========================================= */}
            {/* GERENCIADOR DE AÇÕES DE E-MAIL */}
            {/* ========================================= */}
            <Route
              path="/auth/action"
              element={
                <MainLayout>
                  <ActionHandler />
                </MainLayout>
              }
            />


            {/* ========================================= */}
            {/* ROTAS PRIVADAS (GERAIS) */}
            {/* ========================================= */}
            <Route
              path="/perfil"
              element={
                <PrivateRoute roles={["patient", "doctor", "admin"]}>
                  <PrivateLayout>
                    <PerfilScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            {/* ========================================= */}
            {/* PACIENTE */}
            {/* ========================================= */}
            <Route
              path="/paciente/agendar"
              element={
                <PrivateRoute roles={["patient"]}>
                  <PrivateLayout>
                    <AgendarScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/paciente/confirmar-agendamento/:slotId"
              element={
                <PrivateRoute roles={["patient"]}>
                  <PrivateLayout>
                    <ConfirmarAgendamentoScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/paciente/agendamentos"
              element={
                <PrivateRoute roles={["patient"]}>
                  <PrivateLayout>
                    <AgendamentosScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/paciente/consulta-confirmada/:id"
              element={
                <PrivateRoute roles={["patient"]}>
                  <PrivateLayout>
                    <ConsultaConfirmadaScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            {/* ========================================= */}
            {/* MÉDICO */}
            {/* ========================================= */}
            <Route
              path="/medico/agenda"
              element={
                <PrivateRoute roles={["doctor"]}>
                  <PrivateLayout>
                    <AgendaScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/medico/agenda/:uid"
              element={
                <PrivateRoute roles={["doctor", "admin"]}>
                  <PrivateLayout>
                    <AgendaScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/medico/consultas"
              element={
                <PrivateRoute roles={["doctor"]}>
                  <PrivateLayout>
                    <ConsultasScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />


            <Route
              path="/medico/consultas/:uid"
              element={
                <PrivateRoute roles={["doctor", "admin"]}>
                  <PrivateLayout>
                    <ConsultasScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            {/* ========================================= */}
            {/* ADMINISTRADOR */}
            {/* ========================================= */}
            <Route
              path="/admin/usuarios"
              element={
                <PrivateRoute roles={["admin"]}>
                  <PrivateLayout>
                    <UsuariosScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/medicos"
              element={
                <PrivateRoute roles={["admin"]}>
                  <PrivateLayout>
                    <MedicosScreen />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/slots"
              element={
                <PrivateRoute roles={["admin"]}>
                  <PrivateLayout>
                    <GerenciarSlots />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/agendas"
              element={
                <PrivateRoute roles={["admin"]}>
                  <PrivateLayout>
                    <GerenciarAgendas />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/planos"
              element={
                <PrivateRoute roles={["admin"]}>
                  <PrivateLayout>
                    <GerenciarPlanos />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/admin/notificacoes"
              element={
                <PrivateRoute roles={["admin"]}>
                  <PrivateLayout>
                    <Notificacoes />
                  </PrivateLayout>
                </PrivateRoute>
              }
            />

            <Route
              path="/admin"
              element={<Navigate to="/admin/usuarios" replace />}
            />

            {/* ========================================= */}
            {/* ❌ PÁGINA NÃO ENCONTRADA */}
            {/* ========================================= */}
            <Route
              path="*"
              element={
                <MainLayout>
                  <div className="p-6 text-center">
                    <h2 className="text-2xl font-semibold text-white mb-2">
                      Página não encontrada
                    </h2>
                    <p className="text-white">
                      O endereço acessado não existe. Verifique o link e tente novamente.
                    </p>
                  </div>
                </MainLayout>
              }
            />
          </Routes>

          {/* ========================================= */}
          {/* BOTÃO FLUTUANTE DO WHATSAPP */}
          {/* ========================================= */}
          <div className="fixed bottom-5 right-5 z-50 group">
            <span className="absolute inset-0 rounded-full bg-green-400 opacity-50 scale-100" />
            <a
              href="https://wa.me/5511965721206"
              target="_blank"
              rel="noopener noreferrer"
              className="relative bg-green-500 hover:bg-green-600 text-white rounded-full shadow-xl p-4 flex items-center justify-center transition-all duration-300 animate-[pulse_5s_ease-in-out_infinite]"
              aria-label="Fale conosco no WhatsApp"
            >
              <FaWhatsapp size={17} />
              <span className="absolute right-16 bottom-1/2 translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                Fale conosco no WhatsApp
              </span>
            </a>
          </div>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
