#!/usr/bin/env bash
# Corre as guardas do CI TAL COMO O CI as corre, extraindo-as do próprio
# workflow em vez de as reescrever à mão.
#
# Existe porque a publicação falhou uma vez com `KeyError: 'slug'` numa guarda
# que eu tinha acabado de testar «localmente» — só que a versão local era uma
# cópia adaptada por mim, já com a correcção, e a do CI não. Uma segunda versão
# da verdade envelhece sozinha, e este é o género de erro que só aparece com o
# site já parado.
set -e
cd "$(dirname "$0")/.."
BASE=/AMMA_Creative SITE=https://renatovalente5.github.io/AMMA_Creative node scripts/gerar.mjs
python3 - <<'PY'
import re, io, subprocess, sys
y = io.open('.github/workflows/publicar.yml', encoding='utf-8').read()
blocos = re.findall(r"python3 - <<'PY'\n(.*?)\n\s*PY\n", y, re.S)
print(f'\n{len(blocos)} guardas no workflow:\n')
falhou = False
for i, b in enumerate(blocos, 1):
    ls = b.split('\n')
    ind = min((len(l) - len(l.lstrip()) for l in ls if l.strip()), default=0)
    r = subprocess.run(['python3', '-c', '\n'.join(l[ind:] for l in ls)],
                       capture_output=True, text=True)
    if r.returncode: falhou = True
    saida = (r.stdout + r.stderr).strip().splitlines()
    print(f'  {"ok   " if not r.returncode else "FALHA"} {i}: {saida[-1] if saida else "(sem saída)"}')
    if r.returncode:
        for l in saida[-8:]: print(f'         {l}')
sys.exit(1 if falhou else 0)
PY
