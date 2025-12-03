import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  PhoneMultiFactorGenerator,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../../services/firebase";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../../components/AuthCard";
import Input from "../../components/Input";
import Button from "../../components/Button";
import { Eye, EyeOff, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [mensagemInfo, setMensagemInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Modais
  const [mostrarModal, setMostrarModal] = useState(false);
  const [codigoSMS, setCodigoSMS] = useState("");
  const [mfaResolver, setMfaResolver] = useState(null);
  const [verificationId, setVerificationId] = useState(null);
  const [contador, setContador] = useState(0);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);

  // modal de “esqueci minha senha”
  const [modalResetOpen, setModalResetOpen] = useState(false);
  const [emailReset, setEmailReset] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [erroReset, setErroReset] = useState("");


  const navigate = useNavigate();

  // Inicializa reCAPTCHA invisível
  async function initRecaptcha() {
    try {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch { }
        window.recaptchaVerifier = null;
      }

      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => console.log("reCAPTCHA verificado"),
        "expired-callback": () =>
          console.warn("reCAPTCHA expirado, recarregue a página"),
      });

      await verifier.render();
      window.recaptchaVerifier = verifier;
      return verifier;
    } catch (err) {
      console.error("Erro ao inicializar reCAPTCHA:", err);
      throw err;
    }
  }

  // Controle de auto-limpeza
  useEffect(() => {
    if (!erroReset) return;

    const timer = setTimeout(() => {
      setErroReset("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [erroReset]);


  // Contador de tempo para mensagem info
  useEffect(() => {
    if (!mensagemInfo) {
      return;
    }

    const timer = setTimeout(() => {
      setMensagemInfo("");
    }, 7000);

    return () => {
      clearTimeout(timer);
    };
  }, [mensagemInfo]);


  // Contador reenvio
  useEffect(() => {
    if (contador <= 0) return;
    const t = setInterval(() => setContador((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [contador]);

  // Login principal
  async function handleLogin(e) {
    e.preventDefault();
    setErro("");
    setMensagemInfo(""); // <<< NOVO: limpa info ao tentar logar
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, senha);
      setMostrarSucesso(true);
    } catch (err) {
      if (err.code === "auth/multi-factor-auth-required") {
        console.log("MFA exigida");
        const resolver = err.resolver;
        setMfaResolver(resolver);

        const recaptcha = await initRecaptcha();
        const phoneAuthProvider = new PhoneAuthProvider(auth);
        const phoneInfoOptions = {
          multiFactorHint: resolver.hints[0],
          session: resolver.session,
        };

        const verificationId = await phoneAuthProvider.verifyPhoneNumber(
          phoneInfoOptions,
          recaptcha
        );

        setVerificationId(verificationId);
        setMostrarModal(true);
        setContador(30);
      } else {
        console.error("Erro ao entrar:", err);
        setErro("Credenciais inválidas. Verifique seu e-mail e senha.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Confirmar código SMS
  async function handleConfirmarCodigo() {
    if (!codigoSMS.trim()) return setErro("Digite o código recebido por SMS.");
    if (!verificationId || !mfaResolver)
      return setErro("Sessão de verificação inválida.");

    try {
      setErro("");
      setLoading(true);

      const cred = PhoneAuthProvider.credential(verificationId, codigoSMS);
      const assertion = PhoneMultiFactorGenerator.assertion(cred);

      await mfaResolver.resolveSignIn(assertion);
      setMostrarModal(false);
      setCodigoSMS("");
      setMostrarSucesso(true);
    } catch (err) {
      console.error("Erro ao confirmar MFA:", err);
      setErro("Código incorreto ou expirado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  // Reenviar código SMS
  async function reenviarSMS() {
    if (!mfaResolver || contador > 0) return;
    try {
      const recaptcha = await initRecaptcha();
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const phoneInfoOptions = {
        multiFactorHint: mfaResolver.hints[0],
        session: mfaResolver.session,
      };
      const id = await phoneAuthProvider.verifyPhoneNumber(
        phoneInfoOptions,
        recaptcha
      );
      setVerificationId(id);
      setContador(30);
    } catch (err) {
      console.error("Erro ao reenviar SMS:", err);
      setErro("Não foi possível reenviar o código.");
    }
  }

  // =====================================================
  // Esqueci minha senha – envia e-mail de redefinição
  // =====================================================
  async function handleEnviarReset() {
    const emailAlvo = emailReset.trim();

    if (!emailAlvo) {
      setErroReset("Informe o e-mail para redefinir a senha.");
      return;
    }

    try {
      setErro("");
      setMensagemInfo("");
      setResetLoading(true);

      await sendPasswordResetEmail(auth, emailAlvo, {
        url: "https://consultorio-app-2156a.web.app/auth/action",
        handleCodeInApp: true,
      });

      setModalResetOpen(false);
      setMensagemInfo(
      <p className="flex justify-center">
      Enviamos um link para redefinir sua senha 
      <br />
      Verifique seu e-mail, caixa de spam e lixeira.
      </p>);
      setEmailReset("");
    } catch (err) {
      console.error("Erro ao enviar reset de senha:", err);

      let msg = "Não foi possível enviar o e-mail de redefinição.";

      if (err.code === "auth/user-not-found") {
        msg = "Não existe uma conta cadastrada com este e-mail.";
      } else if (err.code === "auth/invalid-email") {
        msg = "E-mail inválido. Verifique e tente novamente.";
      }

      setErroReset(msg);
    }
    finally {
      setResetLoading(false);
    }
  }

  // JSX
  return (
    <>
      <AuthCard
        title="Entrar"
        footer={
          <div className="flex items-center justify-between text-sm text-gray-400 w-full">

            {/* Lado esquerdo */}
            <div>
              Não tem conta?{" "}
              <Link
                to="/register"
                className="text-yellow-500 hover:underline font-normal"
              >
                Cadastre-se
              </Link>
            </div>

            {/* Lado direito */}
            <button
              type="button"
              onClick={() => {
                setErro("");
                setErroReset("");
                setMensagemInfo("");
                setEmailReset(email);
                setModalResetOpen(true);
              }}
              className="text-sm font-normal hover:text-yellow-500 hover:underline"
            >
              Esqueci minha senha
            </button>

          </div>
        }

      >
        {erro && (
          <div className="mb-3 rounded-md bg-red-50 text-red-700 p-2 text-sm">
            {erro}
          </div>
        )}

        {mensagemInfo && (
          <div className="mb-3 rounded-md bg-green-50 text-green-700 p-2 text-sm">
            {mensagemInfo}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Senha */}
          <div className="relative">
            <label className="block text-sm font-sm text-gray-700 mb-1 ">
              Senha
            </label>
            <input
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="w-full border border-gray-400 rounded-md px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute right-3 top-[30px] text-gray-600 hover:text-yellow-500"
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>



          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-950 text-white hover:bg-yellow-400"
          >
            {loading ? "Entrando..." : "Login"}
          </Button>
        </form>

        <div id="recaptcha-container" className="mt-3"></div>
      </AuthCard>

      {/* ================================
          MODAL MFA (SMS)
      ================================ */}
      <AnimatePresence>
        {mostrarModal && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl p-6 w-[90%] max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Confirmação em Duas Etapas
              </h2>
              <p className="text-gray-700 text-sm mb-4">
                Digite o código de 6 dígitos enviado por SMS.
              </p>

              <input
                type="text"
                maxLength={6}
                value={codigoSMS}
                onChange={(e) => setCodigoSMS(e.target.value)}
                placeholder="Código SMS"
                className="w-full border border-gray-400 rounded-md px-3 py-2 text-center text-lg tracking-widest mb-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />

              <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  {contador > 0 ? (
                    <span>Reenviar em {contador}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={reenviarSMS}
                      className="text-blue-600 hover:underline"
                    >
                      Reenviar código
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <Button
                  onClick={() => setMostrarModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-900 px-3 py-1 rounded-md"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmarCodigo}
                  disabled={loading}
                  className="bg-gray-950 text-white hover:bg-yellow-400 px-3 py-1 rounded-md"
                >
                  {loading ? "Verificando..." : "Confirmar"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================
          MODAL ESQUECI MINHA SENHA
      ================================ */}
      <AnimatePresence>
        {modalResetOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-xl p-6 w-[90%] max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Esqueci minha senha
              </h2>
              <p className="text-gray-700 text-sm mb-4">
                Informe o e-mail cadastrado para enviarmos um link de redefinição.
              </p>
              {erroReset && (
                <div className="mb-3 rounded-md bg-red-50 text-red-700 p-2 text-sm">
                  {erroReset}
                </div>
              )}


              <input
                type="email"
                value={emailReset}
                onChange={(e) => setEmailReset(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full border border-gray-400 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />

              <div className="flex justify-end gap-2 mt-3">
                <Button
                  onClick={() => {
                    if (!resetLoading) {
                      setErroReset("");
                      setModalResetOpen(false);
                    }
                  }}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-900 px-3 py-1 rounded-md"
                  disabled={resetLoading}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEnviarReset}
                  disabled={resetLoading}
                  className="bg-gray-950 text-white hover:bg-yellow-400 px-3 py-1 rounded-md"
                >
                  {resetLoading ? "Enviando..." : "Enviar link"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Sucesso (login) */}
      <AnimatePresence>
        {mostrarSucesso && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl p-8 text-center w-[90%] max-w-md"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex justify-center mb-4">
                <div className="bg-green-100 p-4 rounded-full">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-10 w-10 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Login realizado com sucesso!
              </h2>
              <p className="text-gray-700 text-sm mb-6">
                Bem-vindo de volta. Sua autenticação foi concluída com sucesso.
              </p>

              <Button
                onClick={() => {
                  setMostrarSucesso(false);
                  navigate("/", { replace: true });
                }}
                className="bg-gray-950 text-white hover:bg-yellow-400 w-full py-2 rounded-md"
              >
                Acessar painel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
