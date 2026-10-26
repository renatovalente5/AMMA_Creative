/* AS REGRAS DOS DADOS DA AMMA CREATIVE, NUM SÓ SÍTIO.
 *
 * Três leitores, e os três têm de ouvir o mesmo:
 *   · o CI do site (.github/guardas.mjs), antes de gerar o site;
 *   · o painel, no browser (o erro aparece por baixo do campo, antes de gravar);
 *   · o Worker do painel, ao gravar (recusa os problemas NOVOS que não sejam
 *     lembretes).
 * O painel usa uma CÓPIA BYTE A BYTE deste ficheiro (estatico/js/regras.js no
 * repositório amma-painel), com um teste de SHA-256 que falha se divergirem. Por
 * isso é um ES module puro: nenhum import, nada de node:*, fs, process ou
 * require. Corre tal e qual no browser, num Worker e no Node.
 *
 * O que cada campo FAZ no site é o scripts/gerar.mjs: as regras olham para o que
 * o gerador faz com o valor, e não para o que o valor parece. As ajudas e os
 * rótulos que a dona lê são os do painel (vinham do .pages.yml do Pages CMS, que
 * o painel substituiu em Outubro de 2026).
 *
 * CADA PROBLEMA TEM UMA CLASSE:
 *   · bloqueia   — a publicação pára e o site fica como estava. Só a estrutura
 *                  (um JSON que não se lê, um ficheiro sem a forma que o gerador
 *                  precisa) e os dados de que todas as páginas dependem (a
 *                  morada da sede e o nome comercial, que a lei pede — DL
 *                  7/2004, art. 10.º —, o WhatsApp, a frase dos portes).
 *   · neutraliza — um artigo, só na cópia que o gerador lê (o ficheiro do
 *                  repositório não muda — ver neutralizar()): sem nome, sem
 *                  texto, sem frase curta, numa categoria que não existe, ou
 *                  com um valor que não pode ir para o site, fica escondido do
 *                  site; uma fotografia que não existe, ou que não é da
 *                  biblioteca, não aparece. Um problema de UM artigo nunca
 *                  pára a publicação dos outros.
 *   · avisa      — só aviso. No painel, os que não são lembrete são erro de
 *                  campo (valor fora da lista, número fora dos limites, texto
 *                  comprido de mais): o painel não os deixa gravar, mas um valor
 *                  estranho num commit à mão não é razão para parar o site.
 *                  Os LEMBRETES (lembrete: true) não são erro de ninguém: o
 *                  painel grava na mesma e mostra-os no Início.
 *
 * O NIF E O NOME DA TITULAR SÓ LEMBRAM. Em Outubro de 2026 o NIF ainda é o
 * «000000000» de espera e o nome da titular «(a confirmar)»: a lei pede-os, mas
 * parar a publicação por isso trancava o site hoje. Lembram-se no Início até
 * a dona os dar.
 *
 * dados = {
 *   artigos:    { <nome>: texto | objecto | null },   data/produtos/<nome>.json
 *   definicoes: texto | objecto | null,               data/definicoes.json
 *   categorias: texto | objecto | null,               data/categorias.json
 * }
 *   <nome> é o nome do ficheiro sem «.json», que é o endereço da página (o
 *   gerador usa-o tal e qual: slug = nome do ficheiro sem a extensão).
 *   texto = o conteúdo do ficheiro; null = o ficheiro não existe (ignorado).
 *   Uma chave de topo AUSENTE não se confere (o painel pode conferir só um
 *   artigo); `definicoes: null` (presente, mas null) é «falta o ficheiro».
 *
 * problema = {
 *   classe:   'bloqueia' | 'neutraliza' | 'avisa',
 *   chave:    estável: 'artigo:<slug>:<regra>', 'definicoes:<campo>[:<regra>]' ou
 *             'categoria:<slug>:<regra>' (e 'categorias:…', o ficheiro inteiro).
 *             O Worker compara as chaves do HEAD com as da gravação e recusa só
 *             as novas; por isso UMA CHAVE TEM SEMPRE A MESMA CLASSE.
 *   ficheiro: 'data/produtos/<nome>.json', 'data/definicoes.json' ou 'data/categorias.json';
 *   ecra:     o ecrã do painel onde se corrige («Artigos › Sweat "LOVE"»,
 *             «Dados da loja › Contactos»);
 *   mensagem: para a dona, em português simples, sem caminhos de JSON;
 *   campo?:   o campo onde o painel mostra o erro ('preco', 'contactos.whatsapp');
 *   campos?:  quando são vários;
 *   efeito?:  só nos «neutraliza»: 'esconder' | 'sem_fotografia';
 *   slug?:    só nos artigos;
 *   categoria?: só nos de uma categoria (o slug dela);
 *   foto?, indice?: só nos problemas de uma fotografia (o caminho e a posição);
 *   lembrete?: true nos avisos que não são erro de ninguém.
 * }
 *
 * «NÃO FOI DITO» E NULL SÃO O MESMO: o Pages CMS omitia os campos vazios ao
 * gravar, e há ficheiros assim. E o vazio testa-se ANTES de converter:
 * Number(null) é 0, e 0 é uma escolha.
 */

/* ------------------------------------------------------------------ */
/* Onde estão as coisas                                                */
/* ------------------------------------------------------------------ */

export const FICHEIROS = { definicoes: 'data/definicoes.json', categorias: 'data/categorias.json' };
export const PASTAS = { artigos: 'data/produtos' };
export const ficheiroDoArtigo = (nome) => `${PASTAS.artigos}/${nome}.json`;
/* A BIBLIOTECA das fotografias: os originais, e AO LADO DELES as cópias que a
   publicação gera (<nome>-480/-960/-1600.webp) e o cartão de partilha de cada
   artigo (<pasta do artigo>/og.jpg). Algumas cópias antigas estão no
   repositório; as novas faz a publicação. Para a dona, só os originais são
   fotografias: as cópias e os cartões nunca se mostram nem se escolhem. */
export const BIBLIOTECA = 'assets/produtos';
export const LARGURAS = [480, 960, 1600];
const RE_GERADA = /-(?:480|960|1600)\.webp$/i;
/** Um nome de ficheiro que a publicação gera (uma cópia ou um cartão), e não
 *  uma fotografia que alguém carregou. */
export const eGerada = (nomeFicheiro) => {
  const n = String(nomeFicheiro ?? '').split('/').pop();
  return RE_GERADA.test(n) || n.toLowerCase() === 'og.jpg';
};

/* ------------------------------------------------------------------ */
/* As listas                                                           */
/* ------------------------------------------------------------------ */

/* As ocasiões (os filtros do catálogo), com o nome que o site mostra. O
   scripts/gerar.mjs mostra só as desta lista. */
export const OCASIOES = Object.freeze({
  'anuncio-gravidez': 'Anúncio de gravidez',
  'convite-padrinhos': 'Convite a padrinhos',
  baptizado: 'Batizado',
  casamento: 'Casamento',
  'dia-da-mae': 'Dia da Mãe',
  'dia-do-pai': 'Dia do Pai',
  pascoa: 'Páscoa',
  presente: 'Presente',
  lembrancas: 'Lembranças',
});
/* AS OCASIÕES RETIRADAS, em Agosto de 2026 e por medição (ver o histórico do
   .pages.yml): «Páscoa» tinha UM artigo, que passou a chamar-se «o meu
   primeiro…» e cobre também o Natal e o aniversário; «Lembranças» devolvia os
   MESMOS dois artigos da categoria com o mesmo nome. O site continua a saber
   mostrá-las (um artigo antigo que as tenha não perde nada), mas o painel não
   as oferece para escolher. */
export const OCASIOES_RETIRADAS = Object.freeze(['pascoa', 'lembrancas']);
/* As que o scripts/otimizar-imagens.py prepara. */
export const EXTENSOES_FOTO = ['jpg', 'jpeg', 'png', 'webp'];

/* Os campos de um artigo, pela ordem do formulário. Uma chave nova entra por
   esta ordem (ordenarComo()); as que já estão no ficheiro ficam onde estão.
   A INFORMAÇÃO DO PRODUTO (22 out 2026, grupo 1 da auditoria legal): a
   composição têxtil (Regulamento (UE) 1007/2011), o fabricante com morada e
   email, a referência e os avisos de segurança (Regulamento (UE) 2023/988 —
   GPSR, art. 19.º) e os tipos de perigo das misturas, como a vela (CLP). São
   OPCIONAIS: vazios, a ficha não mostra o bloco «Informação do produto»; o
   gerador avisa no registo da publicação (nunca esconde o artigo). */
export const CAMPOS_ARTIGO = ['nome', 'fotos', 'resumo', 'texto', 'personalizavel', 'preco', 'composicao', 'fabricante', 'referencia', 'avisos', 'perigos', 'categoria', 'ocasioes', 'publicado', 'destaque', 'ordem'];
/* Os campos do fabricante (um objecto dentro do artigo). */
export const CAMPOS_FABRICANTE = ['nome', 'morada', 'email'];
/* Sempre escritos pelo painel, com o valor explícito. Ausentes valem o valor por
   omissão (é o que o gerador faz: publicado !== false, destaque só se true). */
export const BOOLEANOS_ARTIGO = ['publicado', 'destaque'];
export const POR_OMISSAO = Object.freeze({ publicado: true, destaque: false, ordem: 500 });

export const NOMES_CAMPOS = {
  nome: 'Nome do artigo', fotos: 'Fotografias', resumo: 'Frase curta do catálogo', texto: 'Texto da página do artigo',
  personalizavel: 'O que se personaliza', preco: 'Preço', categoria: 'Categoria', ocasioes: 'Ocasiões',
  publicado: 'Publicado no site', destaque: 'Mostrar na página inicial', ordem: 'Posição na lista',
  composicao: 'Composição (têxtil)', fabricante: 'Fabricante', 'fabricante.nome': 'Fabricante › nome', 'fabricante.morada': 'Fabricante › morada', 'fabricante.email': 'Fabricante › email',
  referencia: 'Referência do artigo', avisos: 'Avisos de segurança', perigos: 'Tipos de perigo',
};

/* As secções do data/definicoes.json, com o nome do ecrã. O gerador lê sem
   perguntar `empresa`, `contactos`, `local` e `textos`: sem uma delas rebenta a
   meio. `passos` e `importa` são opcionais (sem elas a secção não aparece). */
export const SECCOES_DEFINICOES = {
  empresa: 'Dados legais', contactos: 'Contactos', local: 'Morada da sede', textos: 'Textos do site',
  passos: 'Os passos', importa: '«O que nos importa»', perguntas: 'As perguntas', inicio: 'As fotografias da página inicial',
};
/* AS PARTES DE «DADOS DA LOJA», PELA PÁGINA DO SITE ONDE O TEXTO APARECE (26
   out 2026: a dona chegava com uma captura de uma página — «como altero
   isto?» — e os textos estavam arrumados pela secção do ficheiro). Cada
   problema leva ao ecrã da parte do campo dele (parteDaLoja). */
export const PARTES_DA_LOJA = {
  inicio: 'Página inicial', sobre: 'Sobre nós', encomendar: 'Como encomendar', contactos: 'Contactos',
  fichas: 'Fichas e rodapé', morada: 'Morada da sede', empresa: 'Dados legais',
};
/** O campo do definicoes.json («textos.hero_titulo», «passos.2.texto») → a parte dele, ou null. */
export function parteDaLoja(campo) {
  const [s, k = ''] = String(campo ?? '').split('.');
  if (s === 'textos') {
    if (/^(sobre_titulo|sobre_texto)$/.test(k)) return 'sobre';
    if (/^(encomendar_|perguntas_|prazo$)/.test(k)) return 'encomendar';
    if (/^contactos_/.test(k)) return 'contactos';
    if (/^(portes|ficha_|reclamo)/.test(k)) return 'fichas';
    return 'inicio';
  }
  return { contactos: 'contactos', inicio: 'inicio', importa: 'sobre', passos: 'encomendar', perguntas: 'encomendar', local: 'morada', empresa: 'empresa' }[s] ?? null;
}
/* OS TEXTOS DAS PÁGINAS (26 out 2026: estavam escritos no gerador, e a dona
   não lhes chegava). Todos opcionais: vazio, a linha ou o parágrafo não
   aparece. [chave, rótulo, tamanho, uma linha?] */
export const TEXTOS_DAS_PAGINAS = [
  ['inicio_categorias_linha', 'Categorias › linha por cima', 'linhaPequena', true],
  ['inicio_categorias_titulo', 'Categorias › título', 'tituloSecao', true],
  ['inicio_destaques_linha', 'Os mais pedidos › linha por cima', 'linhaPequena', true],
  ['inicio_destaques_titulo', 'Os mais pedidos › título', 'tituloSecao', true],
  ['inicio_quem_linha', '«Quem somos» › linha por cima', 'linhaPequena', true],
  ['encomendar_linha', 'Topo › linha por cima', 'linhaPequena', true],
  ['encomendar_titulo', 'Topo › título', 'tituloSecao', true],
  ['encomendar_texto', 'Topo › texto', 'textoSecao', false],
  ['perguntas_linha', 'Perguntas › linha por cima', 'linhaPequena', true],
  ['perguntas_titulo', 'Perguntas › título', 'tituloSecao', true],
  ['encomendar_fim_linha', 'Fim da página › linha por cima', 'linhaPequena', true],
  ['encomendar_fim_titulo', 'Fim da página › título', 'tituloSecao', true],
  ['encomendar_fim_texto', 'Fim da página › texto', 'textoSecao', false],
  ['encomendar_fim_nota', 'Fim da página › nota', 'textoSecao', false],
  ['contactos_linha', 'Página Contactos › linha por cima', 'linhaPequena', true],
  ['contactos_texto', 'Página Contactos › texto', 'textoSecao', false],
  ['contactos_whatsapp', 'Página Contactos › frase do WhatsApp', 'textoSecao', false],
  ['contactos_instagram', 'Página Contactos › frase do Instagram', 'textoSecao', false],
];
/* O que o painel nunca muda: `tecnico` (o endereço do site, que nenhum ecrã
   mostra). O Worker do painel recusa uma gravação do definicoes.json que o
   mude — ver mudancasBloqueadas(). Preserva-se e não se valida. */
export const BLOQUEADOS_DEFINICOES = ['tecnico'];

/* AS CATEGORIAS (data/categorias.json): uma lista de { slug, nome, curto,
   resumo, tecido, … }, pela ordem em que o site as mostra. Desde 26 out 2026 a
   dona cria-as, muda-lhes o nome e a ordem no painel (ecrã «Categorias»).
   O SLUG é o pedaço do endereço de cada artigo (/catalogo/<categoria>/<artigo>/):
   gera-se do nome ao criar (gerarSlug) e nunca muda. UMA CATEGORIA NÃO SE
   APAGA: cada artigo responde em todas as categorias (os endereços antigos de
   quem mudou de categoria), e esses endereços iam-se com ela; uma categoria
   sem artigos já não aparece no site (gerar.mjs, catsVisiveis).
   O painel escreve só estes campos (pela ordem do formulário); os outros
   (`texto`, `titulo_seo`, `descricao_seo`, das páginas de categoria que
   saíram em Agosto) ficam como estão — mudancasBloqueadas(). `tecido`: as
   peças são de tecido, e a ficha pede a composição (Regulamento (UE)
   1007/2011). */
export const CAMPOS_CATEGORIA = ['slug', 'nome', 'curto', 'resumo', 'tecido'];
export const EDITAVEIS_CATEGORIA = ['nome', 'curto', 'resumo', 'tecido'];
export const NOMES_CAMPOS_CATEGORIA = { nome: 'Nome da categoria', curto: 'Nome curto (filtro do catálogo)', resumo: 'Frase do cartão', tecido: 'Peças de tecido' };
/** A categoria é de peças de tecido (a ficha pede a composição). */
export const eDeTecido = (c) => eObjecto(c) && c.tecido === true;

/* ------------------------------------------------------------------ */
/* Limites                                                             */
/* ------------------------------------------------------------------ */

/* Os números: [mínimo, máximo]. A ordem inteira, o preço até 2 casas. */
export const LIMITES = { preco: [0, 100000], ordem: [0, 9999] };
/* Tamanhos máximos dos textos, em caracteres. Folgados: o maior texto de artigo
   de hoje tem perto de 1000. */
export const TAMANHOS = {
  nome: 120, resumo: 400, texto: 6000, personalizavel: 120, personalizavelItens: 30, fotos: 16, caminhoFoto: 300,
  composicao: 200, referencia: 60, fabricanteNome: 120, fabricanteMorada: 200, aviso: 200, avisos: 10, perigo: 200, perigos: 10,
  telefoneTexto: 20, email: 160, url: 500,
  morada: 160, localidade: 60, concelho: 60, pais: 40, codigoPostal: 20,
  nomeComercial: 80, assinatura: 80, denominacao: 160, formaJuridica: 80, cae: 40, nif: 20,
  heroTitulo: 80, heroTexto: 300, reclamo: 100, sobreTitulo: 120, sobreChamada: 300, sobreTexto: 3000, portes: 120, prazo: 200, fichaLinha: 80,
  passoTitulo: 60, passoTexto: 300, passos: 6,
  importaLinha: 60, importaTitulo: 120, importaItemTitulo: 60, importaItemTexto: 300, importaItens: 6,
  categoriaNome: 60, categoriaCurto: 30, categoriaResumo: 200,
  linhaPequena: 60, tituloSecao: 120, textoSecao: 600,
  perguntaTitulo: 150, perguntaTexto: 1500, perguntas: 20, fotosQuemSomos: 4,
};
/* O que o Worker do painel aceita gravar (recusa acima); aqui só se lembra, a
   partir de 80 %. */
export const TECTOS = { artigoBytes: 64 * 1024, definicoesBytes: 64 * 1024, aviso: 0.8 };
/* O NIF de espera: está nos dados desde Agosto de 2026, à espera do verdadeiro. */
export const NIF_DE_ESPERA = '000000000';

/* ------------------------------------------------------------------ */
/* Ajudantes que o painel e o Worker também usam                      */
/* ------------------------------------------------------------------ */

const eObjecto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const ausente = (x) => x === null || x === undefined;
const vazio = (x) => ausente(x) || (typeof x === 'string' && x.trim() === '') || (Array.isArray(x) && x.length === 0);
const temTexto = (x) => typeof x === 'string' && x.trim() !== '';
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const duasCasas = (n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
const bytesDe = (s) => new TextEncoder().encode(s).length;
const milhares = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export const terminacaoDe = (texto) => (typeof texto === 'string' && texto.endsWith('\n') ? '\n' : '');
/* Como os ficheiros estão escritos: 2 espaços e a terminação de cada um (os
   artigos que o Pages CMS gravou vêm sem \n no fim; os que o gerador de
   catálogo escreveu e o definicoes.json, com). Abrir e gravar sem mexer deixa
   o ficheiro igual, byte a byte. */
export function serializar(obj, terminacao = '') { return JSON.stringify(obj, null, 2) + (terminacao || ''); }

/* O endereço da página, a partir do nome do ficheiro — IGUAL ao do
   scripts/gerar.mjs, que usa o nome tal e qual (`f.slice(0, -5)`). */
export const slugDoFicheiro = (nome) => String(nome).replace(/\.json$/, '');

/* NIF português: 9 algarismos, o primeiro nunca é 0, e o de controlo (módulo 11). */
export function nifValido(nif) {
  const s = typeof nif === 'number' ? String(nif) : nif;
  if (typeof s !== 'string' || !/^[1-9][0-9]{8}$/.test(s)) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(s[i]) * (9 - i);
  const resto = soma % 11;
  return (resto < 2 ? 0 : 11 - resto) === Number(s[8]);
}

/* O SLUG DE UM ARTIGO NOVO: gerado UMA vez, ao criar, a partir do nome, e nunca
   mais muda — é o endereço da página que a loja partilha no WhatsApp e no
   Instagram. Mudar o nome de um artigo não muda o endereço. Como o Pages CMS
   fazia: minúsculas, sem acentos, o resto passa a hífen («Box para o pai» →
   box-para-o-pai).
   existentes: os slugs dos artigos E os nomes das pastas da biblioteca
   (assets/produtos/<x>/): um artigo novo que caísse na pasta de fotografias de
   outro misturava-lhe as fotografias e o cartão de partilha. Repetido: -2, -3… */
export function gerarSlug(nome, existentes = []) {
  const ja = existentes instanceof Set ? existentes : new Set(existentes);
  let base = String(ausente(nome) ? '' : nome)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '');
  if (!base) base = 'artigo';
  let slug = base;
  for (let n = 2; ja.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/* UMA FOTOGRAFIA EXISTE PARA O SITE quando o scripts/gerar.mjs (fotos()) lhe
   encontra as cópias (<nome>-480/-960/-1600.webp na mesma pasta), ou quando o
   original está lá e a publicação as vai fazer (o otimizar-imagens.py corre
   antes do gerador). Uma cópia escolhida («07-480.webp») vale pelo original de
   que veio, como no gerador desde 4 out 2026. Um og.jpg não é fotografia.
   O original conta só se o otimizar-imagens.py lhe fizer as cópias: um nome
   acabado em -480/-960/-1600 (com qualquer extensão) ou chamado «og» ele dá
   por cópia ou cartão e salta, e um «logo….png» dá-o por logótipo (que serve
   tal e qual) e salta também — e o site nunca o mostra.
   listarPasta(pasta) → os nomes do que está nessa pasta, ou [] se não existir. */
export function fotografiaExiste(caminho, listarPasta) {
  const limpo = String(caminho).trim().replace(/^\/+/, '');
  if (!limpo.includes('/')) return false;
  const nome = limpo.split('/').pop();
  if (nome.toLowerCase() === 'og.jpg') return false;
  const pasta = limpo.slice(0, limpo.lastIndexOf('/'));
  const base = nome.replace(RE_GERADA, '').replace(/\.[a-z0-9]+$/i, '');
  const l = listarPasta(pasta);
  const lista = Array.isArray(l) ? l : [];
  if (LARGURAS.some((w) => lista.includes(`${base}-${w}.webp`))) return true;
  if (/-(?:480|960|1600)$/.test(base) || base === 'og') return false;
  return lista.some((f) => {
    const ext = f.split('.').pop().toLowerCase();
    return !eGerada(f) && f.replace(/\.[a-z0-9]+$/i, '') === base && EXTENSOES_FOTO.includes(ext) && !(ext === 'png' && base.startsWith('logo'));
  });
}

/* Caracteres de controlo, por escape e nunca literais no código. */
const RE_CONTROLO_LINHA = /[\u0000-\u001F\u007F]/;
const RE_CONTROLO_TEXTO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/* «</script» e «<!--»: dentro de um <script> do JSON-LD, um fecha o elemento a
   meio e o outro muda a forma como o browser o lê. Não há texto honesto que os
   precise. */
const RE_PARTE_A_PAGINA = /<\/script|<!--/i;

/* Telefones portugueses, 9 algarismos: telemóvel (91, 92, 93, 96) e fixo (2…).
   O WhatsApp é sempre um telemóvel, com o indicativo 351 à frente. */
const RE_TELEMOVEL = /^9[1236][0-9]{7}$/;
const RE_FIXO = /^2[1-9][0-9]{7}$/;
const RE_WHATSAPP = /^3519[1236][0-9]{7}$/;
const RE_TELEFONE_TEXTO = /^[0-9 +.-]+$/;
export const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const emailValido = (v) => typeof v === 'string' && v.length <= TAMANHOS.email && RE_EMAIL.test(v.trim());
/* O endereço da página: o que o painel gera (gerarSlug). */
const RE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/* Um endereço https:// inteiro, sem espaços, aspas nem «<>». */
export function urlHttps(v) {
  if (typeof v !== 'string' || !/^https:\/\/[^\s"'<>\\]+$/.test(v.trim())) return false;
  try { return new URL(v.trim()).protocol === 'https:'; } catch { return false; }
}

/* A REDE DE UM TELEFONE, para a nota do custo da chamada que o site escreve
   junto do número (DL 59/2021). O site da AMMA escreve sempre «(Chamada para a
   rede móvel nacional)», por isso o telefone, quando existe, tem de ser um
   telemóvel. */
export const redeDoTelefone = (n) => (typeof n !== 'string' ? null : RE_TELEMOVEL.test(n) ? 'movel' : RE_FIXO.test(n) ? 'fixa' : null);

/* Um caminho de fotografia como o painel e o Pages CMS os escrevem: dentro de
   assets/produtos/ (com ou sem a barra à frente). Nada de «..», «//», barras
   para trás, aspas, nem os sinais que partem um endereço (# ? %). Espaços e
   acentos aceitam-se dentro do nome: o gerador codifica-os («1 - 9-pronta.jpg»
   existe). À volta do caminho, não: o gerador lê-o tal e qual e não acha a
   pasta. */
const EXT = [...EXTENSOES_FOTO, 'webp'].join('|');
const RE_FOTO_CAMINHO = new RegExp(`^/?${BIBLIOTECA}/(?:[^/]+/)*[^/]+\\.(?:${EXT})$`, 'i');
export function caminhoDeFotoValido(c) {
  if (typeof c !== 'string') return false;
  const s = c.trim();
  if (!s || s !== c || s.length > TAMANHOS.caminhoFoto) return false;
  if (RE_CONTROLO_LINHA.test(s) || /["<>\\#?%]/.test(s)) return false;
  if (!RE_FOTO_CAMINHO.test(s)) return false;
  const partes = s.replace(/^\/+/, '').split('/');
  return partes.every((p) => p !== '' && p !== '.' && p !== '..' && p.trim() === p);
}

/* Igualdade de valores lidos de JSON, com null ≡ ausente e sem ligar à ordem
   das chaves. */
function mesmoValor(a, b) {
  if (ausente(a) && ausente(b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => mesmoValor(x, b[i]));
  }
  if (eObjecto(a) || eObjecto(b)) {
    if (!eObjecto(a) || !eObjecto(b)) return false;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (!mesmoValor(a[k], b[k])) return false;
    return true;
  }
  return a === b;
}

/* Os textos de um valor (em profundidade), com o caminho de cada um. */
function textosDe(v, caminho = '') {
  if (typeof v === 'string') return [[caminho, v]];
  const filhos = Array.isArray(v) ? Array.from(v, (x, i) => [i, x]) : eObjecto(v) ? Object.entries(v) : [];
  return filhos.flatMap(([k, x]) => textosDe(x, caminho ? `${caminho}.${k}` : String(k)));
}

/* Lê um ficheiro: o TEXTO (string), o objecto já lido, ou null/undefined. */
function lerJson(valor) {
  if (ausente(valor)) return { ausente: true };
  if (typeof valor !== 'string') return { obj: valor, texto: null };
  try { return { obj: JSON.parse(valor), texto: valor }; } catch (e) { return { ilegivel: String((e && e.message) || e).slice(0, 120), texto: valor }; }
}

/* Os slugs das categorias de data/categorias.json (uma lista de { slug, nome }).
   null quando o ficheiro não se lê: aí não se confere a categoria dos artigos. */
export function categoriasDe(valor) {
  const l = lerJson(valor);
  if (!Array.isArray(l.obj)) return null;
  return l.obj.filter((c) => eObjecto(c) && temTexto(c.slug)).map((c) => ({ slug: c.slug, nome: temTexto(c.nome) ? c.nome.trim() : c.slug, tecido: c.tecido === true }));
}

/* ------------------------------------------------------------------ */
/* Um artigo                                                            */
/* ------------------------------------------------------------------ */

/* No site, como o gerador decide: tudo menos `publicado: false`. */
export const noSite = (a) => eObjecto(a) && a.publicado !== false;
/* O nome que o ecrã mostra, numa linha só, cortado a 80. */
export const nomeDoArtigo = (a, slug) => {
  const n = eObjecto(a) && temTexto(a.nome) ? a.nome.replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const curto = n.length > 80 ? `${n.slice(0, 79)}…` : n;
  return curto || slug || 'artigo sem nome';
};
const ecraDoArtigo = (a, slug) => `Artigos › ${nomeDoArtigo(a, slug)}`;

/* Os problemas de UM artigo, sem os que dependem dos outros. O painel usa-o
   campo a campo.
   ctx = { nome, categorias?: [slug] | null, imagemExiste?(caminho), listarPasta?(pasta) }
   Sem categorias, não se confere a categoria; sem imagemExiste nem
   listarPasta, não se confere se as fotografias existem (só a forma). */
export function problemasDoArtigo(a, ctx = {}) {
  const nome = typeof ctx.nome === 'string' ? ctx.nome : '';
  const slug = slugDoFicheiro(nome);
  const ficheiro = ficheiroDoArtigo(nome);
  const existe = typeof ctx.imagemExiste === 'function' ? ctx.imagemExiste
    : typeof ctx.listarPasta === 'function' ? (c) => fotografiaExiste(c, ctx.listarPasta) : null;
  const categorias = Array.isArray(ctx.categorias) ? ctx.categorias : null;
  const out = [];
  const ecra = ecraDoArtigo(a, slug);
  const base = { ficheiro, ecra, slug };
  const chave = (regra) => `artigo:${slug}:${regra}`;
  const neutraliza = (regra, efeito, campo, mensagem, extra = {}) => out.push({ classe: 'neutraliza', chave: chave(regra), campo, efeito, mensagem, ...base, ...extra });
  const avisa = (regra, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: chave(regra), campo, mensagem, ...base, ...extra });
  const lembra = (regra, campo, mensagem, extra = {}) => avisa(regra, campo, mensagem, { lembrete: true, ...extra });
  if (!eObjecto(a)) return out;   // a forma do ficheiro é do problemas(): bloqueia

  // --- neutraliza: o que o site não pode mostrar --------------------------
  /* Sem nome, o cartão do catálogo e a página ficavam sem título. (O gerador
     ordena os artigos pelo nome, e até 4 out 2026 rebentava com um que não o
     tivesse; agora lê-o como texto.) */
  if (vazio(a.nome)) neutraliza('nome', 'esconder', 'nome', 'Falta o nome do artigo: fica escondido do site até o escrever.');
  else if (typeof a.nome !== 'string') neutraliza('nome', 'esconder', 'nome', 'O nome do artigo tem de ser texto: fica escondido do site até ser corrigido.');
  /* A página do artigo parte o texto em parágrafos (`p.texto.split`) e o cartão
     mostra a frase curta: sem eles, a página rebentava o gerador (texto) ou
     ficava com um cartão vazio (frase). O artigo fica escondido até estarem. */
  for (const [campo, falta] of [['texto', 'o texto da página'], ['resumo', 'a frase curta do catálogo']]) {
    const x = a[campo];
    if (vazio(x)) neutraliza(campo, 'esconder', campo, `Falta ${falta}: o artigo fica escondido do site até estar preenchid${campo === 'texto' ? 'o' : 'a'}.`);
    else if (typeof x !== 'string') neutraliza(campo, 'esconder', campo, `«${NOMES_CAMPOS[campo]}» tem de ser texto: o artigo fica escondido do site até ser corrigido.`);
  }
  /* Sem categoria (ou com uma que não está nas categorias do site), o gerador
     não sabe onde pôr o artigo e rebenta nas migalhas de pão da ficha. Compara
     tal e qual, como ele (`c.slug === p.categoria`): « textil» não é «textil». */
  const cat = a.categoria;
  if (vazio(cat)) neutraliza('categoria', 'esconder', 'categoria', 'Falta a categoria: o artigo fica escondido do site até escolher uma.');
  else if (typeof cat !== 'string' || (categorias && !categorias.includes(cat))) neutraliza('categoria', 'esconder', 'categoria', 'A categoria não é nenhuma das do site: o artigo fica escondido até escolher uma da lista.');

  const partem = [];
  for (const [caminho, t] of textosDe(a)) if (RE_PARTE_A_PAGINA.test(t)) partem.push(caminho.split('.')[0]);
  if (partem.length) {
    const campos = [...new Set(partem)];
    neutraliza('partia-a-pagina', 'esconder', campos[0], `${campos.map((c) => `«${NOMES_CAMPOS[c] || c}»`).join(', ')}: tem «</script» ou «<!--», que não podem ir para o site. O artigo fica escondido do site até isso ser corrigido.`, { campos });
  }

  // --- fotografias ---------------------------------------------------------
  const fotos = a.fotos;
  const lista = Array.isArray(fotos) ? fotos : [];
  if (!ausente(fotos) && !Array.isArray(fotos)) {
    avisa('fotos', 'fotos', 'As fotografias não estão gravadas como uma lista: o artigo aparece sem fotografias. Escolha-as outra vez.');
  }
  /* Cada caminho lê-se TAL E QUAL, como o gerador: com um espaço à volta ele
     não acha a pasta, e a fotografia não aparece. Uma cópia («07-480.webp») e
     o original («07.jpg») são a mesma fotografia, que ele mostra uma vez só.
     Uma linha em branco não é nada (não aparece, e não há nada a tirar). */
  const vistos = new Set();
  lista.forEach((c, indice) => {
    if (typeof c === 'string' && c.trim() === '') return;
    const nomeFoto = typeof c === 'string' ? c.trim().split('/').pop() : String(c);
    const extra = { foto: c, indice };
    if (!caminhoDeFotoValido(c) || nomeFoto.toLowerCase() === 'og.jpg') {
      if (!vistos.has(`x:${String(c)}`)) {
        vistos.add(`x:${String(c)}`);
        neutraliza(`foto-invalida:${String(c)}`, 'sem_fotografia', 'fotos', `A fotografia «${nomeFoto.slice(0, 80)}» não é uma fotografia da biblioteca: não aparece no site. Tire-a do artigo e escolha-a outra vez.`, extra);
      }
      return;
    }
    const semBarra = c.replace(/^\/+/, '');
    const chaveFoto = semBarra.replace(RE_GERADA, '').replace(/\.[a-z0-9]+$/i, '');
    if (vistos.has(chaveFoto)) {
      avisa(`foto-repetida:${chaveFoto}`, 'fotos', `A fotografia «${nomeFoto}» está duas vezes no artigo. Tire uma delas.`, extra);
      return;
    }
    vistos.add(chaveFoto);
    if (existe && !existe(semBarra)) {
      neutraliza(`foto-em-falta:${chaveFoto}`, 'sem_fotografia', 'fotos', `A fotografia «${nomeFoto}» já não está na biblioteca: não aparece no site. Tire-a do artigo, ou carregue-a outra vez.`, extra);
    }
  });
  if (lista.length > TAMANHOS.fotos) avisa('fotos-a-mais', 'fotos', `O artigo tem ${lista.length} fotografias; o máximo é ${TAMANHOS.fotos}. Tire as que estão a mais.`);

  // --- valores de lista ------------------------------------------------------
  const oc = a.ocasioes;
  if (!ausente(oc)) {
    if (!Array.isArray(oc)) avisa('ocasioes', 'ocasioes', 'As ocasiões não estão gravadas como uma lista: o site não as mostra. Escolha-as outra vez.');
    else if (oc.some((o) => typeof o !== 'string' || !tem(OCASIOES, o))) avisa('ocasioes', 'ocasioes', 'Há uma ocasião que não está na lista do site: o site não a mostra. Escolha-as outra vez.');
  }
  for (const b of BOOLEANOS_ARTIGO) {
    if (!ausente(a[b]) && typeof a[b] !== 'boolean') avisa(b, b, `«${NOMES_CAMPOS[b]}» tem de ser sim ou não.`);
  }

  // --- números ----------------------------------------------------------------
  const numero = (campo, [min, max], mensagem, { casas = 0 } = {}) => {
    const x = a[campo];
    if (ausente(x) || x === '') return;
    const ok = typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max && (casas ? duasCasas(x) : Number.isInteger(x));
    if (!ok) avisa(campo, campo, mensagem);
  };
  numero('preco', LIMITES.preco, `O preço é só o número, sem € (ex.: 18 ou 24,50), de 0 a ${milhares(LIMITES.preco[1])} €. Vazio fica «Sob consulta».`, { casas: 2 });
  numero('ordem', LIMITES.ordem, `A posição é um número inteiro de 0 a ${LIMITES.ordem[1]} (mais baixo aparece primeiro; 500 se for indiferente).`);

  // --- textos -------------------------------------------------------------
  const texto = (campo, max, { linha = true } = {}) => {
    const x = a[campo];
    if (ausente(x) || typeof x !== 'string') return;
    if (x.length > max) avisa(`${campo}:tamanho`, campo, `«${NOMES_CAMPOS[campo]}» tem mais de ${max} caracteres (tem ${x.length}).`);
    if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(x)) avisa(`${campo}:controlo`, campo, `«${NOMES_CAMPOS[campo]}» tem caracteres invisíveis${linha ? ' (ex.: uma mudança de linha)' : ''}. Escreva-o outra vez.`);
  };
  texto('nome', TAMANHOS.nome);
  texto('resumo', TAMANHOS.resumo, { linha: false });
  texto('texto', TAMANHOS.texto, { linha: false });
  const pe = a.personalizavel;
  if (!ausente(pe)) {
    if (!Array.isArray(pe)) avisa('personalizavel', 'personalizavel', '«O que se personaliza» não está gravado como uma lista: o site não o mostra. Escreva-o outra vez, um por linha.');
    else {
      if (pe.length > TAMANHOS.personalizavelItens) avisa('personalizavel:quantos', 'personalizavel', `«O que se personaliza» tem ${pe.length} linhas; o máximo é ${TAMANHOS.personalizavelItens}.`);
      if (pe.some((x) => !ausente(x) && typeof x !== 'string')) avisa('personalizavel:texto', 'personalizavel', 'Cada linha de «O que se personaliza» tem de ser texto.');
      if (pe.some((x) => typeof x === 'string' && x.length > TAMANHOS.personalizavel)) avisa('personalizavel:tamanho', 'personalizavel', `Há uma linha de «O que se personaliza» com mais de ${TAMANHOS.personalizavel} caracteres: escreva-a curta (ex.: O nome do bebé).`);
      if (pe.some((x) => typeof x === 'string' && RE_CONTROLO_LINHA.test(x))) avisa('personalizavel:controlo', 'personalizavel', 'Há uma linha de «O que se personaliza» com caracteres invisíveis. Escreva-a outra vez.');
    }
  }

  // --- a informação do produto (opcional; só a forma — o gerador avisa do que falta) ---
  /* A composição com as percentagens, como a lei a pede («100 % algodão»):
     sem um «%» o site mostrava uma composição que não cumpre. É um LEMBRETE
     (não prende a gravação no painel nem esconde nada): as guardas legais
     avisam, nunca bloqueiam. */
  const comp = a.composicao;
  if (!ausente(comp) && comp !== '') {
    if (typeof comp !== 'string') avisa('composicao', 'composicao', '«Composição (têxtil)» tem de ser texto.');
    else {
      texto('composicao', TAMANHOS.composicao);
      if (temTexto(comp) && !/\d\s*%/.test(comp)) lembra('composicao:percentagem', 'composicao', 'A composição escreve-se com as percentagens de cada fibra, como na etiqueta: «100 % algodão» ou «80 % algodão, 20 % poliéster» (Regulamento (UE) 1007/2011).');
    }
  }
  texto('referencia', TAMANHOS.referencia);
  if (!ausente(a.referencia) && typeof a.referencia !== 'string') avisa('referencia', 'referencia', '«Referência do artigo» tem de ser texto.');
  const fab = a.fabricante;
  if (!ausente(fab)) {
    if (!eObjecto(fab)) avisa('fabricante', 'fabricante.nome', '«Fabricante» não está gravado como deve ser: escreva o nome, a morada e o email outra vez.');
    else {
      for (const [k, max] of [['nome', TAMANHOS.fabricanteNome], ['morada', TAMANHOS.fabricanteMorada], ['email', TAMANHOS.email]]) {
        const x = fab[k];
        if (ausente(x)) continue;
        if (typeof x !== 'string') { avisa(`fabricante.${k}`, `fabricante.${k}`, `«${NOMES_CAMPOS[`fabricante.${k}`]}» tem de ser texto.`); continue; }
        if (x.length > max) avisa(`fabricante.${k}:tamanho`, `fabricante.${k}`, `«${NOMES_CAMPOS[`fabricante.${k}`]}» tem mais de ${max} caracteres (tem ${x.length}).`);
        if (RE_CONTROLO_LINHA.test(x)) avisa(`fabricante.${k}:controlo`, `fabricante.${k}`, `«${NOMES_CAMPOS[`fabricante.${k}`]}» tem caracteres invisíveis (ex.: uma mudança de linha). Escreva-o outra vez.`);
      }
      if (temTexto(fab.email) && !emailValido(fab.email.trim())) avisa('fabricante.email:formato', 'fabricante.email', 'O email do fabricante não parece estar certo (ex.: nome@gmail.com).');
      for (const k of Object.keys(fab)) if (!CAMPOS_FABRICANTE.includes(k)) { avisa('fabricante:chaves', 'fabricante.nome', 'O fabricante só tem nome, morada e email: há outra coisa gravada lá dentro.'); break; }
    }
  }
  for (const [campo, max, maxItens] of [['avisos', TAMANHOS.aviso, TAMANHOS.avisos], ['perigos', TAMANHOS.perigo, TAMANHOS.perigos]]) {
    const l = a[campo];
    if (ausente(l)) continue;
    if (!Array.isArray(l)) { avisa(campo, campo, `«${NOMES_CAMPOS[campo]}» não está gravado como uma lista: escreva-os outra vez, um por linha.`); continue; }
    if (l.length > maxItens) avisa(`${campo}:quantos`, campo, `«${NOMES_CAMPOS[campo]}» tem ${l.length} linhas; o máximo é ${maxItens}.`);
    if (l.some((x) => !ausente(x) && typeof x !== 'string')) avisa(`${campo}:texto`, campo, `Cada linha de «${NOMES_CAMPOS[campo]}» tem de ser texto.`);
    if (l.some((x) => typeof x === 'string' && x.length > max)) avisa(`${campo}:tamanho`, campo, `Há uma linha de «${NOMES_CAMPOS[campo]}» com mais de ${max} caracteres: escreva-a curta.`);
    if (l.some((x) => typeof x === 'string' && RE_CONTROLO_LINHA.test(x))) avisa(`${campo}:controlo`, campo, `Há uma linha de «${NOMES_CAMPOS[campo]}» com caracteres invisíveis. Escreva-a outra vez.`);
  }

  // --- lembretes (só os publicados) ------------------------------------------
  if (noSite(a) && !lista.some((c) => typeof c === 'string' && c.trim() !== '')) {
    lembra('sem-fotos', 'fotos', 'O artigo não tem fotografias. A primeira é a capa e a imagem das partilhas no WhatsApp.');
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* data/definicoes.json                                                */
/* ------------------------------------------------------------------ */

export function problemasDasDefinicoes(d) {
  const ficheiro = FICHEIROS.definicoes;
  const out = [];
  /* O ecrã é o da parte do CAMPO (parteDaLoja), que é a página do site onde se vê. */
  const ecraDe = (campo) => { const p = parteDaLoja(campo); return p ? `Dados da loja › ${PARTES_DA_LOJA[p]}` : 'Dados da loja'; };
  const bloqueia = (chave, seccao, campo, mensagem) => out.push({ classe: 'bloqueia', chave: `definicoes:${chave}`, ficheiro, ecra: ecraDe(campo ?? seccao), campo, mensagem });
  const avisa = (chave, seccao, campo, mensagem, extra = {}) => out.push({ classe: 'avisa', chave: `definicoes:${chave}`, ficheiro, ecra: ecraDe(campo ?? seccao), campo, mensagem, ...extra });
  if (!eObjecto(d)) { bloqueia('forma', null, undefined, 'Os dados da loja não têm a forma certa. Só o Renato os pode corrigir.'); return out; }

  /* As secções que o gerador lê sem perguntar. */
  for (const s of ['empresa', 'contactos', 'local', 'textos']) {
    if (!eObjecto(d[s])) bloqueia(`${s}:forma`, s, s, `A secção «${SECCOES_DEFINICOES[s]}» não está gravada, e sem ela o site não se consegue gerar. Preencha os campos dela e grave outra vez.`);
  }

  const partidos = textosDe(Object.fromEntries(Object.entries(d).filter(([k]) => !BLOQUEADOS_DEFINICOES.includes(k)))).filter(([, t]) => RE_PARTE_A_PAGINA.test(t));
  if (partidos.length) {
    const seccao = partidos[0][0].split('.')[0];
    bloqueia('partia-a-pagina', tem(SECCOES_DEFINICOES, seccao) ? seccao : null, partidos[0][0], 'Um texto tem «</script» ou «<!--», que não podem ir para o site. Apague-o e escreva-o outra vez.');
  }

  /* Um texto de um campo, pelo rótulo que a dona vê.
     vazio: a classe quando falta ('bloqueia' — a lei ou o gerador; 'avisa' —
     fica um buraco no site) ou null (opcional); porque: o que acontece sem ele. */
  const textoSimples = (valor, chave, seccao, campo, rotulo, max, { vazio: classeVazio = null, porque = '', linha = true } = {}) => {
    if (vazio(valor)) {
      if (classeVazio === 'bloqueia') bloqueia(chave, seccao, campo, `Preencha «${rotulo}»: ${porque || 'é obrigatório por lei'}, e sem isso o site não é publicado.`);
      else if (classeVazio) avisa(chave, seccao, campo, `Preencha «${rotulo}»: ${porque || 'sem isso fica um espaço em branco no site.'}`);
      return false;
    }
    if (typeof valor !== 'string') { (classeVazio === 'bloqueia' ? bloqueia : avisa)(chave, seccao, campo, `«${rotulo}» tem de ser texto.`); return false; }
    if (valor.length > max) avisa(`${chave}:tamanho`, seccao, campo, `«${rotulo}» tem mais de ${max} caracteres (tem ${valor.length}).`);
    if ((linha ? RE_CONTROLO_LINHA : RE_CONTROLO_TEXTO).test(valor)) avisa(`${chave}:controlo`, seccao, campo, `«${rotulo}» tem caracteres invisíveis${linha ? ' (ex.: uma mudança de linha)' : ''}. Escreva-o outra vez.`);
    return true;
  };

  // --- dados legais ------------------------------------------------------------
  const e = d.empresa;
  if (eObjecto(e)) {
    textoSimples(e.nome_comercial, 'empresa.nome_comercial', 'empresa', 'empresa.nome_comercial', 'Nome comercial', TAMANHOS.nomeComercial, { vazio: 'bloqueia', porque: 'é obrigatório por lei e aparece em todas as páginas' });
    textoSimples(e.assinatura, 'empresa.assinatura', 'empresa', 'empresa.assinatura', 'Assinatura', TAMANHOS.assinatura);
    textoSimples(e.forma_juridica, 'empresa.forma_juridica', 'empresa', 'empresa.forma_juridica', 'Forma jurídica', TAMANHOS.formaJuridica);
    textoSimples(e.cae, 'empresa.cae', 'empresa', 'empresa.cae', 'CAE', TAMANHOS.cae);
    if (vazio(e.nif)) bloqueia('empresa.nif', 'empresa', 'empresa.nif', 'Preencha o NIF: é obrigatório por lei, e sem ele o site não é publicado.');
    else if (String(e.nif).trim() === NIF_DE_ESPERA) avisa('empresa.nif:espera', 'empresa', 'empresa.nif', 'O NIF ainda é o «000000000» de espera. A lei pede o NIF verdadeiro nas páginas legais: escreva-o assim que o tiver.', { lembrete: true });
    else if (!nifValido(String(e.nif).trim())) avisa('empresa.nif:formato', 'empresa', 'empresa.nif', 'Este NIF não é válido: são 9 algarismos, sem espaços, e o último confere os outros. Veja-o num documento das Finanças.');
    if (textoSimples(e.denominacao_social, 'empresa.denominacao_social', 'empresa', 'empresa.denominacao_social', 'Nome completo da titular', TAMANHOS.denominacao)) {
      if (/a confirmar/i.test(e.denominacao_social)) avisa('empresa.denominacao_social:espera', 'empresa', 'empresa.denominacao_social', 'O nome completo da titular ainda diz «a confirmar». Numa empresa em nome individual a lei pede o nome da pessoa: escreva-o assim que puder.', { lembrete: true });
    }
  }

  // --- contactos ------------------------------------------------------------
  /* O gerador escreve o WhatsApp nos botões de todas as páginas (wa.me/…) e o
     Instagram nos links. O telefone é opcional: com ele, o site mostra-o nos
     Contactos com a nota do custo da chamada para a rede MÓVEL, que está
     escrita no site — por isso tem de ser um telemóvel. */
  const c = d.contactos;
  if (eObjecto(c)) {
    if (vazio(c.whatsapp)) bloqueia('contactos.whatsapp', 'contactos', 'contactos.whatsapp', 'Preencha o WhatsApp: é o botão «Encomendar» de todas as páginas, e sem ele o site não é publicado.');
    else if (!(typeof c.whatsapp === 'string' && RE_WHATSAPP.test(c.whatsapp.trim()))) bloqueia('contactos.whatsapp', 'contactos', 'contactos.whatsapp', 'O WhatsApp escreve-se com o 351 à frente e sem espaços nem sinais: 351930477114.');
    if (vazio(c.instagram)) avisa('contactos.instagram', 'contactos', 'contactos.instagram', 'Preencha o Instagram: é o link das redes em todas as páginas.');
    else if (!urlHttps(c.instagram)) avisa('contactos.instagram', 'contactos', 'contactos.instagram', 'O Instagram é o endereço completo da página, a começar por https:// (ex.: https://www.instagram.com/_ammacreative).');
    if (!vazio(c.email) && !emailValido(c.email)) avisa('contactos.email', 'contactos', 'contactos.email', 'Este email não parece estar certo (ex.: nome@gmail.com).');
    const num = c.telefone; const txt = c.telefone_texto;
    if (!(vazio(num) && vazio(txt))) {
      if (vazio(num)) avisa('contactos.telefone', 'contactos', 'contactos.telefone', 'Preencha «Telefone (só dígitos)» (o «como aparece» está preenchido), ou apague os dois.');
      else if (redeDoTelefone(String(num).trim()) !== 'movel') avisa('contactos.telefone', 'contactos', 'contactos.telefone', 'O telefone tem de ser um telemóvel português de 9 algarismos, sem espaços (começa por 91, 92, 93 ou 96): o site escreve junto dele «Chamada para a rede móvel nacional».');
      if (vazio(txt)) avisa('contactos.telefone_texto', 'contactos', 'contactos.telefone_texto', 'Preencha «Telefone (como aparece)»: é o número que se lê no site (ex.: 930 477 114).');
      else if (!(typeof txt === 'string' && RE_TELEFONE_TEXTO.test(txt) && txt.length <= TAMANHOS.telefoneTexto)) avisa('contactos.telefone_texto', 'contactos', 'contactos.telefone_texto', '«Telefone (como aparece)» só pode ter algarismos e espaços (ex.: 930 477 114).');
      else if (!vazio(num) && txt.replace(/[^0-9]/g, '').replace(/^351(?=[0-9]{9}$)/, '') !== String(num).trim()) avisa('contactos.telefone_texto', 'contactos', 'contactos.telefone_texto', '«Telefone (como aparece)» não é o mesmo número de «Telefone (só dígitos)».');
    }
  }

  // --- a morada da sede (só nas páginas legais) ------------------------------
  const l = d.local;
  if (eObjecto(l)) {
    const porque = 'a lei pede a morada da sede nas páginas legais (DL 7/2004, art. 10.º)';
    textoSimples(l.morada, 'local.morada', 'local', 'local.morada', 'Rua e número', TAMANHOS.morada, { vazio: 'bloqueia', porque });
    textoSimples(l.codigo_postal, 'local.codigo_postal', 'local', 'local.codigo_postal', 'Código postal', TAMANHOS.codigoPostal, { vazio: 'bloqueia', porque });
    textoSimples(l.localidade, 'local.localidade', 'local', 'local.localidade', 'Localidade', TAMANHOS.localidade, { vazio: 'bloqueia', porque });
    textoSimples(l.concelho, 'local.concelho', 'local', 'local.concelho', 'Concelho', TAMANHOS.concelho, { vazio: 'bloqueia', porque });
    textoSimples(l.pais, 'local.pais', 'local', 'local.pais', 'País', TAMANHOS.pais, { vazio: 'bloqueia', porque });
    if (typeof l.codigo_postal === 'string' && temTexto(l.codigo_postal) && !/^[0-9]{4}-[0-9]{3}$/.test(l.codigo_postal.trim())) {
      avisa('local.codigo_postal:formato', 'local', 'local.codigo_postal', 'O código postal escreve-se 0000-000, completo: a lei pede a morada inteira.', { lembrete: true });
    }
  }

  // --- textos do site ---------------------------------------------------------
  const t = d.textos;
  if (eObjecto(t)) {
    textoSimples(t.hero_titulo, 'textos.hero_titulo', 'textos', 'textos.hero_titulo', 'Título da página inicial', TAMANHOS.heroTitulo, { vazio: 'avisa' });
    textoSimples(t.hero_texto, 'textos.hero_texto', 'textos', 'textos.hero_texto', 'Texto da página inicial', TAMANHOS.heroTexto, { vazio: 'avisa', linha: false });
    textoSimples(t.reclamo, 'textos.reclamo', 'textos', 'textos.reclamo', 'Frase da marca (rodapé)', TAMANHOS.reclamo);
    textoSimples(t.sobre_titulo, 'textos.sobre_titulo', 'textos', 'textos.sobre_titulo', 'Título do «Sobre nós»', TAMANHOS.sobreTitulo, { vazio: 'avisa' });
    /* Opcionais: vazios, a frase (ou a linha) não aparece. */
    textoSimples(t.sobre_chamada, 'textos.sobre_chamada', 'textos', 'textos.sobre_chamada', 'Frase do «Quem somos» (página inicial)', TAMANHOS.sobreChamada, { linha: false });
    textoSimples(t.ficha_previa, 'textos.ficha_previa', 'textos', 'textos.ficha_previa', '2.ª linha das fichas', TAMANHOS.fichaLinha);
    textoSimples(t.ficha_feito, 'textos.ficha_feito', 'textos', 'textos.ficha_feito', '3.ª linha das fichas', TAMANHOS.fichaLinha);
    textoSimples(t.sobre_texto, 'textos.sobre_texto', 'textos', 'textos.sobre_texto', 'Texto do «Sobre nós»', TAMANHOS.sobreTexto, { vazio: 'bloqueia', porque: 'é o texto da página «Sobre nós»', linha: false });
    textoSimples(t.portes, 'textos.portes', 'textos', 'textos.portes', 'Frase dos portes', TAMANHOS.portes, { vazio: 'bloqueia', porque: 'aparece em todas as fichas de artigo' });
    textoSimples(t.prazo, 'textos.prazo', 'textos', 'textos.prazo', 'Prazo de produção', TAMANHOS.prazo, { vazio: 'avisa', porque: 'numa venda à distância o prazo é informação obrigatória.' });
    for (const [k, rotulo, tam, linha] of TEXTOS_DAS_PAGINAS) textoSimples(t[k], `textos.${k}`, 'textos', `textos.${k}`, rotulo, TAMANHOS[tam], { linha });
  }

  // --- listas: os passos e «O que nos importa» ---------------------------------
  const lista = (valor, seccao, max, item) => {
    if (ausente(valor)) return;
    const nome = `«${SECCOES_DEFINICOES[seccao]}» (${PARTES_DA_LOJA[parteDaLoja(seccao)]})`;
    if (!Array.isArray(valor)) { avisa(`${seccao}:forma`, seccao, seccao, `A lista ${nome} não está gravada como uma lista: escreva-a outra vez.`); return; }
    if (valor.length > max) avisa(`${seccao}:quantos`, seccao, seccao, `A lista ${nome} tem ${valor.length}; o máximo é ${max}.`);
    valor.forEach((x, i) => item(x, i));
  };
  lista(d.passos, 'passos', TAMANHOS.passos, (p, i) => {
    if (!eObjecto(p)) { avisa(`passos.${i}:forma`, 'passos', 'passos', `O passo ${i + 1} não tem a forma de um passo.`); return; }
    textoSimples(p.titulo, `passos.${i}.titulo`, 'passos', `passos.${i}.titulo`, `Título do passo ${i + 1}`, TAMANHOS.passoTitulo, { vazio: 'avisa', porque: 'um passo sem título não aparece no site.' });
    textoSimples(p.texto, `passos.${i}.texto`, 'passos', `passos.${i}.texto`, `Explicação do passo ${i + 1}`, TAMANHOS.passoTexto, { linha: false });
  });
  const im = d.importa;
  if (!ausente(im)) {
    if (!eObjecto(im)) avisa('importa:forma', 'importa', 'importa', '«O que nos importa» não tem a forma certa: escreva-o outra vez.');
    else {
      textoSimples(im.linha, 'importa.linha', 'importa', 'importa.linha', 'Linha pequena por cima', TAMANHOS.importaLinha);
      textoSimples(im.titulo, 'importa.titulo', 'importa', 'importa.titulo', 'Título', TAMANHOS.importaTitulo);
      lista(im.itens, 'importa', TAMANHOS.importaItens, (p, i) => {
        if (!eObjecto(p)) { avisa(`importa.itens.${i}:forma`, 'importa', 'importa.itens', `O ponto ${i + 1} não tem a forma de um ponto.`); return; }
        textoSimples(p.titulo, `importa.itens.${i}.titulo`, 'importa', `importa.itens.${i}.titulo`, `Título do ponto ${i + 1}`, TAMANHOS.importaItemTitulo, { vazio: 'avisa', porque: 'um ponto sem título não aparece no site.' });
        textoSimples(p.texto, `importa.itens.${i}.texto`, 'importa', `importa.itens.${i}.texto`, `Explicação do ponto ${i + 1}`, TAMANHOS.importaItemTexto, { linha: false });
      });
    }
  }

  // --- as perguntas do «Como encomendar» -----------------------------------------
  /* Uma pergunta sem resposta não aparece (nem no Google). Os PORTES: a
     resposta que fala deles com um valor em euros que a «Frase dos portes»
     não tem diz um preço que o site não cumpre noutro sítio — avisa. */
  const eurosDe = (s) => new Set([...String(s ?? '').matchAll(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?)/gi)].map((m) => m[1].replace(',', '.').replace(/\.0+$/, '')));
  const eurosDosPortes = eurosDe(eObjecto(t) ? t.portes : '');
  lista(d.perguntas, 'perguntas', TAMANHOS.perguntas, (p, i) => {
    if (!eObjecto(p)) { avisa(`perguntas.${i}:forma`, 'perguntas', 'perguntas', `A pergunta ${i + 1} não tem a forma de uma pergunta.`); return; }
    textoSimples(p.titulo, `perguntas.${i}.titulo`, 'perguntas', `perguntas.${i}.titulo`, `Pergunta ${i + 1}`, TAMANHOS.perguntaTitulo, { vazio: 'avisa', porque: 'uma pergunta sem texto não aparece no site.' });
    textoSimples(p.texto, `perguntas.${i}.texto`, 'perguntas', `perguntas.${i}.texto`, `Resposta ${i + 1}`, TAMANHOS.perguntaTexto, { vazio: 'avisa', porque: 'uma pergunta sem resposta não aparece no site.', linha: false });
    if (eurosDosPortes.size && /portes|envio/i.test(`${p.titulo ?? ''} ${p.texto ?? ''}`)) {
      const outro = [...eurosDe(p.texto)].find((v) => !eurosDosPortes.has(v));
      if (outro) avisa(`perguntas.${i}.texto:portes`, 'perguntas', `perguntas.${i}.texto`, `A pergunta «${String(p.titulo ?? '').trim() || i + 1}» (Como encomendar) fala de ${outro}€ e a «Frase dos portes» (Fichas e rodapé) de ${[...eurosDosPortes].join(' e ')}€: ponha as duas a dizer o mesmo.`, { portes: true });
    }
  });

  // --- as fotografias da página inicial ---------------------------------------
  /* Caminhos de fotografias da biblioteca. Uma que já lá não está não parte o
     site: o gerador usa a de sempre (a capa de um artigo em destaque). */
  const ini = d.inicio;
  if (!ausente(ini)) {
    if (!eObjecto(ini)) avisa('inicio:forma', 'inicio', 'inicio', 'As fotografias da página inicial não têm a forma certa: escolha-as outra vez.');
    else {
      const foto = (v, campo, rotulo) => { if (!ausente(v) && !(typeof v === 'string' && v.startsWith('assets/'))) avisa(`${campo}:forma`, 'inicio', campo, `«${rotulo}» não é uma fotografia do site: escolha-a outra vez.`); };
      foto(ini.foto, 'inicio.foto', 'Fotografia do topo');
      if (!ausente(ini.fotos)) {
        if (!Array.isArray(ini.fotos)) avisa('inicio.fotos:forma', 'inicio', 'inicio.fotos', 'As fotografias do «Quem somos» têm de ser uma lista: escolha-as outra vez.');
        else {
          if (ini.fotos.length > TAMANHOS.fotosQuemSomos) avisa('inicio.fotos:quantos', 'inicio', 'inicio.fotos', `O «Quem somos» tem ${ini.fotos.length} fotografias; o máximo é ${TAMANHOS.fotosQuemSomos}.`);
          ini.fotos.forEach((v, i) => foto(v, `inicio.fotos.${i}`, `Fotografia ${i + 1} do «Quem somos»`));
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* As categorias                                                       */
/* ------------------------------------------------------------------ */

/* Os problemas de cada categoria (a lista lida de data/categorias.json), sem
   os do ficheiro inteiro (que problemas() diz). O painel usa-o campo a campo.
   Uma entrada sem endereço ou repetida, ou um endereço que não é um slug,
   «bloqueia» (o painel nunca as escreve: só um commit à mão). Um nome vazio ou
   comprido de mais «avisa» — o painel não deixa gravar, mas não é razão para
   parar o site. `categoria` é o slug, para o painel achar a linha. */
export function problemasDasCategorias(lista) {
  const ficheiro = FICHEIROS.categorias;
  const out = [];
  if (!Array.isArray(lista)) return out;
  const vistas = new Set();
  lista.forEach((c, i) => {
    if (!eObjecto(c) || !temTexto(c.slug)) {
      out.push({ classe: 'bloqueia', chave: `categorias:entrada:${i}`, ficheiro, ecra: 'Categorias', mensagem: `A ${i + 1}.ª categoria do site não tem endereço: sem ele o site não se consegue gerar. Só o Renato a pode corrigir.` });
      return;
    }
    const slug = c.slug;
    const nome = temTexto(c.nome) ? c.nome.trim() : slug;
    const ecra = `Categorias › ${nome}`;
    const base = { ficheiro, ecra, categoria: slug };
    const bloqueia = (regra, mensagem, extra = {}) => out.push({ classe: 'bloqueia', chave: `categoria:${slug}:${regra}`, ...base, mensagem, ...extra });
    const avisa = (regra, campo, mensagem) => out.push({ classe: 'avisa', chave: `categoria:${slug}:${regra}`, ...base, campo, mensagem });
    if (vistas.has(slug)) bloqueia('repetida', `Há duas categorias com o endereço «${slug}». Só o Renato o pode corrigir.`);
    vistas.add(slug);
    if (!RE_SLUG.test(slug)) bloqueia('endereco', `O endereço da categoria «${nome}» («${slug}») não é como os outros (só minúsculas, algarismos e hífens). Só o Renato o pode corrigir.`);
    if (textosDe(c).some(([, t]) => RE_PARTE_A_PAGINA.test(t))) bloqueia('partia-a-pagina', 'Um texto desta categoria tem «</script» ou «<!--», que não podem ir para o site. Apague-o e escreva-o outra vez.');
    const texto = (k, max, obrigatorio) => {
      const v = c[k];
      const rotulo = NOMES_CAMPOS_CATEGORIA[k];
      if (vazio(v)) { if (obrigatorio) avisa(k, k, `Preencha «${rotulo}».`); return; }
      if (typeof v !== 'string') { avisa(k, k, `«${rotulo}» tem de ser texto.`); return; }
      if (v.length > max) avisa(`${k}:tamanho`, k, `«${rotulo}» tem mais de ${max} caracteres (tem ${v.length}).`);
      if (RE_CONTROLO_LINHA.test(v)) avisa(`${k}:controlo`, k, `«${rotulo}» tem caracteres invisíveis (ex.: uma mudança de linha). Escreva-o outra vez.`);
    };
    /* O nome é string (sem ele o gerador rebenta: problemas(), categorias:forma);
       vazio, o botão do filtro e o cartão ficavam sem texto. */
    if (typeof c.nome === 'string') texto('nome', TAMANHOS.categoriaNome, true);
    texto('curto', TAMANHOS.categoriaCurto, false);
    texto('resumo', TAMANHOS.categoriaResumo, false);
    if (!ausente(c.tecido) && typeof c.tecido !== 'boolean') avisa('tecido', 'tecido', `«${NOMES_CAMPOS_CATEGORIA.tecido}» é um sim ou não.`);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Todos                                                               */
/* ------------------------------------------------------------------ */

/* problemas(dados, opcoes)
 *   dados:  ver o cabeçalho;
 *   opcoes: { imagemExiste?(caminho) → boolean, listarPasta?(pasta) → nomes —
 *             o que o gerador vê, para fotografiaExiste() }
 *   → [problema]: primeiro as definições, depois os artigos por nome. */
export function problemas(dados = {}, opcoes = {}) {
  const lista = [];
  const d = eObjecto(dados) ? dados : {};

  if (tem(d, 'definicoes')) {
    const ficheiro = FICHEIROS.definicoes;
    const l = lerJson(d.definicoes);
    if (l.ausente) lista.push({ classe: 'bloqueia', chave: 'definicoes:ausente', ficheiro, ecra: 'Dados da loja', mensagem: `Falta o ficheiro ${ficheiro}: sem ele o site não se consegue gerar. Só o Renato o pode repor.` });
    else if (l.ilegivel) lista.push({ classe: 'bloqueia', chave: 'definicoes:ilegivel', ficheiro, ecra: 'Dados da loja', mensagem: `Os dados da loja não se conseguem ler (JSON inválido: ${l.ilegivel}). Só o Renato os pode corrigir.` });
    else {
      lista.push(...problemasDasDefinicoes(l.obj));
      const bytes = l.texto !== null ? bytesDe(l.texto) : bytesDe(serializar(l.obj));
      if (bytes > TECTOS.definicoesBytes * TECTOS.aviso) {
        lista.push({ classe: 'avisa', chave: 'definicoes:tecto', ficheiro, ecra: 'Dados da loja', lembrete: true, mensagem: `Os dados da loja estão a chegar ao limite do painel (${Math.round(bytes / 1024)} de ${TECTOS.definicoesBytes / 1024} KB). Encurte os textos mais compridos.` });
      }
    }
  }

  let categorias = null;
  if (tem(d, 'categorias')) {
    const cs = categoriasDe(d.categorias);
    if (!cs || !cs.length) lista.push({ classe: 'bloqueia', chave: 'categorias:ilegivel', ficheiro: FICHEIROS.categorias, ecra: 'Categorias', mensagem: 'As categorias do site não se conseguem ler: sem elas o site não se consegue gerar. Só o Renato as pode corrigir.' });
    else {
      categorias = cs.map((c) => c.slug);
      /* O gerador escreve o nome de cada categoria (em minúsculas, no botão do
         fim de cada ficha): uma sem nome rebenta-o. */
      const lida = lerJson(d.categorias).obj;
      if (lida.some((c) => eObjecto(c) && temTexto(c.slug) && typeof c.nome !== 'string')) lista.push({ classe: 'bloqueia', chave: 'categorias:forma', ficheiro: FICHEIROS.categorias, ecra: 'Categorias', mensagem: 'Há uma categoria do site sem nome: sem ele o site não se consegue gerar. Só o Renato a pode corrigir.' });
      lista.push(...problemasDasCategorias(lida));
    }
  }

  const mapa = d.artigos;
  if (eObjecto(mapa)) {
    for (const nome of Object.keys(mapa).sort()) {
      const valor = mapa[nome];
      if (ausente(valor)) continue;
      const slug = slugDoFicheiro(nome);
      const ficheiro = ficheiroDoArtigo(nome);
      const ecra = `Artigos › ${slug || nome}`;
      const base = { ficheiro, slug };
      if (!slug) {
        lista.push({ classe: 'bloqueia', chave: `artigo:${nome}:endereco-vazio`, ecra, ...base, mensagem: `O ficheiro ${ficheiro} não dá endereço nenhum. Só o Renato o pode corrigir.` });
        continue;
      }
      const l = lerJson(valor);
      if (l.ilegivel) { lista.push({ classe: 'bloqueia', chave: `artigo:${slug}:ilegivel`, ecra, ...base, mensagem: `O ficheiro deste artigo não se consegue ler (JSON inválido: ${l.ilegivel}). Só o Renato o pode corrigir.` }); continue; }
      if (!eObjecto(l.obj)) { lista.push({ classe: 'bloqueia', chave: `artigo:${slug}:forma`, ecra, ...base, mensagem: 'O ficheiro deste artigo não tem a forma de um artigo (sem ela o site não se consegue gerar). Só o Renato o pode corrigir.' }); continue; }
      if (!RE_SLUG.test(slug)) {
        lista.push({ classe: 'avisa', chave: `artigo:${slug}:endereco`, ecra: ecraDoArtigo(l.obj, slug), ...base, mensagem: `O endereço desta página («${slug}») não é como os outros (só minúsculas, algarismos e hífens): o site publica-a na mesma, mas o painel não lhe consegue guardar fotografias novas. Só o Renato o pode corrigir.` });
      }
      lista.push(...problemasDoArtigo(l.obj, { nome, categorias, imagemExiste: opcoes.imagemExiste, listarPasta: opcoes.listarPasta }));
      const bytes = l.texto !== null ? bytesDe(l.texto) : bytesDe(serializar(l.obj));
      if (bytes > TECTOS.artigoBytes * TECTOS.aviso) {
        lista.push({ classe: 'avisa', chave: `artigo:${slug}:tecto`, ecra: ecraDoArtigo(l.obj, slug), ...base, lembrete: true, mensagem: `Este artigo está a chegar ao limite do painel (${Math.round(bytes / 1024)} de ${TECTOS.artigoBytes / 1024} KB): encurte o texto.` });
      }
    }
  }
  return lista;
}

/* ------------------------------------------------------------------ */
/* A cópia que o gerador lê                                            */
/* ------------------------------------------------------------------ */

/* neutralizar(dados, lista) → { ficheiros, efeitos, mudou }
 *   Os problemas «neutraliza» aplicados a uma CÓPIA dos artigos:
 *     · esconder       — publicado: false (sai do site, como um rascunho);
 *     · sem_fotografia — a fotografia sai da lista: um caminho que não é da
 *       biblioteca, ou uma fotografia que já não existe (a mesma conta do
 *       gerador — fotografiaExiste()).
 *   ficheiros: { <caminho>: texto } — SÓ os que mudam, com a terminação que
 *              tinham;
 *   efeitos:   o que muda NO SITE, por artigo:
 *              [{ ficheiro, slug, nome, efeitos: [...], motivos: [...], fotos: [...] }]
 *   mudou:     false → a cópia é o repositório, byte a byte. */
export function neutralizar(dados = {}, lista = []) {
  const d = eObjecto(dados) ? dados : {};
  const porFicheiro = new Map();
  for (const p of Array.isArray(lista) ? lista : []) {
    if (p && p.classe === 'neutraliza' && typeof p.ficheiro === 'string') porFicheiro.set(p.ficheiro, [...(porFicheiro.get(p.ficheiro) || []), p]);
  }
  const ficheiros = {};
  const efeitos = [];
  const mapa = d.artigos;
  if (eObjecto(mapa)) {
    for (const nome of Object.keys(mapa).sort()) {
      const ficheiro = ficheiroDoArtigo(nome);
      const prs = porFicheiro.get(ficheiro);
      if (!prs) continue;
      const l = lerJson(mapa[nome]);
      if (!eObjecto(l.obj)) continue;
      const a = JSON.parse(JSON.stringify(l.obj));
      const estaNoSite = a.publicado !== false;
      const feitos = []; const motivos = []; const fotos = [];
      let mudou = false;
      if (prs.some((p) => p.efeito === 'esconder')) {
        if (estaNoSite) { a.publicado = false; mudou = true; feitos.push('esconder'); }
        motivos.push(...prs.filter((p) => p.efeito === 'esconder').map((p) => p.mensagem));
      }
      /* As que não são da biblioteca e as que já não existem saem da lista. O
         gerador já deixava estas fora da galeria, mas o cartão de partilha sai
         da PRIMEIRA da lista, e um caminho para dentro de um ficheiro
         («x.jpg/y.jpg») rebentava-o ao listar a pasta: a cópia leva só as que
         existem. */
      const tirar = new Set(prs.filter((p) => p.efeito === 'sem_fotografia').map((p) => String(p.foto)));
      if (tirar.size && Array.isArray(a.fotos)) {
        const antes = a.fotos.length;
        a.fotos = a.fotos.filter((c) => !tirar.has(String(c)));
        if (a.fotos.length !== antes) mudou = true;
      }
      const semFoto = prs.filter((p) => p.efeito === 'sem_fotografia');
      if (semFoto.length && estaNoSite && !feitos.includes('esconder')) {
        feitos.push('sem_fotografia');
        motivos.push(...semFoto.map((p) => p.mensagem));
        fotos.push(...semFoto.map((p) => p.foto));
      }
      if (mudou) ficheiros[ficheiro] = serializar(a, terminacaoDe(l.texto));
      if (feitos.length) efeitos.push({ ficheiro, slug: slugDoFicheiro(nome), nome: nomeDoArtigo(l.obj, slugDoFicheiro(nome)), efeitos: feitos, motivos, fotos });
    }
  }
  return { ficheiros, efeitos, mudou: Object.keys(ficheiros).length > 0 };
}

const DESCRICAO_EFEITOS = { esconder: 'escondido do site', sem_fotografia: 'com fotografias que não aparecem' };
export const descreverEfeitos = (e) => e.efeitos.map((x) => (x === 'sem_fotografia' && e.fotos.length ? `${e.fotos.length} fotografia${e.fotos.length === 1 ? '' : 's'} que não aparece${e.fotos.length === 1 ? '' : 'm'}` : DESCRICAO_EFEITOS[x] || x)).join(' e ');

/* ------------------------------------------------------------------ */
/* O que o painel não pode mudar ao gravar                             */
/* ------------------------------------------------------------------ */

/* mudancasBloqueadas(antes, depois, qual) → [{ caminho, motivo }] ([] = pode gravar)
 *   qual = 'definicoes': o `tecnico` não muda, e uma chave de topo nova só pode
 *          ser uma das SECCOES_DEFINICOES;
 *   qual = 'artigo':     as chaves que não são CAMPOS_ARTIGO não mudam (nem
 *          aparecem, nem desaparecem): o painel preserva o que não edita;
 *   qual = 'categorias': `antes` e `depois` são as listas. Nenhuma categoria
 *          sai (motivo 'apagada'), cada uma é um objecto com endereço
 *          ('forma'), e de cada uma só mudam os EDITAVEIS_CATEGORIA — o slug é
 *          o que as junta, por isso não muda; uma nova leva só os
 *          CAMPOS_CATEGORIA. A ordem muda à vontade. */
export function mudancasBloqueadas(antes, depois, qual = 'definicoes') {
  if (qual === 'categorias') return categoriasBloqueadas(antes, depois);
  const a = eObjecto(antes) ? antes : {};
  const d = eObjecto(depois) ? depois : {};
  const out = [];
  if (qual === 'artigo') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
      if (CAMPOS_ARTIGO.includes(k) || mesmoValor(a[k], d[k])) continue;
      out.push({ caminho: k, motivo: tem(a, k) ? 'mudou' : 'chave_nova' });
    }
    return out;
  }
  for (const caminho of BLOQUEADOS_DEFINICOES) {
    if (!mesmoValor(a[caminho], d[caminho])) out.push({ caminho, motivo: 'mudou' });
  }
  for (const k of Object.keys(d)) {
    if (tem(a, k) || tem(SECCOES_DEFINICOES, k) || out.some((x) => x.caminho === k)) continue;
    out.push({ caminho: k, motivo: 'chave_nova' });
  }
  return out;
}

function categoriasBloqueadas(antes, depois) {
  if (!Array.isArray(depois)) return [{ caminho: '', motivo: 'forma' }];
  const out = [];
  const porSlug = (l) => new Map((Array.isArray(l) ? l : []).filter((c) => eObjecto(c) && temTexto(c.slug)).map((c) => [c.slug, c]));
  const a = porSlug(antes);
  depois.forEach((c, i) => { if (!eObjecto(c) || !temTexto(c.slug)) out.push({ caminho: String(i), motivo: 'forma' }); });
  const d = porSlug(depois);
  for (const slug of a.keys()) if (!d.has(slug)) out.push({ caminho: slug, motivo: 'apagada' });
  for (const [slug, cd] of d) {
    const ca = a.get(slug);
    for (const k of new Set([...Object.keys(ca ?? {}), ...Object.keys(cd)])) {
      if (k === 'slug' || EDITAVEIS_CATEGORIA.includes(k)) continue;
      if (ca && mesmoValor(ca[k], cd[k])) continue;
      out.push({ caminho: `${slug}.${k}`, motivo: ca && tem(ca, k) ? 'mudou' : 'chave_nova' });
    }
  }
  return out;
}

/* A ORDEM DAS CHAVES AO GRAVAR: as que já estavam no ficheiro ficam onde
   estavam; uma nova entra antes da primeira que, na ordem do formulário, vem
   depois dela (e no fim, se nenhuma vier); as que o formulário não conhece vão
   para o fim. As que saíram, saem. */
export function ordenarComo(antes, depois, ordem = CAMPOS_ARTIGO) {
  if (!eObjecto(depois)) return depois;
  const a = eObjecto(antes) ? antes : {};
  const chaves = Object.keys(a).filter((k) => tem(depois, k));
  const novas = Object.keys(depois).filter((k) => !chaves.includes(k));
  for (const k of novas.filter((x) => ordem.includes(x))) {
    const i = ordem.indexOf(k);
    const j = chaves.findIndex((x) => ordem.includes(x) && ordem.indexOf(x) > i);
    if (j < 0) chaves.push(k); else chaves.splice(j, 0, k);
  }
  chaves.push(...novas.filter((x) => !ordem.includes(x)));
  const out = {};
  for (const k of chaves) out[k] = depois[k];
  return out;
}
