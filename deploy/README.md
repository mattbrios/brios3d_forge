# Deploy da API + banco (AWS Lightsail)

Uma máquina só, com Postgres, API e Caddy (HTTPS) via Docker Compose. Custo de ~US$ 5–7/mês.
O `web/` vai para a Vercel (grátis).

```
Vercel (app.seudominio.com) ──https──▶ Caddy :443 ──▶ api:3001 ──▶ db:5432 (só rede interna)
```

## 1. Criar a máquina

1. No [Lightsail](https://lightsail.aws.amazon.com/), crie uma instância **Linux/Unix → OS Only → Ubuntu 24.04**,
   plano com **1 GB de RAM** ou mais (o build do Nest com 512 MB fica apertado).
2. Em **Networking**, crie um **IP estático** e anexe à instância.
3. No firewall IPv4 da instância, deixe abertas só as portas **22, 80 e 443**.
4. No DNS do seu domínio, crie um registro `A` de `api.seudominio.com` apontando para o IP estático.
   No Cloudflare, deixe o proxy **desligado** (nuvem cinza, "DNS only"): o Caddy emite o certificado
   sozinho, e o proxy limita uploads a 100 MB. Se ligar depois, use SSL/TLS **Full (strict)**
   (com "Flexible" o site entra em loop de redirecionamento).

## 2. Preparar o servidor

```bash
ssh ubuntu@<IP>

# Swap de 2 GB (evita falta de memória no build)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit   # reconecte depois
```

## 3. Subir

O repositório é privado, então o servidor precisa de uma **Deploy key** (sem ela o clone falha com
`Permission denied (publickey)`):

```bash
ssh-keygen -t ed25519 -C "brios3d-forge-server" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub     # só a linha "ssh-ed25519 AAAA... brios3d-forge-server"
```

Cadastre essa linha em **GitHub → repositório → Settings → Deploy keys → Add deploy key**, com
"Allow write access" desmarcado. Depois, sem `sudo` e a partir de `~`:

```bash
ssh -T git@github.com         # deve responder "Hi mattbrios/brios3d_forge!"
git clone git@github.com:mattbrios/brios3d_forge.git
cd brios3d_forge/deploy
cp .env.example .env && nano .env        # preencha domínios, senha do banco e admin (mín. 12 caracteres)
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl https://api.seudominio.com/health
```

O serviço `migrate` roda as migrations pendentes e termina. A API só sobe depois que ele termina sem erro.
O Caddy emite o certificado na primeira requisição, e para isso o DNS precisa estar propagado.

Se aparecer `dependency api failed to start`, a API não ficou saudável. Veja o motivo em
`docker compose -f docker-compose.prod.yml logs --tail=80 api` (e `logs migrate`). Causas comuns:

- `ADMIN_PASSWORD` com menos de 12 caracteres: a API recusa subir. Corrija o `.env` e rode `up -d` de novo.
- `password authentication failed`: a `DB_PASSWORD` mudou depois do primeiro `up`. O Postgres só lê a
  senha ao criar o volume; volte a senha antiga ou, se ainda não há dados, `down -v` e suba de novo.

## 4. Atualizar

Cada push na `main` publica a API sozinho, depois que o job `api` do CI passa (job `deploy` em
`.github/workflows/ci.yml`). O job entra no servidor por SSH, avança a `main` até o commit testado
(`git merge --ff-only`) e roda `up -d --build --wait`; as migrations rodam no serviço `migrate` antes
da API nova subir. Acompanhe em **GitHub → Actions**.

Uma migration que apaga dados roda em produção no push: faça backup (`./backup.sh`) antes.

### Configurar o deploy automático (uma vez)

1. Na sua máquina, gere uma chave só para o GitHub Actions (fora do repositório ou numa pasta ignorada):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ./forge_deploy -N ""
   cat ./forge_deploy.pub
   ```
2. No servidor, acrescente a linha da `.pub` ao `authorized_keys`. Use `>>`: `>` apaga a chave de acesso da AWS.
   ```bash
   echo ssh-ed25519 AAAA... github-actions-deploy >> ~/.ssh/authorized_keys
   ```
3. Teste da sua máquina e pegue a identidade do servidor:
   ```bash
   ssh -i ./forge_deploy ubuntu@<IP> 'echo ok'
   ssh-keyscan -t ed25519 <IP>      # a linha "<IP> ssh-ed25519 AAAA..." (ignore as que começam com #)
   ```
   Para conferir que a identidade é a verdadeira, compare o `SHA256:` de
   `ssh-keyscan -t ed25519 <IP> 2>/dev/null | ssh-keygen -lf -` com o de
   `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` rodado no servidor.
4. Em **GitHub → repositório → Settings → Secrets and variables → Actions → New repository secret**:

   | Secret | Valor |
   | --- | --- |
   | `DEPLOY_HOST` | o IP estático |
   | `DEPLOY_USER` | `ubuntu` |
   | `DEPLOY_SSH_KEY` | o conteúdo inteiro de `forge_deploy` (`pbcopy < forge_deploy`), do `-----BEGIN` ao `-----END` |
   | `DEPLOY_KNOWN_HOSTS` | a linha do `ssh-keyscan` |

5. Apague `forge_deploy*` da sua máquina, ou guarde fora do git. Nunca commite a chave privada.

O servidor precisa estar na `main` sem alterações locais (`git status` limpo); senão o merge falha e
o deploy para sem mexer em nada.

### Atualizar à mão

```bash
cd ~/brios3d_forge && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f
```

## 5. Web na Vercel

Importe o repositório com **Root Directory = `web`** e defina `NEXT_PUBLIC_API_URL=https://api.seudominio.com`
(a variável é lida no build: mudou, faça redeploy). Adicione o domínio `app.seudominio.com` ao projeto.

Web e API **precisam do mesmo domínio pai**: o cookie de sessão é `SameSite=Lax` e não é enviado
de `*.vercel.app` para outro domínio.

## 6. Backup

1. Crie um bucket S3 privado. Para controlar o custo, abra o bucket e vá na aba **Management** →
   **Lifecycle rules → Create lifecycle rule**: prefixo `forge/`, ação **Expire current versions of objects**,
   `30` dias.
2. Crie um usuário IAM só com esta política e gere uma access key:
   ```json
   { "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": "s3:PutObject",
     "Resource": "arn:aws:s3:::seu-bucket/forge/*" }] }
   ```
3. No servidor:
   ```bash
   sudo snap install aws-cli --classic
   aws configure                           # a access key acima, região do bucket
   ./backup.sh                             # teste manual
   crontab -e                              # e adicione as duas linhas abaixo
   ```
   ```
   PATH=/snap/bin:/usr/local/bin:/usr/bin:/bin
   0 6 * * * /home/ubuntu/brios3d_forge/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1
   ```
   A linha `PATH` é necessária: o cron não enxerga `/snap/bin`, e sem ela o envio para o S3 falha com
   `aws: command not found`. O horário é UTC (06:00 = 03:00 em Brasília). Confira com `crontab -l`.

Além disso, ative os **snapshots automáticos** da instância no Lightsail.

Para testar um dump sem tocar no banco de produção, restaure num banco separado. Troque o nome do
arquivo pelo real (`ls -lh backups/`):

```bash
docker compose -f docker-compose.prod.yml exec db sh -c 'createdb -U "$POSTGRES_USER" forge_restore_test'
gunzip -c backups/forge-20261003T060000Z.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d forge_restore_test'
docker compose -f docker-compose.prod.yml exec db sh -c 'psql -U "$POSTGRES_USER" -d forge_restore_test -c "\dt"'
docker compose -f docker-compose.prod.yml exec db sh -c 'dropdb -U "$POSTGRES_USER" forge_restore_test'
```

Nunca restaure sobre o banco `forge` com dados: o dump recria tabelas e insere linhas, e só funciona num
banco vazio. Num restore de verdade, suba só o `db` com um volume novo e restaure com
`-d "$POSTGRES_DB"` antes de subir a API.

## 7. Evitar surpresa na fatura

Em **Billing and Cost Management → Budgets and Planning → Budgets** (ou busque "Budgets" no console),
crie um orçamento mensal de US$ 10 (**Monthly cost budget**) e ajuste o alerta por e-mail para 80%.
Com usuário IAM a página fica bloqueada: entre como root ou ative **IAM user and role access to Billing
information** em **Account**.

## Comandos úteis

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```
