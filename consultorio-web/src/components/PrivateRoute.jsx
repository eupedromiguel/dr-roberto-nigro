import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoadingScreen({ message = "Carregando sessão..." }) {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
      <div className="animate-spin h-12 w-12 border-4 border-yellow-400 border-t-transparent rounded-full mb-4"></div>
      <p className="text-lg opacity-80">{message}</p>
    </div>
  );
}

export default function PrivateRoute({ children, roles }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (roles && roles.length > 0) {
    if (!role) {
      return <LoadingScreen message="Carregando permissões..." />;
    }
    if (!roles.includes(role)) {
      return <Navigate to="/perfil" replace />;
    }
  }

  return children;
}
