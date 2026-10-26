#!/bin/bash
# Cria o login do DONO do GIRON (abre o Painel do Dono). Se o login de dono ja existir, so troca a senha.
# A senha e digitada escondida e vai direto pra VPS (nao fica em arquivo nem no historico).
# Uso (no Terminal, na pasta do projeto): ./scripts/criar-dono.sh teste
set -euo pipefail
AMB="${1:?informe o ambiente: teste ou producao}"
read -rp "E-mail do dono [girongestao@gmail.com]: " EMAIL
EMAIL="${EMAIL:-girongestao@gmail.com}"
read -rsp "Crie uma senha (minimo 8 letras/numeros; nao aparece enquanto digita): " S1; echo
read -rsp "Repita a senha: " S2; echo
[ "$S1" = "$S2" ] || { echo "As duas senhas nao batem. Rode de novo."; exit 1; }
[ ${#S1} -ge 8 ] || { echo "Senha curta demais (minimo 8). Rode de novo."; exit 1; }

REMOTO=$(cat <<'FIM'
set -euo pipefail
PY=$(cat <<'PYFIM'
import json, sys, urllib.request, subprocess
amb = sys.argv[1]
email, senha = sys.stdin.readline().strip(), sys.stdin.readline().rstrip('\n')
db = ['docker', 'exec', '-i', f'giron-{amb}-db', 'psql', '-U', 'postgres', '-tA', '-v', f'e={email}']
achou = subprocess.run(db, input="select a.id || '|' || coalesce(u.papel::text, '') from auth.users a left join public.usuarios u on u.id = a.id where lower(a.email) = lower(:'e');\n",
                       capture_output=True, text=True, check=True).stdout.strip()
uid, papel = achou.split('|') if achou else ('', '')
if uid and papel not in ('', 'dono_giron'):
    sys.exit('Esse e-mail ja e login de uma financeira. Use outro e-mail pro dono.')
chave = next(l.split('=', 1)[1].strip() for l in open(f'/opt/giron/supabase-{amb}/.env') if l.startswith('SERVICE_ROLE_KEY='))
porta = subprocess.check_output(['docker', 'port', f'giron-{amb}-api-gw', '8000/tcp'], text=True).strip().rsplit(':', 1)[1]
base = f'http://127.0.0.1:{porta}/auth/v1/admin/users'
cab = {'apikey': chave, 'Authorization': f'Bearer {chave}', 'Content-Type': 'application/json'}
def pedir(url, metodo, corpo):
    return json.load(urllib.request.urlopen(urllib.request.Request(url, method=metodo, headers=cab, data=json.dumps(corpo).encode())))
if uid:
    pedir(f'{base}/{uid}', 'PUT', {'password': senha, 'email_confirm': True})
else:
    uid = pedir(base, 'POST', {'email': email, 'password': senha, 'email_confirm': True})['id']
subprocess.run(db[:-2] + ['-v', 'ON_ERROR_STOP=1', '-q', '-v', f'id={uid}'], check=True, text=True,
               input="insert into public.usuarios (id, tenant_id, papel, nome) values (:'id', null, 'dono_giron', 'Dono do GIRON') on conflict (id) do nothing;\n")
print('Pronto: login do dono criado (ou senha trocada).')
PYFIM
)
python3 -c "$PY" "$AMB"
FIM
)
printf '%s\n%s\n' "$EMAIL" "$S1" | ssh giron-vps "AMB=$AMB bash -c $(printf '%q' "$REMOTO")"
echo "Agora entre em https://teste.gironga.com.br com $EMAIL e essa senha."
