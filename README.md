# Clínica Dr. Roberto Nigro

Plataforma de agendamento médico completa, desenvolvida em **Firebase + React + Vite (Ler FronEnd.md após o README)**

**Integração com Firebase** 

- Cloud Functions (BackEnd)
- Cloud Firestore (Banco de dados orientado a documentos)
- Hosting 
- Storage (Armazenamento)
- Authentication (email/senha + telefone)

**Tecnologia usada**

Ponto Importante: Atualmente, os triggers de autenticação do Firebase são suportados apenas por Cloud Functions de 1ª Geração. Deve-se usar a sintaxe e as bibliotecas da 1ª Geração para esses triggers específicos. 
Embora o Firebase esteja avançando para a 2ª Geração, você pode ter funções de 1ª e 2ª Geração coexistindo no mesmo projeto. 

* Cloud Functions v2 (HTTPS OnCall) southamerica-east1

- Node.js 22.19.0
- Firebase Functions v6.6.0
- Firebase Admin v13.5.0
- Nodemailer 7.0.10

* Cloud Functions v1 (AuthTriggers) us-central1

- Node.js 18 
- Firebase Admin v12.0.0 
- Functions 4.8.0 
- Nodemailer 7.0.10 

**Estrutura** 

firebase-app/ # Backend (Cloud Functions)
├── functions/ # Funções v2
│ ├── index.js # Entrypoint das v2
│ ├── package.json # Package das v2
│ ├── handlers/ # Lógica dividida por domínio
│ │ ├── usuarios.js
│ │ ├── medicos.js
│ │ ├── consultas.js
│ │ ├── admin.js
│ │ └── notificacoes.js
│
├── authTriggers/ # Funções v1
│ ├── index.js # Entrypoint das v1
│ ├── notificacoes.js # Trigger onUserCreated para confirmar e-mail
│ ├── package.json # Package das v1
│ ├── firebaseAdmin.js
│
├── consultorio-web/ # FrontEnd
└── firestore.rules # Regras do banco de dados


# Funções prontas e testadas :

**Funções v1**
Funções de **1ª Geração (Node 20)** para eventos do Authentication.

`authTriggers/`

| Trigger            | Descrição                                                      |
|--------------------|----------------------------------------------------------------|                                                 
| **onUserCreated**  | Cria documento `usuarios/{uid}` e envia e-mail de verificação. |
|--------------------|----------------------------------------------------------------| 
| **onUserDeleted**  | Remove todos os dados vinculados ao usuário excluído.          |

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

**Funções v2**
Funções de **2ª Geração (Node 22)** para eventos OnCall.

`usuarios.js`
Gerencia o ciclo de vida dos usuários.

| Função               | Descrição                                                                                     |
|----------------------|-----------------------------------------------------------------------------------------------|
| **criarUsuario**     | Cria documento no Firestore (`usuarios/{uid}`) e verifica duplicações (e-mail, CPF, telefone) |
|----------------------|-----------------------------------------------------------------------------------------------|
| **atualizarUsuario** | Usuário pode atualizar seus dados pessoais, exceto o campo `role`                             |
|----------------------|-----------------------------------------------------------------------------------------------|
| **deletarUsuario**   | Remove usuário do Auth e do Firestore.                                                        |
|----------------------|-----------------------------------------------------------------------------------------------|
| **validarDuplicatas**| Verificação de duplicidade usada antes do registro (sem precisar estar autenticado).          |
|----------------------|-----------------------------------------------------------------------------------------------|
| **meuPerfil**        | Retorna os dados do perfil do usuário autenticado.                                            |
|----------------------|-----------------------------------------------------------------------------------------------|



---

`medicos.js`
Responsável pelos **horários disponíveis** dos médicos.

| Função                 | Descrição                                                                       |
|------------------------|---------------------------------------------------------------------------------|
| **criarSlot**          | Médico cria um horário em `availability_slots`. Valida duplicação de data/hora. |
|------------------------|---------------------------------------------------------------------------------|
| **listarSlotsPublico** | Retorna horários disponíveis, com filtros por médico e data.                    |
|------------------------|---------------------------------------------------------------------------------|
| **deletarSlot**        | Médico remove seus próprios horários.                                           |
|------------------------|---------------------------------------------------------------------------------|
| **listarMeusSlots**    | Retorna todos os slots criados pelo médico autenticado.                         |
|------------------------|---------------------------------------------------------------------------------|
| **reativarSlot**       | Reabre um slot anteriormente cancelado.                                         |
|------------------------|---------------------------------------------------------------------------------|
| **atualizarSlot**      | Permite ao médico editar um slot existente.                                     |
|------------------------|---------------------------------------------------------------------------------|




---

`consultas.js`
Gerencia o **fluxo de consultas** entre paciente e médico.

| Função                 | Descrição                                                                       |
|------------------------|---------------------------------------------------------------------------------|
| **criarConsulta**      | Apenas pacientes autenticados com e-mail verificado.                            |
|------------------------|---------------------------------------------------------------------------------|
| **cancelarConsulta**   | Cancela uma consulta (sem excluir).                                             |
|------------------------|---------------------------------------------------------------------------------|
| **marcarComoConcluida**| Apenas o médico responsável pode executar, atualiza status para "concluida".    |
|------------------------|---------------------------------------------------------------------------------|
| **listarConsultas**    | Paciente → apenas as suas, Médico → apenas as suas, Admin → todas.              |
|------------------------|---------------------------------------------------------------------------------|
| **marcarComoRetorno**  | Apenas o médico responsável pode executar.                                      |
|------------------------|---------------------------------------------------------------------------------|
| **agendarRetorno**     | Agenda ou atualiza um retorno associado a uma consulta. Apenas 1 por consulta   |
|------------------------|---------------------------------------------------------------------------------|

---

`adminFunctions.js`
Módulo administrativo responsável por todas as ações restritas a administradores: listar usuários, atribuir papéis, adicionar/alterar especialidade, foto e valor de consulta particular do médico.

| Função             | Descrição                                                                          |
|--------------------|---------------------------------------------------------------------------------   |
| **listarUsuarios** | Lista todos os usuários cadastrados na coleção usuarios                            |
|--------------------|---------------------------------------------------------------------------------   |
| **definirRole**    | Atualiza o custom claim no Authentication e o campo role no Firestore              |
|--------------------|---------------------------------------------------------------------------------   |

---

`notificacoes.js`
Módulo central para envio de e-mails via **Nodemailer**.

| Função                                          | Descrição                                                                 |
|-------------------------------------------------|---------------------------------------------------------------------------|
| **sendVerificationEmail(user)**                 | Envia o e-mail de verificação de conta ao novo usuário                    |
|-------------------------------------------------|---------------------------------------------------------------------------|
| **sendPasswordResetEmail(email)**               | Envia e-mail de redefinição de senha com link gerado pelo Firebase        |
|-------------------------------------------------|---------------------------------------------------------------------------|
| **sendChangeEmail(uid, novoEmail)**             | Gerencia alteração de e-mail                                              |
|-------------------------------------------------|---------------------------------------------------------------------------|
| **sendPasswordChangedAlert(email)**             | Envia alerta de segurança confirmando que a senha foi alterada com sucesso|
|-------------------------------------------------|---------------------------------------------------------------------------|
| **sendPhoneChangedAlert(email, novoTelefone)**  | Envia aviso de que o telefone foi atualizado.                             |
|-------------------------------------------------|---------------------------------------------------------------------------|



**Variáveis de ambiente:**
```
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASS

```

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

# Papéis de Usuário (Qualquer usuário pode ver, atualizar os próprios dados e excluir a própria conta)

Papel	  Atribuição	                                     Permissões

patient	  Automático ao criar conta	                         Pode agendar, cancelar e acompanhar as próprias consultas
doctor	  Definido por um admin	                             Pode criar e gerenciar slots, ver perfil, atualizar dados
admin	  Definido no painel ou via função backend	         Pode listar e alterar roles

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

# Regras da Firestore (Banco de Dados)

**O app lê e grava dados conforme as Firestore Rules**

- Coleção usuarios

Leitura:

O próprio usuário pode ver seu perfil.

Admin pode ler qualquer perfil.

Qualquer usuário autenticado pode ver perfis de médicos.

Criação:

Apenas o próprio usuário pode criar seu documento.

O campo role não pode ser definido na criação.

Atualização:

Apenas o próprio usuário pode atualizar.

Não pode alterar o campo role.

Exclusão:

Apenas o próprio usuário pode excluir seu documento.

- Coleção availability_slots (horários disponíveis)

Leitura:

Qualquer usuário autenticado pode ler (pacientes precisam visualizar horários).

Criação:

Apenas médicos autenticados (role == "doctor") podem criar slots para si mesmos (medicoId == uid).

Atualização / Exclusão:

Apenas o médico dono do slot pode atualizar ou excluir.

- Coleção appointments (consultas)

Criação:

Apenas pacientes (role == "patient") podem criar consultas vinculadas ao próprio ID (pacienteId == uid).

Leitura:

Paciente, médico envolvido ou admin podem visualizar a consulta.

Atualização:

Paciente ou médico envolvidos podem atualizar status e horários,
mas não podem alterar os IDs (pacienteId, medicoId).

Exclusão (cancelamento):

Paciente ou médico envolvidos podem excluir a consulta.

- Regra Global de Admin

Usuários com role == "admin" podem ler, criar e atualizar qualquer documento em qualquer coleção.

Não podem deletar documentos.

**Resumo**

Controle rigoroso por função: cada papel (paciente, médico, admin) tem permissões distintas.

Integridade garantida: campos sensíveis como role, pacienteId e medicoId não podem ser alterados indevidamente.

Admin tem poderes amplos, mas sem permissão de exclusão. (Princípio do menor privilégio)

-------------------------------------------------------------------------------------------------------------------------------------------------

# Integração com o Front-end
O front-end React consome as funções via **Callable Functions**:

```js
const criarUsuario = httpsCallable(functions, "usuarios-criarUsuario");
await criarUsuario({ nome, cpf, telefone });
```

- As funções `sendVerificationEmail` e `sendAppointmentNotification` são disparadas automaticamente.
- Todas as telas (paciente, médico, admin) são carregadas de acordo com o `role` salvo nos *custom claims* do usuário.


# Licença e Créditos
Desenvolvido por **Pedro Miguel**, como parte do projeto acadêmico e operacional da  
**Clínica Dr. Roberto Nigro** — sistema de agendamento e gestão médica full-stack.  

© 2025 Clínica Dr. Roberto Nigro. Todos os direitos reservados.
