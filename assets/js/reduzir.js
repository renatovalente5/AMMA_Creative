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
   fotografia, se passa ou não, e devolvê-la reduzida se não passar.

   Tudo acontece neste navegador. Nenhuma fotografia sai deste computador.
   ========================================================================== */
(function () {
  'use strict';

  /* O tecto real é ~3 370 000 bytes, mas o orçamento da Vercel é o PEDIDO
     INTEIRO: cabeçalhos, cookie de sessão e o caminho do URL comem do mesmo
     saco. No navegador da cliente, com a sessão do Pages CMS, o tecto está
     algumas centenas de bytes mais abaixo do que num pedido nu. Por isso o
     limite que se anuncia é 3 MB e o alvo da compressão é 2,4 MB: sobra margem
     e não se anda a apurar bytes. */
  var LIMITE = 3 * 1024 * 1024;          // acima disto, avisa
  var ALVO = Math.round(2.4 * 1024 * 1024); // ao reduzir, aponta para aqui
  var LADO_MAX = 2560;                   // o site só precisa de 1600 px

  var zona = document.getElementById('zona');
  var entrada = document.getElementById('ficheiros');
  var lista = document.getElementById('lista');
  var resumo = document.getElementById('resumo');
  if (!zona || !entrada || !lista) return;

  var feitos = [];

  var kb = function (b) {
    return b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.round(b / 1024) + ' KB';
  };

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

  /* O canvas devolve sempre JPEG: é o formato que o backoffice aceita e o que a
     máquina fotográfica do telefone já produz. Baixa-se a qualidade por passos
     e, se ao fim de todos ainda não couber, encolhe-se o lado maior. */
  function comprimir(bitmap, ladoMax, qualidades) {
    var escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
    var l = Math.round(bitmap.width * escala);
    var a = Math.round(bitmap.height * escala);
    var tela = document.createElement('canvas');
    tela.width = l;
    tela.height = a;
    var ctx = tela.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, l, a);

    return new Promise(function (resolve) {
      var i = 0;
      (function tenta() {
        if (i >= qualidades.length) {
          resolve(null);   // não coube: quem chama volta a chamar com lado menor
          return;
        }
        tela.toBlob(function (blob) {
          if (blob && (blob.size <= ALVO || i === qualidades.length - 1)) {
            resolve({ blob: blob, largura: l, altura: a, qualidade: qualidades[i] });
          } else {
            i++;
            tenta();
          }
        }, 'image/jpeg', qualidades[i]);
      })();
    });
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
    var bitmap;
    try {
      bitmap = await createImageBitmap(ficheiro);
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

    /* Passa como está? Então não se mexe. Recomprimir uma fotografia que já cabe
       só a piora — cada passagem por JPEG perde qualidade. */
    if (ficheiro.size <= LIMITE) {
      ui.estado.innerHTML = '<b class="red__ok">' + kb(ficheiro.size) + ' — passa.</b> ' +
        bitmap.width + '×' + bitmap.height + ' px. Carregue esta como está.';
      ui.raiz.classList.add('red__item--ok');
      if (bitmap.close) bitmap.close();
      return;
    }

    ui.estado.innerHTML = '<b class="red__mau">' + kb(ficheiro.size) +
      ' — grande demais.</b> O backoffice recusa acima de 3 MB. A reduzir…';
    ui.raiz.classList.add('red__item--grande');

    var lado = LADO_MAX;
    var r = null;
    while (lado >= 800) {
      r = await comprimir(bitmap, lado, [0.92, 0.85, 0.78, 0.7, 0.62]);
      if (r && r.blob.size <= ALVO) break;
      lado = Math.round(lado * 0.8);
    }
    if (bitmap.close) bitmap.close();

    if (!r) {
      ui.estado.innerHTML = '<b class="red__mau">Não consegui reduzir esta.</b> ' +
        'Mande-a por WhatsApp que nós carregamos.';
      return;
    }

    var nome = ficheiro.name.replace(/\.[^.]+$/, '') + '-reduzida.jpg';
    var url = URL.createObjectURL(r.blob);
    feitos.push({ url: url, nome: nome });

    ui.raiz.classList.remove('red__item--grande');
    ui.raiz.classList.add('red__item--feito');
    ui.estado.innerHTML = 'Era <s>' + kb(ficheiro.size) + '</s>, ficou <b class="red__ok">' +
      kb(r.blob.size) + '</b> — ' + r.largura + '×' + r.altura + ' px. Passa.';

    var a = document.createElement('a');
    a.className = 'btn btn--cheio btn--pequeno';
    a.href = url;
    a.download = nome;
    a.textContent = 'Guardar';
    ui.acao.appendChild(a);

    contaResumo();
  }

  function contaResumo() {
    if (!resumo) return;
    if (!feitos.length) { resumo.hidden = true; return; }
    resumo.hidden = false;
    resumo.querySelector('.red__quantas').textContent = feitos.length === 1
      ? 'Uma fotografia reduzida e pronta a carregar.'
      : feitos.length + ' fotografias reduzidas e prontas a carregar.';
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
