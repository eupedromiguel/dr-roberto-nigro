# Comandos do firebase no terminal

**Deployar**
(Leia /Comandos_Dev_Build_Deploy.md para fazer o build do front antes de deployar)

- Envio para produção:

firebase deploy                       |<- Deploy geral (Selecionar "N" na pargunta sobre o índice/index)

firebase deploy --only functions:core |<- Funções v2 (BackEnd Principal)

firebase deploy --only functions:auth |<- Funções v1 (AuthTrigger)

firebase deploy --only functions      |<- Firebase.json da pasta raiz chama de forma separada (sobe normalmente)

firebase deploy --only firestore      |<- (Somente rules)

firebase deploy --only hosting        |<- (Somente o front)
     
**Instalar dependências**
   - Instala dependências em cada pasta:

     npm install

LEMBRETES :

As funções OnCall precisam ser testadas junto com o front, pois o firebase espera isso.

_____________________________________________________________________________________________

MAS CASO QUEIRA USAR OS EMULADORES :

**Emuladores**
   - sobe os emuladores, executa os testes e encerra tudo automaticamente.:
     
     npm run test:emuladores

Quero deixar os emuladores rodando para testar manualmente
│
└──> Use: firebase emulators:start
     - Mantém rodando até você parar com CTRL + C
     - Ideal para: testar funções HTTP, abrir a UI do Firestore, brincar no console

Quero rodar testes ou um script e depois encerrar tudo sozinho
│
└──> Use: firebase emulators:exec "comando"
     - Sobe os emuladores, roda o comando e derruba no final
     - Ideal para: npm test, scripts automatizados, CI/CD