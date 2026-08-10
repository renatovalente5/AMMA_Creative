/* ============================================================================
   AMMA CREATIVE — gerador do site

   Node sem uma única dependência. A razão é a durabilidade: este site é
   publicado por uma Action e editado por quem não programa, e uma dependência de
   npm que rebente dentro de dezoito meses deixa a cliente sem conseguir
   publicar, sem ter como diagnosticar. Não há aqui cadeia de fornecimento para
   partir, e a construção leva menos de um segundo.

   O que é moderno neste site está no CSS — view transitions entre páginas,
   animações conduzidas pelo scroll, container queries, Popover API — e não na
   caixa de ferramentas. Ver assets/css/estilo.css.

   Correr:  node scripts/gerar.mjs        →  _site/
   ========================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const SAIDA = join(RAIZ, '_site');

const def = JSON.parse(readFileSync(join(RAIZ, 'data/definicoes.json'), 'utf8'));
const categorias = JSON.parse(readFileSync(join(RAIZ, 'data/categorias.json'), 'utf8'));

/* Um ficheiro JSON por produto. É assim que o backoffice os trata: cada artigo é
   uma entrada própria, cria-se e apaga-se sozinha, e dois artigos editados ao
   mesmo tempo não colidem no mesmo ficheiro. */
const todos = readdirSync(join(RAIZ, 'data/produtos'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(RAIZ, 'data/produtos', f), 'utf8')))
  .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || a.nome.localeCompare(b.nome, 'pt'));

const produtos = todos.filter((p) => p.publicado !== false);

/* O endereço base. Com domínio próprio o site serve na RAIZ e o BASE é vazio;
   no github.io serve dentro de /AMMA_Creative. Enquanto isto estiver errado,
   TUDO o que o HTML pede dá 404 e o site aparece sem estilos — já aconteceu
   noutro projecto e não é evidente, porque o github.io reencaminha. */
const BASE = (process.env.BASE ?? '/AMMA_Creative').replace(/\/$/, '');
const SITE = (process.env.SITE ?? def.tecnico.site).replace(/\/$/, '');

const u = (p) => `${BASE}/${String(p).replace(/^\/+/, '')}`;
const abs = (p) => `${SITE}/${String(p).replace(/^\/+/, '')}`;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Impressão digital do ficheiro no endereço, para o browser não servir CSS
   velho depois de uma publicação. */
function versao(rel) {
  const f = join(RAIZ, rel);
  if (!existsSync(f)) return u(rel);
  return `${u(rel)}?v=${createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8)}`;
}

/* --------------------------------------------------------------- fotografias */
/* Constrói o srcset a partir das variantes que EXISTEM em disco. Se uma faltar,
   o site não parte — usa as que houver. E uma fotografia que esteja na lista mas
   já não exista em disco é IGNORADA com aviso, em vez de deixar uma imagem
   partida no site: já aconteceu numa loja onde a cliente apagou um ficheiro da
   biblioteca que ainda estava num artigo. */
function fotos(p) {
  const lista = Array.isArray(p.fotos) ? p.fotos : [];
  return lista.map((c) => {
    const limpo = String(c).replace(/^\/+/, '');
    const pasta = limpo.slice(0, limpo.lastIndexOf('/'));
    const nome = limpo.split('/').pop();
    const base = nome.replace(/\.[a-z0-9]+$/i, '');
    const dir = join(RAIZ, pasta);
    const vizinhos = existsSync(dir) ? readdirSync(dir) : [];
    const larguras = [480, 960, 1600].filter((w) => vizinhos.includes(`${base}-${w}.webp`));
    if (!larguras.length) {
      console.warn(`  !! ${p.slug}: ${limpo} não tem variantes — ignorada`);
      return null;
    }
    const url = (w) => u(`${pasta}/${base}-${w}.webp`);
    /* Proporção real, medida do ficheiro, para o cartão reservar a altura certa
       e a página não saltar enquanto as imagens carregam. */
    return {
      src: url(larguras.at(-1)),
      srcset: larguras.map((w) => `${url(w)} ${w}w`).join(', '),
      cartao: url(larguras.includes(960) ? 960 : larguras[0]),
      cartaoSet: larguras.filter((w) => w <= 960).map((w) => `${url(w)} ${w}w`).join(', '),
    };
  }).filter(Boolean);
}

const catDe = (slug) => categorias.find((c) => c.slug === slug);
const nomeCat = (slug) => catDe(slug)?.nome ?? slug;
const contaCat = (slug) => produtos.filter((p) => p.categoria === slug).length;

const OCASIOES = {
  'anuncio-gravidez': 'Anúncio de gravidez',
  'convite-padrinhos': 'Convite a padrinhos',
  'baptizado': 'Baptizado',
  'casamento': 'Casamento',
  'dia-da-mae': 'Dia da Mãe',
  'dia-do-pai': 'Dia do Pai',
  'pascoa': 'Páscoa',
  'presente': 'Presente',
  'lembrancas': 'Lembranças',
};

/* ------------------------------------------------------------------- ícones */
const ic = {
  seta: '<svg class="seta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  dir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  esq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.13c-.25.69-1.45 1.32-2 1.4-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.63-2.98-1.29-4.92-4.28-5.07-4.48-.15-.2-1.21-1.61-1.21-3.07 0-1.46.76-2.18 1.02-2.47.26-.29.56-.36.75-.36l.54.01c.17.01.41-.7.64.49.24.58.81 2.03.88 2.18.07.15.12.32.02.52-.1.2-.15.32-.29.49l-.44.51c-.15.15-.3.31-.13.61.17.29.75 1.24 1.61 2.01 1.11.99 2.04 1.3 2.33 1.44.29.15.46.12.63-.7.17-.2.73-.85.92-1.14.2-.29.39-.24.66-.15.27.1 1.71.81 2 .95.29.15.49.22.56.34.07.12.07.69-.18 1.38Z"/></svg>',
  insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.2"/><circle cx="12" cy="12" r="4.1"/><circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10.5c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10.3" r="3"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 7l9 6 9-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  foto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="12" cy="12" r="3.2"/><path d="M8 5l1.5-2h5L16 5"/></svg>',
  lupa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21M11 8.5v5M8.5 11h5"/></svg>',
  caixa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
  coracao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 6.6a5.1 5.1 0 0 0-7.2 0L12 8.2l-1.6-1.6a5.1 5.1 0 0 0-7.2 7.2l8.8 8.8 8.8-8.8a5.1 5.1 0 0 0 0-7.2Z"/></svg>',
  agulha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21 21 3M14 4l6 6M8.5 11.5 12 15"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 1.9"/></svg>',
};

/* ------------------------------------------------------- telefone e a lei --- */
/* Um número de telemóvel português (91/92/93/96) obriga a indicar o custo da
   chamada — DL 59/2021. Em TODO o lado onde o número apareça, e com parênteses.
   Está numa função para não haver um sítio esquecido. */
const CUSTO_CHAMADA = '(Chamada para a rede móvel nacional)';
const telLink = (extra = '') => `<a href="tel:+351${def.contactos.telefone}"${extra}>${esc(def.contactos.telefone_texto)}</a>`;

/* ---------------------------------------------------------- páginas legais --- */
const LEGAIS = [
  ['privacidade/', 'Privacidade e cookies'],
  ['termos/', 'Termos e condições'],
  ['resolucao-de-litigios/', 'Resolução de litígios'],
];

/* ============================================================== esqueleto === */
function pagina({ pag = '', titulo, descricao, corpo, jsonld = [], og, classe = '' }) {
  const canonico = abs(pag);
  const imagem = og ?? abs('assets/img/og.jpg');
  const nav = [
    ['', 'Início'],
    ['catalogo/', 'Catálogo'],
    ['como-encomendar/', 'Como encomendar'],
    ['sobre/', 'Sobre nós'],
    ['contactos/', 'Contactos'],
  ];
  const activo = (p) => (p === pag ? ' aria-current="page"' : '');

  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descricao)}">
<link rel="canonical" href="${canonico}">
<meta name="theme-color" content="#602601">
<meta name="author" content="${esc(def.empresa.nome_comercial)}">

<meta property="og:type" content="website">
<meta property="og:locale" content="pt_PT">
<meta property="og:site_name" content="${esc(def.empresa.nome_comercial)}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descricao)}">
<meta property="og:url" content="${canonico}">
<meta property="og:image" content="${imagem}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="${u('assets/img/favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${u('assets/img/apple-touch-icon.png')}">
<!-- As fontes são pré-carregadas porque são o primeiro texto que se vê. Sem
     isto há um lampejo com a fonte do sistema; o «font-display: swap» garante
     que o texto nunca fica invisível à espera. -->
<link rel="preload" href="${u('assets/fontes/fraunces-var.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${u('assets/fontes/inter-var.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${versao('assets/css/estilo.css')}">
${jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
</head>
<body${classe ? ` class="${classe}"` : ''}>
<a class="salta" href="#conteudo">Saltar para o conteúdo</a>

<header class="topo" id="topo">
  <div class="topo__barra">
    <a class="marca" href="${u('')}" aria-label="${esc(def.empresa.nome_comercial)} — início">
      <img src="${u('assets/img/logo-marrom.png')}" alt="${esc(def.empresa.nome_comercial)}" width="914" height="188">
    </a>
    <nav class="nav" aria-label="Navegação principal">
      ${nav.map(([p, n]) => `<a href="${u(p)}"${activo(p)}>${n}</a>`).join('\n      ')}
    </nav>
    <div class="topo__acoes">
      <a class="btn btn--cheio" href="${u('como-encomendar/')}">Encomendar ${ic.seta}</a>
      <button class="menu-btn" type="button" id="abrir-menu" popovertarget="menu"
              aria-label="Abrir o menu">${ic.menu}</button>
    </div>
  </div>
</header>

<!-- Menu de ecrã inteiro. «popover» é nativo: fecha com Escape, prende o foco e
     não precisa de JavaScript para gerir estado. O site.js só cuida do caso em
     que o browser não conhece a API. -->
<dialog class="menu" id="menu" popover>
  <div class="menu__corpo">
    <div class="menu__topo">
      <img src="${u('assets/img/logo-creme.png')}" alt="" width="914" height="188">
      <button class="menu__x" type="button" popovertarget="menu" popovertargetaction="hide"
              aria-label="Fechar o menu">${ic.x}</button>
    </div>
    <ul class="menu__lista">
      ${nav.map(([p, n], i) => `<li><a href="${u(p)}"${activo(p)}><span class="num">0${i + 1}</span>${n}</a></li>`).join('\n      ')}
    </ul>
    <div class="menu__pe">
      <a href="tel:+351${def.contactos.telefone}">${ic.tel}<span>${esc(def.contactos.telefone_texto)}</span></a>
      <p class="menu__nota">${CUSTO_CHAMADA}</p>
      <a href="${esc(def.contactos.instagram)}" target="_blank" rel="noopener">${ic.insta}<span>@_ammacreative</span></a>
    </div>
  </div>
</dialog>

<main id="conteudo">
${corpo}
</main>

<footer class="pe">
  <div class="envolve">
    <div class="pe__grelha">
      <div class="pe__marca">
        <img src="${u('assets/img/logo-creme.png')}" alt="${esc(def.empresa.nome_comercial)}" width="914" height="188">
        <p class="pe__reclamo">${esc(def.textos.reclamo)}</p>
        <div class="pe__redes">
          <a href="${esc(def.contactos.instagram)}" target="_blank" rel="noopener" aria-label="Instagram da AMMA Creative">${ic.insta}</a>
          <a href="https://wa.me/${def.contactos.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic.zap}</a>
          <a href="tel:+351${def.contactos.telefone}" aria-label="Telefonar">${ic.tel}</a>
        </div>
      </div>

      <div>
        <h3>Categorias</h3>
        <ul>
          ${categorias.map((c) => `<li><a href="${u('catalogo/' + c.slug + '/')}">${esc(c.nome)}</a></li>`).join('\n          ')}
        </ul>
      </div>

      <div>
        <h3>A loja</h3>
        <ul>
          <li><a href="${u('catalogo/')}">Catálogo</a></li>
          <li><a href="${u('como-encomendar/')}">Como encomendar</a></li>
          <li><a href="${u('sobre/')}">Sobre nós</a></li>
          <li><a href="${u('contactos/')}">Contactos</a></li>
        </ul>
      </div>

      <div>
        <h3>Contactos</h3>
        <ul>
          <li class="pe__contacto">${ic.tel}<span><a href="tel:+351${def.contactos.telefone}">${esc(def.contactos.telefone_texto)}</a>
            <small>${CUSTO_CHAMADA}</small></span></li>
          <li class="pe__contacto">${ic.insta}<span><a href="${esc(def.contactos.instagram)}" target="_blank" rel="noopener">@_ammacreative</a></span></li>
          <li class="pe__contacto">${ic.pin}<span>${esc(def.local.morada)}<br>${esc(def.local.codigo_postal)} ${esc(def.local.localidade)}<br>${esc(def.local.concelho)}</span></li>
        </ul>
      </div>
    </div>

    <div class="pe__fim">
      <span>© ${new Date().getFullYear()} ${esc(def.empresa.nome_comercial)}</span>
      <!-- O Livro de Reclamações fica AQUI, junto aos outros links legais, e não
           num bloco à parte: é o que o cliente pediu e é onde as pessoas o
           procuram. -->
      <nav class="pe__legais" aria-label="Informação legal">
        ${LEGAIS.map(([p, n]) => `<a href="${u(p)}">${n}</a>`).join('\n        ')}
        <a href="https://www.livroreclamacoes.pt/inicio" target="_blank" rel="noopener">Livro de Reclamações</a>
        <!-- Entrada da cliente para o backoffice. Fica apagada de propósito: quem
             visita o site não tem nada que a notar, e quem precisa dela sabe que
             está aqui. Continua a ser um link a sério, e não um botão inerte. -->
        <!-- Volta a abrir o aviso, para se poder mudar de ideias. Sem isto, uma
             escolha feita uma vez ficava para sempre e não havia por onde a
             rever — que é precisamente o que o RGPD não quer. -->
        <a href="#" data-cc-abrir>Cookies</a>
        <a class="pe__gestao" href="https://app.pagescms.org/renatovalente5/AMMA_Creative/main"
           target="_blank" rel="noopener">Gestão</a>
      </nav>
    </div>
    <!-- A identificação que o DL 7/2004 obriga a prestar — nome, sede, NIF —
         NÃO está aqui por decisão do cliente, e continua a cumprir-se: está nos
         Termos e na Privacidade, que estão ligadas deste rodapé em todas as
         páginas. É acesso fácil e permanente, que é o que a lei pede; não exige
         que esteja no rodapé. -->
  </div>
</footer>

<!-- O aviso existe SÓ por causa do mapa: fora dele, o site não instala cookie
     nenhuma. Dois botões, e não um painel de preferências — a escolha é uma. -->
<div class="cc" id="cc" role="region" aria-label="Aviso de cookies" hidden>
  <p>Este site não tem analítica nem publicidade. Só precisamos da sua autorização
  para o <strong>mapa do Google</strong> na página de contactos.
  <a href="${u('privacidade/')}" style="color:var(--cacau)">Saber mais</a>.</p>
  <div class="cc__acoes">
    <button class="btn btn--cheio" type="button" data-cc="sim">Aceitar</button>
    <button class="btn btn--linha" type="button" data-cc="nao">Recusar</button>
  </div>
</div>

<script src="${versao('assets/js/site.js')}" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ JSON-LD */
const negocioLD = {
  '@context': 'https://schema.org',
  '@type': 'Store',
  '@id': abs('#loja'),
  name: def.empresa.nome_comercial,
  description: def.textos.sobre_titulo,
  url: abs(''),
  image: abs('assets/img/og.jpg'),
  logo: abs('assets/img/logo-marrom.png'),
  telephone: `+351${def.contactos.telefone}`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: def.local.morada,
    postalCode: def.local.codigo_postal,
    addressLocality: def.local.localidade,
    addressRegion: def.local.concelho,
    addressCountry: 'PT',
  },
  geo: { '@type': 'GeoCoordinates', latitude: def.local.latitude, longitude: def.local.longitude },
  sameAs: [def.contactos.instagram],
  priceRange: 'Sob consulta',
  areaServed: { '@type': 'Country', name: 'Portugal' },
};

const migalhasLD = (itens) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: itens.map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.nome,
    ...(it.href !== undefined ? { item: abs(it.href) } : {}),
  })),
});

function migalhas(itens) {
  return `<nav class="migalhas" aria-label="Migalhas">
    ${itens.map((it, i) => (it.href !== undefined
      ? `<a href="${u(it.href)}">${esc(it.nome)}</a>${ic.dir}`
      : `<span aria-current="page">${esc(it.nome)}</span>`)).join('\n    ')}
  </nav>`;
}

/* ============================================================ componentes === */
function cartaoProduto(p, { prioridade = false } = {}) {
  const fs = fotos(p);
  const f = fs[0];
  const img = f
    ? `<img src="${f.cartao}" srcset="${f.cartaoSet}"
         sizes="(max-width: 620px) 92vw, (max-width: 1000px) 45vw, 300px"
         alt="${esc(p.nome)}" width="960" height="960"
         ${prioridade ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
    : '<div style="aspect-ratio:1;display:grid;place-items:center;color:var(--tinta-3)">Sem fotografia</div>';

  return `<a class="prod" href="${u('catalogo/' + p.categoria + '/' + p.slug + '/')}"
    data-categoria="${esc(p.categoria)}" data-ocasioes="${esc((p.ocasioes || []).join(' '))}"
    data-procura="${esc([p.nome, p.resumo, nomeCat(p.categoria)].join(' ').toLowerCase())}">
    <div class="prod__figura" style="aspect-ratio:1">
      ${img}
      ${fs.length > 1 ? `<span class="prod__nf">${ic.foto}${fs.length}</span>` : ''}
    </div>
    <div class="prod__corpo">
      <span class="prod__cat">${esc(nomeCat(p.categoria))}</span>
      <h3 class="prod__nome">${esc(p.nome)}</h3>
      <p class="prod__resumo">${esc(p.resumo)}</p>
      <div class="prod__pe">
        <span class="prod__preco">Sob consulta</span>
        <span class="prod__ver">Ver ${ic.dir}</span>
      </div>
    </div>
  </a>`;
}

function cartaoCategoria(c, prioridade = false) {
  /* A imagem do cartão é a primeira fotografia do primeiro produto da categoria
     — não uma imagem escolhida à mão, que teria de ser mantida em dia. */
  const p = produtos.find((x) => x.categoria === c.slug);
  const f = p ? fotos(p)[0] : null;
  const n = contaCat(c.slug);
  return `<a class="cat" href="${u('catalogo/' + c.slug + '/')}">
    ${f ? `<img src="${f.cartao}" srcset="${f.cartaoSet}" sizes="(max-width: 760px) 78vw, 300px"
        alt="" width="960" height="960" ${prioridade ? '' : 'loading="lazy"'} decoding="async">` : ''}
    <span class="cat__n">${n} ${n === 1 ? 'artigo' : 'artigos'}</span>
    <div class="cat__corpo">
      <h3 class="cat__nome">${esc(c.nome)}</h3>
      <p class="cat__resumo">${esc(c.resumo)}</p>
    </div>
  </a>`;
}

function mapa() {
  const q = encodeURIComponent(`${def.local.morada}, ${def.local.codigo_postal} ${def.local.localidade}`);
  return `<div class="mapa" id="mapa" data-mapa="https://www.google.com/maps?q=${q}&output=embed">
    <div class="mapa__consent" id="mapa-consent">
      ${ic.pin}
      <p><strong>Mapa do Google.</strong> Fica por carregar até o autorizar, porque vem
      dos servidores do Google e pode instalar cookies. Se recusou as cookies no aviso, é por isso.</p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">
        <button class="btn btn--cheio" type="button" id="btn-mapa">Carregar o mapa</button>
        <a class="btn btn--linha" href="${esc(def.local.mapa)}" target="_blank" rel="noopener">Abrir no Google Maps</a>
      </div>
    </div>
  </div>`;
}

/* ================================================================ páginas === */
function paginaInicial() {
  const destaques = produtos.filter((p) => p.destaque).slice(0, 6);
  const lista = destaques.length ? destaques : produtos.slice(0, 6);
  const heroFoto = fotos(produtos.find((p) => p.slug === 'box-anuncio-gravidez') || produtos[0])[0];

  const corpo = `
<section class="hero">
  <div class="hero__grelha">
    <div class="hero__texto">
      <p class="sobre-linha">${esc(def.empresa.assinatura)}</p>
      <h1 class="hero__titulo">Feito para <em>uma pessoa</em> só</h1>
      <p class="chamada">${esc(def.textos.hero_texto)}</p>
      <div class="hero__acoes">
        <a class="btn btn--cheio" href="${u('catalogo/')}">Ver o catálogo ${ic.seta}</a>
        <a class="btn btn--linha" href="${u('como-encomendar/')}">Como encomendar</a>
      </div>
    </div>
    <figure class="hero__figura" style="margin:0">
      ${heroFoto ? `<img src="${heroFoto.src}" srcset="${heroFoto.srcset}"
        sizes="(max-width: 900px) 92vw, 560px" alt="Box de anúncio de gravidez personalizada da AMMA Creative"
        width="1600" height="1600" fetchpriority="high" decoding="async">` : ''}
      <span class="hero__selo">${ic.caixa}${esc(def.textos.portes)}</span>
    </figure>
  </div>
</section>

<section class="secao secao--creme">
  <div class="envolve">
    <div class="secao__topo">
      <div>
        <p class="sobre-linha">O que fazemos</p>
        <h2 class="tit-g">Escolha por onde começar</h2>
      </div>
      <a class="btn btn--fantasma" href="${u('catalogo/')}">Ver tudo ${ic.seta}</a>
    </div>
  </div>
  <div class="prateleira">
    ${categorias.map((c, i) => cartaoCategoria(c, i < 2)).join('\n    ')}
  </div>
</section>

<section class="secao">
  <div class="envolve">
    <div class="secao__topo">
      <div>
        <p class="sobre-linha">Os mais pedidos</p>
        <h2 class="tit-g">O que mais sai por aqui</h2>
      </div>
      <a class="btn btn--fantasma" href="${u('catalogo/')}">Ver o catálogo ${ic.seta}</a>
    </div>
    <div class="mosaico">
      ${lista.map((p, i) => cartaoProduto(p, { prioridade: i < 3 })).join('\n      ')}
    </div>
  </div>
</section>

<section class="secao secao--creme">
  <div class="envolve">
    <div class="editorial">
      <div class="editorial__texto">
        <p class="sobre-linha">Quem somos</p>
        <h2 class="tit-g" style="margin-bottom:1rem">${esc(def.textos.sobre_titulo)}</h2>
        <p class="chamada">Uma casa pequena em Vila Nova de Anha. Cada peça passa
        pelas nossas mãos — e é por isso que não há duas iguais.</p>
        <div class="hero__acoes">
          <a class="btn btn--linha" href="${u('sobre/')}">Conhecer-nos ${ic.seta}</a>
        </div>
      </div>
      <div class="editorial__figuras">
        ${['sweat-mae', 'colar-inicial', 'box-convite-padrinhos', 'porta-chaves-foto']
          .map((s) => produtos.find((p) => p.slug === s)).filter(Boolean)
          .map((p) => { const f = fotos(p)[0]; return f
            ? `<div><img src="${f.cartao}" srcset="${f.cartaoSet}" sizes="(max-width: 620px) 92vw, 300px"
                alt="${esc(p.nome)}" width="960" height="960" loading="lazy" decoding="async"></div>` : ''; })
          .join('\n        ')}
      </div>
    </div>
  </div>
</section>

<section class="secao secao--escura">
  <div class="envolve">
    <div style="text-align:center;margin-bottom:clamp(2rem,5vw,3.5rem)">
      <p class="sobre-linha sobre-linha--claro sobre-linha--centro">Sem carrinho, sem complicações</p>
      <h2 class="tit-g">Como se encomenda</h2>
    </div>
    ${passosEncomenda()}
    <div style="text-align:center;margin-top:clamp(2rem,4vw,3rem)">
      <a class="btn btn--claro" href="https://wa.me/${def.contactos.whatsapp}" target="_blank" rel="noopener">${ic.zap} Falar connosco</a>
    </div>
  </div>
</section>`;

  return pagina({
    pag: '',
    titulo: `${def.empresa.nome_comercial} — Artigos personalizados para bebés, mamãs e papás`,
    descricao: `Artigos personalizados feitos à mão em Viana do Castelo: bodies de convite a padrinhos, anúncios de gravidez, colares em aço gravados, t-shirts e lembranças. ${def.textos.portes}.`,
    corpo,
    jsonld: [negocioLD, {
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: def.empresa.nome_comercial, url: abs(''), inLanguage: 'pt-PT',
      publisher: { '@id': abs('#loja') },
    }],
  });
}

function passosEncomenda() {
  const p = [
    ['Escolha o artigo', 'Veja o catálogo e guarde o que lhe interessa. Não é preciso decidir tudo agora.'],
    ['Diga-nos os detalhes', 'A frase, o nome, o tamanho, a cor. Se tiver uma ideia e não souber como a pôr, nós ajudamos.'],
    ['Aprovamos juntas', 'Enviamos uma pré-visualização antes de imprimir ou gravar. Só avançamos quando estiver como quer.'],
    ['Fica pronto', `Combinamos a entrega ou o envio. ${def.textos.portes}.`],
  ];
  return `<div class="passos">
    ${p.map(([t, d]) => `<div class="passo"><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join('\n    ')}
  </div>`;
}

function paginaCatalogo() {
  const ocasioesUsadas = [...new Set(produtos.flatMap((p) => p.ocasioes || []))]
    .filter((o) => OCASIOES[o]).sort((a, b) => OCASIOES[a].localeCompare(OCASIOES[b], 'pt'));

  const corpo = `
<section class="secao" style="padding-top:clamp(1.5rem,4vw,2.5rem)">
  <div class="envolve">
    ${migalhas([{ nome: 'Início', href: '' }, { nome: 'Catálogo' }])}
    <div class="secao__topo">
      <div>
        <p class="sobre-linha">${produtos.length} artigos</p>
        <h1 class="tit-g">Catálogo</h1>
      </div>
    </div>

    <form class="filtros" id="filtros">
      <fieldset style="border:0;padding:0;margin:0 0 1rem">
        <legend class="sobre-linha" style="margin-bottom:.7rem">Categoria</legend>
        <div class="filtros__fila">
          <button class="ficha" type="button" data-filtro="categoria" data-valor="" aria-pressed="true">Todas</button>
          ${categorias.map((c) => `<button class="ficha" type="button" data-filtro="categoria" data-valor="${esc(c.slug)}" aria-pressed="false">${esc(c.curto || c.nome)} <span class="ficha__n">${contaCat(c.slug)}</span></button>`).join('\n          ')}
        </div>
      </fieldset>
      <fieldset style="border:0;padding:0;margin:0">
        <legend class="sobre-linha" style="margin-bottom:.7rem">Ocasião</legend>
        <div class="filtros__fila">
          <button class="ficha" type="button" data-filtro="ocasiao" data-valor="" aria-pressed="true">Todas</button>
          ${ocasioesUsadas.map((o) => `<button class="ficha" type="button" data-filtro="ocasiao" data-valor="${esc(o)}" aria-pressed="false">${esc(OCASIOES[o])}</button>`).join('\n          ')}
        </div>
      </fieldset>
      <div class="filtros__pe">
        <p id="contagem" role="status"><b>${produtos.length}</b> artigos</p>
        <button class="limpar" type="button" id="limpar" hidden>Limpar filtros</button>
      </div>
    </form>

    <div class="mosaico" id="grelha">
      ${produtos.map((p, i) => cartaoProduto(p, { prioridade: i < 4 })).join('\n      ')}
    </div>
    <div class="vazio" id="vazio" hidden>
      <h3>Nada com estes filtros</h3>
      <p>Experimente alargar a pesquisa — ou diga-nos o que procura, que fazemos por medida.</p>
      <div style="margin-top:1.4rem"><a class="btn btn--cheio" href="https://wa.me/${def.contactos.whatsapp}" target="_blank" rel="noopener">${ic.zap} Dizer o que procuro</a></div>
    </div>
  </div>
</section>`;

  return pagina({
    pag: 'catalogo/',
    titulo: `Catálogo — ${produtos.length} artigos personalizados | ${def.empresa.nome_comercial}`,
    descricao: 'Todos os nossos artigos personalizados: bodies de convite a padrinhos e anúncio de gravidez, colares e pulseiras em aço gravados, t-shirts, boxes de presente e lembranças.',
    corpo,
    jsonld: [
      migalhasLD([{ nome: 'Início', href: '' }, { nome: 'Catálogo' }]),
      {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: 'Catálogo AMMA Creative', numberOfItems: produtos.length,
        itemListElement: produtos.map((p, i) => ({
          '@type': 'ListItem', position: i + 1, name: p.nome,
          url: abs(`catalogo/${p.categoria}/${p.slug}/`),
        })),
      },
    ],
  });
}

function paginaCategoria(c) {
  const lista = produtos.filter((p) => p.categoria === c.slug);
  const corpo = `
<section class="secao" style="padding-top:clamp(1.5rem,4vw,2.5rem)">
  <div class="envolve">
    ${migalhas([{ nome: 'Início', href: '' }, { nome: 'Catálogo', href: 'catalogo/' }, { nome: c.nome }])}
    <div style="max-width:70ch;margin-bottom:clamp(2rem,4vw,3rem)">
      <p class="sobre-linha">${lista.length} ${lista.length === 1 ? 'artigo' : 'artigos'}</p>
      <h1 class="tit-g" style="margin-bottom:1rem">${esc(c.nome)}</h1>
      ${c.texto.split('\n\n').map((t) => `<p class="chamada">${esc(t)}</p>`).join('\n      ')}
    </div>
    <div class="mosaico">
      ${lista.map((p, i) => cartaoProduto(p, { prioridade: i < 4 })).join('\n      ')}
    </div>
  </div>
</section>

<section class="secao secao--creme">
  <div class="envolve" style="text-align:center">
    <p class="sobre-linha sobre-linha--centro">Não encontrou?</p>
    <h2 class="tit-m" style="margin-bottom:1rem">Fazemos por medida</h2>
    <p class="chamada" style="margin-inline:auto">Se tem uma ideia e não a vê aqui, diga-nos.
    A maior parte do que fazemos começou por ser um pedido de alguém.</p>
    <div style="margin-top:1.6rem;display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap">
      <a class="btn btn--cheio" href="https://wa.me/${def.contactos.whatsapp}" target="_blank" rel="noopener">${ic.zap} Falar connosco</a>
      <a class="btn btn--linha" href="${u('catalogo/')}">Ver o catálogo todo</a>
    </div>
  </div>
</section>`;

  return pagina({
    pag: `catalogo/${c.slug}/`,
    titulo: `${c.titulo_seo} | ${def.empresa.nome_comercial}`,
    descricao: c.descricao_seo,
    corpo,
    jsonld: [
      migalhasLD([{ nome: 'Início', href: '' }, { nome: 'Catálogo', href: 'catalogo/' }, { nome: c.nome }]),
      {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: c.nome, numberOfItems: lista.length,
        itemListElement: lista.map((p, i) => ({
          '@type': 'ListItem', position: i + 1, name: p.nome,
          url: abs(`catalogo/${p.categoria}/${p.slug}/`),
        })),
      },
    ],
  });
}

function paginaProduto(p) {
  const fs = fotos(p);
  const c = catDe(p.categoria);
  const relacionados = produtos.filter((x) => x.categoria === p.categoria && x.slug !== p.slug).slice(0, 3);

  const galeria = fs.length ? `
<div class="galeria">
  <!-- Sem view-transition-name: as transições entre páginas foram retiradas.
       A história, incluindo o diagnóstico errado que as tirou, está no
       estilo.css, na secção MOVIMENTO. -->
  <div class="galeria__principal">
    <img id="foto" src="${fs[0].src}" srcset="${fs[0].srcset}" sizes="(max-width: 940px) 92vw, 660px"
         alt="${esc(p.nome)}" width="1600" height="1600" fetchpriority="high" decoding="async">
    <button class="galeria__lupa" type="button" id="abrir-lupa" aria-label="Ver a fotografia em grande">${ic.lupa}</button>
  </div>
  ${/* Nem `role="tablist"` nem `role="tab"`, de propósito. Uma galeria assim não é
        um separador: não há um painel por miniatura, e um `role="tab"` obriga a
        `aria-selected` e a navegação por setas com gestão de `tabindex`, nada
        disso está aqui. São botões, e o estado do que está escolhido diz-se com
        `aria-current`, que é válido num botão e é o que o JS actualiza. */''}
  ${fs.length > 1 ? `<div class="galeria__tiras" role="group" aria-label="Fotografias do artigo">
    ${fs.map((f, i) => `<button class="tira" type="button" data-i="${i}" aria-current="${i === 0}"
      aria-label="Fotografia ${i + 1} de ${fs.length}"><img src="${f.cartao}" alt="" width="96" height="96" loading="lazy" decoding="async"></button>`).join('\n    ')}
  </div>` : ''}
</div>
<dialog class="lupa" id="lupa">
  <div class="lupa__corpo">
    <img id="lupa-img" src="" alt="">
    <button class="lupa__x" type="button" id="lupa-x" aria-label="Fechar">${ic.x}</button>
    ${fs.length > 1 ? `<button class="lupa__nav lupa__nav--ant" type="button" data-passo="-1" aria-label="Anterior">${ic.esq}</button>
    <button class="lupa__nav lupa__nav--seg" type="button" data-passo="1" aria-label="Seguinte">${ic.dir}</button>
    <span class="lupa__conta"><span id="lupa-n">1</span> de ${fs.length}</span>` : ''}
  </div>
</dialog>
<script type="application/json" id="fotos-json">${JSON.stringify(fs.map((f) => ({ src: f.src, srcset: f.srcset })))}</script>`
    : '<div class="galeria__principal" style="display:grid;place-items:center;color:var(--tinta-3)">Sem fotografias</div>';

  const corpo = `
<section class="ficha-prod">
  <div class="envolve">
    ${migalhas([{ nome: 'Início', href: '' }, { nome: 'Catálogo', href: 'catalogo/' },
                { nome: c.nome, href: `catalogo/${c.slug}/` }, { nome: p.nome }])}
    <div class="ficha-prod__grelha">
      <div>
        ${galeria}

        <div class="bloco">
          <h2>Sobre este artigo</h2>
          ${p.texto.split('\n\n').map((t) => `<p>${esc(t)}</p>`).join('\n          ')}
        </div>

        ${(p.personalizavel || []).length ? `<div class="bloco">
          <h2>O que se personaliza</h2>
          <ul class="person">
            ${p.personalizavel.map((x) => `<li>${ic.check}<span>${esc(x)}</span></li>`).join('\n            ')}
          </ul>
        </div>` : ''}

        ${(p.ocasioes || []).length ? `<div class="bloco">
          <h2>Costuma dar-se em</h2>
          <div class="filtros__fila">
            ${p.ocasioes.filter((o) => OCASIOES[o]).map((o) => `<span class="ficha" style="cursor:default">${esc(OCASIOES[o])}</span>`).join('\n            ')}
          </div>
        </div>` : ''}
      </div>

      <aside class="painel">
        <span class="painel__cat">${esc(c.nome)}</span>
        <h1 class="painel__nome">${esc(p.nome)}</h1>
        <p class="painel__resumo">${esc(p.resumo)}</p>
        <p class="painel__preco">Sob consulta</p>
        <!-- Sem preços no site, por decisão da loja. Cada peça é feita por medida
             e o preço depende do que se personaliza — pôr um número seria pôr um
             número errado. Se algum dia entrarem preços, o DL 138/90 obriga a
             que sejam finais e com impostos incluídos. -->
        <p class="painel__nota">O preço depende do que escolher personalizar. Diga-nos o
        que quer e respondemos no mesmo dia.</p>
        <div class="painel__acoes">
          <a class="btn btn--cheio" href="https://wa.me/${def.contactos.whatsapp}?text=${encodeURIComponent('Olá! Tenho interesse em: ' + p.nome)}"
             target="_blank" rel="noopener">${ic.zap} Pedir pelo WhatsApp</a>
          <a class="btn btn--linha" href="${esc(def.contactos.instagram)}" target="_blank" rel="noopener">${ic.insta} Mensagem no Instagram</a>
          <a class="btn btn--linha" href="tel:+351${def.contactos.telefone}">${ic.tel} ${esc(def.contactos.telefone_texto)}</a>
        </div>
        <p class="painel__telefone">${CUSTO_CHAMADA}</p>
        <ul class="person" style="margin-top:1.4rem">
          <li>${ic.caixa}<span>${esc(def.textos.portes)}</span></li>
          <li>${ic.relogio}<span>Pré-visualização antes de produzir</span></li>
          <li>${ic.agulha}<span>Feito à mão em Viana do Castelo</span></li>
        </ul>
      </aside>
    </div>
  </div>
</section>

${relacionados.length ? `<section class="secao secao--creme">
  <div class="envolve">
    <div class="secao__topo">
      <div>
        <p class="sobre-linha">Da mesma categoria</p>
        <h2 class="tit-m">Também pode gostar</h2>
      </div>
      <a class="btn btn--fantasma" href="${u('catalogo/' + c.slug + '/')}">Ver ${esc(c.nome.toLowerCase())} ${ic.seta}</a>
    </div>
    <div class="mosaico">
      ${relacionados.map((x) => cartaoProduto(x)).join('\n      ')}
    </div>
  </div>
</section>` : ''}`;

  return pagina({
    pag: `catalogo/${p.categoria}/${p.slug}/`,
    titulo: `${p.nome} personalizado | ${def.empresa.nome_comercial}`,
    descricao: `${p.resumo} Personalizamos a frase, o nome e a cor. Feito à mão em Viana do Castelo. ${def.textos.portes}.`,
    og: fs.length ? abs(`assets/produtos/${p.slug}/og.jpg`) : undefined,
    corpo,
    jsonld: [
      migalhasLD([{ nome: 'Início', href: '' }, { nome: 'Catálogo', href: 'catalogo/' },
                  { nome: c.nome, href: `catalogo/${c.slug}/` }, { nome: p.nome }]),
      {
        '@context': 'https://schema.org', '@type': 'Product',
        name: p.nome, description: p.resumo,
        category: c.nome,
        image: fs.length ? [abs(`assets/produtos/${p.slug}/og.jpg`)] : [],
        brand: { '@type': 'Brand', name: def.empresa.nome_comercial },
        /* Sem preço porque não há preço público. `offers` com um preço inventado
           seria pior do que não ter `offers`: o Google mostra-o na pesquisa. */
        offers: {
          '@type': 'Offer',
          availability: 'https://schema.org/InStock',
          priceCurrency: 'EUR',
          priceSpecification: {
            '@type': 'PriceSpecification',
            valueAddedTaxIncluded: true,
            description: 'Sob consulta — o preço depende da personalização escolhida.',
          },
          seller: { '@id': abs('#loja') },
          areaServed: { '@type': 'Country', name: 'Portugal' },
        },
      },
    ],
  });
}

function paginaComoEncomendar() {
  const corpo = `
<section class="secao" style="padding-top:clamp(1.5rem,4vw,2.5rem)">
  <div class="envolve">
    ${migalhas([{ nome: 'Início', href: '' }, { nome: 'Como encomendar' }])}
    <div style="max-width:68ch">
      <p class="sobre-linha">Sem carrinho</p>
      <h1 class="tit-g" style="margin-bottom:1rem">Como se encomenda</h1>
      <p class="chamada">Este site é a nossa montra, não uma loja em linha. Cada peça é
      feita por medida — a frase, o nome, o tamanho, a cor — e isso combina-se a
      falar, não a clicar. É mais simples do que parece.</p>
    </div>
    <div style="margin-top:clamp(2.5rem,5vw,4rem)">
      ${passosEncomenda()}
    </div>
  </div>
</section>

<section class="secao secao--creme">
  <div class="envolve envolve--estreito">
    <p class="sobre-linha">Perguntas de sempre</p>
    <h2 class="tit-m" style="margin-bottom:1.6rem">O que nos perguntam mais</h2>
    <div class="texto">
      <h3>Quanto custa?</h3>
      <p>Depende do que escolher personalizar, e por isso não pomos preços no site:
      um número aqui seria um número errado. Diga-nos o que quer e respondemos no
      mesmo dia, com o valor final e o prazo.</p>

      <h3>Quanto tempo demora?</h3>
      <p>Depende da peça e de estarmos com muitos pedidos — em época de baptizados e
      de Dia da Mãe, estamos. Dizemos-lhe o prazo antes de começar, e cumprimo-lo.</p>

      <h3>Posso ver antes de vocês produzirem?</h3>
      <p>Sim, e insistimos nisso. Enviamos uma pré-visualização e só avançamos com o
      seu «sim». É a forma de ninguém receber uma peça com um nome mal escrito.</p>

      <h3>E os portes?</h3>
      <p>${esc(def.textos.portes)}. Abaixo disso, dizemos-lhe quanto fica quando
      combinarmos o pedido. Também pode combinar a entrega em mão.</p>

      <h3>Posso devolver?</h3>
      <p>Peças personalizadas não têm direito de livre resolução — é a lei
      (Decreto-Lei 24/2014, artigo 17.º), porque uma peça feita com o nome de
      alguém não se pode vender a mais ninguém. O que fazemos, e fazemos sempre, é
      mostrar-lhe a pré-visualização antes de produzir. Se a peça vier com defeito
      ou não corresponder ao aprovado, resolvemos sem discussão. Está explicado nos
      <a href="${u('termos/')}">termos e condições</a>.</p>

      <h3>Fazem coisas que não estão no site?</h3>
      <p>Fazemos, e é metade do nosso trabalho. A maior parte do que está aqui
      começou por ser o pedido de alguém.</p>
    </div>
  </div>
</section>

<section class="secao secao--escura">
  <div class="envolve" style="text-align:center">
    <p class="sobre-linha sobre-linha--claro sobre-linha--centro">Vamos a isso</p>
    <h2 class="tit-g" style="margin-bottom:1rem">Diga-nos o que tem em mente</h2>
    <p class="chamada" style="margin-inline:auto">Uma fotografia, uma frase, ou só uma ideia
    vaga. Nós ajudamos a chegar ao resto.</p>
    <div style="margin-top:1.8rem;display:flex;gap:.7rem;justify-content:center;flex-wrap:wrap">
      <a class="btn btn--claro" href="https://wa.me/${def.contactos.whatsapp}" target="_blank" rel="noopener">${ic.zap} WhatsApp</a>
      <a class="btn btn--claro" href="${esc(def.contactos.instagram)}" target="_blank" rel="noopener">${ic.insta} Instagram</a>
    </div>
    <p style="margin-top:1.2rem;font-size:.86rem;color:rgba(250,241,232,.7)">
      Ou ligue: <a href="tel:+351${def.contactos.telefone}" style="color:#fff">${esc(def.contactos.telefone_texto)}</a><br>
      ${CUSTO_CHAMADA}
    </p>
  </div>
</section>`;

  return pagina({
    pag: 'como-encomendar/',
    titulo: `Como encomendar | ${def.empresa.nome_comercial}`,
    descricao: 'Como se encomenda um artigo personalizado na AMMA Creative: escolher, dizer os detalhes, aprovar a pré-visualização e receber. Sem carrinho, por WhatsApp ou Instagram.',
    corpo,
    jsonld: [
      migalhasLD([{ nome: 'Início', href: '' }, { nome: 'Como encomendar' }]),
      {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: [
          ['Quanto custa?', 'O preço depende do que escolher personalizar. Diga-nos o que quer e respondemos no mesmo dia, com o valor final e o prazo.'],
          ['Quanto tempo demora?', 'Depende da peça e da época. Dizemos o prazo antes de começar.'],
          ['Posso ver antes de produzirem?', 'Sim. Enviamos uma pré-visualização e só avançamos com a sua aprovação.'],
          ['E os portes?', `${def.textos.portes}. Abaixo disso indicamos o valor ao combinar o pedido.`],
          ['Posso devolver?', 'Peças personalizadas não têm direito de livre resolução, nos termos do artigo 17.º do Decreto-Lei 24/2014. Se a peça vier com defeito ou não corresponder ao aprovado, resolvemos.'],
        ].map(([q, a]) => ({
          '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  });
}

function paginaSobre() {
  const corpo = `
<section class="secao" style="padding-top:clamp(1.5rem,4vw,2.5rem)">
  <div class="envolve">
    ${migalhas([{ nome: 'Início', href: '' }, { nome: 'Sobre nós' }])}
    <div class="editorial">
      <div class="editorial__texto">
        <p class="sobre-linha">${esc(def.empresa.assinatura)}</p>
        <h1 class="tit-g" style="margin-bottom:1.2rem">${esc(def.textos.sobre_titulo)}</h1>
        ${def.textos.sobre_texto.split('\n\n').map((t) => `<p class="chamada">${esc(t)}</p>`).join('\n        ')}
        <div class="hero__acoes">
          <a class="btn btn--cheio" href="${u('catalogo/')}">Ver o catálogo ${ic.seta}</a>
          <a class="btn btn--linha" href="${esc(def.contactos.instagram)}" target="_blank" rel="noopener">${ic.insta} Instagram</a>
        </div>
      </div>
      <div>
        <img src="${u('assets/img/equipa-960.webp')}"
             srcset="${u('assets/img/equipa-480.webp')} 480w, ${u('assets/img/equipa-960.webp')} 960w, ${u('assets/img/equipa-1600.webp')} 1600w"
             sizes="(max-width: 900px) 92vw, 640px"
             alt="A equipa da AMMA Creative" width="1179" height="1434"
             style="border-radius:var(--raio-g);width:100%" loading="lazy" decoding="async">
      </div>
    </div>
  </div>
</section>

<section class="secao secao--creme">
  <div class="envolve">
    <div style="text-align:center;max-width:60ch;margin:0 auto clamp(2rem,4vw,3rem)">
      <p class="sobre-linha sobre-linha--centro">O que nos importa</p>
      <h2 class="tit-g">Três coisas, e são sempre as mesmas</h2>
    </div>
    <div class="passos" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
      <div class="passo"><h3>Detalhes únicos</h3><p>Cada peça é feita para uma
      pessoa só. A frase é sua, o nome é dele, e não há duas iguais.</p></div>
      <div class="passo"><h3>Qualidade e bom gosto</h3><p>Vinil que aguenta a
      máquina, aço que não escurece, madeira que não lasca. O barato sai caro.</p></div>
      <div class="passo"><h3>Feito por nós</h3><p>Somos uma casa pequena em
      Vila Nova de Anha. Quem responde à mensagem é quem faz a peça.</p></div>
    </div>
  </div>
</section>`;

  return pagina({
    pag: 'sobre/',
    titulo: `Sobre nós | ${def.empresa.nome_comercial}`,
    descricao: 'A AMMA Creative é uma casa pequena em Vila Nova de Anha, Viana do Castelo, que faz artigos personalizados para bebés, mamãs e papás. Cada peça passa pelas nossas mãos.',
    corpo,
    jsonld: [migalhasLD([{ nome: 'Início', href: '' }, { nome: 'Sobre nós' }]), negocioLD],
  });
}

function paginaContactos() {
  const l = def.local;
  const corpo = `
<section class="secao" style="padding-top:clamp(1.5rem,4vw,2.5rem)">
  <div class="envolve">
    ${migalhas([{ nome: 'Início', href: '' }, { nome: 'Contactos' }])}
    <div style="max-width:60ch;margin-bottom:clamp(2rem,4vw,3rem)">
      <p class="sobre-linha">Falar connosco</p>
      <h1 class="tit-g" style="margin-bottom:1rem">Contactos</h1>
      <p class="chamada">O caminho mais rápido é o WhatsApp ou o Instagram — é por lá
      que combinamos quase tudo, porque é onde se podem trocar fotografias.</p>
    </div>

    <div class="editorial" style="grid-template-columns:1fr">
      <div class="mosaico" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))">
        <div class="painel" style="position:static">
          <span class="painel__cat">Mensagem</span>
          <h2 class="tit-m" style="margin:.4rem 0 .8rem">WhatsApp</h2>
          <p class="painel__resumo">Manda-nos a ideia, uma fotografia, ou só uma pergunta.</p>
          <div class="painel__acoes">
            <a class="btn btn--cheio" href="https://wa.me/${def.contactos.whatsapp}" target="_blank" rel="noopener">${ic.zap} Abrir conversa</a>
          </div>
        </div>
        <div class="painel" style="position:static">
          <span class="painel__cat">Redes</span>
          <h2 class="tit-m" style="margin:.4rem 0 .8rem">Instagram</h2>
          <p class="painel__resumo">É lá que publicamos o que vai saindo. @_ammacreative</p>
          <div class="painel__acoes">
            <a class="btn btn--linha" href="${esc(def.contactos.instagram)}" target="_blank" rel="noopener">${ic.insta} Ver o Instagram</a>
          </div>
        </div>
        <div class="painel" style="position:static">
          <span class="painel__cat">Telefone</span>
          <h2 class="tit-m" style="margin:.4rem 0 .8rem">Ligar</h2>
          <p class="painel__resumo">${esc(def.contactos.telefone_texto)}<br>
            <small style="color:var(--tinta-2)">${CUSTO_CHAMADA}</small></p>
          <div class="painel__acoes">
            <a class="btn btn--linha" href="tel:+351${def.contactos.telefone}">${ic.tel} Ligar agora</a>
          </div>
        </div>
      </div>
    </div>

    <div style="margin-top:clamp(2.5rem,5vw,4rem)">
      <div class="secao__topo">
        <div>
          <p class="sobre-linha">Onde estamos</p>
          <h2 class="tit-m">${esc(l.morada)}</h2>
          <p style="color:var(--tinta-2);margin-top:.4rem">${esc(l.codigo_postal)} ${esc(l.localidade)} · ${esc(l.concelho)}</p>
        </div>
        <a class="btn btn--linha" href="https://www.google.com/maps/dir/?api=1&amp;destination=${l.latitude},${l.longitude}"
           target="_blank" rel="noopener">${ic.pin} Como chegar</a>
      </div>
      ${def.opcoes.mostrar_mapa ? mapa() : ''}
    </div>
  </div>
</section>`;

  return pagina({
    pag: 'contactos/',
    titulo: `Contactos | ${def.empresa.nome_comercial}`,
    descricao: `Fale com a AMMA Creative: WhatsApp, Instagram ou telefone ${def.contactos.telefone_texto}. Estamos em ${l.morada}, ${l.codigo_postal} ${l.localidade}, ${l.concelho}.`,
    corpo,
    jsonld: [migalhasLD([{ nome: 'Início', href: '' }, { nome: 'Contactos' }]), negocioLD],
  });
}

/* ------------------------------------------- markdown mínimo (páginas legais) */
function marcarDown(md) {
  const linhas = md.split('\n');
  let html = '', lista = null;
  /* O negrito é convertido ANTES do itálico, senão a regra do itálico come o
     primeiro asterisco de cada par. */
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<![\w*])\*([^*]+)\*(?![\w*])/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, h) =>
      `<a href="${h.startsWith('http') || h.startsWith('mailto') ? h : u(h)}"${h.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);

  const fechar = () => { if (lista) { html += `</${lista}>\n`; lista = null; } };
  for (const l of linhas) {
    const t = l.trim();
    if (!t) { fechar(); continue; }
    let m;
    if ((m = t.match(/^###\s+(.*)$/))) { fechar(); html += `<h3>${inline(m[1])}</h3>\n`; }
    else if ((m = t.match(/^##\s+(.*)$/))) { fechar(); html += `<h2>${inline(m[1])}</h2>\n`; }
    else if ((m = t.match(/^[-*]\s+(.*)$/))) {
      if (lista !== 'ul') { fechar(); html += '<ul>\n'; lista = 'ul'; }
      html += `<li>${inline(m[1])}</li>\n`;
    } else if ((m = t.match(/^\d+\.\s+(.*)$/))) {
      if (lista !== 'ol') { fechar(); html += '<ol>\n'; lista = 'ol'; }
      html += `<li>${inline(m[1])}</li>\n`;
    } else { fechar(); html += `<p>${inline(t)}</p>\n`; }
  }
  fechar();
  return html;
}

/* =================================================================== main === */
function escrever(caminho, html) {
  const destino = join(SAIDA, caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html, 'utf8');
}

/* Que ficheiros de assets/produtos vão para o ar.
   O site serve as variantes -480/-960/-1600 e o cartão og.jpg. O ORIGINAL nunca
   é usado — mas era copiado à mesma, e são 40 MB de fotografias de 4096 px com
   os metadados do telemóvel dentro, incluindo coordenadas de GPS. Fica no
   repositório, para a biblioteca do backoffice o mostrar; deixa de ser publicado. */
const VARIANTE = /-(?:480|960|1600)\.webp$/;
const naoPublicados = [];
function publicavel(origem) {
  const rel = relative(RAIZ, origem).split(sep).join('/');
  if (!rel.startsWith('assets/produtos/')) return true;
  const nome = rel.split('/').pop();
  if (!nome.includes('.')) return true;                    // é pasta
  if (nome === 'og.jpg' || VARIANTE.test(nome)) return true;
  const base = nome.replace(/\.[a-z0-9]+$/i, '');
  const dir = dirname(origem);
  const tem = existsSync(dir) && readdirSync(dir).includes(`${base}-1600.webp`);
  if (tem) naoPublicados.push(rel);
  return !tem;
}

function main() {
  rmSync(SAIDA, { recursive: true, force: true });
  mkdirSync(SAIDA, { recursive: true });
  cpSync(join(RAIZ, 'assets'), join(SAIDA, 'assets'), { recursive: true, filter: publicavel });

  if (existsSync(join(RAIZ, 'CNAME'))) cpSync(join(RAIZ, 'CNAME'), join(SAIDA, 'CNAME'));

  escrever('index.html', paginaInicial());
  escrever('catalogo/index.html', paginaCatalogo());
  escrever('como-encomendar/index.html', paginaComoEncomendar());
  escrever('sobre/index.html', paginaSobre());
  escrever('contactos/index.html', paginaContactos());
  for (const c of categorias) escrever(`catalogo/${c.slug}/index.html`, paginaCategoria(c));
  for (const p of produtos) escrever(`catalogo/${p.categoria}/${p.slug}/index.html`, paginaProduto(p));

  /* páginas legais, em markdown */
  for (const [ficheiro, destino] of Object.entries({
    'privacidade.md': 'privacidade/index.html',
    'termos.md': 'termos/index.html',
    'resolucao-de-litigios.md': 'resolucao-de-litigios/index.html',
  })) {
    const caminho = join(RAIZ, 'conteudo', ficheiro);
    if (!existsSync(caminho)) continue;
    const bruto = readFileSync(caminho, 'utf8');
    const [, cab, md] = bruto.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [null, '', bruto];
    const meta = Object.fromEntries(cab.split('\n').filter(Boolean)
      .map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]));
    escrever(destino, pagina({
      pag: destino.replace('index.html', ''),
      titulo: `${meta.titulo} | ${def.empresa.nome_comercial}`,
      descricao: meta.descricao ?? meta.titulo,
      corpo: `<section class="secao" style="padding-top:clamp(1.5rem,4vw,2.5rem)"><div class="envolve envolve--estreito">
        ${migalhas([{ nome: 'Início', href: '' }, { nome: meta.titulo }])}
        <h1 class="tit-g" style="margin-bottom:1.5rem">${esc(meta.titulo)}</h1>
        <article class="texto">${marcarDown(md)}</article>
      </div></section>`,
    }));
  }

  /* sitemap, robots, 404 */
  const urls = ['', 'catalogo/', 'como-encomendar/', 'sobre/', 'contactos/',
    ...categorias.map((c) => `catalogo/${c.slug}/`),
    ...produtos.map((p) => `catalogo/${p.categoria}/${p.slug}/`),
    ...LEGAIS.map(([p]) => p)];
  const hoje = new Date().toISOString().slice(0, 10);
  escrever('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${hoje}</lastmod></url>`).join('\n')}
</urlset>
`);
  escrever('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
  escrever('404.html', pagina({
    pag: '404.html', titulo: `Página não encontrada | ${def.empresa.nome_comercial}`,
    descricao: 'A página que procura não existe.',
    corpo: `<section class="secao"><div class="envolve vazio">
      <p class="sobre-linha sobre-linha--centro">Erro 404</p>
      <h1 class="tit-g" style="margin-bottom:1rem">Não encontrámos esta página</h1>
      <p>Pode ter sido removida, ou o endereço está errado.</p>
      <div style="margin-top:1.6rem"><a class="btn btn--cheio" href="${u('catalogo/')}">Ver o catálogo ${ic.seta}</a></div>
    </div></section>`,
  }));
  writeFileSync(join(SAIDA, '.nojekyll'), '');

  console.log('gerado em _site/');
  console.log(`  ${produtos.length} produtos em ${categorias.length} categorias`);
  console.log(`  ${urls.length} páginas no sitemap`);
  console.log(`  base: ${BASE || '/'}   site: ${SITE}`);
  if (naoPublicados.length) {
    console.log(`  ${naoPublicados.length} originais ficaram fora do site (o site usa as variantes)`);
  }
}

main();
