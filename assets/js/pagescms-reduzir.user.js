// ==UserScript==
// @name         AMMA Creative — reduzir fotografias no Pages CMS
// @namespace    https://renatovalente5.github.io/AMMA_Creative/
// @version      1.0.0
// @description  Reduz as fotografias grandes no momento do envio, para o backoffice deixar de recusar com «Failed to upload file: 413». Não pede nada a quem carrega e não mostra nada: só acontece.
// @author       renatovalente5/AMMA_Creative
// @match        https://app.pagescms.org/*
// @run-at       document-start
// @grant        none
// @downloadURL  https://renatovalente5.github.io/AMMA_Creative/assets/js/pagescms-reduzir.user.js
// @updateURL    https://renatovalente5.github.io/AMMA_Creative/assets/js/pagescms-reduzir.user.js
// ==/UserScript==

/* ============================================================================
   PORQUE É QUE ISTO EXISTE

   O Pages CMS recusa fotografias grandes com «Failed to upload file: 413», que
   não explica nada. O 413 não é dele: é da Vercel, que o aloja e que corta
   qualquer pedido acima de 4,5 MB antes de o código da aplicação correr. Como a
   fotografia vai codificada em base64 dentro de um JSON — o que a engorda um
   terço — o tecto real por ficheiro fica em cerca de 3,37 MB. Fotografias de
   telemóvel andam nos 2 a 6 MB, ou seja em cima da fronteira: umas passam,
   outras não, sem explicação nenhuma.

   Não há como resolver isto do lado do repositório. Não existe opção de tamanho
   máximo na configuração (o esquema é `.strict()` e o pedido está aberto na
   issue #346), e a validação que o Pages CMS faz no navegador só olha para o
   TIPO do ficheiro, nunca para o tamanho — não existe uma única leitura de
   `file.size` em `components/media/media-upload.tsx`. A PR #425, que faria
   exactamente o que este script faz, está aberta e sem um único comentário
   desde Agosto de 2026, e o repositório não recebe um push desde Junho.

   COMO FUNCIONA. O upload é um `fetch` global com um JSON dentro
   (`{type:"media", name, content}`, o `content` em base64). Este script
   substitui o `window.fetch` e, quando vê um desses pedidos com uma fotografia
   grande, descodifica-a, redesenha-a mais pequena num canvas, volta a codificar
   e devolve o corpo com a fotografia nova. O Pages CMS não sabe que aconteceu.

   PORQUE É QUE REDUZIR NÃO CUSTA QUALIDADE NENHUMA NESTE SITE. O AMMA Creative
   nunca serve o ficheiro original: em cada publicação o `otimizar-imagens.py`
   gera variantes de 480, 960 e 1600 px em WebP, e o `gerar.mjs` monta o
   `srcset` só a partir dessas — uma fotografia sem variantes é ignorada, não há
   recurso ao original. Logo a maior imagem que um visitante recebe tem 1600 px.
   Enviar 2000 px em vez de 4000 é invisível no site publicado, e poupa ao
   repositório megabytes que nunca chegariam a ninguém.

   REGRAS QUE ESTE SCRIPT NÃO QUEBRA
   • Fotografias que já cabem passam byte a byte, sem serem tocadas. Recomprimir
     o que já cabe só piora — cada passagem por JPEG perde qualidade.
   • O formato nunca muda. Um JPEG sai JPEG, um PNG sai PNG. Mudar de formato
     obrigaria a mudar a extensão, que está no endereço do pedido, e o ficheiro
     iria para o repositório com o nome errado.
   • Se alguma coisa falhar — um formato que o navegador não descodifica, um erro
     no canvas, o que for — o pedido ORIGINAL segue intacto. Um script destes
     nunca pode ser a razão de um upload falhar. No pior caso volta o 413, que é
     o que já acontecia.

   O QUE ISTO NÃO RESOLVE. Um ficheiro HEIC (o formato do iPhone) é recusado pela
   filtragem de extensões do próprio Pages CMS ANTES de haver qualquer pedido —
   este script nem chega a ser chamado. No iPhone: Definições, Câmara, Formatos,
   «Mais compatível».
   ========================================================================== */
(function () {
  'use strict';

  /* O tecto real é ~3 370 000 bytes, mas o orçamento da Vercel é o PEDIDO
     INTEIRO: cabeçalhos, cookie de sessão e caminho do URL comem do mesmo saco.
     Por isso mexe-se acima de 2,9 MB e aponta-se a 2,4 MB — sobra margem e não
     se anda a apurar bytes. */
  var MEXER_ACIMA_DE = Math.round(2.9 * 1024 * 1024);
  var ALVO = Math.round(2.4 * 1024 * 1024);
  var LADO_MAX = 2000;                 // o site nunca serve mais de 1600 px
  var QUALIDADES = [0.9, 0.84, 0.78, 0.72, 0.66, 0.6];

  var TIPOS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

  var log = function () {
    var a = Array.prototype.slice.call(arguments);
    console.log.apply(console, ['[reduzir-fotos]'].concat(a));
  };

  function tipoDoCaminho(url) {
    try {
      var ultimo = decodeURIComponent(String(url).split('?')[0].split('/').pop() || '');
      var ext = (ultimo.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
      return TIPOS[ext] || null;
    } catch (e) {
      return null;
    }
  }

  /* base64 → Blob pela via mais curta e mais rápida que o navegador tem: deixa-o
     descodificar um data: URL em vez de o fazer byte a byte em JavaScript. */
  function paraBlob(base64, tipo) {
    return fetch('data:' + tipo + ';base64,' + base64).then(function (r) { return r.blob(); });
  }

  function paraBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).replace(/^[^,]+,/, '')); };
      fr.onerror = function () { reject(new Error('não consegui recodificar')); };
      fr.readAsDataURL(blob);
    });
  }

  function desenhar(bitmap, lado) {
    var escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
    var l = Math.round(bitmap.width * escala);
    var a = Math.round(bitmap.height * escala);
    var tela = document.createElement('canvas');
    tela.width = l;
    tela.height = a;
    tela.getContext('2d').drawImage(bitmap, 0, 0, l, a);
    return { tela: tela, largura: l, altura: a };
  }

  function exportar(tela, tipo, qualidade) {
    return new Promise(function (resolve) {
      tela.toBlob(function (b) { resolve(b); }, tipo, qualidade);
    });
  }

  async function reduzir(blob, tipo) {
    var bitmap = await createImageBitmap(blob);
    var lado = LADO_MAX;
    var melhor = null;

    try {
      while (lado >= 700) {
        var d = desenhar(bitmap, lado);
        /* O PNG não tem parâmetro de qualidade: só a dimensão o encolhe. Por
           isso uma tentativa por dimensão, e não seis. */
        var qs = tipo === 'image/png' ? [undefined] : QUALIDADES;
        for (var i = 0; i < qs.length; i++) {
          var b = await exportar(d.tela, tipo, qs[i]);
          if (!b) continue;
          if (!melhor || b.size < melhor.blob.size) {
            melhor = { blob: b, largura: d.largura, altura: d.altura };
          }
          if (b.size <= ALVO) {
            return { blob: b, largura: d.largura, altura: d.altura };
          }
        }
        lado = Math.round(lado * 0.8);
      }
    } finally {
      if (bitmap.close) bitmap.close();
    }

    /* Não chegou ao alvo. Devolve-se o MENOR que se conseguiu em vez de desistir:
       se couber abaixo do tecto real ainda passa, e mesmo que não passe é melhor
       do que mandar o original. (É aqui que a PR #425 falha: guarda o menor e
       nunca o devolve — recusa o upload em vez de tentar com ele.) */
    return melhor;
  }

  var original = window.fetch;

  window.fetch = async function (entrada, opcoes) {
    try {
      var url = typeof entrada === 'string' ? entrada
        : (entrada && entrada.url) ? entrada.url : '';
      var metodo = ((opcoes && opcoes.method) ||
        (entrada && entrada.method) || 'GET').toUpperCase();
      var corpo = opcoes && opcoes.body;

      var candidato = metodo === 'POST' &&
        /\/files\//.test(url) &&
        typeof corpo === 'string' &&
        corpo.indexOf('"media"') !== -1;

      if (candidato) {
        var dados = JSON.parse(corpo);
        var tipo = tipoDoCaminho(url);

        if (dados && dados.type === 'media' && typeof dados.content === 'string' && tipo) {
          /* 3 bytes de ficheiro por cada 4 de base64: chega para decidir se vale
             a pena descodificar. */
          var bytes = Math.floor(dados.content.length * 3 / 4);

          if (bytes > MEXER_ACIMA_DE) {
            var blob = await paraBlob(dados.content, tipo);
            var r = await reduzir(blob, tipo);

            if (r && r.blob && r.blob.size < blob.size) {
              dados.content = await paraBase64(r.blob);
              opcoes = Object.assign({}, opcoes, { body: JSON.stringify(dados) });
              log('reduzida antes de enviar:',
                (blob.size / 1048576).toFixed(2) + ' MB →',
                (r.blob.size / 1048576).toFixed(2) + ' MB',
                '(' + r.largura + '×' + r.altura + ' px)');
            } else {
              log('não consegui reduzir; segue como está',
                (bytes / 1048576).toFixed(2) + ' MB');
            }
          }
        }
      }
    } catch (e) {
      /* Nunca, em circunstância nenhuma, este script pode ser a razão de um
         upload falhar. Qualquer erro aqui e o pedido original segue intacto. */
      log('deixei passar sem tocar, por causa de:', e && e.message);
    }

    return original.apply(this, [entrada, opcoes]);
  };

  log('activo. Fotografias acima de 2,9 MB são reduzidas no envio.');
})();
