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
import { Eye, EyeOff, Loader2, User, UserRound, Mail, Phone, CreditCard, Calendar, CheckCircle, AlertCircle, Edit, Trash2, LogOut } from "lucide-react";
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
            console.warn("⚠️ Falha real ao sincronizar emailVerificado no Firestore:", e.message);
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
    if (!dataStr) return false;

    const [dd, mm, yyyy] = dataStr.split("/").map(Number);

    // Formato básico
    if (!dd || !mm || !yyyy || dataStr.length !== 10) return false;

    // Mês válido
    if (mm < 1 || mm > 12) return false;

    // Dia válido considerando meses e ano bissexto
    const diasNoMes = new Date(yyyy, mm, 0).getDate();
    if (dd < 1 || dd > diasNoMes) return false;

    // Impede datas futuras
    const hoje = new Date();
    const dataInformada = new Date(yyyy, mm - 1, dd);
    if (dataInformada > hoje) return false;

    // Impede datas muito antigas (ex: antes de 1900)
    if (yyyy < 1900) return false;

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
        setErro("Digite sua senha para confirmar a atualização.");
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
        setErro("Usuário inválido ou não autenticado.");
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
        setErro(res.data?.erro || "Erro ao atualizar perfil.");
      }
    } catch (e) {
      if (e.message.includes("already-exists")) {
        if (e.message.includes("Telefone")) setErroModal("❌ Telefone já cadastrado.");
        else if (e.message.includes("CPF")) setErroModal("❌ CPF já cadastrado.");
        else setErroModal("❌ Já existe um usuário com esses dados.");
      } else if (e.message.includes("Senha incorreta")) {
        setErroModal("❌ Senha incorreta. Tente novamente.");
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

      if (!novoEmail.trim()) {
        setErroModal("Informe um novo e-mail.");
        return;
      }

      const currentAuth = auth;
      const currentUser = currentAuth.currentUser;


      if (!senha.trim()) {
        setErroModal("Digite sua senha para confirmar a alteração de e-mail.");
        return;
      }

      // Reautentica o usuário
      const cred = EmailAuthProvider.credential(currentUser.email, senha);
      await reauthenticateWithCredential(currentUser, cred);

      // Atualiza o e-mail imediatamente
      await updateEmail(currentUser, novoEmail);
      await sendEmailVerification(currentUser);


      // Atualiza também o Firestore (mantendo consistência)
      const atualizar = httpsCallable(functions, "usuarios-atualizarUsuario");
      await atualizar({ email: novoEmail });

      setMensagemModal(
        "✅ E-mail atualizado com sucesso! Um aviso foi enviado ao e-mail antigo por segurança."
      );

      await logout();

      setModo(null);
      setNovoEmail("");
      await carregarPerfil();
    } catch (e) {
      console.error("Erro ao atualizar e-mail:", e);
      const code = e.code || "";
      const msg = e.message || "";

      if (code === "auth/email-already-in-use" || msg.includes("already-exists")) {
        setErroModal("❌ Este e-mail já está em uso por outro usuário.");
      } else if (code === "auth/requires-recent-login") {
        setErroModal("⚠️ Sessão expirada. Faça login novamente para alterar o e-mail.");
      } else if (code === "auth/invalid-email") {
        setErroModal("❌ E-mail inválido. Verifique o formato e tente novamente.");
      } else {
        setErroModal("❌ Erro ao atualizar e-mail. " + (msg || "Tente novamente."));
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
        setErro("Preencha ambos os campos de senha.");
        return;
      }
      if (senha !== confirmarSenha) {
        setErro("As senhas não coincidem.");
        return;
      }

      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser?.email) {
        setErro("Usuário inválido ou não autenticado.");
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
        setErro(res.data?.erro || "Erro ao excluir conta.");
      }
    } catch (e) {
      if (e.message.includes("Senha incorreta")) {
        setErro("❌ Senha incorreta. Tente novamente.");
      } else {
        setErro(e.message || String(e));
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
                  <span className="text-red-500 text-sm flex items-center gap-1 flex-shrink-0">
                    <AlertCircle size={10} /> Não verificado
                  </span>
                )}
              </div>


              <div className="flex items-center text-white gap-2">
                <UserRound className="text-yellow-400" size={18} />
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

      {/* Ações */}
      {!carregandoPerfil && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Button
            className="bg-gray-500 hover:bg-yellow-400 text-white flex items-center justify-center gap-2"
            onClick={() => {
              setErro("");
              setMensagem("");
              setErroModal("");
              setMensagemModal("");
              setSenha("");
              if (perfil?.dataNascimento) {
                const p = perfil.dataNascimento.split(/[\/\-]/);
                let dd, mm, yyyy;
                if (p[0]?.length === 4) [yyyy, mm, dd] = p;
                else[dd, mm, yyyy] = p;
                setFormData((prev) => ({
                  ...prev,
                  dataNascimento: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yyyy}`,
                }));
              }
              setModo("atualizar");
            }}
          >
            <Edit size={18} /> Editar
          </Button>

          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
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
            <Mail size={18} /> Meu e-mail
          </Button>

          <Button
            className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
            onClick={() => {
              setErro("");
              setMensagem("");
              setSenha("");
              setConfirmarSenha("");
              setMostrarSenha(false);
              setMostrarSenhaConfirmar(false);
              setModo("excluir");
            }}
          >
            <Trash2 size={18} /> Excluir
          </Button>

          <Button
            className="bg-gray-800 hover:bg-gray-900 text-white flex items-center justify-center gap-2"
            onClick={logout}
          >
            <LogOut size={18} /> Sair
          </Button>
        </div>
      )}


      {/* Modal principal */}
      {modo && modo !== "excluido" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl p-6 w-80 relative">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">
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
                  Telefone:
                  <IMaskInput
                    mask="(00) 00000-0000"
                    placeholder="(00) 00000-0000"
                    value={formData.telefone}
                    onAccept={(v) => setFormData({ ...formData, telefone: v })}
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


                <label className="block text-sm text-gray-700 relative">
                  Digite sua senha para confirmar alterações:
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
                    className="absolute right-3 top-7 text-gray-500 hover:text-gray-700"
                  >
                    {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
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
              <div className="space-y-3">
                <label className="block text-sm text-gray-700 relative">
                  Digite sua nova senha:
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
                  Repetir senha nova:
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
    </div>
  );
}
