# Plano de Monitoramento e Proteção do Firebase com Cloudflare

Este documento organiza, em formato de checklist e passos práticos, a configuração de monitoramento, segurança e proteção contra abusos no Firebase com uso da Cloudflare como firewall e camada de proteção externa.

---

## Checklist Geral de Segurança

| Nível          | Ação                          |
|----------------|-------------------------------|
| Borda          | Cloudflare ativo              |
| WAF            | Regras contra bots e floods   |
| Hosting        | Headers de segurança          |
| Backend        | Rate-limit                    |
| Firebase       | Regras de segurança           |
| Auth           | Acesso bloqueado sem login    |
| Monitoramento  | Alertas de custo              |

### Regra de ouro

Cloudflare + Rate limit + Autenticação obrigatória = proteção real.

---

## Criar conta na Cloudflare

Acesse:

https://cloudflare.com

1. Crie uma conta
2. Clique em **Add a site**
3. Informe seu domínio
4. Escolha o plano

Plano recomendado:
- **Free** é suficiente para começar

---

## Alterar DNS para Cloudflare

A Cloudflare exibirá algo como:

ns1.cloudflare.com
ns2.cloudflare.com


Agora, vá no site onde comprou seu domínio e:

1. Localize "Nameservers"
2. Substitua os antigos pelos da Cloudflare
3. Salve

### Observação
A propagação pode levar:
- Geralmente: 10 minutos  
- Em alguns casos: até 1 hora

---

## Apontar o domínio para o Firebase Hosting

### No Firebase Console

1. Vá em **Hosting**
2. Clique em **Add custom domain**
3. Digite o domínio

O Firebase solicitará:

CNAME → ghs.googlehosted.com


### Na Cloudflare (DNS)

Crie os seguintes registros:

| Tipo  | Nome | Destino              |
|-------|------|----------------------|
| CNAME | @    | ghs.googlehosted.com |
| CNAME | www  | ghs.googlehosted.com |

---

## Ativar proxy da Cloudflare

Na Cloudflare → DNS:

Verifique se a nuvem está:

Laranja ligada


Isso significa:

Cloudflare está protegendo o Firebase Hosting.

---

## Ativar DDoS, Firewall e Bot Protection

### Cloudflare → Security → Settings

Ativar:

- Bot Fight Mode
- Browser Integrity Check

---

## Criar regras de firewall

Acesse:

Cloudflare → Firewall → Rules → Create rule


---

### Regra 1 — Bloquear acessos fora do Brasil

**Condição**

Country NOT IN "BR"


**Ação**

JS Challenge


---

### Regra 2 — Rate-limit por IP

**Condição**

Requests > 20 em 10 segundos por IP


**Ação**


Block


---

### Regra 3 — Bloquear ferramentas automatizadas

**Condição**


User-Agent contains "curl"
OR "python"
OR "wget"


**Ação**


Block


---

### Regra 4 — Challenge em requisições POST

**Condição**


http.request.method eq "POST"
AND NOT cf.client.bot


**Ação**


Managed Challenge


---

## 9. Testar se está funcionando

Abra no navegador:



https://seusite.com/cdn-cgi/trace


Se aparecer algo como:



cf-ray=


Resultado:
Cloudflare está ativo e protegendo seu domínio.

---

## 10. Resultado Final

### Antes

- Firebase exposto
- Sem firewall
- Bots acessam direto
- Risco de custo elevado
- Backend vulnerável

### Depois

- Firebase protegido
- Cloudflare filtrando ataques
- Firewall global
- Bots bloqueados
- Requisições controladas
- Custo monitorado

---

## Conclusão

Com essa configuração:

- Ataques são filtrados antes de chegar no Firebase
- Bots não consomem seu projeto
- Accessos suspeitos são bloqueados
- Custos são monitorados
- Infraestrutura preparada para crescer com segurança

---