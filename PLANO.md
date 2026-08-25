# AMMA Creative — plano

Site para a **AMMA Creative**, loja de artigos personalizados em Vila Nova de Anha
(Viana do Castelo). Marca jovem, feita por mulheres, que personaliza para bebés,
mamãs e papás — e também para casamentos e baptizados.

Este ficheiro é o plano e o registo das decisões. Cada passo é fechado antes de
começar o seguinte, e o que falhou fica escrito, não apagado.

---

## 0. O que se sabe, e de onde vem

Tudo o que está aqui foi tirado do material da empresa, não inventado.

### As categorias são delas

Não fui eu que as decidi. O cartão «Bem-vindos» que publicam no Instagram
(`631337301_…jpg`) lista-as, e é essa a espinha do site:

| Categoria no cartão | Como fica no site |
|---|---|
| Textil Personalizado | **Têxtil** |
| Artigos em aço personalizáveis | **Aço inoxidável** |
| Box anúncio gravidez | **Boxes de anúncio** |
| Body anúncio gravidez, convites padrinhos.. | **Bodies e convites** |
| Almofadas/canecas personalizadas | **Casa** |
| Ímãs/Porta-chaves — Lembranças casamento/baptizados | **Lembranças** |

O cartão diz também «Somos uma loja de artigos personalizados!» e assina
«obrigada por nos escolher» — feminino singular. O tom do site segue isso:
primeira pessoa, próximo, sem linguagem de catálogo.

### A paleta é do logótipo e das fotografias

Medida, não estimada:

| | | de onde |
|---|---|---|
| `#602601` | marrom-chocolate | 91,4% do logótipo; é a cor das publicações de marca no Instagram |
| `#FAF1E8` | creme | fundo do cartão «Bem-vindos» |
| `#FFFFFF` | branco | o texto do logótipo (contraste 11,73:1 sobre o marrom) |

Das fotografias de produto saem os neutros quentes que já são o cenário delas:
madeira `#A99986`, veludo nude, lona crua `#ABA5A6`, terra `#7F6B5C`, e o dourado
das peças em aço.

Isto bate com o que a investigação diz sobre 2026 para marcas de artesanato e
presente: **um ambiente neutro dominante, duas ou três texturas tácteis, e um só
acento intencional.** Não é preciso inventar uma paleta — a marca já a tem.

### As 52 fotografias, catalogadas

Vistas uma a uma. O que lá está:

- **bodies de bebé** com pedidos de padrinhos/madrinhas («um bebé especial precisa
  da madrinha mais especial de todas, aceitas?»), anúncios de gravidez
  («Baby loading 2026», «Big Brother 2026»), avós, tios, «A minha primeira Páscoa»
- **boxes de pedido** em madeira e cartão, com sapatinhos e carta
- **aço inoxidável**: colares de inicial, pendentes gravados com nomes, pulseiras
  — fotografados sobre fatia de tronco e sobre cartão de veludo nude
- **t-shirts e sweats**: «MOM», «PAPA», «BRIDE / Team Bride», «Eu sou o noivo»,
  «Super Padrinho»
- **boxes de presente** com vinho e acessórios
- **sacos de pano e bolsas** com monograma
- **porta-chaves de acrílico com fotografia**
- **impressões de ecografia** em estilo polaroid
- uma **fotografia de equipa** (`equipa.jpg`)

Seis das 52 são cartões de marca em marrom, sem produto — servem de separador
visual, não de montra.

---

## 1. Decisão de arquitectura, e porque NÃO é Astro

O cliente disse que os meus sites são sempre do mesmo estilo. Tem razão, e a
tentação era responder trocando de ferramenta — Astro, que é o que hoje se
usaria para um catálogo.

Não é o que vou fazer, e a razão é a durabilidade. Este site vai ser publicado
por uma Action e editado por quem não programa. Uma dependência de npm que
rebente dentro de dezoito meses deixa a cliente sem conseguir publicar, e ela
não tem como diagnosticar isso. O gerador sem dependências que uso constrói em
menos de um segundo e não tem cadeia de fornecimento para partir.

**O que estava «básico» era o desenho, não o gerador.** É aí que entra o que há
de novo na plataforma, e nada disto precisa de framework:

- **View Transitions entre páginas** (`@view-transition`) — a fotografia do
  produto continua-se de uma página para a outra, sem JavaScript
- **animações conduzidas pelo scroll** (`animation-timeline: view()`) — nativas.
  ATENÇÃO: num filho de `column-count` colapsam as colunas todas numa só; já me
  aconteceu noutro projecto
- **`::scroll-marker` e `::scroll-button`** — carrossel sem uma linha de JS, como
  melhoria progressiva onde o browser souber
- **Popover API** para o menu e para a lightbox, em vez de JS a gerir estado
- **container queries** para os cartões se adaptarem ao seu espaço e não ao ecrã
- **`text-wrap: balance`** nos títulos
- **`:has()`** para estado sem classes penduradas pelo JS

O ponto é: modernidade onde ela se vê e degrada bem, não modernidade na caixa de
ferramentas.

---

## PLANO A — Fundações

- **A1** Criar o repositório `AMMA_Creative` no GitHub, público (o Pages exige
  público no plano gratuito).
- **A2** Estrutura: `scripts/gerar.mjs`, `data/`, `conteudo/`, `assets/`,
  `.github/workflows/publicar.yml`.
- **A3** Pipeline de imagens em Python/Pillow: variantes 480/960/1600 em WebP,
  cartão de partilha 1200×630 em JPEG por produto (o WhatsApp não mostra WebP).
- **A4** Tratar as 52 fotografias: recortar o que interessa, atribuir a
  categorias, escrever `data/produtos/*.json`. As seis de marca ficam de fora da
  montra.
- **A5** Logótipo: extrair o lettering do JPEG para SVG utilizável sobre creme
  **e** sobre marrom. O ficheiro que temos é um JPEG de fundo cheio — não serve
  para uma navbar.

## PLANO B — Sistema visual

- **B1** Fichas de cor e tipografia. Serifa de exibição para títulos + sem-serifa
  para texto, auto-alojadas (sem Google Fonts: é um pedido a terceiros e o site
  vai declarar-se sem pedidos externos).
- **B2** Navbar com o logótipo grande que encolhe no scroll e volta a crescer no
  topo. Sem salto de layout — a altura reservada é sempre a maior.
- **B3** Menu que ocupa o ecrã todo no telemóvel.
- **B4** A camada nova: view transitions, scroll-driven, container queries,
  popover. Cada uma com o seu recuo escrito.

## PLANO C — Páginas

- **C1** Início: hero editorial de sangria completa, os cartões das categorias,
  montra, «+60€ oferta de portes», prova (equipa/Instagram). *Eram seis
  categorias quando isto se escreveu; a estrutura mexeu duas vezes em Agosto de
  2026 e ficaram cinco — «Bodies» à frente, porque é o que a loja mais faz. Os
  cartões levam ao catálogo filtrado, não a uma página própria.*
- **C2** Catálogo com filtro por categoria e por ocasião (gravidez, baptizado,
  casamento, dia da mãe/pai).
- **C3** Ficha de produto: galeria, o que é personalizável, prazo, como encomendar.
- **C4** Sobre nós, com a fotografia de equipa.
- **C5** Contactos com mapa do Google **atrás de consentimento** (art. 5.º da Lei
  41/2004 — o embed instala cookies antes de qualquer interacção).
- **C6** Como encomendar: não há carrinho, o pedido é por Instagram/telefone.
  Isto tem de ser explícito, senão o site parece uma loja que não vende.

## PLANO D — Legal (UE + ASAE)

- **D1** Identificação: DL 7/2004 obriga nome, sede, NIF e contactos em sítio de
  acesso fácil e permanente. **NIF fica placeholder** até o cliente o dar.
- **D2** Livro de Reclamações electrónico, obrigatório, junto aos outros links
  legais como pedido.
- **D3** Resolução alternativa de litígios — verificar qual é a entidade
  competente para Viana do Castelo, não copiar de outro projecto.
- **D4** Privacidade e cookies. Sem carrinho e sem analítica, o site é cookieless
  fora do mapa — o aviso só aparece por causa do mapa, e tem de o dizer.
- **D5** Preços: se aparecerem, DL 138/90 obriga a preço final com impostos.
- **D6** Personalizados: DL 24/2014 art. 17.º — **não há direito de livre
  resolução** em bens feitos por medida. Isto protege a cliente e tem de estar
  escrito.
- **D7** Acessibilidade: o EAA (DL 82/2022) não obriga uma microempresa sem venda
  em linha, mas o WCAG AA vai ser cumprido de qualquer maneira.

## PLANO E — SEO

- **E1** ~~Uma página por categoria com texto próprio~~ — **REVOGADO em Agosto de
  2026, a pedido da cliente.** As páginas de categoria foram removidas: quem
  escolhe uma categoria vai para `/catalogo/?categoria=<slug>`, que abre o
  catálogo já filtrado. O raciocínio de E1 continua a ser verdade em SEO — o
  site perdeu quatro páginas indexáveis com título próprio, e a variante com
  parâmetro auto-canoniza para `/catalogo/`, portanto não a substitui. Foi uma
  troca consciente: a cliente achava que a página de categoria repetia o
  catálogo sem os filtros. Quem procura «body personalizado padrinhos» chega
  agora pela ficha do artigo, que continua a existir.
- **E2** `LocalBusiness` + `Product` + `BreadcrumbList` em JSON-LD.
- **E3** Sitemap, robots, canónicos, og por produto.
- **E4** Nomes de ficheiro e `alt` descritivos: as 52 fotografias vêm com nomes
  do Instagram que não dizem nada.

## PLANO F — Backoffice

- **F1** `.pages.yml` simples: **Artigos** e **Dados da loja**. *A entrada
  **Categorias** saiu em Agosto de 2026, a pedido; as categorias passaram a ser
  tratadas por nós em `data/categorias.json`.*
- **F2** Ajuda em cada campo, escrita para quem não é técnico.
- **F3** Só o que ela precisa de mexer. Nada de campos técnicos à vista.

## PLANO G — Verificação

- **G1** Telemóvel (375, 390, 430), tablet, computador (1280, 1920).
- **G2** Contrastes calculados, não estimados.
- **G3** Teclado e leitor de ecrã no menu, filtros e galeria.
- **G4** Todas as imagens referenciadas existem; nenhuma partida.
- **G5** Publicar e verificar em produção.

---

## Pendências do cliente

- **NIF** — placeholder até ele dar
- Confirmar a **denominação social** e a forma jurídica (ENI ou Lda), que muda o
  que é obrigatório no rodapé
- Confirmar se **`+60€ portes grátis`** é sobre Portugal continental só
- Preços: entram no site ou é tudo «sob consulta»?
