# ⚔️ Sombra do Arcanum — V10

Versão para **Vercel Hobby + Supabase Free**. Mantém a interface medieval V9, o editor de 20 atributos, foto de personagem, recursos vitais sem dados, biblioteca pública de **nomes e retratos**, e leitura/edição das fichas mediante senha.

## Funcionalidades

- Tela inicial com **Nova Ficha** e **Biblioteca**; toda ficha salva é fechada e selada.
- Dados D100 **somente nos atributos**: 200 pontos totais = 1d100. Recursos vitais contam apenas pontos numéricos.
- Sem classe = 1.600 pontos; com classe = 1.800 pontos. Níveis posteriores +250 por nível; XP alvo personalizável.
- Base gratuita: Vida 120; Estamina 50; Mana 50; Sanidade 100; Velocidade 50; Peso 50.
- Distribuição validada no navegador **e no servidor**; não é possível salvar pontos acima do limite.
- Senha criada na primeira gravação, protegida por `scrypt` com salt aleatório. Nunca é disponibilizada na biblioteca pública.
- Lista pública inclui **apenas `id`, `name` e `portrait`**. Os demais campos só são retornados após a verificação da senha pela função da Vercel.
- Fotos compactadas para JPEG e guardadas junto dos dados no Supabase (sem precisar criar um bucket separado).
- Registro de tentativas e bloqueio temporário de autenticação para dificultar adivinhação de senhas.

## Instalação — 1. Supabase

1. Abra https://supabase.com/dashboard e entre na sua conta.
2. Escolha **New project** e crie um projeto com nome `sombra-do-arcanum`.
3. Aguarde a criação e abra **SQL Editor → New query**.
4. Abra o arquivo [`supabase-schema.sql`](supabase-schema.sql) deste projeto, cole todo o conteúdo no editor e execute **Run**.
5. Vá em **Project Settings → API Keys** (ou em **Connect**, dependendo da versão do painel).
6. Guarde, para a etapa da Vercel, os dois valores seguintes:
   - **Project URL**: `https://SEU-PROJETO.supabase.co`
   - **Secret key**: uma chave que começa com `sb_secret_...` (ou a chave `service_role` antiga, se necessário).

**NUNCA** coloque a secret key no `index.html`, nos arquivos enviados ao GitHub, em `NEXT_PUBLIC_*` ou numa mensagem pública. Ela deve ficar exclusivamente nas variáveis privadas da Vercel.

O SQL habilita RLS e **não permite acesso direto por chave pública** às tabelas `arcanum_sheets` e `arcanum_rate_limits`. As funções de API com a chave secreta implementam a permissão por senha.

## Instalação — 2. GitHub

1. Abra https://github.com e crie o repositório `sombra-do-arcanum`.
2. Descompacte o ZIP V10 e envie **o conteúdo da pasta**, preservando a organização abaixo. `index.html`, `vercel.json` e `package.json` devem ficar na **raiz**, sem uma pasta extra:

```text
sombra-do-arcanum/
├── index.html
├── castelo-banner.jpg
├── cidade-medieval.jpg
├── cenario-medieval.svg
├── vercel.json
├── package.json
├── supabase-schema.sql
├── api/
│   ├── health.js
│   ├── sheets.js
│   └── sheets/
│       └── [id]/
│           ├── unlock.js
│           └── save.js
├── lib/
│   └── arcanum.js
└── README.md
```

No iPhone, é possível usar o Safari em **Solicitar Site para Computador**. Se não conseguir enviar pastas pelo GitHub móvel, use um computador para subir o ZIP descompactado ou um cliente Git que preserve os diretórios. **Subir o ZIP como um arquivo só não publica o site.**

## Instalação — 3. Vercel

1. Abra https://vercel.com/new, entre com a conta GitHub e importe `sombra-do-arcanum`.
2. Em **Framework Preset**, escolha **Other**; em **Root Directory**, deixe `./`.
3. Em **Environment Variables**, crie:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://SEU-PROJETO.supabase.co` |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` (sua chave **secreta**, não publicável) |

4. Marque essas duas variáveis para o ambiente **Production** (e Preview, se também for testar previews).
5. Pressione **Deploy** e aguarde o endereço `https://...vercel.app`.
6. Acesse `https://SEU-SITE.vercel.app/api/health`. O esperado é:

```json
{"service":"sombra-arcanum","version":10,"ready":true,"storage":"supabase"}
```

7. Acesse `https://SEU-SITE.vercel.app/api/sheets`. Inicialmente deve responder `[]`.
8. Abra a página principal e teste uma ficha: crie, salve, abra a Biblioteca, tente uma senha errada e a senha correta, altere e salve novamente.

Se `/api/health` mostrar `"ready":false`, confira **as duas variáveis de ambiente da Vercel** e faça um novo deploy. Se `/api/sheets` retornar erro, confira o SQL e a chave secreta.

> Nota: a publicação exige que você configure as suas contas Vercel e Supabase. Este ZIP é o **projeto pronto para publicar**, não um site já publicado.

## Segurança e funcionamento

- `GET /api/sheets`: somente nome, retrato e identificador de até 1.000 fichas.
- `POST /api/sheets`: valida e salva ficha e hash de senha.
- `POST /api/sheets/:id/unlock`: exige senha, retorna ficha completa apenas após validação.
- `POST /api/sheets/:id/save`: exige senha, valida pontos e atualiza ficha.
- `GET /api/health`: informa se o site recebeu as variáveis necessárias. Não exibe chaves.
- Na saída/salvamento a ficha é limpa do editor, e a senha deixa de ser mantida pela aplicação.
- As respostas de API são `no-store`. Os endpoints não foram programados para aceitar acesso anônimo a fichas completas.
- Recomendamos não utilizar nomes, retratos ou dados pessoais sensíveis se não desejar que a comunidade os veja.
- Sem recuperação automática de senha: guarde-a com segurança. Caso esqueça, a ficha não pode ser reaberta pelo aplicativo. Um administrador do Supabase poderá recuperar dados diretamente no banco, pois controla a infraestrutura.

## Limitações gratuitas

O plano Hobby da Vercel destina-se a uso pessoal/não comercial e tem limites. O Supabase gratuito possui limites de banco de dados, requisições e inatividade; projetos podem ser pausados. Fichas e imagens não são gravadas no disco temporário da Vercel, mas sim no Supabase. Não há garantia de disponibilidade contínua em planos gratuitos.

As fotos são gravadas como JPEG-base64 na tabela. Esse formato simplifica a instalação, mas consome mais banco de dados que usar Supabase Storage. Para comunidades muito grandes, migrar fotos para Storage é aconselhável.

## Demonstração offline e dados anteriores

O `sombra_do_arcanum_v10_demo.html` separado é um protótipo **local**. Fichas criadas nele não aparecerão no site hospedado.

Dados de instalações anteriores (V6–V9) **não são importados automaticamente** para o Supabase. Se você já tem fichas publicadas em outra base, não apague a base antiga antes de planejar uma migração.

## Testes incluídos

Com Node.js 20+ instalado execute `npm test`. Testes automáticos cobrem regras de pontos, criação, listagem sem informações privadas, senhas incorretas, desbloqueio, edição, distribuição inválida e limite de tentativas (com banco REST simulado). Não substituem um teste final usando as suas contas reais Vercel e Supabase.
