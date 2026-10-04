#!/usr/bin/env node
/* A GUARDA DO CONTEÚDO, NO CI (passo «Conferir o conteúdo» do publicar.yml;
 * não precisa de segredos).
 *
 * Lê os JSON de data/ e corre as regras de .github/regras.mjs — as MESMAS que o
 * painel (backoffice.ammacreative.pt) mostra por baixo dos campos e que o
 * Worker do painel confere ao gravar. Molde: a guarda da LR Motors.
 *
 * O PRINCÍPIO: um problema de UM artigo nunca pára a publicação dos outros. Só
 * pára o que não se pode publicar sem inventar um valor ou partir o site
 * inteiro (classe «bloqueia»: a estrutura dos ficheiros, a morada da sede, o
 * nome comercial, o WhatsApp). O resto vai para o resumo da corrida.
 *
 *   node .github/guardas.mjs [--raiz <pasta>] [--relatorio-em <ficheiro>]
 *       Confere. Sai com 1 só se houver um «bloqueia».
 *
 *   node .github/guardas.mjs --neutralizar <pasta> [--relatorio-em <ficheiro>]
 *       Confere e escreve, em <pasta>/data/produtos/, a CÓPIA QUE O GERADOR LÊ:
 *       os artigos sem texto, sem frase curta ou numa categoria que não existe
 *       escondidos, as fotografias que não são da biblioteca fora da lista. SÓ
 *       os ficheiros que mudam, e só quando há alguma coisa a neutralizar.
 *       ESCREVE NOS FICHEIROS DE DADOS: no CI a publicação não faz commit de
 *       volta, por isso a cópia neutralizada nunca entra no repositório; fora
 *       do CI (sem GITHUB_ACTIONS=true) recusa-se a escrever no próprio
 *       repositório — só numa cópia.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FICHEIROS, PASTAS, problemas, neutralizar, descreverEfeitos } from './regras.mjs';
import { umaLinha } from './consola.mjs';

const RAIZ_DO_REPOSITORIO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MAX_ANOTACOES = 9;

/* ------------------------------------------------------------------ */
/* Ler o repositório                                                    */
/* ------------------------------------------------------------------ */

/* Os dados como o gerador os lê: o definicoes.json, o categorias.json e cada
   *.json de data/produtos/. Um «.json» que não é um ficheiro normal (uma
   pasta, uma ligação) partia o gerador: pára aqui, com o nome dele. O mapa dos
   artigos é sem protótipo: um ficheiro chamado «__proto__.json» é só um nome. */
export function lerDados(raiz) {
  const estrutura = [];
  const pararNoFicheiro = (rel, ecra) => estrutura.push({
    classe: 'bloqueia', chave: `estrutura:${rel}`, ficheiro: rel, ecra,
    mensagem: `${rel} não é um ficheiro normal (é uma pasta ou uma ligação): o site não se consegue gerar assim. Só o Renato o pode corrigir.`,
  });
  const dados = { artigos: Object.create(null), definicoes: null, categorias: null };
  for (const [chave, rel, ecra] of [['definicoes', FICHEIROS.definicoes, 'Dados da loja'], ['categorias', FICHEIROS.categorias, 'Artigos']]) {
    let st = null;
    try { st = lstatSync(join(raiz, rel)); } catch { st = null; }
    if (st && !st.isFile()) pararNoFicheiro(rel, ecra);
    else if (st) dados[chave] = readFileSync(join(raiz, rel), 'utf8');
  }
  let entradas = [];
  try { entradas = readdirSync(join(raiz, PASTAS.artigos), { withFileTypes: true }); } catch { entradas = []; }
  for (const e of entradas) {
    if (!e.name.endsWith('.json')) continue;
    if (!e.isFile()) { pararNoFicheiro(`${PASTAS.artigos}/${e.name}`, 'Artigos'); continue; }
    dados.artigos[e.name.slice(0, -'.json'.length)] = readFileSync(join(raiz, PASTAS.artigos, e.name), 'utf8');
  }
  return { dados, estrutura };
}

/* O que está numa pasta, como o gerador o vê (readdirSync, ficheiros e
   pastas). É com isto que regras.fotografiaExiste() faz a MESMA conta. */
export function listarPastaEm(raiz) {
  const lidas = new Map();
  return (pasta) => {
    if (!lidas.has(pasta)) {
      let nomes = [];
      try { nomes = readdirSync(join(raiz, pasta)); } catch { nomes = []; }
      lidas.set(pasta, nomes);
    }
    return lidas.get(pasta);
  };
}

const ORDEM = { bloqueia: 0, neutraliza: 1, avisa: 2 };
export const ordenar = (lista) => lista.sort((a, b) => ORDEM[a.classe] - ORDEM[b.classe] || (a.lembrete ? 1 : 0) - (b.lembrete ? 1 : 0));

export function conferir(raiz) {
  const { dados, estrutura } = lerDados(raiz);
  const lista = ordenar([...estrutura, ...problemas(dados, { listarPasta: listarPastaEm(raiz) })]);
  const n = neutralizar(dados, lista);
  const efeitos = n.efeitos.map((e) => ({ ...e, descricao: descreverEfeitos(e) }));
  return { dados, lista, efeitos, ficheiros: n.ficheiros, mudou: n.mudou };
}

/* ------------------------------------------------------------------ */
/* As saídas                                                            */
/* ------------------------------------------------------------------ */

/* Os comandos do GitHub: %, \r e \n escapam-se na mensagem; nas
   propriedades, também : e ,. E o «##[» leva um espaço no meio, como no
   umaLinha(): numa linha de comando do formato novo o runner não o lê, mas
   assim nenhuma linha da guarda o tem. */
const escMsg = (s) => String(s).replace(/##\[/g, '## [').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s) => escMsg(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

export function anotacoes(lista) {
  const linhas = [];
  const grupos = [
    ['error', lista.filter((p) => p.classe === 'bloqueia')],
    ['warning', lista.filter((p) => p.classe !== 'bloqueia' && !p.lembrete)],
    ['notice', lista.filter((p) => p.lembrete)],
  ];
  for (const [tipo, grupo] of grupos) {
    for (const p of grupo.slice(0, MAX_ANOTACOES)) {
      const prefixo = p.classe === 'neutraliza' ? 'Muda no site: ' : p.lembrete ? 'Lembrete: ' : '';
      linhas.push(`::${tipo} file=${escProp(p.ficheiro || '')},title=${escProp(p.ecra || 'Guarda do conteúdo')}::${escMsg(prefixo + p.mensagem)}`);
    }
    if (grupo.length > MAX_ANOTACOES) {
      linhas.push(`::${tipo} title=Guarda do conteúdo::${escMsg(`e mais ${grupo.length - MAX_ANOTACOES} — veja o resumo desta corrida`)}`);
    }
  }
  return linhas;
}

/* UM VALOR DOS DADOS NO RESUMO DA CORRIDA, que é público e que o GitHub lê em
   Markdown: entre crases (dentro de um código o GitHub não interpreta nada),
   com a cerca mais comprida do que a maior fila de crases do texto; numa
   tabela, a barra como «\|»; o controlo e as mudanças de linha passam a espaço.
   Ver a guarda da LR Motors, onde isto foi apanhado. */
const emCodigo = (s, { tabela = false } = {}) => {
  let t = String(s ?? '').replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ');
  if (tabela) t = t.replace(/\|/g, '\\|');
  const cerca = '`'.repeat((t.match(/`+/g) || []).reduce((m, x) => Math.max(m, x.length), 0) + 1);
  return `${cerca} ${t} ${cerca}`;
};
const MAX_RESUMO = 900 * 1024;
const contas = (lista) => ({
  bloqueia: lista.filter((p) => p.classe === 'bloqueia').length,
  neutraliza: lista.filter((p) => p.classe === 'neutraliza').length,
  avisa: lista.filter((p) => p.classe === 'avisa' && !p.lembrete).length,
  lembretes: lista.filter((p) => p.lembrete).length,
});

export function resumo(lista, efeitos) {
  const n = contas(lista);
  const l = ['## Guarda do conteúdo', ''];
  if (n.bloqueia) l.push(`**A publicação parou**: ${n.bloqueia} problema(s) que não se podem contornar. O site continua como estava.`);
  else l.push('A publicação segue.');
  if (efeitos.length) {
    l.push('', `**${efeitos.length} artigo(s) mudam no site** por terem dados com problemas (o ficheiro do repositório não muda; corrige-se no painel):`, '',
      ...efeitos.map((e) => `- ${emCodigo(e.nome)}: **${emCodigo(e.descricao)}** — ${emCodigo(e.motivos.join(' '))}`));
  }
  l.push('', `Problemas: ${n.bloqueia} que param · ${n.neutraliza} que mudam o site · ${n.avisa} avisos · ${n.lembretes} lembretes.`);
  if (lista.length) {
    l.push('', '| | Onde se corrige | O quê |', '|---|---|---|');
    const nome = (p) => (p.classe === 'bloqueia' ? 'PÁRA' : p.classe === 'neutraliza' ? 'no site' : p.lembrete ? 'lembrete' : 'aviso');
    for (const p of lista) l.push(`| ${nome(p)} | ${emCodigo(p.ecra, { tabela: true })} | ${emCodigo(p.mensagem, { tabela: true })} |`);
  }
  const bytes = (s) => new TextEncoder().encode(s).length;
  if (bytes(`${l.join('\n')}\n`) <= MAX_RESUMO) return `${l.join('\n')}\n`;
  const cabem = []; let n2 = 0;
  for (const linha of l) { n2 += bytes(`${linha}\n`); if (n2 > MAX_RESUMO / 2) break; cabem.push(linha); }
  return `${cabem.join('\n')}\n\n… (o resto está no relatório desta corrida)\n`;
}

export function relatorio(lista, efeitos) {
  return { versao: 1, ...contas(lista), problemas: lista, neutralizados: efeitos };
}

const NOME_NA_CONSOLA = (p) => (p.classe === 'bloqueia' ? 'PÁRA    ' : p.classe === 'neutraliza' ? 'NO SITE ' : p.lembrete ? 'LEMBRETE' : 'AVISO   ');
/* A listagem leva os dados tal e qual, por isso cada linha passa pelo
   umaLinha(): o runner lê comandos no que aqui se escreve — ver consola.mjs. */
const listar = (texto) => console.log(umaLinha(texto));

function escreverSaidas(lista, efeitos, relatorioEm) {
  for (const linha of anotacoes(lista)) console.log(linha);
  console.log('');
  for (const p of lista) listar(`  ${NOME_NA_CONSOLA(p)} ${p.ecra} — ${p.mensagem}`);
  for (const e of efeitos) listar(`  MUDA NO SITE: ${e.nome} — ${e.descricao}`);
  const n = contas(lista);
  console.log(`\nGuarda do conteúdo: ${n.bloqueia} que param, ${n.neutraliza} que mudam o site (${efeitos.length} artigo(s)), ${n.avisa} avisos, ${n.lembretes} lembretes.`);
  if (relatorioEm) writeFileSync(relatorioEm, JSON.stringify(relatorio(lista, efeitos), null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumo(lista, efeitos));
  return n.bloqueia;
}

/* ------------------------------------------------------------------ */
/* Os dois modos                                                       */
/* ------------------------------------------------------------------ */

function modoConferir(raiz, relatorioEm) {
  const { lista, efeitos } = conferir(raiz);
  return escreverSaidas(lista, efeitos, relatorioEm) ? 1 : 0;
}

function modoNeutralizar(raiz, relatorioEm) {
  const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  if (real(raiz) === real(RAIZ_DO_REPOSITORIO) && process.env.GITHUB_ACTIONS !== 'true') {
    console.error('--neutralizar escreve nos ficheiros de data/: fora do CI, só numa cópia do repositório (aqui mudava os dados de verdade).');
    return 2;
  }
  const { lista, efeitos, ficheiros, mudou } = conferir(raiz);
  if (escreverSaidas(lista, efeitos, relatorioEm)) return 1;
  if (mudou) {
    for (const [rel, texto] of Object.entries(ficheiros)) writeFileSync(join(raiz, rel), texto);
    // A prova: a cópia escrita já não tem nada a mudar.
    if (conferir(raiz).mudou) { console.error('ERRO: a cópia neutralizada ainda tem artigos a neutralizar'); return 1; }
    console.log(`\n${Object.keys(ficheiros).length} ficheiro(s) de artigos mudados SÓ na cópia que o gerador lê (o repositório não muda).`);
  } else {
    console.log('\nNada a neutralizar: o gerador lê os ficheiros do repositório tal e qual.');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### A cópia que o gerador lê\n\n${mudou
      ? `${Object.keys(ficheiros).length} ficheiro(s) de artigos mudados SÓ nesta cópia (o repositório não muda): ${Object.keys(ficheiros).map((f) => emCodigo(f)).join(', ')}.`
      : 'Nada a neutralizar: o gerador lê os ficheiros do repositório tal e qual.'}\n`);
  }
  return 0;
}

export function principal(args) {
  const opcao = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
  for (const nome of ['--raiz', '--relatorio-em', '--neutralizar']) {
    if (args.includes(nome) && !opcao(nome)) { console.error(`${nome} precisa de um valor`); return 2; }
  }
  const relatorioEm = opcao('--relatorio-em');
  const copia = opcao('--neutralizar');
  if (copia) return modoNeutralizar(resolve(copia), relatorioEm);
  const raiz = resolve(opcao('--raiz') || RAIZ_DO_REPOSITORIO);
  if (!existsSync(raiz)) { console.error(`a pasta ${raiz} não existe`); return 2; }
  return modoConferir(raiz, relatorioEm);
}

/* Corre quando é o ficheiro chamado. O caminho REAL, dos dois lados: no Mac o
   /tmp e as pastas temporárias são ligações para /private/..., e o Node dá o
   import.meta.url já resolvido — com o caminho tal e qual, numa cópia em /tmp
   esta guarda não corria e saía com 0, calada. */
const chamado = () => { try { return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } };
if (process.argv[1] && chamado()) {
  process.exitCode = principal(process.argv.slice(2));
}
