import { useEffect, useState, useCallback } from "react";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../../services/firebase";
import {
  getAuth,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateEmail,
  sendEmailVerification,
} from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import Button from "../../components/Button";
import { Eye, EyeOff, Loader2, User, UserRound, Mail, Phone, CreditCard, Calendar, CheckCircle, AlertCircle, Edit, Lock, PhoneForwarded, NotebookPen } from "lucide-react";
import { IMaskInput } from "react-imask";

export default function PerfilScreen() {
  const { user, loading, logout } = useAuth();

  const [perfil, setPerfil] = useState(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [modo, setModo] = useState(null);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarSenhaConfirmar, setMostrarSenhaConfirmar] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const [mensagemModal, setMensagemModal] = useState("");
  const [emailVerificado, setEmailVerificado] = useState(false);
  const [reenviandoEmail, setReenviandoEmail] = useState(false);




  const [formData, setFormData] = useState({
    nome: "",
    telefone: "",
    cpf: "",
    dataNascimento: "",
    sexoBiologico: "",
  });

  // Carregar perfil (reutilizável)
  const carregarPerfil = useCallback(async () => {
    try {
      setCarregandoPerfil(true);
      const meuPerfil = httpsCallable(functions, "usuarios-meuPerfil");
      const res = await meuPerfil({});
      setPerfil(res.data.perfil);
      setFormData({
        nome: res.data.perfil?.nome || "",
        telefone: res.data.perfil?.telefone || "",
        cpf: res.data.perfil?.cpf || "",
        dataNascimento: res.data.perfil?.dataNascimento || "",
        sexoBiologico: res.data.perfil?.sexoBiologico || "",
      });
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setCarregandoPerfil(false);
    }
  }, []);


  useEffect(() => {
    if (modo === "emailSucesso") return;
    if (!erroModal && !mensagemModal) return;

    const timer = setTimeout(() => {
      setErroModal("");
      setMensagemModal("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [erroModal, mensagemModal, modo]);





  useEffect(() => {
    const carregar = async () => {
      if (!user) return;

      // Atualiza o estado de verificação do e-mail no Auth
      await auth.currentUser?.reload();
      const verificado = auth.currentUser?.emailVerified || false;
      setEmailVerificado(verificado);


      /// (Opcional) Atualiza também no Firestore se acabou de verificar
      if (verificado) {
        try {
          const atualizar = httpsCallable(functions, "usuarios-atualizarUsuario");
          await atualizar({ emailVerificado: true });
        } catch (e) {
          // Ignora apenas o erro esperado (campo não aceito)
          if (!e.message.includes("Nenhum campo válido")) {
            console.warn("Falha real ao sincronizar emailVerificado no Firestore:", e.message);
          }
        }
      }


      // Carrega o restante do perfil
      await carregarPerfil();
    };
    carregar();
  }, [user, carregarPerfil]);


  // Ocultar mensagens após 5s
  useEffect(() => {
    if (!erro && !mensagem) return;
    const t = setTimeout(() => {
      setErro("");
      setMensagem("");
    }, 5000);
    return () => clearTimeout(t);
  }, [erro, mensagem]);

  // Formatadores
  function formatarDataCompleta(dataStr) {
    if (!dataStr) return "(não informado)";
    const p = dataStr.split(/[\/\-]/);
    let dd, mm, yyyy;
    if (p[0]?.length === 4) [yyyy, mm, dd] = p;
    else[dd, mm, yyyy] = p;
    if (!yyyy || !mm || !dd) return "(data inválida)";
    return `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`;
  }

  function dataParaISO(dataStr) {
    if (!dataStr) return "";
    const [dd, mm, yyyy] = dataStr.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }

  function validarDataNascimento(dataStr) {

    if (!dataStr) {
      return false;
    }

    // Garante o formato exatamente DD/MM/AAAA
    const formatoValido = /^\d{2}\/\d{2}\/\d{4}$/;

    if (!formatoValido.test(dataStr)) {
      return false;
    }

    const partes = dataStr.split("/");
    const dd = Number(partes[0]);
    const mm = Number(partes[1]);
    const yyyy = Number(partes[2]);

    // Impede datas como 00/00/0000
    if (dd === 0 || mm === 0 || yyyy === 0) {
      return false;
    }

    // Mês válido
    if (mm < 1 || mm > 12) {
      return false;
    }

    // Dia válido considerando meses e ano bissexto
    const diasNoMes = new Date(yyyy, mm, 0).getDate();

    if (dd < 1 || dd > diasNoMes) {
      return false;
    }

    // Impede datas futuras
    const hoje = new Date();
    const dataInformada = new Date(yyyy, mm - 1, dd);

    if (dataInformada > hoje) {
      return false;
    }

    // Impede datas absurdamente antigas
    if (yyyy < 1900) {
      return false;
    }

    return true;
  }



  // Ações

  async function handleAtualizar() {
    try {
      setErro("");
      setMensagem("");
      setErroModal("");
      setMensagemModal("");
      setSalvando(true);

      if (!senha.trim()) {
        setErroModal("Digite sua senha para confirmar a atualização.");
        setSalvando(false);
        return;
      }



      if (!validarDataNascimento(formData.dataNascimento)) {
        setErroModal("Data de nascimento inválida. Use o formato DD/MM/AAAA e uma data real.");
        setSalvando(false);
        return;
      }


      const currentAuth = auth;
      const currentUser = auth.currentUser;
      if (!currentUser?.email) {
        setErroModal("Usuário inválido ou não autenticado.");
        setSalvando(false);
        return;
      }

      const cred = EmailAuthProvider.credential(currentUser.email, senha);
      await reauthenticateWithCredential(currentUser, cred).catch(() => {
        throw new Error("Senha incorreta.");
      });

      const atualizar = httpsCallable(functions, "usuarios-atualizarUsuario");
      const res = await atualizar({
        ...formData,
        dataNascimento: dataParaISO(formData.dataNascimento),
      });

      if (res.data?.sucesso) {
        setMensagemModal("Dados atualizados com sucesso!");
        setModo(null);
        setSenha("");
        await carregarPerfil();
      } else {
        setErroModal(res.data?.erro || "Erro ao atualizar perfil.");
      }

    } catch (e) {
      if (e.message.includes("already-exists")) {
        if (e.message.includes("Telefone")) setErroModal(" Telefone já cadastrado.");
        else if (e.message.includes("CPF")) setErroModal("CPF já cadastrado.");
        else setErroModal("Já existe um usuário com esses dados.");
      } else if (e.message.includes("Senha incorreta")) {
        setErroModal("Senha incorreta. Tente novamente.");
      } else {
        setErroModal(e.message || String(e));
      }
    } finally {
      setSalvando(false);
    }


  }


  async function handleAtualizarEmail() {
    try {
      setErro("");
      setMensagem("");
      setErroModal("");
      setMensagemModal("");
      setSalvando(true);

      const emailLimpo = novoEmail.trim().toLowerCase();

      if (!emailLimpo) {
        setErroModal("Informe o novo e-mail.");
        setSalvando(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(emailLimpo)) {
        setErroModal("Formato de e-mail inválido.");
        setSalvando(false);
        return;
      }

      if (!senha.trim()) {
        setErroModal("Digite sua senha para confirmar a alteração.");
        setSalvando(false);
        return;
      }

      const currentUser = auth.currentUser;

      if (!currentUser?.email) {
        setErroModal("Sessão inválida. Faça login novamente.");
        setSalvando(false);
        return;
      }

      // Validação extra: verificar se e-mail é diferente do atual
      if (currentUser.email.toLowerCase() === emailLimpo) {
        setErroModal("O novo e-mail deve ser diferente do atual.");
        setSalvando(false);
        return;
      }

      // Reautenticar usuário
      const cred = EmailAuthProvider.credential(currentUser.email, senha);

      await reauthenticateWithCredential(currentUser, cred).catch(() => {
        throw new Error("Senha incorreta.");
      });

      const solicitarTroca = httpsCallable(
        functions,
        "notificacoes-solicitarTrocaEmail"
      );

      const res = await solicitarTroca({
        novoEmail: emailLimpo,
      });

      if (res.data?.sucesso) {
        setMensagemModal(
          "Enviamos um link de confirmação ao novo e-mail. A alteração só será feita após a confirmação."
        );

        setNovoEmail("");
        setSenha("");
        setModo("emailSucesso");
        return;
      }

      setErroModal("Falha ao solicitar troca de e-mail.");
    } catch (e) {
      console.log("ERRO NA TROCA DE E-MAIL:", e);

      const code = e.code || "";
      const msg = e.message || "";

      if (msg.toLowerCase().includes("senha incorreta")) {
        setErroModal("Senha incorreta.");
      }
      // NOVO: E-mail já em uso
      else if (
        code === "functions/already-exists" ||
        code === "already-exists"
      ) {
        setErroModal("Este e-mail já está em uso.");
      }
      // NOVO: E-mail igual ao atual
      else if (
        code === "functions/failed-precondition" ||
        code === "failed-precondition"
      ) {
        setErroModal("O novo e-mail deve ser diferente do atual.");
      }
      // E-mail inválido
      else if (
        code === "functions/invalid-argument" ||
        code === "invalid-argument" ||
        msg.toLowerCase().includes("inválido")
      ) {
        setErroModal("Formato de e-mail inválido.");
      }
      // NOVO: Sessão expirada
      else if (
        code === "functions/unauthenticated" ||
        code === "unauthenticated"
      ) {
        setErroModal("Sessão expirada. Faça login novamente.");
      }
      // Erro genérico
      else {
        setErroModal("Erro ao solicitar troca de e-mail.");
      }
    } finally {
      setSalvando(false);
    }
  }




  async function handleExcluirConta() {
    try {
      setErro("");
      setMensagem("");
      setSalvando(true);

      if (!senha || !confirmarSenha) {
        setErroModal("Preencha ambos os campos de senha.");
        setSalvando(false);
        return;
      }

      if (senha !== confirmarSenha) {
        setErroModal("As senhas não coincidem.");
        setSalvando(false);
        return;
      }



      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser?.email) {
        setErroModal("Usuário inválido ou não autenticado.");
        setSalvando(false);
        return;
      }


      const cred = EmailAuthProvider.credential(currentUser.email, senha);
      await reauthenticateWithCredential(currentUser, cred).catch(() => {
        throw new Error("Senha incorreta.");
      });

      const excluir = httpsCallable(functions, "usuarios-deletarUsuario");
      const res = await excluir({ senha });

      if (res.data?.sucesso) {
        setModo("excluido");
        setSenha("");
        setConfirmarSenha("");
        setMostrarSenha(false);
        setMostrarSenhaConfirmar(false);
      } else {
        setErroModal(res.data?.erro || "Erro ao excluir conta.");
      }
    } catch (e) {
      if (e.message.includes("Senha incorreta")) {
        setErroModal("Senha incorreta. Tente novamente.");
      }
      else {
        setErroModal(e.message || String(e));
      }
    } finally {
      setSalvando(false);
    }
  }


  // Render

  if (loading)
    return <div className="p-4 text-center text-gray-600">Carregando...</div>;

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <p className="mb-3">Você não está logado.</p>
        <Link to="/" className="text-blue-700 hover:underline">
          Ir para Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-5 relative">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-100 flex items-center justify-center gap-2">
          <User className="text-yellow-400" size={26} />
          Meu Perfil
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Gerencie suas informações pessoais e de acesso
        </p>
      </div>



      {/* Card do perfil */}
      <div className="rounded-md border border-slate-200 p-5 bg-gray-700 space-y-3 relative z-10">
        {carregandoPerfil ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-200 rounded w-2/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
          </div>
        ) : perfil ? (
          <>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center text-white gap-x-2 gap-y-1">
                <Mail className="text-yellow-400 flex-shrink-0" size={18} />

                <p className="break-all">
                  <b></b> {user.email}
                </p>

                {emailVerificado ? (
                  <span className="text-green-500 text-sm flex items-center gap-1 flex-shrink-0">
                    <CheckCircle size={10} /> Verificado
                  </span>
                ) : (
                  <span
                    onClick={async () => {
                      if (reenviandoEmail) return;

                      try {
                        setErro("");
                        setMensagem("");
                        setReenviandoEmail(true);

                        await sendEmailVerification(auth.currentUser);

                        setMensagem("E-mail de verificação reenviado com sucesso!");
                      } catch (e) {
                        console.error("Erro ao reenviar e-mail:", e);
                        setErro("Erro ao reenviar e-mail. Tente novamente.");
                      } finally {
                        setReenviandoEmail(false);
                      }
                    }}
                    className={`
        text-sm 
        flex 
        items-center 
        gap-1 
        flex-shrink-0
        ${reenviandoEmail ? "text-gray-400 cursor-not-allowed" : "text-red-500 cursor-pointer hover:underline hover:text-red-400"}
      `}
                    title={reenviandoEmail ? "Enviando e-mail..." : "Clique para reenviar o e-mail"}
                  >
                    <AlertCircle size={10} />

                    {reenviandoEmail ? "Enviando..." : "Não verificado - Reenviar link"}
                  </span>
                )}
              </div>




              <div className="flex items-center text-white gap-2">
                <NotebookPen className="text-yellow-400" size={18} />
                <p><b>Nome:</b> {perfil.nome || "(sem nome)"}</p>
              </div>

              <div className="flex items-center text-white gap-2">
                <Phone className="text-yellow-400" size={18} />
                <p><b>Telefone:</b> {perfil.telefone || "(sem telefone)"}</p>
              </div>

              <div className="flex items-center text-white gap-2">
                <CreditCard className="text-yellow-400" size={18} />
                <p><b>CPF:</b> {perfil.cpf || "(não informado)"}</p>
              </div>

              <div className="flex items-center text-white gap-2">
                <Calendar className="text-yellow-400" size={18} />
                <p><b>Nascimento:</b> {formatarDataCompleta(perfil.dataNascimento)}</p>
              </div>
              <div className="flex items-center text-white gap-2">
                <UserRound className="text-yellow-400" size={18} />
                <p><b>Sexo Biológico:</b> {perfil.sexoBiologico || "(não informado)"}</p>
              </div>



            </div>

          </>
        ) : (
          <p className="text-slate-600 mt-2">Nenhum perfil carregado.</p>
        )}

        {erro && <p className="text-red-600 mt-2 font-medium">{erro}</p>}
        {mensagem && <p className="text-green-700 mt-2 font-medium">{mensagem}</p>}
      </div>




      {/*Ações*/}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">

        <Button
          className="bg-gray-500 hover:bg-yellow-400 text-white flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs"
          onClick={() => {
            setErro("");
            setMensagem("");
            setErroModal("");
            setMensagemModal("");
            setSenha("");

            if (perfil?.dataNascimento) {
              const p = perfil.dataNascimento.split(/[\/\-]/);

              let dd, mm, yyyy;

              if (p[0]?.length === 4) {
                [yyyy, mm, dd] = p;
              } else {
                [dd, mm, yyyy] = p;
              }

              setFormData((prev) => ({
                ...prev,
                dataNascimento: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`,
              }));
            }

            setModo("atualizar");
          }}
        >
          <Edit size={14} />
          Editar
        </Button>

        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs"
          onClick={() => {
            setErro("");
            setMensagem("");
            setErroModal("");
            setMensagemModal("");
            setNovoEmail("");
            setSenha("");
            setModo("email");
          }}
        >
          <Mail size={14} />
          Mudar e-mail
        </Button>

        <Button
          className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs"
          onClick={() => {
          }}
        >
          <PhoneForwarded size={14} />
          Mudar telefone
        </Button>

        <Button
          className="bg-gray-800 hover:bg-gray-900 text-white flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs"
          onClick={() => {
          }}
        >
          <Lock size={14} />
          Mudar senha
        </Button>


      </div>

      <div className="w-full flex justify-center mt-3">
        <span
          onClick={() => {
            setErro("");
            setMensagem("");
            setSenha("");
            setConfirmarSenha("");
            setMostrarSenha(false);
            setMostrarSenhaConfirmar(false);
            setModo("excluir");
          }}
          className="
      text-xs 
      text-red-600 
      hover:text-red-700 
      hover:underline 
      cursor-pointer 
      transition
    "
        >
          Excluir minha conta
        </span>
      </div>



      {/* Modal principal */}
      {modo && modo !== "excluido" && modo !== "emailSucesso" && (

        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 relative">
            <h3 className="flex justify-center text-lg font-semibold mb-3 text-gray-900">
              {modo === "atualizar" && "Atualizar Dados"}
              {modo === "email" && "Atualizar e-mail"}
              {modo === "excluir" && "Excluir Conta"}
            </h3>

            {erroModal && (
              <p className="text-red-600 text-sm mb-2 font-medium text-center">{erroModal}</p>
            )}
            {mensagemModal && (
              <p className="text-green-700 text-sm mb-2 font-medium text-center">
                {mensagemModal}
              </p>
            )}


            {/* Atualizar dados */}
            {modo === "atualizar" && (
              <div className="space-y-3">
                <label className="block text-sm text-gray-700">
                  Nome completo:
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </label>


                <label className="block text-sm text-gray-700">
                  CPF:
                  <IMaskInput
                    mask="000.000.000-00"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    disabled
                    className="w-full border border-gray-300 bg-gray-100 text-gray-500 rounded px-3 py-2 text-sm mt-1 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Para alterar o CPF, entre em{" "}
                    <a
                      href="https://wa.me/5511965721206"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-gray-700 hover:text-yellow-400"
                    >
                      contato
                    </a>{" "}
                    com a clínica.
                  </p>
                </label>


                <label className="block text-sm text-gray-700">
                  Data de Nascimento:
                  <IMaskInput
                    mask="00/00/0000"
                    placeholder="DD/MM/AAAA"
                    value={formData.dataNascimento}
                    onAccept={(v) => setFormData({ ...formData, dataNascimento: v })}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </label>

                <label className="block text-sm text-gray-700">
                  Sexo Biológico:
                  <div className="relative">
                    <select
                      value={formData.sexoBiologico}
                      onChange={(e) => setFormData({ ...formData, sexoBiologico: e.target.value })}
                      className="appearance-none w-full border border-gray-500 rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent pr-8"
                    >
                      <option value="">Selecione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Prefiro não dizer">Prefiro não dizer</option>
                    </select>

                    {/* Ícone de seta customizada */}
                    <svg
                      className="absolute right-3 top-[15px] w-4 h-4 text-gray-500 pointer-events-none"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </label>


                <label className="block text-sm text-gray-700">
                  Digite sua senha para confirmar alterações:

                  <div className="relative mt-1">
                    <input
                      type={mostrarSenha ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="w-full border border-gray-500 rounded px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      placeholder="Senha atual"
                    />

                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </label>


                <Button
                  onClick={handleAtualizar}
                  disabled={salvando}
                  className="bg-gray-500 hover:bg-yellow-400 text-white w-full mt-3 flex items-center justify-center"
                >
                  {salvando ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                  {salvando ? "Atualizando..." : "Atualizar"}
                </Button>
              </div>
            )}

            {/* Atualizar e-mail */}
            {modo === "email" && (
              <div className="space-y-3">
                <label className="block text-sm text-gray-700">Novo e-mail:</label>
                <input
                  type="email"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                  className="w-full border border-gray-500 rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="exemplo@novoemail.com"
                />

                <label className="block text-sm text-gray-700 relative">
                  Digita sua senha para confirmar:
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="Senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-[33px] text-gray-500 hover:text-gray-700"
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </label>

                <Button
                  onClick={handleAtualizarEmail}
                  disabled={salvando}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full flex items-center justify-center"
                >
                  {salvando ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                  {salvando ? "Atualizando..." : "Confirmar atualização"}
                </Button>
              </div>
            )}

            {/* Excluir conta */}
            {modo === "excluir" && (
              <div className="space-y-2">
                <p className="w-full flex justify-center text-sm text-red-500">Esta é uma ação irreversível.
                </p>
                <p className="w-full flex justify-center text-xs">Para continuar, informe sua senha atual abaixo.</p>
                <label className="block text-sm text-gray-700 relative">
                  Digite sua senha:
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-[33px] text-gray-500 hover:text-gray-700"
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </label>

                <label className="block text-sm text-gray-700 relative">
                  Repita sua senha:
                  <input
                    type={mostrarSenhaConfirmar ? "text" : "password"}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    className="w-full border border-gray-500 rounded px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaConfirmar((v) => !v)}
                    className="absolute right-3 top-[33px] text-gray-500 hover:text-gray-700"
                  >
                    {mostrarSenhaConfirmar ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </label>

                <Button
                  onClick={handleExcluirConta}
                  disabled={salvando}
                  className="bg-red-600 hover:bg-red-700 text-white w-full flex items-center justify-center"
                >
                  {salvando ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                  {salvando ? "Excluindo..." : "Excluir Conta"}
                </Button>
              </div>
            )}

            {/* Fechar modal */}
            <button
              onClick={() => {
                setErro("");
                setMensagem("");
                setErroModal("");
                setMensagemModal("");
                setSenha("");
                setConfirmarSenha("");
                setNovoEmail("");
                setMostrarSenha(false);
                setMostrarSenhaConfirmar(false);
                setModo(null);
              }}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-800 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Modal de sucesso */}
      {modo === "excluido" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-green-100 text-green-600 rounded-full p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Conta excluída com sucesso
            </h3>
            <p className="text-gray-600 mb-6">
              Seus dados foram removidos do sistema. Esperamos vê-lo novamente.
            </p>

            <Button
              onClick={async () => {
                await logout();
                window.location.href = "/";
              }}
              className="bg-gray-900 hover:bg-gray-800 text-white w-full py-2 rounded-md"
            >
              Voltar à tela inicial
            </Button>

            <button
              onClick={async () => {
                await logout();
                window.location.href = "/";
              }}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {modo === "emailSucesso" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-96 text-center">

            <div className="flex justify-center mb-4">
              <div className="bg-green-100 text-green-600 rounded-full p-4">
                <CheckCircle size={36} />
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Link enviado!
            </h3>

            <p className="text-gray-600 mb-6">
              Link enviado para o novo e-mail.<br />
              A troca só será feita após confirmação nesse link.
            </p>

            <Button
              onClick={() => {
                setModo(null);
                setErroModal("");
                setMensagemModal("");
              }}
              className="bg-gray-900 hover:bg-gray-800 text-white w-full py-2 rounded-md"
            >
              Ok
            </Button>

            <button
              onClick={() => setModo(null)}
              className="absolute top-2 right-3 text-gray-500 hover:text-gray-700 text-sm"
            >
              ✕
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
