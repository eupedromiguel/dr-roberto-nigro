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
import { getFunctions, httpsCallable } from "firebase/functions";

// -------------------------------------------------------------
//   Essa página gerencia as ações vindas de links do Firebase:
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

  const isPasswordReset = mode === "resetPassword";

  const functions = getFunctions(undefined, "southamerica-east1");




  async function confirmarRecoverEmail() {
    try {
      setStatus("loading");

      await applyActionCode(auth, actionCode);

      setStatus("success");
      setMessage(
        "E-mail restaurado com sucesso. Se você não reconhece esta ação, altere sua senha imediatamente."
      );

      const cleanUrl = window.location.origin + "/action-complete";
      window.history.replaceState({}, document.title, cleanUrl);

    } catch (err) {
      console.error("Erro ao recuperar e-mail:", err);

      setStatus("error");
      setMessage("Este link já foi usado ou expirou.");
    }
  }


  // UseEffects  

  useEffect(() => {
    async function handleAction() {
      try {
        switch (mode) {
          // =====================================================
          // Verificação de e-mail
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
          // Redefinição de senha
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
          // Mudar email
          // =====================================================

          case "verifyAndChangeEmail":
            try {
              console.log("Confirmando troca de e-mail...");

              // Valida o código e obtém os dados do Firebase
              const info = await checkActionCode(auth, actionCode);

              // Aplica realmente a mudança no Auth
              await applyActionCode(auth, actionCode);

              const novoEmail = info.data?.email;

              if (!novoEmail) {
                throw new Error("Firebase não retornou o novo e-mail.");
              }

              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

              if (!emailRegex.test(novoEmail)) {
                throw new Error("Firebase retornou e-mail inválido.");
              }

              console.log("E-mail confirmado:", novoEmail);

              // Sincroniza Firestore
              const atualizarUsuario = httpsCallable(functions, "usuarios-atualizarUsuario");

              await atualizarUsuario({
                email: novoEmail,
                emailVerificado: true,
              });

              setStatus("success");
              setMessage("E-mail alterado com sucesso! Faça login novamente.");

              setTimeout(() => {
                window.location.href = "/login";
              }, 15000);

            } catch (err) {
              console.error("Erro ao confirmar troca de e-mail:", err);

              const code = err.code || "";
              const msg = err.message || "";

              let mensagem = "Erro ao confirmar troca de e-mail.";

              if (code === "auth/expired-action-code") {
                mensagem = "Este link expirou. Solicite uma nova troca de e-mail.";
              }
              else if (code === "auth/invalid-action-code") {
                mensagem = "Este link é inválido ou já foi usado.";
              }
              else if (code === "auth/user-disabled") {
                mensagem = "Esta conta está desativada.";
              }
              else if (code === "auth/user-not-found") {
                mensagem = "Usuário não encontrado.";
              }
              else if (msg.includes("não retornou")) {
                mensagem = "Não foi possível obter o e-mail confirmado pelo Firebase.";
              }
              else if (msg.includes("inválido")) {
                mensagem = "Firebase retornou um e-mail inválido.";
              }
              else if (msg.toLowerCase().includes("permission")) {
                mensagem = "Sem permissão para atualizar os dados.";
              }

              setStatus("error");
              setMessage(mensagem);
            }

            break;


          // =====================================================
          // Reverter troca de e-mail (segurança)
          // =====================================================
          case "recoverEmail":
            setStatus("confirmRecover");
            setMessage(
              "Você solicitou reverter a troca de e-mail desta conta.\n\nDeseja realmente restaurar o e-mail anterior?"
            );
            break;

          // =====================================================
          // Ação inválida / não suportada
          // =====================================================
          default:
            console.log("MODE DESCONHECIDO:", mode);
            setStatus("error");
            setMessage("Ação inválida: " + mode);
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
              <a href="/login">
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

        {status === "confirmRecover" && (
          <>
            <h3 className="text-lg font-semibold mb-4">Confirmar recuperação</h3>

            <p className="whitespace-pre-line text-gray-700 mb-6">
              {message}
            </p>

            <div className="flex gap-3">
              <Button
                className="w-full bg-gray-500"
                onClick={() => {
                  setStatus("error");
                  setMessage("A operação foi cancelada.");
                }}
              >
                Cancelar
              </Button>

              <Button
                className="w-full bg-red-600 hover:bg-red-700"
                onClick={confirmarRecoverEmail}
              >
                Restaurar e-mail
              </Button>
            </div>
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
