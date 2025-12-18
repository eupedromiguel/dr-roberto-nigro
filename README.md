# README -- Clínica Dr. Roberto Nigro

Sistema completo de agendamento médico, desenvolvido com **Firebase**,
**React** e **Vite**.

Este repositório documenta a arquitetura do backend (Cloud Functions),
integrações com o Firebase, regras de segurança, papéis de usuário e
módulos principais da plataforma.\

## Visão Geral

Plataforma full-stack de agendamento médico com:
- Autenticação segura (email, telefone, claims)
- Cloud Functions v1 e v2
- Regras rígidas de negócio e segurança
- Auditoria completa de ações sensíveis
- Front-end React com rotas protegidas por papel


**Integração com Firebase** 

- Cloud Functions (BackEnd)
- Cloud Firestore (Banco de dados orientado a documentos)
- Hosting 
- Storage (Armazenamento)
- Authentication (email/senha + telefone)

**Tecnologias Utilizadas**

Ponto Importante: Atualmente, os triggers de autenticação do Firebase são suportados apenas por Cloud Functions de 1ª Geração. Deve-se usar a sintaxe e as bibliotecas da 1ª Geração para esses triggers específicos. 
Embora o Firebase esteja avançando para a 2ª Geração, você pode ter funções de 1ª e 2ª Geração coexistindo no mesmo projeto. 

* Cloud Functions v2 (HTTPS OnCall) southamerica-east1

- Node.js 22.19.0
- Firebase Functions v6.6.0
- Firebase Admin v13.5.0
- Nodemailer 7.0.10

* Cloud Functions v1 (AuthTriggers) us-central1

- Node.js 20 
- Firebase Functions v4.8.0
- Firebase Admin v12.0.0  
- Nodemailer 7.0.10 

**Estrutura**

``` txt
firebase-app/
├── functions/                 # Funções v2 (Node 22)
│   ├── index.js               # Entrypoint das v2
│   ├── package.json
│   ├── handlers/              # Lógica de domínio
│   │   ├── usuarios.js
│   │   ├── medicos.js
│   │   ├── consultas.js
│   │   ├── admin.js
│   │   └── notificacoes.js
│
├── authTriggers/              # Funções v1 (Node 20)
│   ├── index.js               # Entrypoint das v1
│   ├── notificacoes.js        # Trigger onUserCreated
│   ├── package.json
│   ├── firebaseAdmin.js
│
├── consultorio-web/           # Front-end (React)
└── firestore.rules            # Regras de segurança
```

-------------------------------------------------------------------------------------------------------------------------------

# Funções prontas e testadas :

**Funções v1**
Funções de **1ª Geração (Node 20)** para eventos do Authentication.

`authTriggers/`

| Trigger            | Descrição                                                      |
|--------------------|----------------------------------------------------------------|                                                 
| **onUserCreated**  | Cria documento `usuarios/{uid}` e envia e-mail de verificação. | 
| **onUserDeleted**  | Remove os dados vinculados ao usuário e gera log com IP.       |

-------------------------------------------------------------------------------------------------------------------------------

**Funções v2**
Funções de **2ª Geração (Node 22)** para eventos OnCall.

Funções chamadas diretamente do frontend. Automaticamente verificam autenticação e validam Custom Claims.

**Namespaces implementados:**
- `usuarios.*` - Gerenciamento de usuários
- `consultas.*` - Fluxo de agendamentos
- `medicos.*` - Disponibilidade e slots
- `admin.*` - Operações administrativas
- `notificacoes.*` - Envio de emails
- `health.ping` - Monitoramento

**Como chamar do frontend:**
```js
const criarUsuario = httpsCallable(functions, "usuarios-criarUsuario");
const resultado = await criarUsuario({ nome, cpf, telefone });
```

**Firestore Triggers**
Funções assíncronas disparadas por mudanças no banco de dados.

**Triggers implementados:**
- `logAppointmentStatus` - Monitora mudanças de status em `appointments/{id}`

---

**Estrutura de Namespaces**

As funções são organizadas em grupos lógicos (domínios):

```
functions/
├── index.js                    # Entrypoint + setGlobalOptions
└── handlers/
    ├── usuarios.js             → exports.usuarios.*
    ├── consultas.js            → exports.consultas.*
    ├── medicos.js              → exports.medicos.*
    ├── adminFunctions.js       → exports.admin.*
    ├── notificacoes.js         → exports.notificacoes.*
    └── relatorios.js           → exports.logAppointmentStatus
```

**Vantagens:**
- Organização clara por domínio
- Facilita manutenção e escalabilidade
- Permite controle granular de permissões

---

**Handlers Implementados**

`usuarios.js`
Gerencia o ciclo de vida completo dos usuários.

| Função               | Descrição                                                                                     |
|----------------------|-----------------------------------------------------------------------------------------------|
| **criarUsuario**     | Cria documento no Firestore (`usuarios/{uid}`) e verifica duplicações (e-mail, CPF, telefone) |
| **atualizarUsuario** | Usuário pode atualizar seus dados pessoais, exceto o campo `role`                             |
| **deletarUsuario**   | Remove usuário do Auth e do Firestore.                                                        |
| **validarDuplicatas**| Verificação de duplicidade usada antes do registro (sem precisar estar autenticado).          |
| **meuPerfil**        | Retorna os dados do perfil do usuário autenticado.                                            |

---

`medicos.js`
Responsável pelos **horários disponíveis** dos médicos.

| Função                 | Descrição                                                                       |
|------------------------|---------------------------------------------------------------------------------|
| **criarSlot**          | Médico cria um horário em `availability_slots`. Valida duplicação de data/hora. |
| **listarSlotsPublico** | Retorna horários disponíveis, com filtros por médico e data.                    |
| **deletarSlot**        | Médico remove seus próprios horários.                                           |
| **listarMeusSlots**    | Retorna todos os slots criados pelo médico autenticado.                         |
| **reativarSlot**       | Reabre um slot anteriormente cancelado.                                         |
| **atualizarSlot**      | Permite ao médico editar um slot existente.                                     |

---

`consultas.js`
Gerencia o **fluxo de consultas** entre paciente e médico.

| Função                 | Descrição                                                                       |
|------------------------|---------------------------------------------------------------------------------|
| **criarConsulta**      | Apenas pacientes autenticados com e-mail verificado.                            |
| **cancelarConsulta**   | Cancela uma consulta (sem excluir).                                             |
| **marcarComoConcluida**| Apenas o médico responsável pode executar, atualiza status para "concluida".    |
| **listarConsultas**    | Paciente → apenas as suas, Médico → apenas as suas, Admin → todas.              |
| **marcarComoRetorno**  | Apenas o médico responsável pode executar.                                      |
| **agendarRetorno**     | Agenda ou atualiza um retorno associado a uma consulta. Apenas 1 por consulta   |

---

`adminFunctions.js`
Módulo administrativo responsável por todas as ações restritas a administradores.

| Função               | Descrição                                                                          |
|----------------------|------------------------------------------------------------------------------------|
| **listarUsuarios**   | Lista todos os usuários cadastrados na coleção usuarios                            |
| **definirRole**      | Atualiza o custom claim no Authentication e o campo role no Firestore              |
| **removerUsuario**   | Remove usuário do Authentication e Firestore (apenas admins)                       |

**Observação importante:**
- `removerUsuario` é diferente de `deletarUsuario` (do handler `usuarios.js`)
- `removerUsuario`: admin remove **qualquer usuário**
- `deletarUsuario`: usuário remove **a própria conta**

---

`relatorios.js`
Sistema automático de relatórios mensais via **Firestore Trigger**.

# Relatórios Administrativos

Os relatórios registram:
- Quem marcou a consulta como concluída (`doctor` ou `admin`)
- Quem cancelou a consulta (`patient`, `doctor` ou `admin`)
- Data de criação original da consulta
- Indicação se a consulta foi concluída com retorno associado

| Trigger                   | Tipo                     | Descrição                                                                 |
|---------------------------|--------------------------|---------------------------------------------------------------------------|
| **logAppointmentStatus**  | onDocumentUpdated        | Monitora mudanças em `appointments/{id}` e grava relatórios mensais       |

**Como funciona:**
1. Dispara automaticamente quando uma consulta muda de status
2. Se `status = "concluida"` → grava em `relatorios/appointments_done/{YYYY_MM}/{consultaId}`
3. Se `status = "cancelada"` → grava em `relatorios/appointments_canceled/{YYYY_MM}/{consultaId}`
4. Organiza por ano/mês para facilitar análises e dashboards

**Campos gravados (concluída):**
- `idConsulta`, `medicoId`, `pacienteId`
- `dataConsulta`, `especialidade`, `valor`
- `status: "concluida"`
- `concludedBy` (quem concluiu)
- `appointmentOriginalCreatedAt`, `createdAt`

**Campos gravados (cancelada):**
- `idConsulta`, `medicoId`, `pacienteId`
- `dataConsulta`, `motivo` (cancelReason)
- `status: "cancelada"`
- `canceledBy` (patient | doctor | admin)
- `appointmentOriginalCreatedAt`, `createdAt`

**Estrutura no Firestore:**
```
relatorios/
├── appointments_done/
│   ├── 2025_01/
│   │   └── {consultaId}
│   ├── 2025_02/
│   │   └── {consultaId}
│   └── 2025_03/
│       └── {consultaId}
└── appointments_canceled/
    ├── 2025_01/
    │   └── {consultaId}
    ├── 2025_02/
    │   └── {consultaId}
    └── 2025_03/
        └── {consultaId}
```

**Consultar relatórios (exemplo):**
```js
// Buscar todas as consultas concluídas em janeiro/2025
const snapshot = await db
  .collection('relatorios')
  .doc('appointments_done')
  .collection('2025_01')
  .get();

const consultas = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));

// Calcular total faturado no mês
const totalFaturado = consultas.reduce((sum, c) => sum + (c.valor || 0), 0);
```

---

`notificacoes.js`
Módulo central para envio de e-mails via **Nodemailer**.

| Função                                          | Descrição                                                                 |
|-------------------------------------------------|---------------------------------------------------------------------------|
| **sendVerificationEmail(user)**                 | Envia o e-mail de verificação de conta ao novo usuário                    |
| **sendPasswordResetEmail(email)**               | Envia e-mail de redefinição de senha com link gerado pelo Firebase        |
| **sendChangeEmail(uid, novoEmail)**             | Gerencia alteração de e-mail                                              |
| **sendPasswordChangedAlert(email)**             | Envia alerta de segurança confirmando que a senha foi alterada com sucesso|
| **sendPhoneChangedAlert(email, novoTelefone)**  | Envia aviso de que o telefone foi atualizado.                             |

**Variáveis de ambiente (secrets):**

```bash
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASS
```

**Observação:** Essas funções são chamadas internamente por outras Cloud Functions. Não são expostas diretamente ao frontend.

---

`health.ping`
Função de monitoramento para validar se as Cloud Functions estão operacionais.

| Função   | Descrição                                                    |
|----------|--------------------------------------------------------------|
| **ping** | Retorna `{ ok: true, ts: timestamp }` se o backend está ativo |

**Uso:**
```js
const ping = httpsCallable(functions, "health-ping");
const { data } = await ping();
console.log(data); // { ok: true, ts: 1704825600000 }
```

**Útil para:**
- Monitoramento de disponibilidade
- Testes de integração
- Validar deploy bem-sucedido
- Health checks em sistemas de CI/CD

-------------------------------------------------------------------------------------------------------------------------------

# Variáveis de ambiente:

``` bash
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASS
```

-------------------------------------------------------------------------------------------------------------------------------

# Papéis de Usuário (Qualquer usuário pode ver, atualizar os próprios dados e excluir a própria conta)


| Papel       | Atribuição                               | Permissões                                                               |
|-------------|------------------------------------------|--------------------------------------------------------------------------|
| **patient** | Automático ao criar conta                | Pode agendar, cancelar e acompanhar as próprias consultas                |
| **doctor**  | Definido por um admin                    | Pode criar, gerenciar slots, cancelar e acompanhar as próprias consultas |
| **admin**   | Definido no painel ou via função backend | Lista, altera roles, gerencia todos os slots, médicos e convênios        |


-------------------------------------------------------------------------------------------------------------------------------

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

# Segurança e Compliance

**Exclusão de Conta e Auditoria**

Quando um usuário exclui sua própria conta pela página **Meu Perfil**, o sistema:

1. Remove o usuário do Firebase Authentication
2. Remove o documento correspondente em `usuarios/{uid}`
3. Gera automaticamente um log de auditoria em `/logs_delecoes`

* Dados registrados no log
Cada exclusão gera um documento contendo:

- `email` do usuário
- `uid` (ID do usuário)
- `deletedAt` (data e hora da exclusão)
- `ip` de origem da requisição

* Objetivo
- Auditoria e rastreabilidade de ações sensíveis
- Análise de incidentes e segurança
- Conformidade com boas práticas de proteção de dados

# Segurança da Conta do Usuário

## Alteração de E-mail
- Ao solicitar mudança de e-mail:
  - Um aviso de segurança é enviado para o e-mail antigo
  - Um link de confirmação é enviado para o novo e-mail
- A alteração só é efetivada após o clique no link de confirmação
- O novo e-mail é automaticamente atualizado no Authentication e no Firestore

## Alteração de Telefone
- A troca de telefone exige confirmação por **código SMS**
- O telefone só é atualizado após validação do código

## Alertas de Segurança
Qualquer alteração sensível dispara automaticamente:
- E-mail informativo ao usuário
- Dicas de segurança para proteger a conta



-------------------------------------------------------------------------------------------------------------------------------

# Front-End com React + Vite

## Integração
O front-end React consome as funções via **Callable Functions**:

```js
const criarUsuario = httpsCallable(functions, "usuarios-criarUsuario");
await criarUsuario({ nome, cpf, telefone });
```

- As funções `sendVerificationEmail` e `sendAppointmentNotification` são disparadas automaticamente.
- Todas as telas (paciente, médico, admin) são carregadas de acordo com o `role` salvo nos *custom claims* do usuário.

-------------------------------------------------------------------------------------------------------------------------------

### Tecnologias Principais

| Categoria                   | Tecnologias                               |
|-----------------------------|-------------------------------------------|
| **Framework**               | React e DOM 19.1.1, Vite 7.1.10           |
| **UI / Estilo**             | Tailwind v4, Framer Motion, Lucide Icons  |
| **Gerenciamento de Estado** | React Context + Hooks personalizados      |

# Autenticação e Papéis

Cada usuário possui um **papel (role)** definido no Firebase Auth via *Custom Claims*:
- `patient` → agendar, ver e cancelar consultas.
- `doctor` → criar slots, confirmar, remarcar ou cancelar consultas.
- `admin` → acessar todos os dados e o painel administrativo.

Esses papéis são carregados no front via `AuthContext` e determinam o acesso às rotas.

---

## Regras de Rotas e Proteção de Acesso

O app usa **React Router DOM** e componentes de proteção para garantir que cada papel veja apenas o permitido.

## ProtectedRoute
Bloqueio de acesso a rotas privadas (Perfil/Marcar consulta/Minhas consultas) se o usuário não estiver autenticado.

## AdminRoute
Permite acesso apenas a administradores.

## DoctorRoute
Restringe acesso apenas a médicos.

## Design e Experiência
- Layout responsivo (mobile-first, Tailwind)
- Animações com Framer Motion
- Skeleton loaders e modais dinâmicos
- Ícones: Lucide Icons

## Boas Práticas Implementadas
- Rotas protegidas por papel e autenticação.  
- Layouts responsivos e reutilizáveis.    
- Comunicação segura com Cloud Functions.  
- Três camadas de segurança: *Firestore Rules + Claims + Rotas Protegidas*.

-------------------------------------------------------------------------------------------------------------------------------

# Fluxo do Paciente

## Criação de Conta
- Cadastro exige verificação por **código SMS de 6 dígitos**
- Após o cadastro, um **gatilho automático** envia e-mail de verificação
- O acesso à página de agendamento só é liberado após a confirmação do e-mail

### Regras de Negócio da Clínica

- Apenas **1 consulta por horário**
- Apenas **1 consulta por médico no mesmo horário**
- Um retorno só pode ser agendado após a consulta original ser concluída
- Caso exista um retorno em andamento, novos agendamentos são bloqueados

### Agendamento de Consultas

O paciente pode:
- Visualizar horários disponíveis por médico (dia e hora)
- Ver informações do médico:
  - Nome
  - Foto
  - Especialidade
- Agendar consultas
- Acompanhar o status das consultas
- Cancelar consultas já agendadas

-------------------------------------------------------------------------------------------------------------------------------

# Login

## Recuperação de Senha
- A funcionalidade **"Esqueci minha senha"** envia corretamente o e-mail de redefinição
- O link é gerado pelo Firebase Authentication
- Processo seguro e compatível com boas práticas


-------------------------------------------------------------------------------------------------------------------------------

## Decisões de Arquitetura

- Uso de Cloud Functions v1 apenas onde necessário (Auth Triggers)
- Cloud Functions v2 para melhor escalabilidade e performance
- Regras críticas de negócio implementadas no backend
- Front-end atua apenas como consumidor das regras

# Licença e Créditos

Desenvolvido por **Pedro Miguel**

> Este projeto foi desenvolvido com foco acadêmico e operacional,
> aplicando práticas utilizadas em sistemas reais de produção.


© 2025 Clínica Dr. Roberto Nigro. Todos os direitos reservados.
