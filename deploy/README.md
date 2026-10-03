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

```bash
# Repositório privado: gere uma chave (ssh-keygen -t ed25519) e cadastre a .pub
# como Deploy key (somente leitura) no GitHub.
git clone git@github.com:mattbrios/brios3d_forge.git
cd brios3d_forge/deploy
cp .env.example .env && nano .env        # preencha domínios, senha do banco e admin
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
curl https://api.seudominio.com/health
```

O serviço `migrate` roda as migrations pendentes e termina. A API só sobe depois que ele termina sem erro.
O Caddy emite o certificado na primeira requisição, e para isso o DNS precisa estar propagado.

## 4. Atualizar

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

1. Crie um bucket S3 privado. Uma regra de lifecycle que apague objetos com mais de 30 dias controla o custo.
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
   crontab -e                              # e adicione:
   # 0 6 * * * /home/ubuntu/brios3d_forge/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1
   ```

Além disso, ative os **snapshots automáticos** da instância no Lightsail.

Para restaurar um dump:

```bash
gunzip -c backups/forge-<data>.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Restaure num banco vazio: suba só o `db` com um volume novo antes de subir a API.

## 7. Evitar surpresa na fatura

Em **Billing → Budgets**, crie um orçamento mensal de US$ 10 com alerta por e-mail em 80%.

## Comandos úteis

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```
