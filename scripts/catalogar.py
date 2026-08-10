#!/usr/bin/env python3
"""
Constrói o catálogo a partir das fotografias das redes sociais da AMMA Creative.

Porque existe: a matéria-prima são 52 fotografias com nomes do Instagram
(`631033342_17950784532080307_….jpg`) que não dizem nada — nem a quem trabalha no
site, nem ao Google, nem a um leitor de ecrã. Este script vê-as atribuídas a
produtos e categorias, copia-as para `assets/produtos/<slug>/` com nomes que se
leem, e escreve um JSON por produto em `data/produtos/`.

A ATRIBUIÇÃO FOI FEITA A OLHO, uma a uma. Está escrita em CATALOGO, em baixo, com
o número de índice de cada fotografia. Não há aqui adivinhação por nome de
ficheiro nem por ordem: o que está escrito é o que se vê em cada imagem.

As categorias não foram inventadas. São as seis que a própria empresa lista no
cartão «Bem-vindos» que publica no Instagram (fotografia 04).

Correr:  python3 scripts/catalogar.py            (mostra o que faria)
         python3 scripts/catalogar.py --gravar   (copia e escreve)
"""
import glob
import json
import os
import shutil
import sys
import unicodedata
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / '_fonte' / 'instagram'
DESTINO = RAIZ / 'assets' / 'produtos'
DADOS = RAIZ / 'data' / 'produtos'
GRAVAR = '--gravar' in sys.argv

# As fotografias por índice, na ordem alfabética do nome de ficheiro.
FOTOS = sorted(f for f in glob.glob(str(FONTE / '*.jpg')) if os.path.getsize(f) > 20000)

# Cartões de marca em marrom, sem produto nenhum: servem de separador no
# Instagram e não têm nada que fazer numa montra.
SEM_PRODUTO = {1, 2, 18, 19, 24, 34, 35}
# A fotografia 39 é um anúncio a um equipamento de futebol COM PREÇO impresso na
# imagem. O site é todo sob consulta, e uma imagem que diz «apenas 19,99€» ficava
# a contradizê-lo — e um preço numa imagem não se actualiza. Fica de fora.
SEM_PRODUTO.add(39)
# A 04 é o cartão «Bem-vindos». Não é produto, mas é bom material para o Sobre.
CARTAO_CATEGORIAS = 4
# A 22 é uma impressão de ecografia em estilo polaroid.

CATALOGO = [
    # ---------------------------------------------------------- convites de padrinhos
    dict(slug='body-convite-madrinha', nome='Body «aceitas ser a minha madrinha?»',
         categoria='bodies-convites', ocasioes=['baptizado', 'convite-padrinhos'],
         fotos=[7, 8],
         resumo='O convite que ninguém recusa. Um body com o pedido escrito, para '
                'dar em mão à futura madrinha.',
         texto='É o nosso pedido mais pedido. Escolhemos juntas a frase — «um bebé '
               'especial precisa da madrinha mais especial de todas» é a preferida '
               'de quem já cá passou — e nós fazemos o resto.\n\n'
               'Vai num body de algodão, no tamanho que quiser, e pode seguir com '
               'os sapatinhos e a caixa se preferir entregar tudo junto.',
         personalizavel=['A frase do pedido', 'O nome de quem convida',
                         'O tamanho do body', 'A cor do lettering']),

    dict(slug='body-convite-padrinho', nome='Body «aceitas ser o meu padrinho?»',
         categoria='bodies-convites', ocasioes=['baptizado', 'convite-padrinhos'],
         fotos=[44],
         resumo='O mesmo pedido, para o padrinho — ou para o tio que já sabe que '
                'vai ser escolhido.',
         texto='«Tio, aceitas ser meu padrinho?» — escrito num body, entregue sem '
               'aviso. Funciona sempre.\n\n'
               'A frase é sua: mudamos o parentesco, o nome, e o tratamento por tu '
               'ou por você.',
         personalizavel=['A frase do pedido', 'O parentesco (tio, avô, primo…)',
                         'O nome de quem convida', 'O tamanho do body']),

    dict(slug='body-convite-avos', nome='Body «avô e avó, preparem o colinho»',
         categoria='bodies-convites', ocasioes=['anuncio-gravidez', 'convite-padrinhos'],
         fotos=[11],
         resumo='Para contar aos avós que vem alguém a caminho.',
         texto='Com as pegadinhas em vermelho e a frase que faz sempre chorar '
               'alguém. É dos que mais saem por aqui, e não é por acaso: dá-se '
               'numa mão e diz tudo sem se falar.',
         personalizavel=['A frase', 'Os nomes dos avós', 'A cor das pegadinhas',
                         'O tamanho do body']),

    # ---------------------------------------------------------- anúncio de gravidez
    dict(slug='body-anuncio-gravidez', nome='Body de anúncio de gravidez',
         categoria='bodies-convites', ocasioes=['anuncio-gravidez'],
         fotos=[13, 17, 12],
         resumo='«Baby loading 2026». Para anunciar sem ter de encontrar as '
                'palavras.',
         texto='O ano é o seu, a frase também. Fazemos «baby loading», «a vossa '
               'melhor prenda está a chegar», ou aquela que lhe apetecer — se '
               'trouxer a ideia, nós compomos.\n\n'
               'É o artigo com que muita gente nos conhece: fotografa-se bem, e o '
               'anúncio fica feito numa imagem.',
         personalizavel=['A frase e o ano', 'O tipo de letra',
                         'A cor do lettering', 'O tamanho do body']),

    dict(slug='body-irmao-mais-velho', nome='Body «big brother»',
         categoria='bodies-convites', ocasioes=['anuncio-gravidez'],
         fotos=[10],
         resumo='Para o irmão mais velho dar a notícia — e ficar com o crédito.',
         texto='«Big Brother 2026», com a barra a carregar. Fazemos também para '
               'irmã, e em português se preferir.\n\n'
               'Vem no tamanho do mais velho, não do que está a caminho — é ele '
               'que o vai vestir no dia do anúncio.',
         personalizavel=['«Brother» ou «Sister», ou em português',
                         'O ano', 'O tamanho', 'A cor']),

    dict(slug='body-hello-daddy', nome='Body «hello daddy»',
         categoria='bodies-convites', ocasioes=['anuncio-gravidez', 'dia-do-pai'],
         fotos=[16, 3, 14],
         resumo='Para contar ao pai. Costuma ser o mais difícil de filmar sem '
                'estragar a surpresa.',
         texto='Escrito à mão, em letra corrida, num body pequeno. Há quem o '
               'embrulhe, há quem o deixe em cima da cama.\n\n'
               'Fazemos também «hello mummy», «hello grandpa», e as versões em '
               'português.',
         personalizavel=['A frase', 'O tipo de letra', 'O tamanho do body']),

    dict(slug='body-primeira-pascoa', nome='Body «a minha primeira Páscoa»',
         categoria='bodies-convites', ocasioes=['pascoa'],
         fotos=[32],
         resumo='Com orelhas de coelho e o nome. Para a primeira de todas.',
         texto='As primeiras vezes são uma só, e ficam em fotografia. Este leva as '
               'orelhas desenhadas e o nome do bebé por baixo.\n\n'
               'Fazemos o mesmo para o primeiro Natal e para o primeiro '
               'aniversário.',
         personalizavel=['O nome do bebé', 'A ocasião (Páscoa, Natal, aniversário)',
                         'A cor do desenho', 'O tamanho']),

    # ---------------------------------------------------------- boxes
    dict(slug='box-anuncio-gravidez', nome='Box de anúncio de gravidez',
         categoria='boxes', ocasioes=['anuncio-gravidez'],
         fotos=[9, 21],
         resumo='Caixa de madeira com sapatinhos, carta e o anúncio lá dentro. '
                'Abre-se uma vez e não se esquece.',
         texto='É a nossa forma preferida de dar a notícia. A caixa é de madeira, '
               'vai com os sapatinhos, e a carta é escrita por nós com o que nos '
               'contar — «agora somos 3», o nome se já souberem, a data prevista.\n\n'
               'Quem recebe abre e percebe. Não é preciso dizer nada.',
         personalizavel=['O texto da carta', 'A cor dos sapatinhos',
                         'A gravação na tampa', 'O que vai dentro']),

    dict(slug='box-convite-padrinhos', nome='Box de convite a padrinhos',
         categoria='boxes', ocasioes=['baptizado', 'convite-padrinhos'],
         fotos=[26, 27, 28],
         resumo='O pedido em caixa: carta, lembrança e o nome de quem convida.',
         texto='«Temos um pedido muito especial para ti…» — e depois a carta, que '
               'escrevemos com as suas palavras ou com as nossas, se preferir que '
               'ajudemos.\n\n'
               'Há quem leve só a carta, há quem junte o body, o porta-chaves ou '
               'uma peça em aço gravada. Diga-nos o que quer lá dentro.',
         personalizavel=['O texto da carta', 'Madrinha ou padrinho',
                         'O que vai dentro da caixa', 'A cor da caixa e do papel']),

    dict(slug='box-presente-padrinho', nome='Box de presente para padrinho',
         categoria='boxes', ocasioes=['baptizado', 'convite-padrinhos', 'dia-do-pai'],
         fotos=[29, 30, 31],
         resumo='Garrafa personalizada, abre-cápsulas gravado e caixa a condizer.',
         texto='«O melhor padrinho do mundo» — escrito no rótulo da garrafa, que '
               'fazemos com o nome dele. Vai com o abre-cápsulas gravado e o resto '
               'assente em palha, na caixa.\n\n'
               'É o presente que se dá no dia do baptizado, ou no dia em que se '
               'faz o pedido.',
         personalizavel=['O rótulo da garrafa', 'A gravação no abre-cápsulas',
                         'O nome', 'O que vai na caixa']),

    dict(slug='box-noivo', nome='Box para o noivo',
         categoria='boxes', ocasioes=['casamento'],
         fotos=[38, 37],
         resumo='T-shirt, garrafa e caixa. Para a despedida ou para a manhã do '
                'casamento.',
         texto='«Eu sou o noivo, os demais que se emborrachem» — é a que mais nos '
               'pedem, e não somos nós que a escolhemos.\n\n'
               'Fazemos o conjunto para o noivo e as t-shirts para o grupo, a '
               'condizer.',
         personalizavel=['A frase da t-shirt', 'Os tamanhos do grupo',
                         'O rótulo da garrafa', 'As cores']),

    dict(slug='ecografia-polaroid', nome='Ecografia em polaroid',
         categoria='boxes', ocasioes=['anuncio-gravidez'],
         fotos=[22],
         resumo='A primeira fotografia dele, impressa como se tivesse saído de '
                'uma polaroid.',
         texto='Manda-nos a ecografia e nós tratamos: limpamos, imprimimos em '
               'papel fotográfico e escrevemos por baixo o que quiser — «chego em '
               '2026», «estou a caminho», o nome.\n\n'
               'Vai bem sozinha num envelope, e vai melhor dentro da box de '
               'anúncio.',
         personalizavel=['A frase por baixo', 'Quantas impressões',
                         'Com ou sem moldura']),

    # ---------------------------------------------------------- aço inoxidável
    dict(slug='colar-nome-gravado', nome='Colar com nome gravado',
         categoria='aco', ocasioes=['dia-da-mae', 'baptizado', 'presente'],
         fotos=[15],
         resumo='Aço inoxidável com o nome gravado. Um por filho, para usar todos '
                'juntos.',
         texto='Gravamos o nome em letra corrida, na chapa de aço. Quem tem dois '
               'filhos leva dois; quem tem três leva três, e usa-os na mesma '
               'corrente.\n\n'
               'Aço inoxidável: não escurece, não dá alergia e vai ao banho.',
         personalizavel=['O nome ou os nomes', 'O tipo de letra',
                         'O comprimento da corrente', 'Prateado ou dourado']),

    dict(slug='colar-inicial', nome='Colar de inicial',
         categoria='aco', ocasioes=['dia-da-mae', 'presente'],
         fotos=[41, 42, 45, 43],
         resumo='A inicial em madrepérola, com um coração ao lado se quiser.',
         texto='Discreto, para usar todos os dias. A inicial vem em madrepérola '
               'sobre aço dourado, e há quem junte o coração — ou o segundo, para '
               'o outro filho.\n\n'
               'É o que mais sai no Dia da Mãe, e o que mais nos pedem para '
               'embrulhar.',
         personalizavel=['A inicial', 'Com ou sem coração',
                         'Dourado ou prateado', 'O comprimento']),

    dict(slug='pulseira-gravada', nome='Pulseira gravada',
         categoria='aco', ocasioes=['presente', 'casamento'],
         fotos=[20, 40],
         resumo='Chapa em aço, gravada com nome, data ou coordenadas.',
         texto='Há cinco modelos de fecho e de contas, e gravamos o que quiser na '
               'chapa: um nome, uma data, umas coordenadas, uma frase curta.\n\n'
               'Fazemos em par, para dar uma e ficar com a outra.',
         personalizavel=['A gravação', 'O modelo da pulseira',
                         'O tamanho do pulso', 'Prateado ou dourado']),

    dict(slug='conjunto-aco', nome='Conjunto em aço',
         categoria='aco', ocasioes=['presente', 'dia-da-mae'],
         fotos=[51],
         resumo='Colar, pendentes e brincos a combinar, para dar de uma vez.',
         texto='Quando não se sabe o que escolher, escolhe-se o conjunto. '
               'Montamos com os pendentes que quiser — inicial, coração, '
               'pegadinha, árvore da vida — e vai numa caixa pronta a dar.',
         personalizavel=['Os pendentes', 'As gravações', 'A cor do metal',
                         'A caixa']),

    # ---------------------------------------------------------- têxtil
    dict(slug='sweat-mae', nome='Sweat de mãe personalizada',
         categoria='textil', ocasioes=['dia-da-mae', 'presente'],
         fotos=[5],
         resumo='«MOM» com a fotografia dos filhos dentro das letras.',
         texto='A fotografia entra dentro do lettering — é isso que faz esta peça. '
               'Manda-nos as fotografias e nós compomos, com o ano por baixo se '
               'quiser.\n\n'
               'Também fazemos «MÃE», e com o nome dos filhos em vez da '
               'fotografia.',
         personalizavel=['As fotografias', 'O texto e o ano',
                         'A cor da sweat', 'O tamanho']),

    dict(slug='tshirt-pai', nome='T-shirt de pai personalizada',
         categoria='textil', ocasioes=['dia-do-pai', 'presente'],
         fotos=[6],
         resumo='«PAPA» com as fotografias dentro das letras, e o ano por baixo.',
         texto='A mesma ideia da sweat de mãe, para ele. Fica bem em escuro, que é '
               'o que costumam escolher.\n\n'
               'Fazemos «PAI», «PAPÁ» e «AVÔ», com o número de fotografias que as '
               'letras aguentarem.',
         personalizavel=['As fotografias', 'O texto e o ano',
                         'A cor da t-shirt', 'O tamanho']),

    dict(slug='tshirt-super-padrinho', nome='T-shirt «super padrinho»',
         categoria='textil', ocasioes=['baptizado', 'convite-padrinhos', 'presente'],
         fotos=[47],
         resumo='O emblema de super-herói, com o nome dele.',
         texto='Para dar no dia do pedido ou vestir no dia do baptizado. O emblema '
               'é desenhado por nós e leva o nome dentro.\n\n'
               'Há a versão «super madrinha», e a de padrinho e madrinha a '
               'condizer.',
         personalizavel=['O nome no emblema', 'Padrinho ou madrinha',
                         'A cor da t-shirt', 'O tamanho']),

    dict(slug='tshirts-despedida', nome='T-shirts de despedida de solteira',
         categoria='textil', ocasioes=['casamento'],
         fotos=[33, 36],
         resumo='«Bride» para ela, «Team Bride» para o grupo.',
         texto='Fazemos o grupo todo de uma vez: a dela numa cor, as delas noutra, '
               'com os nomes atrás se quiserem.\n\n'
               'Diga-nos quantas e os tamanhos — e se quiserem a coroa, que é o '
               'detalhe que mais nos pedem.',
         personalizavel=['As frases', 'Os nomes de cada uma',
                         'As cores', 'Os tamanhos do grupo']),

    dict(slug='sweat-casal', nome='Sweat de casal ilustrada',
         categoria='textil', ocasioes=['presente', 'casamento'],
         fotos=[25, 23],
         resumo='Um desenho vosso, bordado no peito, com a data por baixo.',
         texto='Manda-nos uma fotografia e transformamo-la em desenho de linha, '
               'pequeno, no peito. Com os nomes e a data por baixo.\n\n'
               'É o presente de aniversário de namoro que mais fazemos.',
         personalizavel=['A fotografia a desenhar', 'Os nomes e a data',
                         'A cor da sweat', 'Os tamanhos']),

    dict(slug='bolsa-monograma', nome='Bolsa com monograma',
         categoria='textil', ocasioes=['presente', 'dia-da-mae'],
         fotos=[46],
         resumo='Lona crua com a inicial grande e o nome por cima, em dourado.',
         texto='A inicial vai grande, em escuro, e o nome atravessa-a em dourado. '
               'Fica bem como estojo, como necessaire, ou dentro de um presente '
               'maior.\n\n'
               'Fazemos com a florzinha ao canto ou sem ela.',
         personalizavel=['A inicial e o nome', 'As cores do vinil',
                         'Com ou sem ornamento', 'O tamanho da bolsa']),

    dict(slug='saco-pano-personalizado', nome='Saco de pano personalizado',
         categoria='textil', ocasioes=['presente', 'lembrancas'],
         fotos=[48, 50],
         resumo='Para lembranças, para a escola, ou para levar o presente lá '
                'dentro.',
         texto='Fazemos um ou fazemos quarenta. Para lembrança de festa, com o '
                'nome de cada convidado; para a creche, com o nome do bebé; ou '
                'para embrulhar o que nos comprar.\n\n'
               'Em lona crua, com o desenho e o nome que escolher.',
         personalizavel=['O nome ou nomes', 'O desenho',
                         'A quantidade', 'O tamanho do saco']),

    # ---------------------------------------------------------- lembranças
    dict(slug='porta-chaves-foto', nome='Porta-chaves com fotografia',
         categoria='lembrancas', ocasioes=['presente', 'lembrancas', 'dia-da-mae'],
         fotos=[49],
         resumo='Acrílico com a fotografia e um coração com o parentesco escrito.',
         texto='«Avó» escrito à mão dentro do coração, e a fotografia ao lado. É '
               'pequeno, anda no bolso, e é dos presentes que mais nos agradecem.\n\n'
               'Fazemos para avó, avô, madrinha, padrinho, mãe, pai — e com a '
               'fotografia que nos mandar.',
         personalizavel=['A fotografia', 'A palavra no coração',
                         'A cor do coração', 'A quantidade']),
]


def slugificar(s):
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def main():
    usadas = set()
    for p in CATALOGO:
        usadas.update(p['fotos'])

    todas = set(range(1, len(FOTOS) + 1))
    sobra = todas - usadas - SEM_PRODUTO - {CARTAO_CATEGORIAS}
    print(f'{len(FOTOS)} fotografias · {len(CATALOGO)} produtos')
    print(f'  em produtos: {len(usadas)}')
    print(f'  cartões de marca (fora da montra): {len(SEM_PRODUTO)}')
    print(f'  cartão de categorias: 1')
    if sobra:
        print(f'  !! por atribuir: {sorted(sobra)}')
    print()

    cats = {}
    for p in CATALOGO:
        cats.setdefault(p['categoria'], []).append(p['slug'])
    for c, ps in sorted(cats.items()):
        print(f'  {c:<18} {len(ps)} produtos')

    if not GRAVAR:
        print('\n(simulação — corre com --gravar para escrever)')
        return

    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)
    for f in DADOS.glob('*.json'):
        f.unlink()

    print()
    for i, p in enumerate(CATALOGO, 1):
        pasta = DESTINO / p['slug']
        pasta.mkdir(parents=True, exist_ok=True)
        caminhos = []
        for n, idx in enumerate(p['fotos'], 1):
            origem = FOTOS[idx - 1]
            nome = f'{n:02d}.jpg'
            shutil.copy2(origem, pasta / nome)
            caminhos.append(f'assets/produtos/{p["slug"]}/{nome}')
        d = dict(p)
        d['fotos'] = caminhos
        d['ordem'] = i * 10
        d['publicado'] = True
        d['destaque'] = i <= 6
        (DADOS / f'{p["slug"]}.json').write_text(
            json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'  {p["slug"]:<28} {len(caminhos)} foto(s)')

    print(f'\n{len(CATALOGO)} produtos escritos')


if __name__ == '__main__':
    main()
