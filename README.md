# HEMOTE Vencimentos

Sistema de controle de vencimento de hemocomponentes para a rede de agências transfusionais do HEMOTE.

## Stack

- **Next.js 14** com App Router e TypeScript
- **NextAuth.js** + Azure AD (Entra ID) para autenticação OIDC
- **Turso** (SQLite serverless) + **Drizzle ORM**
- **Google Drive API v3** para leitura de planilhas Excel por agência
- **SheetJS** para parsing dos relatórios `.xls/.xlsx`
- **Microsoft Teams Webhooks** para notificações
- **Vercel Cron Jobs** para rotina diária às 10h BRT (13h UTC)

---

## Pré-requisitos

- Node.js 18+
- Conta Vercel (plano Hobby ou superior)
- Conta Turso (gratuita)
- Azure AD / Microsoft Entra ID com permissão para registrar aplicativos
- Google Cloud com acesso ao Google Drive API
- Canal no Microsoft Teams para webhooks

---

## 1. Clone e instalação

```bash
git clone https://github.com/seu-usuario/hemote-vencimentos.git
cd hemote-vencimentos
npm install
cp .env.example .env.local
```

---

## 2. Azure AD — Autenticação OIDC

1. Acesse [portal.azure.com](https://portal.azure.com)
2. Vá em **Azure Active Directory → App registrations → New registration**
3. Nome: `HEMOTE Vencimentos`
4. Supported account types: *Accounts in this organizational directory only*
5. Redirect URI: `https://seu-dominio.vercel.app/api/auth/callback/azure-ad`
   - Para desenvolvimento local, adicione também: `http://localhost:3000/api/auth/callback/azure-ad`
6. Após criar, vá em **Certificates & secrets → New client secret**
   - Copie o **Value** (não o ID) imediatamente — só aparece uma vez
7. Anote:
   - **Application (client) ID** → `AZURE_AD_CLIENT_ID`
   - **Directory (tenant) ID** → `AZURE_AD_TENANT_ID`
   - **Client secret value** → `AZURE_AD_CLIENT_SECRET`

---

## 3. Turso — Banco de Dados

1. Instale a CLI: `npm install -g @turso/cli`
2. Faça login: `turso auth login`
3. Crie o banco:
   ```bash
   turso db create hemote-vencimentos
   turso db show hemote-vencimentos
   # Anote a URL (libsql://...)
   ```
4. Crie o token:
   ```bash
   turso db tokens create hemote-vencimentos
   # Anote o token
   ```
5. Preencha no `.env.local`:
   ```
   TURSO_DATABASE_URL=libsql://hemote-vencimentos-<usuario>.turso.io
   TURSO_AUTH_TOKEN=<token>
   ```

---

## 4. Google Cloud — Service Account para Drive

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ex: `hemote-vencimentos`)
3. Habilite a **Google Drive API**:
   - APIs & Services → Library → pesquise "Google Drive API" → Enable
4. Crie uma Service Account:
   - APIs & Services → Credentials → Create Credentials → Service Account
   - Nome: `hemote-vencimentos`
   - Clique em Create and Continue (sem roles obrigatórias)
5. Gere uma chave JSON:
   - Clique na service account criada → Keys → Add Key → JSON
   - Faça download do arquivo JSON
6. Extraia do JSON:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
7. **Para cada agência**, compartilhe a pasta do Google Drive com o email da Service Account (apenas visualização)
8. Anote o ID de cada pasta (está na URL: `drive.google.com/drive/folders/<ID>`)
9. Após o seed, atualize `google_drive_folder_id` no banco para cada agência

---

## 5. Microsoft Teams — Webhook de Notificações

1. No Teams, abra o canal desejado
2. Clique nos `...` do canal → **Connectors**
3. Procure **Incoming Webhook** → Configure
4. Nome: `HEMOTE Vencimentos`, faça upload do logo se quiser
5. Clique em **Create** e copie a URL
6. Cole em `TEAMS_WEBHOOK_URL`

---

## 6. Configuração do `.env.local`

```env
NEXTAUTH_URL=https://seu-dominio.vercel.app
NEXTAUTH_SECRET=<openssl rand -base64 32>

AZURE_AD_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_SECRET=<client secret>
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

TURSO_DATABASE_URL=libsql://hemote-vencimentos-<usuario>.turso.io
TURSO_AUTH_TOKEN=<token>

GOOGLE_SERVICE_ACCOUNT_EMAIL=hemote-vencimentos@<projeto>.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...

CRON_SECRET=<openssl rand -base64 32>

ADMIN_EMAIL=administradora@hemote.gov.br
TZ=America/Sao_Paulo
```

---

## 7. Banco de Dados — Migração e Seed

```bash
# Gera as migrations
npm run db:generate

# Aplica no banco (Turso)
npm run db:push

# Popula as agências e lideranças
npm run seed

# Para explorar o banco via UI
npm run db:studio
```

Após o seed, você deve atualizar o campo `google_drive_folder_id` de cada agência.
Use o **Drizzle Studio** (`npm run db:studio`) ou execute diretamente via CLI do Turso:

```sql
UPDATE agencias SET google_drive_folder_id = 'ID_DA_PASTA' WHERE codigo = 'HUSC';
-- repita para cada agência
```

---

## 8. Deploy na Vercel

1. Conecte o repositório no [vercel.com](https://vercel.com)
2. Adicione todas as variáveis de ambiente de `.env.local` em **Settings → Environment Variables**
3. O arquivo `vercel.json` já configura o cron para 13h UTC (10h BRT):
   ```json
   { "crons": [{ "path": "/api/cron/processar-vencimentos", "schedule": "0 13 * * *" }] }
   ```
4. A Vercel chama o endpoint com o header `Authorization: Bearer <CRON_SECRET>`
5. **Atenção:** Cron Jobs no plano Hobby da Vercel têm limite de 60 segundos por execução.
   Para 25 agências com muitas bolsas, recomenda-se o plano **Pro** (até 300 segundos).

---

## 9. Estrutura de Pastas

```
hemote-vencimentos/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          — Tela de login Microsoft
│   │   └── solicitar-acesso/       — Formulário de solicitação
│   ├── (dashboard)/
│   │   ├── layout.tsx              — Header + nav autenticado
│   │   ├── dashboard/
│   │   │   ├── page.tsx            — Server component (dados)
│   │   │   └── DashboardView.tsx   — Client component (UI interativa)
│   │   └── admin/
│   │       ├── page.tsx            — Painel admin
│   │       └── aprovacoes/
│   │           ├── page.tsx        — Lista de pendentes
│   │           └── AprovacaoList.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── access-request/route.ts
│   │   ├── bolsas/route.ts
│   │   ├── admin/
│   │   │   ├── aprovar/[id]/route.ts
│   │   │   └── rejeitar/[id]/route.ts
│   │   └── cron/processar-vencimentos/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── lib/
│   ├── auth.ts                     — Configuração NextAuth
│   ├── db/
│   │   ├── index.ts                — Cliente Drizzle/Turso
│   │   └── schema.ts               — Tabelas do banco
│   ├── google-drive.ts             — Listagem e download via API
│   ├── sheets-parser.ts            — Parsing dos .xls/.xlsx do HEMOTE
│   ├── teams-webhook.ts            — Notificações Teams
│   └── whatsapp-message.ts         — Gerador de mensagem para redistribuição
├── scripts/
│   └── seed.ts                     — Popula as 25 agências
├── types/index.ts                  — Tipos globais
├── drizzle.config.ts
├── vercel.json
└── .env.example
```

---

## 10. Fluxo de Uso

### Acesso inicial
1. Usuário acessa o sistema e clica "Entrar com conta Microsoft"
2. Se não tem cadastro → redirecionado para `/solicitar-acesso`
3. Preenche nome, agência e justificativa
4. Administradora recebe notificação no Teams com link para `/admin/aprovacoes`
5. Administradora aprova com perfil (admin/liderança/viewer)
6. Usuário recebe notificação e acessa normalmente

### Cron diário (10h BRT)
1. Vercel chama `GET /api/cron/processar-vencimentos`
2. Para cada agência com `google_drive_folder_id` configurado:
   - Lista arquivos Excel na pasta do Drive
   - Baixa o mais recente
   - Parseia (cabeçalho na linha com "Instituição", colunas: 0=Instituição, 1=Doação, 3=Componente, 5=Validade, 11=ABO, 12=Fator Rh)
   - Classifica urgência: vencido/hoje/amanhã/3dias/ok
   - Salva no Turso
3. Notifica Teams sobre agências sem arquivo
4. Notifica Teams sobre agências com bolsas críticas

### Dashboard
- Cards por agência com contagem por urgência
- Clique em uma agência → tabela detalhada de bolsas
- Filtro por urgência
- Botão "📱 WhatsApp" → gera mensagem formatada para redistribuição

---

## 11. Perfis de Acesso

| Perfil | Dashboard | Admin |
|--------|-----------|-------|
| `viewer` | ✅ Todas as agências | ❌ |
| `lideranca` | ✅ Todas as agências | ❌ |
| `admin` | ✅ Todas as agências | ✅ |

---

## Suporte

Em caso de dúvidas ou problemas, abra uma issue no repositório ou contate o time de TI do HEMOTE.
