/* ============================================================================
   REDUZIR FOTOGRAFIAS — só nesta página, não vai no site.js

   PORQUE É QUE ISTO EXISTE. O backoffice (Pages CMS) recusa fotografias grandes
   com uma mensagem que não explica nada: «Failed to upload file: 413». O 413 não
   é do Pages CMS: é da Vercel, que o aloja, e que corta qualquer pedido acima de
   4,5 MB antes de o código da aplicação correr. Como a fotografia vai codificada
   em base64 dentro de um JSON — o que a engorda um terço — o tecto real por
   ficheiro fica em cerca de 3,37 MB. Fotografias de telemóvel andam nos 2 a 6 MB,
   ou seja em cima da fronteira: umas passam, outras não, sem explicação.

   Não há forma de melhorar aquela mensagem. Não é código nosso, não existe opção
   de tamanho máximo na configuração, e o gancho de validação no navegador que o
   Pages CMS tem só olha para o TIPO do ficheiro, nunca para o tamanho — por isso
   a subida vai até ao fim antes de falhar.

   O que esta página faz é dizer o que a mensagem não diz: o tamanho de cada
   fotografia, se passa ou não, e devolvê-la pronta a carregar.

   Tudo acontece neste navegador. Nenhuma fotografia sai deste computador.
   ========================================================================== */
(function () {
  'use strict';

  /* ESTES NÚMEROS SÃO MEDIDOS, NÃO ESCOLHIDOS A OLHO. Vêm do site da LR Motors,
     onde este mesmo problema foi resolvido primeiro e a calibração foi feita por
     medição de PSNR contra o original:

         1600 px q82 ... custa 2,07 dB   ← apertado de mais
         2048 px q92 ... custa 0,14 dB
         2048 px q95 ... custa 0,01 dB   ← escolhido: sem diferença mensurável

     Acima de 2048 px não se ganha nada, porque o site reduz a 1600 px de
     qualquer maneira. E reduz-se o MENOS possível, não o mais: o objectivo é
     caber, não poupar. */
  var LADO_MAX = 2048;
  var ORCAMENTO = Math.round(2.6 * 1024 * 1024);
  var DEGRAUS = [0.95, 0.90, 0.85, 0.78, 0.70];
  var LIMITE = ORCAMENTO;                // acima disto é preciso reduzir

  /* ══════════════ APAGAR OS METADADOS ══════════════
     Uma fotografia de telemóvel traz dentro dela a marca do aparelho, a data e
     — o que importa aqui — as COORDENADAS DE GPS de onde foi tirada. A AMMA
     trabalha de casa e o repositório do site é público: uma fotografia tirada na
     sala publica a morada de casa com precisão de metros, sem ninguém dar por
     isso. Hoje não acontece porque as 99 fotografias que lá estão vieram do
     Instagram, que apaga o EXIF. A primeira que subir directamente do telemóvel
     já o traz.

     Isto apaga os segmentos privados e MANTÉM o APP2 de propósito: é lá que vive
     o perfil de cor. As fotografias do iPhone são em Display P3 e, sem o perfil,
     o navegador lê-as como sRGB — as cores saem lavadas. Deitar fora tudo o que
     começa por APP era o caminho fácil, e estragava-as.

     Não recomprime nada: mexe nos bytes dos cabeçalhos e deixa a imagem
     intacta. Por isso vale a pena mesmo nas fotografias que já passam. */
  function lerOrientacao(b) {
    for (var i = 2; i + 4 < b.length && b[i] === 0xFF;) {
      var marca = b[i + 1];
      var tam = (b[i + 2] << 8) | b[i + 3];
      if (marca === 0xDA || marca === 0xD9) break;
      if (marca === 0xE1 && String.fromCharCode.apply(null, b.slice(i + 4, i + 8)) === 'Exif') {
        var t = i + 10;
        var le = b[t] === 0x49;
        var d = new DataView(b.buffer, b.byteOffset + t, b.length - t);
        var ifd = d.getUint32(4, le);
        var n = d.getUint16(ifd, le);
        for (var e = 0; e < n; e++) {
          var pos = ifd + 2 + e * 12;
          if (d.getUint16(pos, le) === 0x0112) return d.getUint16(pos + 8, le) || 1;
        }
        return 1;
      }
      i += 2 + tam;
    }
    return 1;
  }

  /* Um EXIF do tamanho mínimo, só com a orientação. Apagar o EXIF inteiro numa
     fotografia que precisa de ser rodada deixá-la-ia deitada; por isso a
     orientação volta a entrar, e só ela. */
  function exifMinimo(orientacao) {
    var buf = new ArrayBuffer(34);
    var d = new DataView(buf);
    d.setUint16(0, 34);
    var m = 'Exif\u0000\u0000';
    for (var i = 0; i < m.length; i++) d.setUint8(2 + i, m.charCodeAt(i));
    d.setUint16(8, 0x4949, true);
    d.setUint16(10, 42, true);
    d.setUint32(12, 8, true);
    d.setUint16(16, 1, true);
    d.setUint16(18, 0x0112, true);
    d.setUint16(20, 3, true);
    d.setUint32(22, 1, true);
    d.setUint16(26, orientacao, true);
    d.setUint32(30, 0, true);
    return new Uint8Array(buf);
  }

  async function semMetadados(ficheiro) {
    try {
      var b = new Uint8Array(await ficheiro.arrayBuffer());
      if (b[0] !== 0xFF || b[1] !== 0xD8) return ficheiro;   // não é JPEG: fica como está
      var orientacao = lerOrientacao(b);
      var pedacos = [new Uint8Array([0xFF, 0xD8])];
      if (orientacao !== 1) pedacos.push(new Uint8Array([0xFF, 0xE1]), exifMinimo(orientacao));

      var i = 2;
      while (i + 4 <= b.length && b[i] === 0xFF) {
        var marca = b[i + 1];
        if (marca === 0xDA) { pedacos.push(b.subarray(i)); break; }
        var tam = 2 + ((b[i + 2] << 8) | b[i + 3]);
        var privado = marca === 0xE1 || marca === 0xED || marca === 0xFE;
        if (!privado) pedacos.push(b.subarray(i, i + tam));
        i += tam;
      }
      var limpo = new Blob(pedacos, { type: 'image/jpeg' });
      /* Maior, ou vazio, quer dizer que a leitura dos segmentos correu mal:
         devolve-se o original, que é sempre seguro. */
      return limpo.size > 0 && limpo.size <= ficheiro.size ? limpo : ficheiro;
    } catch (e) {
      return ficheiro;
    }
  }

  var zona = document.getElementById('zona');
  var entrada = document.getElementById('ficheiros');
  var lista = document.getElementById('lista');
  var resumo = document.getElementById('resumo');
  if (!zona || !entrada || !lista) return;

  var feitos = [];

  /* O QUE ESTAS MENSAGENS NÃO DIZEM, e é de propósito. A dona da loja não precisa
     de saber que o limite são 3 MB, que o erro do backoffice se chama «413», nem
     que se lhe apagam as coordenadas de GPS da fotografia — foi pedido, e com
     razão: nada disso é accionável por ela, e o que não é accionável só assusta.
     Cada linha diz uma coisa só — esta está pronta, ou esta não deu. O trabalho
     continua a ser feito exactamente como antes. */
  /* Vírgula decimal, não ponto: `toFixed` devolve «2.38» e em português lê-se
     «2,38». Detalhe pequeno que, numa página que ela vai usar, é a diferença
     entre parecer feita para ela ou traduzida. */
  var kb = function (b) {
    return b >= 1048576
      ? (b / 1048576).toFixed(2).replace('.', ',') + ' MB'
      : Math.round(b / 1024) + ' KB';
  };

  /* TODAS saem com o mesmo sufixo, tenham sido reduzidas ou não. Dar «-pronta» só
     às reduzidas devolvia pela porta do lado a informação que se quer fora daqui:
     dois nomes diferentes na pasta das transferências dizem exactamente quais
     foram mexidas. E precisa de sufixo — sem ele o navegador guarda como
     «IMG_0042 (1).jpg», ao lado do original, e ela tem de adivinhar qual é qual. */
  var EXTENSAO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

  /* A EXTENSÃO SEGUE O CONTEÚDO, não o nome que entrou. Uma fotografia reduzida sai
     sempre em JPEG; uma que já cabia sai no formato em que entrou, porque só se lhe
     tiraram os cabeçalhos. Escrever «.jpg» num ficheiro que é PNG dava um ficheiro
     com o nome errado dentro do repositório — e o backoffice valida a extensão. */
  function nomeDeSaida(nome, blob) {
    var ext = EXTENSAO[blob && blob.type] ||
      (nome.match(/\.([a-z0-9]+)$/i) || [, 'jpg'])[1].toLowerCase();
    return nome.replace(/\.[^.]+$/, '') + '-pronta.' + ext;
  }

  function linha(nome) {
    var li = document.createElement('li');
    li.className = 'red__item';
    li.innerHTML =
      '<div class="red__nome"></div>' +
      '<div class="red__estado">a ler…</div>' +
      '<div class="red__acao"></div>';
    li.querySelector('.red__nome').textContent = nome;
    lista.appendChild(li);
    return {
      estado: li.querySelector('.red__estado'),
      acao: li.querySelector('.red__acao'),
      raiz: li,
    };
  }

  /* Descodificar honrando a rotação. `imageOrientation: 'from-image'` é o que
     impede uma fotografia tirada na vertical de sair deitada: a rotação vive nos
     metadados e o canvas ignora-os a não ser que se peça. O Chrome de hoje já usa
     isso por omissão — testei —, mas o valor por omissão nunca foi garantido pela
     norma e o Safari do iPhone é exactamente onde ela estaria. Pede-se. */
  async function abrir(ficheiro) {
    if (self.createImageBitmap) {
      var bm = await createImageBitmap(ficheiro, { imageOrientation: 'from-image' });
      return { fonte: bm, largura: bm.width, altura: bm.height, fechar: function () { if (bm.close) bm.close(); } };
    }
    var url = URL.createObjectURL(ficheiro);
    try {
      var im = await new Promise(function (ok, falha) {
        var el = new Image();
        el.onload = function () { ok(el); };
        el.onerror = function () { falha(new Error('formato não reconhecido')); };
        el.src = url;
      });
      return { fonte: im, largura: im.naturalWidth, altura: im.naturalHeight, fechar: function () {} };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* Só se baixa a qualidade quando é preciso, e só se corta a dimensão se nem a
     qualidade mais baixa chegar. Na prática nunca chega lá — mas assim não há
     hipótese de esta página devolver algo que o backoffice recuse. */
  async function comprimir(aberto) {
    var lados = [LADO_MAX, Math.round(LADO_MAX / 1.5)];
    for (var k = 0; k < lados.length; k++) {
      var escala = Math.min(1, lados[k] / Math.max(aberto.largura, aberto.altura));
      var tela = document.createElement('canvas');
      tela.width = Math.round(aberto.largura * escala);
      tela.height = Math.round(aberto.altura * escala);
      var ctx = tela.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(aberto.fonte, 0, 0, tela.width, tela.height);

      for (var q = 0; q < DEGRAUS.length; q++) {
        var blob = await new Promise(function (ok) { tela.toBlob(ok, 'image/jpeg', DEGRAUS[q]); });
        if (!blob) continue;
        var ultimo = k === lados.length - 1 && q === DEGRAUS.length - 1;
        if (blob.size <= ORCAMENTO || ultimo) {
          return { blob: blob, largura: tela.width, altura: tela.height };
        }
      }
    }
    return null;
  }

  async function trata(ficheiro) {
    var ui = linha(ficheiro.name);

    if (ficheiro.size === 0) {
      ui.estado.innerHTML = '<b class="red__mau">Este ficheiro está vazio</b> ' +
        '(0 bytes). Alguma coisa correu mal a copiá-lo ou a descarregá-lo.';
      return;
    }

    /* DESCODIFICA-SE SEMPRE, mesmo quando o tamanho passa. Na primeira versão
       desta página um ficheiro pequeno era dado como «passa» sem nunca se
       confirmar que era uma imagem — um ficheiro vazio, um PDF ou um HEIC de
       200 KB arrastados para aqui recebiam luz verde e só falhavam depois, no
       backoffice, outra vez sem explicação. É o oposto do que esta página serve. */
    var aberto;
    try {
      aberto = await abrir(ficheiro);
    } catch (e) {
      /* Quase sempre HEIC: o formato do iPhone, que a maior parte dos
         navegadores não sabe descodificar. O Safari do iPhone sabe. */
      var heic = /\.(heic|heif)$/i.test(ficheiro.name);
      ui.estado.innerHTML = heic
        ? '<b class="red__mau">É um ficheiro HEIC</b> e este navegador não o sabe abrir. ' +
          'No iPhone: Definições, Câmara, Formatos, escolha «Mais compatível» — as ' +
          'fotografias passam a sair em JPG. As que já tirou, abra esta página no ' +
          'Safari do iPhone, que lê HEIC.'
        : '<b class="red__mau">Não consegui abrir este ficheiro.</b> ' +
          'É uma fotografia? Só aceito JPG, PNG e WebP.';
      return;
    }

    var saida, nome, mensagem;

    if (ficheiro.size <= LIMITE) {
      /* JÁ CABE: não se recomprime. Voltar a gravá-la não a melhorava e chegou a
         PIORÁ-LA — no LR Motors uma fotografia de 822 KB saía com 1,2 MB, maior e
         com mais uma compressão em cima. Mas limpam-se os metadados, que é uma
         operação de bytes e não toca na imagem: é o que tira as coordenadas de
         GPS antes de a fotografia ir para um repositório público. */
      saida = await semMetadados(ficheiro);
      nome = nomeDeSaida(ficheiro.name, saida);
      mensagem = '<b class="red__ok">Pronta.</b>';
      ui.raiz.classList.add('red__item--ok');
    } else {
      ui.estado.innerHTML = 'A preparar…';
      ui.raiz.classList.add('red__item--grande');

      var r = await comprimir(aberto);
      aberto.fechar();
      if (!r) {
        ui.estado.innerHTML = '<b class="red__mau">Esta não deu.</b> ' +
          'Mande-a por WhatsApp que nós carregamos.';
        return;
      }
      /* Passar pelo canvas já apaga tudo o que a fotografia trazia dentro: o
         canvas só conhece píxeis. */
      saida = r.blob;
      nome = nomeDeSaida(ficheiro.name, saida);
      /* EXACTAMENTE A MESMA FRASE da que não foi tocada, e é esse o ponto: a dona
         da loja não precisa de saber que houve redução nenhuma. Duas fotografias
         lado a lado, uma reduzida e outra não, dizem as duas «Pronta.» */
      mensagem = '<b class="red__ok">Pronta.</b>';
      ui.raiz.classList.remove('red__item--grande');
    }

    var url = URL.createObjectURL(saida);
    feitos.push({ url: url, nome: nome });
    ui.raiz.classList.add('red__item--feito');
    ui.estado.innerHTML = mensagem;

    var a = document.createElement('a');
    a.className = 'btn btn--cheio btn--pequeno';
    a.href = url;
    a.download = nome;
    a.textContent = 'Guardar';
    ui.acao.appendChild(a);
    /* A que já cabia sai com o MESMO nome do original. É de propósito: é a mesma
       fotografia, só sem os metadados, e dois nomes diferentes para a mesma
       imagem punham-na a escolher entre duas coisas iguais. */

    contaResumo();
  }

  function contaResumo() {
    if (!resumo) return;
    if (!feitos.length) { resumo.hidden = true; return; }
    resumo.hidden = false;
    /* «Prontas», não «reduzidas»: as que já cabiam não foram reduzidas, e dizer
       que foram era mentira em cima de um número. */
    resumo.querySelector('.red__quantas').textContent = feitos.length === 1
      ? 'Uma fotografia pronta a carregar.'
      : feitos.length + ' fotografias prontas a carregar.';
  }

  var todas = document.getElementById('guardar-todas');
  if (todas) {
    todas.addEventListener('click', function () {
      /* Um clique por ficheiro, espaçado: o navegador ignora downloads
         disparados todos no mesmo instante. */
      feitos.forEach(function (f, i) {
        setTimeout(function () {
          var a = document.createElement('a');
          a.href = f.url;
          a.download = f.nome;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }, i * 350);
      });
    });
  }

  function recebe(ficheiros) {
    var arr = Array.prototype.slice.call(ficheiros);
    if (!arr.length) return;
    /* Uma a uma, não todas ao mesmo tempo: descodificar seis fotografias de 5 MB
       em paralelo bloqueia um telemóvel. */
    arr.reduce(function (fila, f) {
      return fila.then(function () { return trata(f); });
    }, Promise.resolve());
  }

  entrada.addEventListener('change', function () { recebe(entrada.files); });

  ['dragenter', 'dragover'].forEach(function (ev) {
    zona.addEventListener(ev, function (e) {
      e.preventDefault();
      zona.classList.add('red__zona--sobre');
    });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    zona.addEventListener(ev, function (e) {
      e.preventDefault();
      zona.classList.remove('red__zona--sobre');
    });
  });
  zona.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files) recebe(e.dataTransfer.files);
  });
})();
