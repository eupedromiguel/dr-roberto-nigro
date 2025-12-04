import { useState, useEffect } from "react";
import {
  updateProfile,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signOut,
  linkWithCredential,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../services/firebase";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../../components/AuthCard";
import Input from "../../components/Input";
import Button from "../../components/Button";
import { IMaskInput } from "react-imask";
import { Eye, EyeOff, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RegisterScreen() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState("");
  const [confirmarEmail, setConfirmarEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [codigoSMS, setCodigoSMS] = useState("");
  const [verificationId, setVerificationId] = useState(null);
  const [contador, setContador] = useState(0);
  const [mostrarSucesso, setMostrarSucesso] = useState(false);
  const [sexoBiologico, setSexoBiologico] = useState("");
  const [dataNascimentoFormatada, setDataNascimentoFormatada] = useState(null);



  const navigate = useNavigate();
  const anoAtual = new Date().getFullYear();
  const minDate = "1930-01-01";
  const maxDate = `${anoAtual}-12-31`;


  useEffect(() => {
    if (!erro) {
      return;
    }
    const timer = setTimeout(() => {
      setErro("");
    }, 2000);
    return () => clearTimeout(timer);
  }, [erro]);


  useEffect(() => {
    if (contador <= 0) return;
    const t = setInterval(() => setContador((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [contador]);


  function validarDataNascimento(dataStr) {

    if (!dataStr) {
      return false;
    }

    const formatoValido = /^\d{2}\/\d{2}\/\d{4}$/;

    if (!formatoValido.test(dataStr)) {
      return false;
    }

    const partes = dataStr.split("/");
    const dia = Number(partes[0]);
    const mes = Number(partes[1]);
    const ano = Number(partes[2]);

    if (dia === 0 || mes === 0 || ano === 0) {
      return false;
    }

    if (mes < 1 || mes > 12) {
      return false;
    }

    const diasNoMes = new Date(ano, mes, 0).getDate();

    if (dia < 1 || dia > diasNoMes) {
      return false;
    }

    const hoje = new Date();
    const dataInformada = new Date(ano, mes - 1, dia);

    if (dataInformada > hoje) {
      return false;
    }

    if (ano < 1900) {
      return false;
    }

    return true;
  }





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


  // Envia SMS e exibe modal
  // =========================================
  async function handleRegister(e) {
    e.preventDefault();
    setErro("");

    // Validações básicas de campos
    if (!nome.trim()) {
      return setErro("Por favor, informe seu nome completo.");
    }

    if (!cpf.trim()) {
      return setErro("Por favor, informe seu CPF.");
    }

    if (!dataNascimento) {
      return setErro("Informe sua data de nascimento.");
    }

    if (!validarDataNascimento(dataNascimento)) {
      return setErro("Data de nascimento inválida. Use DD/MM/AAAA.");
    }

    if (!sexoBiologico.trim()) {
      return setErro("Por favor, selecione seu sexo biológico.");
    }

    if (email !== confirmarEmail) {
      return setErro("Os e-mails não coincidem.");
    }

    if (senha !== confirmarSenha) {
      return setErro("As senhas não coincidem.");
    }

    if (!telefone.trim()) {
      return setErro("Informe um telefone válido.");
    }

    // Converte a data UMA VEZ só (DD/MM/AAAA -> YYYY-MM-DD)
    const partesData = dataNascimento.split("/");
    const dia = partesData[0];
    const mes = partesData[1];
    const ano = partesData[2];

    const dataFormatada = `${ano}-${mes}-${dia}`;
    setDataNascimentoFormatada(dataFormatada);


    try {
      setLoading(true);

      // PASSO 1: validar duplicatas
      try {
        const validarDuplicatas = httpsCallable(functions, "usuarios-validarDuplicatas");

        await validarDuplicatas({
          email,
          telefone,
          cpf,
          dataNascimento: dataFormatada,
        });

      } catch (validErr) {
        console.error("Duplicidade detectada:", validErr);
        const msg = validErr?.message || "";

        if (msg.includes("E-mail já cadastrado")) {
          setErro("Este e-mail já está em uso por outra conta.");
        } else if (msg.includes("Telefone já cadastrado")) {
          setErro("Este telefone já está em uso por outra conta.");
        } else if (msg.includes("CPF já cadastrado")) {
          setErro("Este CPF já está em uso por outra conta.");
        } else {
          setErro("Erro ao validar informações. Tente novamente.");
        }

        return;
      }

      // PASSO 2: Encerra sessão anterior (se houver)
      if (auth.currentUser) {
        console.log("Encerrando sessão anterior...");
        await signOut(auth);
      }

      // PASSO 3: Envia SMS
      const recaptcha = await initRecaptcha();
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const phoneNumber = "+55" + telefone.replace(/\D/g, "");
      const id = await phoneAuthProvider.verifyPhoneNumber(phoneNumber, recaptcha);

      setVerificationId(id);
      setMostrarModal(true);
      setContador(30);

    } catch (err) {
      console.error("Erro ao enviar SMS:", err);
      setErro("Falha ao enviar código SMS. Verifique o número informado.");
    } finally {
      setLoading(false);
    }
  }



  // helper: fecha modal e mostra erro visual no card
  function showVisualError(message) {
    setMostrarModal(false);
    setErro(message);
  }

  // helper: apaga somente a conta recém‐criada (sem derrubar outras sessões)
  async function cleanupNewUser(newUser) {
    if (!newUser?.user) return;
    try {
      await newUser.user.delete();
    } catch (delErr) {
      // fallback
      try {
        await signOut(auth);
      } catch { }
      console.warn("Falha ao deletar user recém-criado; fez signOut.", delErr);
    }
  }


  // =========================================
  // Confirmar código SMS e criar conta 
  // =========================================
  async function handleConfirmarCodigo() {
    if (!codigoSMS.trim()) return setErro("Digite o código recebido por SMS.");

    setErro("");
    setLoading(true);
    let newUser = null;

    try {
      const phoneCred = PhoneAuthProvider.credential(verificationId, codigoSMS);

      // Cria a conta no Firebase Auth (email/senha)
      try {
        newUser = await createUserWithEmailAndPassword(auth, email, senha);
      } catch (emailErr) {
        if (emailErr?.code === "auth/email-already-in-use") {
          setMostrarModal(false);
          setErro("Este e-mail já está em uso.");
          return;
        }
        console.error("Erro ao criar usuário por e-mail:", emailErr);
        setMostrarModal(false);
        setErro("Não foi possível criar a conta por e-mail. Tente novamente.");
        return;
      }

      // Vincula telefone ao Auth
      try {
        await linkWithCredential(newUser.user, phoneCred);
      } catch (linkErr) {
        console.error("Erro ao vincular telefone:", linkErr);

        if (linkErr?.code === "auth/provider-already-linked") {
          console.warn("Telefone já vinculado. Prosseguindo.");
        } else if (linkErr?.code === "auth/credential-already-in-use") {
          try { await newUser.user.delete(); } catch { await signOut(auth); }
          setMostrarModal(false);
          setErro("Este telefone já está vinculado a outra conta.");
          return;
        } else if (linkErr?.code === "auth/invalid-verification-code") {
          try { await newUser.user.delete(); } catch { await signOut(auth); }
          setMostrarModal(false);
          setErro("Código SMS inválido. Tente novamente.");
          return;
        } else {
          try { await newUser.user.delete(); } catch { await signOut(auth); }
          setMostrarModal(false);
          setErro("Falha ao vincular o telefone. Tente novamente.");
          return;
        }
      }

      // Cria o documento no Firestore via Cloud Function autenticada
      try {
        const criarUsuario = httpsCallable(functions, "usuarios-criarUsuario");

        await criarUsuario({
          nome,
          telefone,
          cpf,
          dataNascimento: dataNascimentoFormatada,
          sexoBiologico,
        });

        console.log("Documento criado no Firestore com sucesso!");
      } catch (firestoreErr) {
        console.error("Erro ao criar documento no Firestore:", firestoreErr);
        try { await newUser.user.delete(); } catch { await signOut(auth); }
        setMostrarModal(false);
        setErro("Erro ao salvar seus dados. Tente novamente.");
        return;
      }

      // Atualiza nome de exibição no Auth
      try {
        await updateProfile(newUser.user, { displayName: nome });
      } catch (pErr) {
        console.warn("Não foi possível atualizar o displayName:", pErr);
      }

      // Finaliza com sucesso!
      setMostrarModal(false);
      setMostrarSucesso(true);
    } catch (err) {
      console.error("Erro geral na verificação:", err);
      if (newUser?.user) {
        try { await newUser.user.delete(); } catch { await signOut(auth); }
      }
      setMostrarModal(false);
      setErro("Erro ao confirmar código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }



  // =========================================
  // Reenviar SMS
  // =========================================
  async function reenviarSMS() {
    if (contador > 0) return;
    try {
      const recaptcha = await initRecaptcha();
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const phoneNumber = "+55" + telefone.replace(/\D/g, "");
      const id = await phoneAuthProvider.verifyPhoneNumber(phoneNumber, recaptcha);
      setVerificationId(id);
      setContador(30);
    } catch (err) {
      console.error("Erro ao reenviar SMS:", err);
      setErro("Falha ao reenviar código.");
    }
  }

  // =========================================
  // Interface JSX
  // =========================================
  return (
    <>
      <AuthCard
        title="Criar conta"
        footer={
          <>
            Já tem conta?{" "}
            <Link className="text-yellow-400 hover:underline" to="/login">
              Entrar
            </Link>
          </>
        }
      >
        {erro && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-md bg-red-100 border border-red-300 text-red-700 p-2 text-sm"
          >
            {erro}
          </motion.div>
        )}

        <form onSubmit={handleRegister} className="space-y-3 text-left">
          <Input
            label="Nome completo"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />

          {/* Telefone */}
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              Telefone
            </label>
            <IMaskInput
              mask="(00) 00000-0000"
              value={telefone}
              onAccept={(v) => setTelefone(v)}
              placeholder="(11) 91234-5678"
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              CPF
            </label>
            <IMaskInput
              mask="000.000.000-00"
              value={cpf}
              onAccept={(v) => setCpf(v)}
              placeholder="000.000.000-00"
              required
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>

          {/* Data de Nascimento */}
          <div>
            <label className="block text-sm text-slate-700 mb-1">
              Data de Nascimento
            </label>
            <IMaskInput
              mask="00/00/0000"
              value={dataNascimento}
              onAccept={(v) => setDataNascimento(v)}
              placeholder="DD/MM/AAAA"
              required
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
          </div>

          {/* Sexo Biológico */}
          <div className="relative">
            <label className="block text-sm text-slate-700 mb-1">
              Sexo Biológico
            </label>

            <select
              value={sexoBiologico}
              onChange={(e) => setSexoBiologico(e.target.value)}
              required
              className="appearance-none w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent pr-8"
            >
              <option value="">Selecione</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
              <option value="Prefiro não dizer">Prefiro não dizer</option>
            </select>

            {/* Ícone de seta customizado */}
            <svg
              className="absolute right-3 top-[35px] w-4 h-4 text-gray-500 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>




          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Confirmar Email"
            type="email"
            value={confirmarEmail}
            onChange={(e) => setConfirmarEmail(e.target.value)}
            required
          />

          {/* Senhas */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              className="absolute right-3 top-[30px] text-gray-600 hover:text-yellow-500"
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Confirmar senha
            </label>
            <input
              type={mostrarConfirmarSenha ? "text" : "password"}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setMostrarConfirmarSenha((v) => !v)}
              className="absolute right-3 top-[30px] text-gray-600 hover:text-yellow-500"
            >
              {mostrarConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-950 text-white hover:bg-yellow-400 transition-all"
          >
            {loading ? "Enviando código..." : "Cadastrar"}
          </Button>
        </form>

        <div id="recaptcha-container" className="mt-3"></div>
      </AuthCard>

      {/* Modal SMS */}
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
                Verificação do Telefone
              </h2>
              <p className="text-gray-700 text-sm mb-4">
                Digite o código de 6 dígitos enviado por SMS para <b>{telefone}</b>.
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
                    <button type="button" onClick={reenviarSMS} className="text-gray-600 hover:underline">
                      Reenviar código
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <Button
                  onClick={() => {
                    // Cancelar apenas fecha modal; mantém formulário para corrigir
                    setMostrarModal(false);
                  }}
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

      {/* Modal de Sucesso */}
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Conta criada com sucesso!
              </h2>
              <p className="text-gray-700 text-sm mb-6">
                Seu cadastro foi concluído. Agora você pode fazer login para acessar sua conta.
              </p>

              <Button
                onClick={() => {
                  setMostrarSucesso(false);
                  signOut(auth);
                  navigate("/login");
                }}
                className="bg-gray-950 text-white hover:bg-yellow-400 w-full py-2 rounded-md"
              >
                Ir para Login
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
