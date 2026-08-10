/* ============================================================================
   AMMA CREATIVE — o pouco JavaScript que o site precisa

   É pouco de propósito. O menu de ecrã inteiro é `popover` nativo, os cartões
   adaptam-se com container queries, e a prateleira de categorias é uma zona que
   rola com `scroll-snap` e marcadores nativos. Nada disso está aqui, porque nada
   disso precisa de JavaScript.

   Houve aqui mais duas funcionalidades de CSS — as animações de entrada com
   `animation-timeline: view()` e as transições entre páginas com
   `@view-transition`. As duas deixavam fotografias de artigos sem serem
   pintadas no Chrome e as duas foram retiradas. O relato completo, com as
   medições, está no `estilo.css`.

   O que ficou:
     1. o logótipo que encolhe no scroll
     2. recuo do menu, para browsers sem Popover API
     3. filtros do catálogo
     4. galeria e lupa da ficha de produto
     5. consentimento do mapa
     6. aviso de cookies

   Sem dependências. Tudo degrada: sem JavaScript o site lê-se e navega-se
   inteiro — os filtros desaparecem, o menu é um link para o catálogo, e o mapa
   fica um botão para o Google Maps.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ------------------------------------------- 1. o logótipo encolhe no scroll */
  (function () {
    var topo = $('#topo');
    if (!topo) return;

    /* O limite de descida é DIFERENTE do de subida — 40 px contra 10. Sem essa
       folga, uma página parada exactamente na fronteira fica a alternar entre os
       dois estados a cada pixel de scroll, e o logótipo tremia. */
    var DESCER = 40, SUBIR = 10;
    var desceu = false, agendado = false;

    function ver() {
      agendado = false;
      var y = window.scrollY || document.documentElement.scrollTop;
      if (!desceu && y > DESCER) { desceu = true; topo.classList.add('topo--desceu'); }
      else if (desceu && y < SUBIR) { desceu = false; topo.classList.remove('topo--desceu'); }
    }
    /* Uma leitura por frame, e não uma por evento de scroll: o scroll dispara
       dezenas de vezes por frame e ler `scrollY` força o browser a recalcular a
       disposição da página. */
    window.addEventListener('scroll', function () {
      if (!agendado) { agendado = true; requestAnimationFrame(ver); }
    }, { passive: true });
    ver();
  })();

  /* ----------------------------- 2. recuo do menu, sem Popover API disponível */
  (function () {
    var menu = $('#menu');
    if (!menu) return;
    /* Onde o `popover` existe, o browser faz tudo — abrir, fechar com Escape,
       prender o foco — e este bloco não faz nada. */
    if (HTMLElement.prototype.hasOwnProperty('popover')) return;

    var abrir = $('#abrir-menu');
    var fechar = $$('[popovertargetaction="hide"]', menu);
    var ultimoFoco = null;

    function mostrar() {
      ultimoFoco = document.activeElement;
      if (menu.showModal) menu.showModal(); else menu.setAttribute('open', '');
      var a = $('a', menu); if (a) a.focus();
    }
    function esconder() {
      if (menu.close) menu.close(); else menu.removeAttribute('open');
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    }
    if (abrir) abrir.addEventListener('click', mostrar);
    fechar.forEach(function (b) { b.addEventListener('click', esconder); });
    /* Seguir uma ligação do menu tem de o fechar: numa transição entre páginas o
       diálogo podia ficar aberto por cima da página nova. */
    $$('a', menu).forEach(function (a) { a.addEventListener('click', esconder); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.hasAttribute('open')) esconder();
    });
  })();

  /* ------------------------------------------------ 3. filtros do catálogo */
  (function () {
    var forma = $('#filtros'), grelha = $('#grelha');
    if (!forma || !grelha) return;

    var cartoes = $$('.prod', grelha);
    var vazio = $('#vazio');
    var contagem = $('#contagem');
    var limpar = $('#limpar');
    var estado = { categoria: '', ocasiao: '' };

    function aplicar() {
      var n = 0;
      cartoes.forEach(function (c) {
        var okCat = !estado.categoria || c.dataset.categoria === estado.categoria;
        var ocas = (c.dataset.ocasioes || '').split(' ');
        var okOca = !estado.ocasiao || ocas.indexOf(estado.ocasiao) !== -1;
        var mostra = okCat && okOca;
        /* `hidden` e não `style.display`: o CSS tem
           `[hidden] { display: none !important }` à cabeça, precisamente porque
           uma classe com `display` ganha ao atributo e os filtros ficariam a
           esconder cartões que continuavam à vista. */
        c.hidden = !mostra;
        if (mostra) n++;
      });
      if (vazio) vazio.hidden = n > 0;
      grelha.hidden = n === 0;
      if (contagem) contagem.innerHTML = '<b>' + n + '</b> ' + (n === 1 ? 'artigo' : 'artigos');
      if (limpar) limpar.hidden = !estado.categoria && !estado.ocasiao;

      /* O endereço acompanha o filtro, para se poder partilhar ou recarregar sem
         perder a escolha. `replaceState` e não `pushState`: cada toque num filtro
         não é um passo do histórico que o botão «voltar» tenha de desfazer. */
      var q = new URLSearchParams();
      if (estado.categoria) q.set('categoria', estado.categoria);
      if (estado.ocasiao) q.set('ocasiao', estado.ocasiao);
      var s = q.toString();
      history.replaceState(null, '', s ? '?' + s : location.pathname);
    }

    function marcar(tipo) {
      $$('[data-filtro="' + tipo + '"]', forma).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.valor === estado[tipo]));
      });
    }

    $$('.ficha[data-filtro]', forma).forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.dataset.filtro;
        /* Tocar no filtro que já está escolhido desliga-o. Poupa uma ida ao
           «Todas» e é o que as pessoas tentam fazer. */
        estado[t] = (estado[t] === b.dataset.valor) ? '' : b.dataset.valor;
        marcar(t);
        aplicar();
      });
    });

    if (limpar) limpar.addEventListener('click', function () {
      estado.categoria = ''; estado.ocasiao = '';
      marcar('categoria'); marcar('ocasiao'); aplicar();
    });

    /* Estado inicial vindo do endereço: uma ligação de fora pode já trazer
       ?categoria=aco, e o catálogo abre filtrado. */
    var q = new URLSearchParams(location.search);
    ['categoria', 'ocasiao'].forEach(function (t) {
      var v = q.get(t);
      if (v && $$('[data-filtro="' + t + '"][data-valor="' + v + '"]', forma).length) {
        estado[t] = v; marcar(t);
      }
    });
    if (estado.categoria || estado.ocasiao) aplicar();
    else if (limpar) limpar.hidden = true;
  })();

  /* --------------------------------------------- 4. galeria e lupa do produto */
  (function () {
    var dados = $('#fotos-json');
    if (!dados) return;
    var fotos;
    try { fotos = JSON.parse(dados.textContent); } catch (e) { return; }
    if (!fotos.length) return;

    var principal = $('#foto');
    var tiras = $$('.tira');
    var i = 0;

    function ir(n) {
      i = (n + fotos.length) % fotos.length;
      if (principal) { principal.src = fotos[i].src; principal.srcset = fotos[i].srcset; }
      tiras.forEach(function (t, k) { t.setAttribute('aria-current', String(k === i)); });
      var lupaImg = $('#lupa-img');
      if (lupaImg && lupaImg.src) { lupaImg.src = fotos[i].src; lupaImg.srcset = fotos[i].srcset; }
      var conta = $('#lupa-n'); if (conta) conta.textContent = String(i + 1);
    }

    tiras.forEach(function (t) {
      t.addEventListener('click', function () { ir(parseInt(t.dataset.i, 10)); });
    });

    var lupa = $('#lupa');
    var abrir = $('#abrir-lupa');
    if (lupa && abrir) {
      abrir.addEventListener('click', function () {
        var img = $('#lupa-img');
        img.src = fotos[i].src; img.srcset = fotos[i].srcset;
        img.alt = principal ? principal.alt : '';
        var conta = $('#lupa-n'); if (conta) conta.textContent = String(i + 1);
        if (lupa.showModal) lupa.showModal();
      });
      var x = $('#lupa-x'); if (x) x.addEventListener('click', function () { lupa.close(); });
      $$('.lupa__nav', lupa).forEach(function (b) {
        b.addEventListener('click', function () { ir(i + parseInt(b.dataset.passo, 10)); });
      });
      /* Clicar fora da fotografia fecha — é o que se espera de uma lupa, e o
         <dialog> não o faz sozinho. */
      lupa.addEventListener('click', function (e) {
        if (e.target === lupa || e.target.classList.contains('lupa__corpo')) lupa.close();
      });
      document.addEventListener('keydown', function (e) {
        if (!lupa.open) return;
        if (e.key === 'ArrowRight') ir(i + 1);
        if (e.key === 'ArrowLeft') ir(i - 1);
      });
    }
  })();

  /* ------------------------------------- 5. o mapa só carrega com autorização */
  /* O embed do Google instala cookies antes de qualquer interacção, e o
     consentimento tem de ser PRÉVIO — art. 5.º da Lei 41/2004. Por isso o mapa
     não está no HTML: é criado depois de alguém carregar no botão. */
  (function () {
    var mapa = $('#mapa');
    if (!mapa) return;
    var btn = $('#btn-mapa');
    var consent = $('#mapa-consent');

    function carregar() {
      if ($('iframe', mapa)) return;
      var f = document.createElement('iframe');
      f.src = mapa.dataset.mapa;
      f.title = 'Mapa com a localização da AMMA Creative';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.setAttribute('allowfullscreen', '');
      mapa.appendChild(f);
      if (consent) consent.hidden = true;
      try { localStorage.setItem('amma:mapa', '1'); } catch (e) { /* navegação privada */ }
    }
    if (btn) btn.addEventListener('click', carregar);

    /* Quem já autorizou antes não tem de voltar a autorizar. Só se lê a escolha
       explícita para o MAPA: aceitar o aviso de cookies não é autorizar o
       Google, e misturar as duas coisas era o que fazia o mapa pedir outra vez
       depois de a pessoa ter aceitado tudo. */
    try {
      if (localStorage.getItem('amma:mapa') === '1') carregar();
    } catch (e) { /* nada */ }
  })();

  /* ------------------------------------------------- 6. aviso de cookies */
  /* O site não tem analítica, nem carrinho, nem publicidade: fora do mapa, não
     instala cookie nenhuma. O aviso existe SÓ por causa do mapa, e diz isso —
     dois botões, sem painel de preferências para uma escolha que é uma. */
  (function () {
    var CHAVE = 'amma:cookies';
    var barra = $('#cc');
    if (!barra) return;

    function guardado() {
      try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
    }
    function guardar(v) {
      try { localStorage.setItem(CHAVE, v); } catch (e) { /* nada */ }
    }

    if (!guardado()) barra.hidden = false;

    $$('[data-cc]', barra).forEach(function (b) {
      b.addEventListener('click', function () {
        guardar(b.dataset.cc);
        barra.hidden = true;
        /* Aceitar aqui autoriza também o mapa — é a única coisa de terceiros que
           o site tem, e obrigar a autorizar duas vezes seria absurdo. Recusar
           não apaga uma autorização de mapa dada antes de propósito. */
        if (b.dataset.cc === 'sim') {
          try { localStorage.setItem('amma:mapa', '1'); } catch (e) { /* nada */ }
          var m = $('#btn-mapa'); if (m) m.click();
        }
      });
    });

    /* Reabrir o aviso a partir do rodapé, para se poder mudar de ideias. */
    $$('[data-cc-abrir]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); barra.hidden = false; });
    });
  })();
})();
