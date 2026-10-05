#!/usr/bin/env node
/* A BATERIA DA GUARDA DO CONTEÚDO E DO CI DO SITE.
 *
 * Corre em local, NÃO no CI: afirma coisas sobre os dados de HOJE, e um artigo
 * mal preenchido pela dona não pode parar a publicação por causa de um teste
 * (como a da LR Motors, de onde vem o molde).
 *
 *     node .github/test-guardas.mjs             tudo (alguns minutos)
 *     node .github/test-guardas.mjs --rapido    sem a publicação de ponta a ponta
 *
 * A publicação de ponta a ponta precisa de um python3 com Pillow — no Mac, o
 * /usr/bin/python3 tem; PYTHON=<outro> para escolher — e de APFS: cada caso
 * corre num clone do repositório (cp -c), que não ocupa disco e onde ficam as
 * cópias das fotografias e os cartões de partilha. O repositório não se toca.
 *
 * O que prova:
 *   · regras.mjs é ES module puro (corre no browser e no Worker do painel);
 *   · os dados de hoje passam sem nada que pare, sem nada neutralizado e sem
 *     avisos, e os lembretes são exactamente os que os dados pedem; os
 *     ficheiros saem do serializar() byte a byte, cada um com a sua terminação;
 *   · re-jogar TODOS os commits que mexeram em data/: os que teriam parado a
 *     publicação listam-se, com a razão, e são os esperados;
 *   · cada regra com um caso e a classe certa — e os casos em que a regra diz
 *     «sim»; uma chave, uma classe (o Worker do painel compara só as chaves);
 *   · o varrimento: apagar cada chave de cada artigo e do definicoes.json dá
 *     o problema certo, com o ecrã nomeado, ou nada se o campo é opcional;
 *   · na consola, nenhum dado abre um comando do runner; no resumo da corrida
 *     (público, em Markdown), nenhum dado fica fora do código;
 *   · a cópia que o gerador lê muda só o que tem de mudar, e nada sem nada;
 *   · A PUBLICAÇÃO DE PONTA A PONTA: dados estragados de propósito, e os passos
 *     do publicar.yml corridos TAL COMO ESTÃO ESCRITOS (o run: extraído, nunca
 *     reescrito — memória correr-a-guarda-verdadeira), pela ordem do ficheiro.
 *     Ou a guarda pára e diz porquê, ou a publicação vai até ao fim: nunca pára
 *     mais à frente sem explicação, e o gerador nunca deixa cair uma
 *     fotografia que a guarda deu por boa;
 *   · o publicar.yml: a guarda antes de tudo o que lê os dados, e nenhum passo
 *     grava no repositório (a cópia neutralizada nunca lá chega);
 *   · --neutralizar recusa-se a escrever no próprio repositório fora do CI;
 *   · as regras do site e a cópia do painel são o mesmo ficheiro. */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, existsSync, statSync, realpathSync, symlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir, availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as R from './regras.mjs';
import * as G from './guardas.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARDA = join(RAIZ, '.github', 'guardas.mjs');
const YAML = readFileSync(join(RAIZ, '.github', 'workflows', 'publicar.yml'), 'utf8');
const TMP = realpathSync(mkdtempSync(join(tmpdir(), 'amma-guardas-')));
const RAPIDO = process.argv.includes('--rapido');
const PY = process.env.PYTHON || '/usr/bin/python3';

let passou = 0; let falhou = 0;
const certo = (c, d, extra = '') => {
  if (c) { passou++; console.log(`  ✓ ${d}`); } else { falhou++; console.log(`  ✗ ${d}${extra ? `  — ${String(extra).slice(0, 1500)}` : ''}`); }
  return c;
};
const secao = (t) => console.log(`\n— ${t}`);
const clonar = (x) => JSON.parse(JSON.stringify(x));
const correr = (cmd, args, opcoes = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opcoes, env: { ...process.env, GITHUB_STEP_SUMMARY: '', GITHUB_ACTIONS: '', ...(opcoes.env || {}) } });
  return { status: r.status, out: r.stdout || '', err: r.stderr || '' };
};
const git = (...a) => execFileSync('git', ['-C', RAIZ, ...a], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

/* Os dados de hoje, como a guarda os lê (texto), e lidos (objectos). */
const { dados: TEXTO } = G.lerDados(RAIZ);
const HOJE = {
  definicoes: JSON.parse(TEXTO.definicoes),
  categorias: JSON.parse(TEXTO.categorias),
  artigos: Object.fromEntries(Object.entries(TEXTO.artigos).map(([k, v]) => [k, JSON.parse(v)])),
};
const LISTAR = G.listarPastaEm(RAIZ);
const OP = { listarPasta: LISTAR };
const tem = (lista, classe, chave) => lista.some((p) => p.classe === classe && (chave instanceof RegExp ? chave.test(p.chave) : p.chave === chave));
const deClasse = (lista, classe) => lista.filter((p) => p.classe === classe);
const avisos = (lista) => lista.filter((p) => p.classe === 'avisa' && !p.lembrete);
const lembretes = (lista) => lista.filter((p) => p.lembrete);
/* Os dados de hoje, mudados: mudar(d) mexe em d.artigos[<nome>] (objecto, ou
   texto para um ficheiro que não se lê), d.definicoes, d.categorias. */
const com = (mudar) => { const d = clonar(HOJE); mudar(d); return d; };
const problemasCom = (mudar) => R.problemas(com(mudar), OP);
const novos = (lista) => { const hoje = new Set(R.problemas(TEXTO, OP).map((p) => p.chave)); return lista.filter((p) => !hoje.has(p.chave)); };

const S = 'sweat-love';             // fotografias na pasta de outro artigo (sweat-mae)
const C = 'colar-essenza';          // fotografias soltas na raiz da biblioteca (do Pages CMS)
const B = 'box-anuncio-gravidez';   // a fotografia da página inicial
const art = (nome, mudar) => (d) => mudar(d.artigos[nome], d);
const def = (mudar) => (d) => mudar(d.definicoes, d);
const PRIMEIRA = HOJE.artigos[S].fotos[0];
const PRIMEIRA_C = HOJE.artigos[C].fotos[0];
const semExt = (c) => c.replace(/^\/+/, '').replace(/-(?:480|960|1600)\.webp$/i, '').replace(/\.[a-z0-9]+$/i, '');

/* OS COMMITS QUE TERIAM PARADO A PUBLICAÇÃO, revistos um a um (4 out 2026):
   cada um é um dado que, no site de hoje, partia o gerador ou a lei.
   · 7cd200c, 28 ago 2026: «Dados da loja» gravados no Pages CMS com a morada
     em branco — o Pages CMS apagou as chaves e o site foi publicado sem a
     morada que o DL 7/2004 pede. Foi o que deu origem à verificação do
     gerador (OBRIGATORIOS em scripts/gerar.mjs). */
const ESPERADOS_NO_HISTORICO = {
  '7cd200c': ['definicoes:local.morada', 'definicoes:local.codigo_postal', 'definicoes:local.localidade', 'definicoes:local.concelho'],
};

/* ================================================================== */
secao('as regras são um ES module puro');
{
  const fonte = readFileSync(join(RAIZ, '.github', 'regras.mjs'), 'utf8');
  certo(!/^\s*import[\s{*]/m.test(fonte) && !/\bimport\s*\(/.test(fonte), 'regras.mjs não importa nada');
  certo(!/\brequire\s*\(|\bprocess\.|['"]node:|\bBuffer\b|__dirname|import\.meta/.test(fonte), 'nem require, process, node:*, Buffer, __dirname ou import.meta (corre tal e qual no browser e num Worker)');
  certo(![...fonte].some((ch) => { const c = ch.codePointAt(0); return (c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 0x7f || c === 0x2028 || c === 0x2029 || c === 0xfeff; }), 'nenhum carácter de controlo literal no código (memória bytes-de-controlo-no-codigo)');
}

/* ================================================================== */
secao('os dados de hoje');
{
  const lista = R.problemas(TEXTO, OP);
  certo(deClasse(lista, 'bloqueia').length === 0, 'nada pára a publicação', deClasse(lista, 'bloqueia').map((p) => p.chave).join(', '));
  certo(deClasse(lista, 'neutraliza').length === 0, 'nada muda no site', deClasse(lista, 'neutraliza').map((p) => p.chave).join(', '));
  certo(avisos(lista).length === 0, 'nenhum aviso', avisos(lista).map((p) => `${p.chave}: ${p.mensagem}`).join(' | '));
  const esperados = ['definicoes:empresa.nif:espera', 'definicoes:empresa.denominacao_social:espera', 'definicoes:local.codigo_postal:formato'];
  const vistos = lembretes(lista).map((p) => p.chave).sort();
  certo(JSON.stringify(vistos) === JSON.stringify([...esperados].sort()), `os lembretes são os ${esperados.length} que os dados pedem (o NIF de espera, a titular «a confirmar», o código postal incompleto)`, vistos.join(', '));
  let iguais = 0; const diferentes = [];
  for (const [rel, t] of [[R.FICHEIROS.definicoes, TEXTO.definicoes], [R.FICHEIROS.categorias, TEXTO.categorias], ...Object.entries(TEXTO.artigos).map(([n, t2]) => [R.ficheiroDoArtigo(n), t2])]) {
    if (R.serializar(JSON.parse(t), R.terminacaoDe(t)) === t) iguais++; else diferentes.push(rel);
  }
  certo(diferentes.length === 0, `os ${iguais} ficheiros de data/ saem do serializar() byte a byte, cada um com a sua terminação`, diferentes.join(', '));
  const semFim = Object.values(TEXTO.artigos).filter((t) => !t.endsWith('\n')).length;
  certo(semFim > 0 && TEXTO.definicoes.endsWith('\n'), `as duas terminações existem nos dados (${semFim} artigos sem \\n no fim; o definicoes.json com)`);
  const g = correr('node', [GUARDA]);
  certo(g.status === 0 && /0 que param, 0 que mudam o site \(0 artigo\(s\)\), 0 avisos, 3 lembretes/.test(g.out), 'a guarda, como programa, no repositório: sai com 0, e diz o mesmo', g.out.slice(-300) + g.err);
}

/* ================================================================== */
secao('re-jogar os commits de data/');
{
  certo(git('rev-parse', '--is-shallow-repository').trim() === 'false', 'o histórico está inteiro (um clone raso não prova nada)');
  /* Um commit lido como a guarda o leria: os JSON pela árvore do commit, e as
     pastas da biblioteca pela árvore também (ficheiros e pastas, como o
     readdirSync que o gerador usa). */
  const lerBlobs = (ids) => {
    if (!ids.length) return new Map();
    const r = spawnSync('git', ['-C', RAIZ, 'cat-file', '--batch'], { input: ids.join('\n') + '\n', maxBuffer: 512 * 1024 * 1024 });
    const out = r.stdout; const m = new Map(); let i = 0;
    for (const id of ids) {
      const nl = out.indexOf(0x0a, i);
      const tam = Number(out.subarray(i, nl).toString().split(' ')[2]);
      m.set(id, out.subarray(nl + 1, nl + 1 + tam).toString('utf8'));
      i = nl + 1 + tam + 1;
    }
    return m;
  };
  const noCommit = (c) => {
    const entradas = git('ls-tree', '-r', '-z', c, '--', 'data/').split('\0').filter(Boolean).map((l) => { const [cab, caminho] = l.split('\t'); return { id: cab.split(' ')[2], caminho }; });
    const blobs = lerBlobs(entradas.map((e) => e.id));
    const dados = { artigos: Object.create(null), definicoes: null, categorias: null };
    for (const { id, caminho } of entradas) {
      if (caminho === R.FICHEIROS.definicoes) dados.definicoes = blobs.get(id);
      else if (caminho === R.FICHEIROS.categorias) dados.categorias = blobs.get(id);
      else if (/^data\/produtos\/[^/]+\.json$/.test(caminho)) dados.artigos[caminho.split('/').pop().slice(0, -5)] = blobs.get(id);
    }
    const pastas = new Map();
    for (const caminho of git('ls-tree', '-r', '-t', '-z', '--name-only', c, '--', 'assets/produtos').split('\0').filter(Boolean)) {
      const pai = caminho.slice(0, caminho.lastIndexOf('/'));
      if (!pastas.has(pai)) pastas.set(pai, []);
      pastas.get(pai).push(caminho.slice(caminho.lastIndexOf('/') + 1));
    }
    return { dados, listarPasta: (p) => pastas.get(p) || [] };
  };
  const commits = git('log', '--format=%H %h', '--reverse', '--', 'data/').trim().split('\n').map((l) => l.split(' '));
  const pararam = new Map(); let comNeutralizados = 0;
  for (const [c, h] of commits) {
    const { dados, listarPasta } = noCommit(c);
    const lista = R.problemas(dados, { listarPasta });
    const b = deClasse(lista, 'bloqueia');
    const efeitos = R.neutralizar(dados, lista).efeitos;
    const msg = git('log', '-1', '--format=%ad %an: %s', '--date=short', c).trim();
    if (b.length) pararam.set(h, b.map((p) => p.chave));
    if (efeitos.length) comNeutralizados++;
    console.log(`    · ${h} ${msg.slice(0, 80)} — ${b.length ? `PARAVA: ${b.map((p) => `${p.ecra}: ${p.mensagem}`).join(' | ').slice(0, 300)}` : 'publicava'} (${Object.keys(dados.artigos).length} artigos; ${efeitos.length ? `mudavam no site: ${efeitos.map((e) => `${e.nome} — ${R.descreverEfeitos(e)}`).join('; ').slice(0, 300)}` : 'nada neutralizado'}; ${avisos(lista).length} avisos, ${lembretes(lista).length} lembretes)`);
  }
  certo(commits.length >= 80, `${commits.length} commits re-jogados (todos os que mexeram em data/, desde o primeiro)`);
  /* OS QUE PARAVAM, e porquê — revistos um a um a 4 out 2026. */
  const ESPERADOS = new Map(Object.entries(ESPERADOS_NO_HISTORICO));  // ver no topo
  const a = [...pararam.entries()].map(([h, k]) => `${h}: ${k.join(', ')}`).sort();
  const e = [...ESPERADOS.entries()].map(([h, k]) => `${h}: ${k.join(', ')}`).sort();
  certo(JSON.stringify(a) === JSON.stringify(e), `os commits que teriam parado a publicação são os ${ESPERADOS.size} esperados${comNeutralizados ? ` (em ${comNeutralizados} algum artigo mudava no site — ver a lista)` : ''}`, `vistos: ${a.join(' · ') || 'nenhum'} — esperados: ${e.join(' · ') || 'nenhum'}`);
  {
    /* A mesma máquina tem de saber dizer «pára». */
    const [c] = commits.at(-1);
    const { dados, listarPasta } = noCommit(c);
    const d = JSON.parse(dados.definicoes); delete d.contactos.whatsapp;
    certo(tem(R.problemas({ ...dados, definicoes: R.serializar(d, '\n') }, { listarPasta }), 'bloqueia', 'definicoes:contactos.whatsapp'), '   e a mesma máquina diz «pára» quando é caso disso (o último commit, sem o WhatsApp)');
  }
}

/* ================================================================== */
secao('cada regra, com a classe certa');
{
  const fotosDeHoje = [...new Set(Object.values(HOJE.artigos).flatMap((a) => a.fotos || []))];
  const CASOS = [
    // [descrição, mudar(dados), classe, chave (texto ou RegExp), efeito?, lembrete?]
    ['artigo sem nome', art(S, (a) => { delete a.nome; }), 'neutraliza', `artigo:${S}:nome`, 'esconder'],
    ['nome que é um número', art(S, (a) => { a.nome = 7; }), 'neutraliza', `artigo:${S}:nome`, 'esconder'],
    ['nome vazio', art(S, (a) => { a.nome = ''; }), 'neutraliza', `artigo:${S}:nome`, 'esconder'],
    ['nome só com espaços', art(S, (a) => { a.nome = '   '; }), 'neutraliza', `artigo:${S}:nome`, 'esconder'],
    ['sem texto', art(S, (a) => { delete a.texto; }), 'neutraliza', `artigo:${S}:texto`, 'esconder'],
    ['texto que é uma lista', art(S, (a) => { a.texto = ['a']; }), 'neutraliza', `artigo:${S}:texto`, 'esconder'],
    ['sem frase curta', art(S, (a) => { a.resumo = ''; }), 'neutraliza', `artigo:${S}:resumo`, 'esconder'],
    ['sem categoria', art(S, (a) => { delete a.categoria; }), 'neutraliza', `artigo:${S}:categoria`, 'esconder'],
    ['categoria que não existe', art(S, (a) => { a.categoria = 'nao-existe'; }), 'neutraliza', `artigo:${S}:categoria`, 'esconder'],
    ['categoria com um espaço à frente (o gerador compara tal e qual)', art(S, (a) => { a.categoria = ` ${a.categoria}`; }), 'neutraliza', `artigo:${S}:categoria`, 'esconder'],
    ['«</script>» no texto', art(S, (a) => { a.texto += ' </script><script>alert(1)</script>'; }), 'neutraliza', `artigo:${S}:partia-a-pagina`, 'esconder'],
    ['«<!--» no nome', art(S, (a) => { a.nome = 'Sweat <!-- x'; }), 'neutraliza', `artigo:${S}:partia-a-pagina`, 'esconder'],
    ['«</SCRIPT» na frase curta', art(S, (a) => { a.resumo = 'a </SCRIPT b'; }), 'neutraliza', `artigo:${S}:partia-a-pagina`, 'esconder'],
    ['fotografia que já não existe', art(S, (a) => { a.fotos.push('assets/produtos/sweat-mae/APAGADA.jpg'); }), 'neutraliza', `artigo:${S}:foto-em-falta:assets/produtos/sweat-mae/APAGADA`, 'sem_fotografia'],
    ['fotografia numa pasta que não existe', art(S, (a) => { a.fotos.push('assets/produtos/nao-existe/x.jpg'); }), 'neutraliza', `artigo:${S}:foto-em-falta:assets/produtos/nao-existe/x`, 'sem_fotografia'],
    ['fotografia «dentro» de um ficheiro', art(S, (a) => { a.fotos.push(`${PRIMEIRA_C}/x.jpg`); }), 'neutraliza', `artigo:${S}:foto-em-falta:${PRIMEIRA_C}/x`, 'sem_fotografia'],
    ['fotografia fora da biblioteca', art(S, (a) => { a.fotos.push('assets/img/logo-marrom.png'); }), 'neutraliza', `artigo:${S}:foto-invalida:assets/img/logo-marrom.png`, 'sem_fotografia'],
    ['o cartão de partilha de outro artigo (og.jpg)', art(S, (a) => { a.fotos.unshift('assets/produtos/tshirt-pai/og.jpg'); }), 'neutraliza', `artigo:${S}:foto-invalida:assets/produtos/tshirt-pai/og.jpg`, 'sem_fotografia'],
    ['fotografia com «..»', art(S, (a) => { a.fotos.push('assets/produtos/../img/logo-marrom.png'); }), 'neutraliza', `artigo:${S}:foto-invalida:assets/produtos/../img/logo-marrom.png`, 'sem_fotografia'],
    ['fotografia de outro site', art(S, (a) => { a.fotos.push('https://exemplo.pt/a.jpg'); }), 'neutraliza', `artigo:${S}:foto-invalida:https://exemplo.pt/a.jpg`, 'sem_fotografia'],
    ['fotografia com «#» no nome', art(S, (a) => { a.fotos.push('assets/produtos/a#b.jpg'); }), 'neutraliza', `artigo:${S}:foto-invalida:assets/produtos/a#b.jpg`, 'sem_fotografia'],
    ['fotografia com um espaço à frente (o gerador não a acha)', art(S, (a) => { a.fotos[0] = ` ${a.fotos[0]}`; }), 'neutraliza', `artigo:${S}:foto-invalida: ${PRIMEIRA}`, 'sem_fotografia'],
    ['fotografia .gif', art(S, (a) => { a.fotos.push('assets/produtos/a.gif'); }), 'neutraliza', `artigo:${S}:foto-invalida:assets/produtos/a.gif`, 'sem_fotografia'],
    ['fotografia que não é texto', art(S, (a) => { a.fotos.push(null); }), 'neutraliza', `artigo:${S}:foto-invalida:null`, 'sem_fotografia'],
    ['um original que a preparação salta («-480.jpg»)', art(S, (a) => { a.fotos.push('assets/produtos/foto-480.jpg'); }), 'neutraliza', `artigo:${S}:foto-em-falta:assets/produtos/foto-480`, 'sem_fotografia'],
    ['um «logo….png» que está na biblioteca (a preparação salta-o)', art(S, (a) => { a.fotos.push('assets/produtos/logo-caixa.png'); }), 'neutraliza', `artigo:${S}:foto-em-falta:assets/produtos/logo-caixa`, 'sem_fotografia'],
    ['a mesma fotografia duas vezes', art(S, (a) => { a.fotos.push(a.fotos[0]); }), 'avisa', `artigo:${S}:foto-repetida:${semExt(PRIMEIRA)}`],
    ['o original e uma cópia dele', art(S, (a) => { a.fotos.push(a.fotos[0].replace(/\.[a-z]+$/i, '-960.webp')); }), 'avisa', `artigo:${S}:foto-repetida:${semExt(PRIMEIRA)}`],
    ['17 fotografias', art(S, (a) => { a.fotos = fotosDeHoje.slice(0, 17); }), 'avisa', `artigo:${S}:fotos-a-mais`],
    ['fotografias que não são uma lista', art(S, (a) => { a.fotos = a.fotos[0]; }), 'avisa', `artigo:${S}:fotos`],
    ['ocasião que não existe', art(S, (a) => { a.ocasioes = ['nao-existe']; }), 'avisa', `artigo:${S}:ocasioes`],
    ['ocasiões num texto', art(S, (a) => { a.ocasioes = 'presente'; }), 'avisa', `artigo:${S}:ocasioes`],
    ['ocasião «constructor»', art(S, (a) => { a.ocasioes = ['constructor']; }), 'avisa', `artigo:${S}:ocasioes`],
    ['«Publicado» escrito como texto', art(S, (a) => { a.publicado = 'false'; }), 'avisa', `artigo:${S}:publicado`],
    ['«Mostrar na página inicial» como número', art(S, (a) => { a.destaque = 1; }), 'avisa', `artigo:${S}:destaque`],
    ['preço com vírgula, num texto', art(S, (a) => { a.preco = '18,50'; }), 'avisa', `artigo:${S}:preco`],
    ['preço com três casas', art(S, (a) => { a.preco = 18.555; }), 'avisa', `artigo:${S}:preco`],
    ['preço negativo', art(S, (a) => { a.preco = -1; }), 'avisa', `artigo:${S}:preco`],
    ['posição com casas decimais', art(S, (a) => { a.ordem = 1.5; }), 'avisa', `artigo:${S}:ordem`],
    ['nome com 200 caracteres', art(S, (a) => { a.nome = 'x'.repeat(200); }), 'avisa', `artigo:${S}:nome:tamanho`],
    ['nome com uma mudança de linha', art(S, (a) => { a.nome = 'Sweat\nLOVE'; }), 'avisa', `artigo:${S}:nome:controlo`],
    ['texto com um NUL', art(S, (a) => { a.texto = 'a\u0000b'; }), 'avisa', `artigo:${S}:texto:controlo`],
    ['«O que se personaliza» num texto', art(S, (a) => { a.personalizavel = 'O nome do bebé'; }), 'avisa', `artigo:${S}:personalizavel`],
    ['«O que se personaliza» com 31 linhas', art(S, (a) => { a.personalizavel = Array.from({ length: 31 }, (_, i) => `l${i}`); }), 'avisa', `artigo:${S}:personalizavel:quantos`],
    ['«O que se personaliza» com um número', art(S, (a) => { a.personalizavel = [5]; }), 'avisa', `artigo:${S}:personalizavel:texto`],
    ['publicado sem fotografias', art(S, (a) => { a.fotos = []; }), 'avisa', `artigo:${S}:sem-fotos`, undefined, true],
    ['despublicado sem texto: o problema diz-se na mesma (o painel não grava artigos incompletos, como o Pages CMS)', art(S, (a) => { delete a.texto; a.publicado = false; }), 'neutraliza', `artigo:${S}:texto`, 'esconder'],
    ['um artigo que não se lê', (d) => { d.artigos[S] = '{ "nome": '; }, 'bloqueia', `artigo:${S}:ilegivel`],
    ['um artigo que é uma lista', (d) => { d.artigos[S] = '[]'; }, 'bloqueia', `artigo:${S}:forma`],
    ['um ficheiro chamado «.json»', (d) => { d.artigos[''] = TEXTO.artigos[S]; }, 'bloqueia', 'artigo::endereco-vazio'],
    ['um nome de ficheiro com maiúsculas e espaços', (d) => { d.artigos['Teste Ç'] = TEXTO.artigos[S]; }, 'avisa', 'artigo:Teste Ç:endereco'],
    ['um artigo de 60 KB', art(S, (a) => { a.texto = 'x'.repeat(5000); a.resumo = 'y'.repeat(56 * 1024); }), 'avisa', `artigo:${S}:tecto`, undefined, true],
    ['sem WhatsApp', def((x) => { delete x.contactos.whatsapp; }), 'bloqueia', 'definicoes:contactos.whatsapp'],
    ['WhatsApp sem o 351', def((x) => { x.contactos.whatsapp = x.contactos.whatsapp.slice(3); }), 'bloqueia', 'definicoes:contactos.whatsapp'],
    ['WhatsApp com espaços', def((x) => { x.contactos.whatsapp = '351 930 477 114'; }), 'bloqueia', 'definicoes:contactos.whatsapp'],
    ['WhatsApp de um fixo', def((x) => { x.contactos.whatsapp = '351253000000'; }), 'bloqueia', 'definicoes:contactos.whatsapp'],
    ['sem Instagram', def((x) => { delete x.contactos.instagram; }), 'avisa', 'definicoes:contactos.instagram'],
    ['Instagram sem https', def((x) => { x.contactos.instagram = 'http://instagram.com/x'; }), 'avisa', 'definicoes:contactos.instagram'],
    ['email que não é email', def((x) => { x.contactos.email = 'isto não é email'; }), 'avisa', 'definicoes:contactos.email'],
    ['telefone fixo (o site diz «rede móvel»)', def((x) => { x.contactos.telefone = '253000000'; x.contactos.telefone_texto = '253 000 000'; }), 'avisa', 'definicoes:contactos.telefone'],
    ['telefone sem o «como aparece»', def((x) => { x.contactos.telefone = '930477114'; delete x.contactos.telefone_texto; }), 'avisa', 'definicoes:contactos.telefone_texto'],
    ['telefone e «como aparece» diferentes', def((x) => { x.contactos.telefone = '930477114'; x.contactos.telefone_texto = '930 477 115'; }), 'avisa', 'definicoes:contactos.telefone_texto'],
    ['sem a rua da sede', def((x) => { delete x.local.morada; }), 'bloqueia', 'definicoes:local.morada'],
    ['código postal vazio', def((x) => { x.local.codigo_postal = ''; }), 'bloqueia', 'definicoes:local.codigo_postal'],
    ['sem a secção da morada', def((x) => { delete x.local; }), 'bloqueia', 'definicoes:local:forma'],
    ['sem nome comercial', def((x) => { delete x.empresa.nome_comercial; }), 'bloqueia', 'definicoes:empresa.nome_comercial'],
    ['sem NIF', def((x) => { x.empresa.nif = ''; }), 'bloqueia', 'definicoes:empresa.nif'],
    ['NIF que não confere', def((x) => { x.empresa.nif = '123456788'; }), 'avisa', 'definicoes:empresa.nif:formato'],
    ['dados legais que são uma lista', def((x) => { x.empresa = []; }), 'bloqueia', 'definicoes:empresa:forma'],
    ['sem o texto do «Sobre nós»', def((x) => { delete x.textos.sobre_texto; }), 'bloqueia', 'definicoes:textos.sobre_texto'],
    ['sem a frase dos portes', def((x) => { x.textos.portes = '  '; }), 'bloqueia', 'definicoes:textos.portes'],
    ['frase dos portes que é um número', def((x) => { x.textos.portes = 7; }), 'bloqueia', 'definicoes:textos.portes'],
    ['sem o prazo de produção', def((x) => { delete x.textos.prazo; }), 'avisa', 'definicoes:textos.prazo'],
    ['«</script>» num texto da loja', def((x) => { x.textos.reclamo = 'a </script> b'; }), 'bloqueia', 'definicoes:partia-a-pagina'],
    ['os passos num texto', def((x) => { x.passos = 'um passo'; }), 'avisa', 'definicoes:passos:forma'],
    ['7 passos', def((x) => { x.passos = Array.from({ length: 7 }, (_, i) => ({ titulo: `P${i}`, texto: 't' })); }), 'avisa', 'definicoes:passos:quantos'],
    ['um passo sem título', def((x) => { x.passos[0].titulo = ''; }), 'avisa', 'definicoes:passos.0.titulo'],
    ['«O que nos importa» num texto', def((x) => { x.importa = 'x'; }), 'avisa', 'definicoes:importa:forma'],
    ['os dados da loja não se lêem', (d) => { d.definicoes = '{'; }, 'bloqueia', 'definicoes:ilegivel'],
    ['sem os dados da loja', (d) => { d.definicoes = null; }, 'bloqueia', 'definicoes:ausente'],
    ['os dados da loja numa lista', (d) => { d.definicoes = []; }, 'bloqueia', 'definicoes:forma'],
    ['as categorias não se lêem', (d) => { d.categorias = '['; }, 'bloqueia', 'categorias:ilegivel'],
    ['nenhuma categoria', (d) => { d.categorias = []; }, 'bloqueia', 'categorias:ilegivel'],
    ['uma categoria do site sem nome', (d) => { delete d.categorias[0].nome; }, 'bloqueia', 'categorias:forma'],
  ];
  for (const [descr, mudar, classe, chave, efeito, lembrete] of CASOS) {
    const lista = problemasCom(mudar);
    const p = lista.find((x) => x.classe === classe && (chave instanceof RegExp ? chave.test(x.chave) : x.chave === chave));
    const outrosQueParam = deClasse(novos(lista), 'bloqueia').filter((x) => x !== p);
    certo(p && (!efeito || p.efeito === efeito) && (!lembrete || p.lembrete === true) && !outrosQueParam.length && p.ecra && p.mensagem,
      `${descr} → ${classe}${efeito ? ` (${efeito})` : ''}${lembrete ? ' (lembrete)' : ''}`,
      p ? `efeito ${p.efeito}, lembrete ${p.lembrete}, também param: ${outrosQueParam.map((x) => x.chave).join(', ')}` : `veio: ${novos(lista).map((x) => `${x.chave}=${x.classe}`).join(', ') || 'nada'}`);
  }

  /* E os casos em que a regra diz «sim». */
  const SIM = [
    ['uma cópia escolhida vale pelo original', art(S, (a) => { a.fotos[0] = a.fotos[0].replace(/\.[a-z]+$/i, '-480.webp'); })],
    ['a mesma fotografia com a barra à frente', art(S, (a) => { a.fotos[0] = `/${a.fotos[0]}`; })],
    ['texto com parágrafos (mudanças de linha)', art(S, (a) => { a.texto = 'Um.\n\nDois.'; })],
    ['preço vazio fica «Sob consulta»', art(S, (a) => { delete a.preco; })],
    ['preço com duas casas', art(S, (a) => { a.preco = 24.5; })],
    ['preço 0', art(S, (a) => { a.preco = 0; })],
    ['sem ocasiões', art(S, (a) => { delete a.ocasioes; })],
    ['despublicado sem fotografias', art(S, (a) => { a.fotos = []; a.publicado = false; })],
    ['um NIF que confere', def((x) => { x.empresa.nif = '123456789'; })],
    ['sem telefone (é opcional)', def((x) => { delete x.contactos.telefone; delete x.contactos.telefone_texto; })],
    ['sem email (é opcional)', def((x) => { delete x.contactos.email; })],
    ['sem passos', def((x) => { delete x.passos; })],
    ['sem «O que nos importa»', def((x) => { delete x.importa; })],
    ['um artigo novo, do painel', (d) => { d.artigos['caneca-nova'] = { nome: 'Caneca nova', fotos: [PRIMEIRA_C], resumo: 'Uma caneca.', texto: 'Uma caneca.', categoria: HOJE.artigos[C].categoria, publicado: true, destaque: false, ordem: 500 }; }],
  ];
  for (const [descr, mudar] of SIM) {
    const n = novos(problemasCom(mudar)).filter((p) => !p.lembrete);
    certo(n.length === 0, `sim: ${descr}`, n.map((p) => `${p.chave}=${p.classe}`).join(', '));
  }

  /* Uma chave, uma classe: o Worker do painel compara as chaves do HEAD com as
     da gravação, e uma chave que mudasse de classe com o valor enganava-o. */
  const classes = new Map(); const duplas = [];
  for (const [, mudar] of [...CASOS, ...SIM].map((c) => [c[0], c[1]])) {
    for (const p of problemasCom(mudar)) {
      const k = p.chave.replace(/^artigo:[^:]*:/, 'artigo:*:').replace(/:(foto-[a-z-]+):.*$/, ':$1:*').replace(/^definicoes:passos\.\d+/, 'definicoes:passos.N').replace(/^definicoes:importa\.itens\.\d+/, 'definicoes:importa.itens.N');
      const c = `${p.classe}${p.lembrete ? '+lembrete' : ''}`;
      if (classes.has(k) && classes.get(k) !== c) duplas.push(`${k}: ${classes.get(k)} e ${c}`);
      classes.set(k, c);
    }
  }
  certo(duplas.length === 0, `uma chave, uma classe (${classes.size} chaves vistas)`, duplas.join(' | '));
}

/* ================================================================== */
secao('o varrimento: cada chave apagada');
{
  const maus = []; let n = 0;
  const esperadoArtigo = { nome: 'neutraliza', texto: 'neutraliza', resumo: 'neutraliza', categoria: 'neutraliza', fotos: 'lembrete' };
  for (const nome of Object.keys(HOJE.artigos)) {
    for (const k of Object.keys(HOJE.artigos[nome])) {
      n++;
      const lista = novos(problemasCom(art(nome, (a) => { delete a[k]; })));
      const quer = esperadoArtigo[k];
      const viu = lista.length ? (lista.every((p) => p.lembrete) ? 'lembrete' : lista[0].classe) : null;
      if ((quer || null) !== viu) maus.push(`${nome}.${k}: queria ${quer || 'nada'}, veio ${viu || 'nada'}`);
      for (const p of lista) if (!p.ecra?.startsWith('Artigos › ') || /data\/|\.json|\b[a-z_]+\.[a-z_]+\b/.test(p.mensagem)) maus.push(`${nome}.${k}: ecrã «${p.ecra}», mensagem «${p.mensagem}»`);
    }
  }
  certo(maus.length === 0, `apagar cada uma das ${n} chaves dos ${Object.keys(HOJE.artigos).length} artigos dá o problema certo, no ecrã do artigo, sem caminhos de JSON`, maus.slice(0, 8).join(' | '));

  /* O definicoes.json, em profundidade. O que pára é o que a lei pede ou o que
     o gerador lê sem perguntar; o resto avisa ou cala-se. */
  const PARAM = new Set(['empresa', 'contactos', 'local', 'textos', 'empresa.nome_comercial', 'empresa.nif', 'contactos.whatsapp', 'local.morada', 'local.codigo_postal', 'local.localidade', 'local.concelho', 'local.pais', 'textos.sobre_texto', 'textos.portes']);
  const caminhos = [];
  (function andar(o, pre) {
    for (const [k, v] of Object.entries(o)) {
      const c = [...pre, k]; caminhos.push(c);
      if (v && typeof v === 'object') andar(v, c);
    }
  })(HOJE.definicoes, []);
  const maus2 = []; let param = 0;
  for (const c of caminhos) {
    const lista = novos(problemasCom(def((d) => { const pai = c.slice(0, -1).reduce((o, k) => o[k], d); if (Array.isArray(pai)) pai.splice(Number(c.at(-1)), 1); else delete pai[c.at(-1)]; })));
    const k = c.join('.');
    const pára = lista.some((p) => p.classe === 'bloqueia');
    if (pára) param++;
    if (pára !== PARAM.has(k)) maus2.push(`${k}: ${pára ? 'pára' : 'não pára'}`);
    if (lista.some((p) => p.classe === 'neutraliza')) maus2.push(`${k}: neutraliza nos dados da loja`);
    for (const p of lista) if (!p.ecra?.startsWith('Dados da loja') || /data\/|\.json/.test(p.mensagem)) maus2.push(`${k}: ecrã «${p.ecra}», mensagem «${p.mensagem}»`);
  }
  certo(maus2.length === 0, `apagar cada um dos ${caminhos.length} caminhos do definicoes.json: param os ${param} que a lei ou o gerador pedem, e cada problema diz o ecrã`, maus2.slice(0, 8).join(' | '));
}

/* ================================================================== */
secao('a consola e o resumo da corrida');
{
  /* Um repositório de ensaio com dados que tentam abrir comandos do runner e
     escapar do código no resumo (público, em Markdown). */
  const dir = mkdtempSync(join(TMP, 'repo-'));
  mkdirSync(join(dir, 'data', 'produtos'), { recursive: true });
  symlinkSync(join(RAIZ, 'assets'), join(dir, 'assets'));
  writeFileSync(join(dir, R.FICHEIROS.definicoes), TEXTO.definicoes);
  writeFileSync(join(dir, R.FICHEIROS.categorias), TEXTO.categorias);
  const mau = (nome, mudar) => { const a = clonar(HOJE.artigos[S]); mudar(a); writeFileSync(join(dir, R.ficheiroDoArtigo(nome)), JSON.stringify(a, null, 2)); };
  mau('a', (a) => { a.nome = 'Sweat\n::error::falso'; delete a.texto; });
  mau('b', (a) => { a.nome = 'Sweat ##[error]falso'; a.fotos.push('assets/produtos/x\n::warning::y.jpg'); });
  mau('c', (a) => { a.nome = 'Sweat ``` | <img src=x onerror=alert(1)> [ligação](https://exemplo.pt) ![i](https://exemplo.pt/i.png)'; delete a.resumo; });
  mau('d', (a) => { a.nome = `Sweat ${String.fromCharCode(0x2028)}::error::separador`; a.categoria = 'x|y'; });
  const resumo = join(dir, 'resumo.md');
  writeFileSync(resumo, '');
  const r = correr('node', [GUARDA, '--raiz', dir], { env: { GITHUB_STEP_SUMMARY: resumo } });
  certo(r.status === 0, 'artigos com dados hostis não param a publicação', r.out.slice(-400) + r.err);
  const linhas = r.out.split('\n');
  const comandos = linhas.filter((l) => /^\s*::/.test(l));
  const legitimos = comandos.filter((l) => /^::(error|warning|notice) (file=[^,\n]*,)?title=[^:\n]*::/.test(l));
  certo(comandos.length > 0 && comandos.length === legitimos.length, `na consola, as ${comandos.length} linhas «::» são as anotações da guarda, e nenhuma vem dos dados`, comandos.filter((l) => !legitimos.includes(l)).join(' ⏎ '));
  certo(!r.out.includes('##['), 'nenhum «##[» em sítio nenhum da consola', linhas.filter((l) => l.includes('##[')).join(' ⏎ '));
  const md = readFileSync(resumo, 'utf8');
  /* Tira os códigos (com a cerca de cada um) e vê o que sobra. */
  const semCodigo = md.split('\n').map((l) => {
    let out = ''; let i = 0;
    while (i < l.length) {
      if (l[i] === '`') {
        let n = 0; while (l[i + n] === '`') n++;
        const cerca = '`'.repeat(n);
        const fim = l.indexOf(cerca, i + n);
        if (fim < 0) { out += l.slice(i); break; }
        out += '⟦código⟧'; i = fim + n; while (l[i] === '`') i++;
      } else { out += l[i]; i++; }
    }
    return out;
  }).join('\n');
  const fora = ['<img', '](', '::error', '##[', 'onerror', 'falso', 'separador'].filter((s) => semCodigo.includes(s));
  certo(md.length > 0 && fora.length === 0, 'no resumo, nenhum dado fica fora do código (nem ligações, nem imagens, nem HTML)', `fora: ${fora.join(', ')}`);
  const tabela = md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('|---'));
  const colunas = tabela.map((l) => l.replace(/\\\|/g, '').split('|').length);
  certo(tabela.length > 1 && colunas.every((x) => x === 5), `a tabela do resumo tem as ${tabela.length} linhas com 3 colunas (uma «|» nos dados não abre outra)`, colunas.join(','));
  certo(!/[\p{Zl}\p{Zp}]/u.test(md) && !/[\u0000-\u0009\u000B-\u001F]/.test(md), 'no resumo, nenhum carácter de controlo nem separador de linha do Unicode');
}

/* ================================================================== */
secao('a cópia que o gerador lê');
{
  const d = com((x) => {
    delete x.artigos[S].texto;                                             // esconder
    x.artigos[C].fotos.push('assets/produtos/tshirt-pai/og.jpg', 'assets/produtos/NAO-EXISTE.jpg');   // sem_fotografia
    x.artigos[B].categoria = 'nao-existe'; x.artigos[B].publicado = false; // escondido já estava: nada a dizer no site
  });
  const textos = { ...d, artigos: Object.fromEntries(Object.entries(d.artigos).map(([k, v]) => [k, R.serializar(v, R.terminacaoDe(TEXTO.artigos[k]))])) };
  const lista = R.problemas(textos, OP);
  const n = R.neutralizar(textos, lista);
  certo(JSON.stringify(Object.keys(n.ficheiros).sort()) === JSON.stringify([R.ficheiroDoArtigo(C), R.ficheiroDoArtigo(S)].sort()), 'mudam só os ficheiros dos dois artigos com alguma coisa a mudar', Object.keys(n.ficheiros).join(', '));
  const s2 = JSON.parse(n.ficheiros[R.ficheiroDoArtigo(S)]);
  certo(s2.publicado === false && JSON.stringify({ ...s2, publicado: d.artigos[S].publicado }) === JSON.stringify(d.artigos[S]), 'o artigo sem texto: só o «publicado» muda (fica escondido)');
  const c2 = JSON.parse(n.ficheiros[R.ficheiroDoArtigo(C)]);
  certo(JSON.stringify(c2.fotos) === JSON.stringify(HOJE.artigos[C].fotos) && c2.publicado !== false, 'o artigo com o og.jpg e a fotografia em falta: as duas saem da lista, as outras ficam pela ordem, e continua no site');
  certo(n.ficheiros[R.ficheiroDoArtigo(S)].endsWith('\n') === TEXTO.artigos[S].endsWith('\n') && n.ficheiros[R.ficheiroDoArtigo(C)].endsWith('\n') === TEXTO.artigos[C].endsWith('\n'), 'cada um com a terminação que tinha');
  certo(n.efeitos.length === 2 && !n.efeitos.some((e) => e.slug === B), 'o resumo diz o que muda no site em dois artigos (o que já estava escondido não muda nada)', JSON.stringify(n.efeitos.map((e) => [e.slug, e.efeitos])));
  const depois = { ...textos, artigos: { ...textos.artigos } };
  for (const [rel, t] of Object.entries(n.ficheiros)) depois.artigos[rel.split('/').pop().slice(0, -5)] = t;
  certo(!R.neutralizar(depois, R.problemas(depois, OP)).mudou, 'a cópia neutralizada já não tem nada a neutralizar (a segunda passagem não muda nada)');
  certo(!R.neutralizar(TEXTO, R.problemas(TEXTO, OP)).mudou, 'com os dados de hoje, nada sem nada: a cópia é o repositório');
}

/* ================================================================== */
secao('--neutralizar e o repositório');
{
  const ficheiros = readdirSync(join(RAIZ, 'data', 'produtos')).map((f) => join(RAIZ, 'data', 'produtos', f));
  const antes = ficheiros.map((f) => statSync(f).mtimeMs).join();
  const r = correr('node', [GUARDA, '--neutralizar', RAIZ]);
  certo(r.status === 2 && /só numa cópia/.test(r.err) && ficheiros.map((f) => statSync(f).mtimeMs).join() === antes, '--neutralizar recusa-se a escrever no próprio repositório fora do CI (sai com 2, sem tocar em nada)', `${r.status} ${r.err}`);
  const r2 = correr('node', [GUARDA, '--neutralizar']);
  certo(r2.status === 2, '--neutralizar sem pasta sai com 2');
}

/* ================================================================== */
secao('o publicar.yml');
{
  const nomes = YAML.split('\n').map((l) => l.match(/^ {6}- (?:name: (.+)|uses: ([^@\s]+)@\S+)$/)).filter(Boolean).map((m) => m[1] || m[2]);
  const i = (n) => nomes.indexOf(n);
  certo(i('Conferir o conteúdo') > 0 && i('Conferir o conteúdo') < i('Preparar as fotografias') && i('Preparar as fotografias') < i('Gerar o site'), 'a guarda corre antes de tudo o que lê os dados (as fotografias e o gerador lêem a cópia neutralizada)', nomes.join(' → '));
  certo(/node \.github\/guardas\.mjs --neutralizar \. /.test(passoDoYaml('Conferir o conteúdo')), 'e é a guarda a preparar a cópia (--neutralizar .)');
  certo(!/\bgit\s+(commit|push|add)\b/.test(YAML), 'nenhum passo grava no repositório: a cópia neutralizada nunca lá chega');
  certo(/^permissions:\n {2}contents: read$/m.test(YAML), 'o job só lê o repositório (contents: read)');
  certo(/^on:\n(?:\s*#.*\n)*\s+push:\n\s+branches: \[main\]\n\s+workflow_dispatch:/m.test(YAML) && !/^\s+(?:paths-ignore|paths):/m.test(YAML), 'corre em todos os pushes para o main, sem paths-ignore (o painel conta com uma corrida por commit)');
  certo(!nomes.includes('Confirmar o backoffice contra os dados'), 'o passo que lia o .pages.yml saiu (as categorias e as ocasiões são das regras)');
  certo(!/node\s+\.github\/test-guardas/.test(YAML), 'esta bateria não corre no CI (afirma coisas sobre os dados de hoje)');
}

/* ================================================================== */
secao('a mesma regra no site e no painel');
{
  const painel = resolve(RAIZ, '..', 'amma-painel', 'estatico', 'js', 'regras.js');
  if (existsSync(painel)) {
    const h = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
    certo(h(painel) === h(join(RAIZ, '.github', 'regras.mjs')), 'as regras do painel são uma cópia byte a byte das do site (cp .github/regras.mjs ../amma-painel/estatico/js/regras.js)');
  } else console.log('  · o painel não está ao lado (~/Websites/amma-painel): não se compara');
}

/* ================================================================== */
if (!RAPIDO) await pontaAPonta();
rmSync(TMP, { recursive: true, force: true });
console.log(`\nRESULTADO test-guardas passou=${passou} falhou=${falhou}`);
process.exit(falhou ? 1 : 0);

/* ------------------------------------------------------------------ */
/* O publicar.yml, passo a passo                                       */
/* ------------------------------------------------------------------ */
function passoDoYaml(nome) {
  const linhas = YAML.split('\n');
  const ind = (l) => l.match(/^ */)[0].length;
  const i0 = linhas.findIndex((l) => l.trim() === `- name: ${nome}`);
  if (i0 < 0) throw new Error(`o publicar.yml não tem o passo «${nome}»`);
  let fim = linhas.length;
  for (let i = i0 + 1; i < linhas.length; i++) if (linhas[i].trim() && ind(linhas[i]) <= ind(linhas[i0])) { fim = i; break; }
  const r = linhas.slice(i0, fim).findIndex((l) => /^\s*run:/.test(l));
  if (r < 0) return null;
  const m = linhas[i0 + r].match(/^\s*run:\s*(.*)$/);
  if (m[1] && m[1] !== '|') return m[1] + '\n';
  const corpo = linhas.slice(i0 + r + 1, fim);
  while (corpo.length && !corpo[corpo.length - 1].trim()) corpo.pop();
  const base = Math.min(...corpo.filter((l) => l.trim()).map(ind));
  return corpo.map((l) => l.slice(base)).join('\n') + '\n';
}
function envDoPasso(nome) {
  const linhas = YAML.split('\n');
  const ind = (l) => l.match(/^ */)[0].length;
  const i0 = linhas.findIndex((l) => l.trim() === `- name: ${nome}`);
  const out = {}; let dentro = false; let indEnv = 0;
  for (let i = i0 + 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (l.trim() && ind(l) <= ind(linhas[i0])) break;
    if (/^\s*env:\s*$/.test(l)) { dentro = true; indEnv = ind(l); continue; }
    if (dentro) {
      if (l.trim() && ind(l) <= indEnv) { dentro = false; continue; }
      const m = l.match(/^\s*([A-Z_]+):\s*(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* A publicação de ponta a ponta                                       */
/* ------------------------------------------------------------------ */
async function pontaAPonta() {
  secao('a publicação de ponta a ponta (os passos do publicar.yml, tal como estão escritos)');
  const py = correr(PY, ['-c', 'import PIL']);
  if (!certo(py.status === 0, `o ${PY} tem o Pillow`, py.err)) return;
  const base = join(TMP, 'base'); mkdirSync(base);
  try {
    for (const p of ['data', 'conteudo', 'scripts', '.github', 'assets', 'CNAME']) execFileSync('cp', ['-c', '-R', join(RAIZ, p), join(base, p)]);
  } catch (e) { certo(false, 'o clone do repositório (cp -c, APFS)', String(e.message)); return; }
  const bin = join(TMP, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'python3'), `#!/bin/sh\nexec ${PY} "$@"\n`, { mode: 0o755 });
  /* As cópias das fotografias uma vez, na base; os cartões de partilha voltam
     ao que está no repositório — cada caso faz os seus, como o CI. */
  execFileSync(join(bin, 'python3'), ['scripts/otimizar-imagens.py'], { cwd: base, stdio: 'ignore' });
  const noGit = new Set(git('ls-files', 'assets/produtos').split('\n').filter((f) => f.endsWith('/og.jpg')));
  for (const f of execFileSync('find', [join(base, 'assets', 'produtos'), '-name', 'og.jpg'], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
    const rel = f.slice(base.length + 1);
    if (noGit.has(rel)) execFileSync('cp', [join(RAIZ, rel), f]); else rmSync(f);
  }
  const nomes = YAML.split('\n').map((l) => l.match(/^ {6}- name: (.+)$/)).filter(Boolean).map((m) => m[1]);
  const PASSOS = nomes.filter((n) => !/^Instalar /.test(n) && passoDoYaml(n)).map((n) => ({ nome: n, run: passoDoYaml(n), env: envDoPasso(n) }));
  certo(PASSOS.length >= 5 && PASSOS[0].nome === 'Conferir o conteúdo', `${PASSOS.length} passos: ${PASSOS.map((p) => p.nome).join(' → ')}`);

  const correrAsync = (cmd, args, { cwd, env }) => new Promise((res) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, GITHUB_STEP_SUMMARY: '', GITHUB_ACTIONS: '', ...env } });
    let out = ''; let err = '';
    p.stdout.on('data', (x) => { out += x; }); p.stderr.on('data', (x) => { err += x; });
    p.on('close', (status) => res({ status, out, err }));
  });
  async function publicar(w) {
    const rt = join(w, '.rt'); mkdirSync(rt, { recursive: true });
    const env = { GITHUB_ACTIONS: 'true', RUNNER_TEMP: rt, GITHUB_STEP_SUMMARY: join(rt, 'resumo.md'), PATH: `${bin}:${process.env.PATH}` };
    const feitos = [];
    for (const p of PASSOS) {
      const f = join(rt, `passo-${feitos.length}.sh`);
      writeFileSync(f, p.run);
      const r = await correrAsync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', f], { cwd: w, env: { ...env, ...p.env } });
      feitos.push({ nome: p.nome, ...r });
      if (r.status !== 0) break;
    }
    const rel = join(rt, 'relatorio.json');
    return { feitos, relatorio: existsSync(rel) ? JSON.parse(readFileSync(rel, 'utf8')) : null };
  }

  const ler = (w, rel) => readFileSync(join(w, rel), 'utf8');
  const escrever = (w, rel, obj, t) => writeFileSync(join(w, rel), JSON.stringify(obj, null, 2) + t);
  const artW = (nome, mudar) => (w) => { const rel = R.ficheiroDoArtigo(nome); const t = ler(w, rel); const a = JSON.parse(t); mudar(a); escrever(w, rel, a, R.terminacaoDe(t)); };
  const defW = (mudar) => (w) => { const t = ler(w, R.FICHEIROS.definicoes); const d = JSON.parse(t); mudar(d); escrever(w, R.FICHEIROS.definicoes, d, R.terminacaoDe(t)); };
  const fotoNova = (nome, conteudo) => (w) => writeFileSync(join(w, 'assets', 'produtos', nome), conteudo ?? readFileSync(join(w, PRIMEIRA_C)));
  const e = (...fs) => (w) => fs.forEach((f) => f(w));
  /* [descrição, mudar(pasta), o que se espera: 'publica' | chave que pára,
      e, se publica, uma verificação do _site (opcional), e o aviso do gerador
      que se aceita (opcional)] */
  const ficha = (cat, slug) => `_site/catalogo/${cat}/${slug}/index.html`;
  const CAT_S = HOJE.artigos[S].categoria;
  const CASOS = [
    ['os dados de hoje (e a lista dos endereços antigos bate certo: nenhum «~» do gerador)', () => {}, 'publica', (w, g) => existsSync(join(w, ficha(CAT_S, S))) && existsSync(join(w, 'assets', 'produtos', S, 'og.jpg')) && !/^\s*~ /m.test(g)],
    /* OS ENDEREÇOS ANTIGOS (a lista REENCAMINHAR do gerador) contra o que a dona
       faz no painel: mudar a categoria de um destino, criar um artigo num
       endereço antigo, mudar um artigo para um endereço antigo. Até 4 out 2026
       os três paravam a construção. */
    ['mudar de categoria um artigo que é destino de endereços antigos', artW('sweat-mae', (a) => { a.categoria = 'bodies'; }), 'publica',
      (w) => existsSync(join(w, ficha('bodies', 'sweat-mae'))) && readFileSync(join(w, '_site', 'catalogo', 'textil', 'sweat-casal', 'index.html'), 'utf8').includes('/catalogo/bodies/sweat-mae/')],
    ['um artigo novo num endereço antigo', (w) => writeFileSync(join(w, 'data', 'produtos', 'box-noivo.json'), JSON.stringify({ ...HOJE.artigos[S], nome: 'Box noivo', categoria: 'boxes' }, null, 2)), 'publica',
      (w) => !readFileSync(join(w, ficha('boxes', 'box-noivo')), 'utf8').includes('http-equiv="refresh"')],
    /* E qualquer mudança de categoria, sem lista nenhuma (5 out 2026: o Sweat
       «LOVE» passou de Lembranças para Têxtil e o endereço partilhado deu
       404): o endereço do artigo em qualquer categoria leva à ficha; a de um
       artigo despublicado leva ao catálogo. */
    ['mudar a categoria: o endereço antigo leva à ficha nova', artW('colar-essenza', (a) => { a.categoria = 'lembrancas'; }), 'publica',
      (w) => existsSync(join(w, ficha('lembrancas', 'colar-essenza'))) && readFileSync(join(w, '_site', 'catalogo', 'aco', 'colar-essenza', 'index.html'), 'utf8').includes('url=/catalogo/lembrancas/colar-essenza/')
        && readFileSync(join(w, '_site', 'catalogo', 'boxes', 'colar-essenza', 'index.html'), 'utf8').includes('url=/catalogo/lembrancas/colar-essenza/')],
    ['despublicado: o endereço do artigo leva ao catálogo', artW('colar-essenza', (a) => { a.publicado = false; }), 'publica',
      (w) => readFileSync(join(w, '_site', 'catalogo', 'aco', 'colar-essenza', 'index.html'), 'utf8').includes('url=/catalogo/"')],
    ['mudar um artigo para um endereço antigo', artW('body-convite-madrinha', (a) => { a.categoria = 'boxes'; }), 'publica',
      (w) => !readFileSync(join(w, ficha('boxes', 'body-convite-madrinha')), 'utf8').includes('http-equiv="refresh"') && readFileSync(join(w, '_site', 'catalogo', 'bodies-convites', 'body-convite-madrinha', 'index.html'), 'utf8').includes('/catalogo/boxes/body-convite-madrinha/')],
    ...['nome', 'fotos', 'resumo', 'texto', 'personalizavel', 'preco', 'categoria', 'ocasioes', 'publicado', 'destaque', 'ordem'].map((k) => [`sem «${k}» num artigo`, artW(S, (a) => { delete a[k]; }), 'publica']),
    ['sem nome, num artigo com a mesma posição de outros (o gerador ordena-os pelo nome)', artW('sweat-icon', (a) => { delete a.nome; }), 'publica'],
    ['sem nome, num artigo despublicado', artW(S, (a) => { delete a.nome; a.publicado = false; }), 'publica'],
    ...[['texto', 7], ['resumo', ['x']], ['nome', ''], ['categoria', {}], ['ocasioes', 'presente'], ['ocasioes', { presente: true }], ['ocasioes', ['constructor', '__proto__']], ['personalizavel', 'O nome'], ['personalizavel', [5, null]], ['preco', '18'], ['preco', true], ['ordem', '5'], ['ordem', 'x'], ['publicado', 'false'], ['destaque', 'sim'], ['fotos', 'assets/produtos/x.jpg'], ['fotos', [5, null, {}]], ['fotos', {}]]
      .map(([k, v]) => [`«${k}» = ${JSON.stringify(v)}`, artW(S, (a) => { a[k] = v; }), 'publica']),
    ['a primeira fotografia em falta (o cartão de partilha sai da segunda)', artW(S, (a) => { a.fotos.unshift('assets/produtos/nao-existe.jpg'); }), 'publica', (w) => existsSync(join(w, 'assets', 'produtos', S, 'og.jpg'))],
    ['a primeira fotografia com a barra à frente', artW(C, (a) => { a.fotos[0] = `/${a.fotos[0]}`; }), 'publica', (w) => existsSync(join(w, 'assets', 'produtos', C, 'og.jpg'))],
    ['a primeira fotografia com um espaço à frente', artW(S, (a) => { a.fotos[0] = ` ${a.fotos[0]}`; }), 'publica'],
    ['todas as fotografias em falta', artW(S, (a) => { a.fotos = ['assets/produtos/nao-existe.jpg']; }), 'publica'],
    ['uma fotografia «dentro» de um ficheiro', artW(S, (a) => { a.fotos.unshift(`${PRIMEIRA_C}/x.jpg`); }), 'publica'],
    ['o og.jpg de outro artigo à frente', artW(S, (a) => { a.fotos.unshift('assets/produtos/tshirt-pai/og.jpg'); }), 'publica', (w) => existsSync(join(w, 'assets', 'produtos', S, 'og.jpg'))],
    ['só o og.jpg de outro artigo', artW(S, (a) => { a.fotos = ['assets/produtos/tshirt-pai/og.jpg']; }), 'publica'],
    ['uma cópia escolhida, sozinha', artW(S, (a) => { a.fotos = [a.fotos[0].replace(/\.[a-z]+$/i, '-1600.webp')]; }), 'publica', (w) => existsSync(join(w, 'assets', 'produtos', S, 'og.jpg'))],
    /* O LIMITE CONHECIDO: um ficheiro que não é uma imagem (um carregamento
       partido) tem nome de fotografia, e a guarda só vê nomes. A preparação não
       o abre, o gerador deixa-o cair, e o cartão de partilha sai da seguinte —
       a publicação segue. O painel só carrega o que reduziu no browser (um
       JPEG que abriu), por isso isto só vem de fora dele. */
    ['uma fotografia que não abre, à frente', e(fotoNova('estragada.jpg', 'isto não é uma imagem'), artW(S, (a) => { a.fotos.unshift('assets/produtos/estragada.jpg'); })), 'publica', (w) => existsSync(join(w, 'assets', 'produtos', S, 'og.jpg')), /estragada\.jpg não tem variantes/],
    ['uma fotografia chamada «-480.jpg»', e(fotoNova('foto-480.jpg'), artW(S, (a) => { a.fotos = ['assets/produtos/foto-480.jpg', ...a.fotos]; })), 'publica'],
    ['uma fotografia chamada «logo….png» (a preparação dá-a por logótipo)', e(fotoNova('logo-caixa.png'), artW(S, (a) => { a.fotos = ['assets/produtos/logo-caixa.png', ...a.fotos]; })), 'publica', (w) => existsSync(join(w, 'assets', 'produtos', S, 'og.jpg'))],
    ['uma fotografia .JPG com acentos e espaços', e(fotoNova('Ação Nova.JPG'), artW(S, (a) => { a.fotos = ['assets/produtos/Ação Nova.JPG']; })), 'publica', (w) => existsSync(join(w, 'assets', 'produtos', S, 'og.jpg'))],
    ['o artigo da página inicial sem fotografias', artW(B, (a) => { a.fotos = []; }), 'publica'],
    ['o artigo da página inicial despublicado', artW(B, (a) => { a.publicado = false; }), 'publica'],
    ['uma categoria com um espaço (o artigo esconde-se: o endereço dele leva ao catálogo)', artW(S, (a) => { a.categoria = ` ${a.categoria}`; }), 'publica', (w) => !existsSync(join(w, ficha(CAT_S, S))) || readFileSync(join(w, ficha(CAT_S, S)), 'utf8').includes('url=/catalogo/"')],
    ['um artigo novo que não se lê', (w) => writeFileSync(join(w, 'data', 'produtos', 'teste-novo.json'), '{ "nome": '), 'artigo:teste-novo:ilegivel'],
    ['um artigo novo vazio ({})', (w) => writeFileSync(join(w, 'data', 'produtos', 'teste-novo.json'), '{}'), 'publica', (w) => !existsSync(join(w, '_site', 'catalogo', 'undefined'))],
    ['uma categoria do site sem nome', (w) => { const t = ler(w, R.FICHEIROS.categorias); const c = JSON.parse(t); delete c[0].nome; escrever(w, R.FICHEIROS.categorias, c, R.terminacaoDe(t)); }, 'categorias:forma'],
    ['um ficheiro de artigo com nome estranho', (w) => writeFileSync(join(w, 'data', 'produtos', 'Teste Ç.json'), ler(w, R.ficheiroDoArtigo(S))), 'publica'],
    ['um ficheiro com BOM', (w) => writeFileSync(join(w, R.ficheiroDoArtigo(S)), `${String.fromCharCode(0xfeff)}${ler(w, R.ficheiroDoArtigo(S))}`), `artigo:${S}:ilegivel`],
    ...['empresa', 'contactos', 'local', 'textos', 'empresa.nome_comercial', 'empresa.nif', 'contactos.whatsapp', 'local.morada', 'local.codigo_postal', 'local.localidade', 'local.concelho', 'local.pais', 'textos.sobre_texto', 'textos.portes']
      .map((c) => [`sem «${c}» nos dados da loja`, defW((d) => { const [a, b] = c.split('.'); if (b) delete d[a][b]; else delete d[a]; }), c.includes('.') ? `definicoes:${c}` : `definicoes:${c}:forma`]),
    ...[['textos.prazo', 7], ['textos.prazo', ['x']], ['textos.hero_titulo', 7], ['textos.hero_titulo', null], ['textos.reclamo', {}], ['textos.sobre_titulo', ['x']], ['passos', 'x'], ['passos', [5, null, { titulo: 7 }]], ['importa', 'x'], ['importa', { itens: 'x' }], ['importa', { itens: [5, null] }], ['contactos.email', 7], ['contactos.telefone', 930477114], ['contactos.instagram', 7], ['empresa.assinatura', {}], ['empresa.denominacao_social', 7], ['tecnico', 'x']]
      .map(([c, v]) => [`«${c}» = ${JSON.stringify(v)} nos dados da loja`, defW((d) => { const [a, b] = c.split('.'); if (b) d[a][b] = v; else d[a] = v; }), 'publica']),
    ['os dados da loja que não se lêem', (w) => writeFileSync(join(w, R.FICHEIROS.definicoes), '{'), 'definicoes:ilegivel'],
    ['as categorias que não se lêem', (w) => writeFileSync(join(w, R.FICHEIROS.categorias), '['), 'categorias:ilegivel'],
    ['todos os artigos despublicados', (w) => { for (const f of readdirSync(join(w, 'data', 'produtos'))) artW(f.slice(0, -5), (a) => { a.publicado = false; })(w); }, 'publica'],
  ];

  const maus = []; let i = 0; let ok = 0;
  const OPERARIOS = Math.max(2, Math.min(6, availableParallelism() - 2));
  const operario = async (n) => {
    while (i < CASOS.length) {
      const [descr, mudar, quer, conferir, aceitar] = CASOS[i++];
      const w = join(TMP, `w${n}`);
      rmSync(w, { recursive: true, force: true });
      execFileSync('cp', ['-c', '-R', base, w]);
      let r;
      try { mudar(w); r = await publicar(w); } catch (err) { maus.push(`${descr}: o ensaio rebentou (${err.message})`); continue; }
      const falhou = r.feitos.find((p) => p.status !== 0);
      const gerador = r.feitos.find((p) => p.nome === 'Gerar o site');
      const caiu = gerador ? `${gerador.out}\n${gerador.err}`.split('\n').filter((l) => /!!/.test(l) && !(aceitar && aceitar.test(l))) : [];
      const pararam = (r.relatorio?.problemas || []).filter((p) => p.classe === 'bloqueia').map((p) => p.chave);
      if (quer === 'publica') {
        if (falhou) maus.push(`${descr}: parou em «${falhou.nome}»${falhou.nome === 'Conferir o conteúdo' ? ` (${pararam.join(', ')})` : ' SEM A GUARDA DIZER PORQUÊ'}: ${(falhou.err || falhou.out).trim().split('\n').slice(-3).join(' ⏎ ').slice(0, 300)}`);
        else if (caiu.length) maus.push(`${descr}: o gerador deixou cair o que a guarda deu por bom: ${caiu.join(' | ').slice(0, 300)}`);
        else if (conferir && !conferir(w, gerador ? `${gerador.out}\n${gerador.err}` : '')) maus.push(`${descr}: publicou, mas o site não ficou como devia`);
        else ok++;
      } else if (!falhou || falhou.nome !== 'Conferir o conteúdo' || !pararam.includes(quer)) {
        maus.push(`${descr}: devia parar na guarda com ${quer}; ${falhou ? `parou em «${falhou.nome}» (${pararam.join(', ') || 'sem bloqueios'})` : 'publicou'}`);
      } else ok++;
      rmSync(w, { recursive: true, force: true });
    }
  };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: OPERARIOS }, (_, n) => operario(n)));
  certo(maus.length === 0, `${CASOS.length} casos de ponta a ponta (${Math.round((Date.now() - t0) / 1000)} s): ou a guarda pára e diz porquê, ou o site publica-se até ao fim, sem perder fotografias que a guarda deu por boas (${ok} certos)`, maus.join('\n      '));
}
