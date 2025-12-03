import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  checkActionCode,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../../services/firebase";
import Button from "../../components/Button";

// -------------------------------------------------------------
//   Essa página gerencia as ações vindas de links do Firebase:
// - verifyEmail   → Verificar e-mail do usuário
// - resetPassword → Redefinir senha
// - recoverEmail  → Restaurar e-mail antigo
// -------------------------------------------------------------
export default function ActionHandler() {
  const [params] = useSearchParams();
  const mode = params.get("mode");
  const actionCode = params.get("oobCode");
  const continueUrl = params.get("continueUrl");

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Para sabermos se estamos no fluxo de redefinição de senha
  const isPasswordReset = mode === "resetPassword";

  useEffect(() => {
    async function handleAction() {
      try {
        switch (mode) {
          // =====================================================
          // 1. Verificação de e-mail
          // =====================================================
          case "verifyEmail":
            try {
              console.log("Verificando link de e-mail...");

              // Desloga o usuário se estiver logado
              try {
                await auth.signOut();
              } catch (signOutErr) {
                console.warn(
                  "Falha ao deslogar antes da verificação:",
                  signOutErr
                );
              }

              // Valida e aplica o código
              await checkActionCode(auth, actionCode);
              await applyActionCode(auth, actionCode);

              setStatus("success");
              setMessage("E-mail verificado com sucesso!");

              // Evita reexecução em reload
              sessionStorage.setItem("emailVerifiedOnce", "true");

              // Limpa a URL (opcional)
              const cleanUrl = window.location.origin + "/action-complete";
              window.history.replaceState({}, document.title, cleanUrl);

              // Redireciona após 30s
              setTimeout(() => {
                window.location.replace(continueUrl || "/");
              }, 30000);
            } catch (err) {
              console.warn("Erro ao verificar e-mail:", err);

              if (sessionStorage.getItem("emailVerifiedOnce") === "true") {
                setStatus("success");
                setMessage("E-mail verificado.");
                break;
              }

              setStatus("error");
              setMessage(
                "Este link já foi usado ou expirou. Se seu e-mail não estiver verificado, tente reenviar a confirmação."
              );
            }
            break;

          // =====================================================
          // 2. Redefinição de senha
          // =====================================================
          case "resetPassword": {
            const emailFromCode = await verifyPasswordResetCode(
              auth,
              actionCode
            );
            setEmail(emailFromCode);
            setStatus("askPassword");
            break;
          }

          // =====================================================
          // 3. Recuperação de e-mail
          // =====================================================
          case "recoverEmail": {
            const info = await checkActionCode(auth, actionCode);
            const restoredEmail = info.data.email;

            await applyActionCode(auth, actionCode);
            await sendPasswordResetEmail(auth, restoredEmail);

            setStatus("success");
            setMessage(
              `O e-mail foi revertido para ${restoredEmail}. Verifique sua caixa de entrada.`
            );
            break;
          }

          // =====================================================
          // 4. Ação inválida / não suportada
          // =====================================================
          default:
            setStatus("error");
            setMessage("Faça login novamente para atualizar sua conta.");
        }
      } catch (err) {
        console.error("Erro no link do Firebase:", err);
        setStatus("error");
        setMessage("O link é inválido ou já expirou. Tente novamente.");
      }
    }

    // Roda só quando os parâmetros do link mudarem
    if (mode && actionCode) {
      handleAction();
    } else {
      setStatus("error");
      setMessage("Link expirado.");
    }
  }, [mode, actionCode, continueUrl]); 

  // =============================================================
  // Confirmação da nova senha
  // =============================================================
  async function handlePasswordConfirm() {
    setPasswordError("");

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }

    try {
      await confirmPasswordReset(auth, actionCode, newPassword);

      setStatus("success");
      setMessage("Senha redefinida com sucesso! Agora você já pode fazer login.");

      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setPasswordError(
        "Erro ao redefinir senha. O link pode ter expirado. Tente novamente."
      );
    }
  }

  // =============================================================
  // Interface visual
  // =============================================================
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6 bg-gray-900">
      <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8">
        {status === "loading" && <p>Carregando...</p>}

        {status === "success" && (
          <>
            <p className="text-lg font-semibold mb-4">{message}</p>

            {isPasswordReset && (
              <a href="/login">
                <Button className="mt-4 w-full">Ir para login</Button>
              </a>
            )}

            {!isPasswordReset && continueUrl && (
              <a href={continueUrl}>
                <Button className="mt-4 w-full">Voltar ao aplicativo</Button>
              </a>
            )}
          </>
        )}

        {status === "askPassword" && (
          <>
            <h2 className="text-xl font-semibold mb-2">Redefinir senha</h2>
            <p className="text-gray-600 mb-4">
              Conta: <b>{email}</b>
            </p>

            <div className="space-y-3 mb-2">
              <input
                type="password"
                placeholder="Nova senha"
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <input
                type="password"
                placeholder="Confirme a nova senha"
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {passwordError && (
              <p className="text-red-600 text-sm mb-3">{passwordError}</p>
            )}

            <Button className="w-full" onClick={handlePasswordConfirm}>
              Salvar nova senha
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-gray-950 font-semibold mb-4">{message}</p>
            <a href="/">
              <Button className="mt-4 w-full">Voltar</Button>
            </a>
          </>
        )}
      </div>
    </div>
  );
}
