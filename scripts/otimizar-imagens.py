#!/usr/bin/env python3
"""
Prepara as fotografias para a web.

Porque existe: as fotografias vêm das redes sociais com 1440 a 4096 px de lado e
até 2 MB cada. Servidas assim, uma página de catálogo com 24 produtos são dezenas
de MB, e no telemóvel isso é imperdoável.

O que faz: por cada fotografia gera três larguras em WebP (480/960/1600) para o
`srcset`, mais um cartão de partilha 1200x630 em JPEG por produto — o WhatsApp e
o Facebook não mostram WebP nas pré-visualizações de link, e é por WhatsApp que
esta cliente vai partilhar.

As fotografias grandes nunca chegam ao visitante: o gerador serve só as variantes.

Correr:  python3 scripts/otimizar-imagens.py
         python3 scripts/otimizar-imagens.py --varrer   (o que a Action usa)
"""
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit('Falta o Pillow:  pip3 install Pillow')

RAIZ = Path(__file__).resolve().parent.parent
PRODUTOS = RAIZ / 'assets' / 'produtos'
IMG = RAIZ / 'assets' / 'img'

LARGURAS = [480, 960, 1600]
QUALIDADE = 78
EXTENSOES = {'.jpg', '.jpeg', '.png', '.webp'}
SUFIXOS = tuple(f'-{w}' for w in LARGURAS)

# 1200x630 é a proporção que o WhatsApp e o Facebook usam na pré-visualização
# grande. A fotografia é cortada ao centro para lá caber.
OG_TAM = (1200, 630)


def carregar(caminho: Path) -> Image.Image:
    im = Image.open(caminho)
    # Sem isto, fotografias tiradas na vertical aparecem deitadas: a rotação vive
    # nos metadados e o Pillow não a aplica sozinho.
    im = ImageOps.exif_transpose(im)
    return im.convert('RGB')


def variantes(im: Image.Image, base: Path) -> int:
    feitas = 0
    for w in LARGURAS:
        saida = base.with_name(f'{base.stem}-{w}.webp')
        if saida.exists():
            continue
        escala = im.copy()
        # Não ampliar: uma fotografia de 700 px não ganha nada a ser gravada em
        # 1600, e ficaria maior em bytes do que o original.
        if im.width > w:
            escala.thumbnail((w, w * 10), Image.LANCZOS)
        escala.save(saida, 'WEBP', quality=QUALIDADE, method=6)
        feitas += 1
    return feitas


def cartao_partilha(im: Image.Image, pasta: Path):
    saida = pasta / 'og.jpg'
    c = ImageOps.fit(im.convert('RGB'), OG_TAM, Image.LANCZOS, centering=(0.5, 0.5))
    c.save(saida, 'JPEG', quality=82, optimize=True)


def varrer():
    novas = existentes = cartoes = 0
    for pasta in [PRODUTOS, IMG]:
        if not pasta.exists():
            continue
        for f in sorted(pasta.rglob('*')):
            if not f.is_file() or f.suffix.lower() not in EXTENSOES:
                continue
            if f.stem.endswith(SUFIXOS) or f.stem == 'og':
                continue                      # já é variante, ou é o cartão
            if f.suffix.lower() == '.png' and f.stem.startswith('logo'):
                continue                      # o logótipo é servido tal e qual
            falta = [w for w in LARGURAS if not f.with_name(f'{f.stem}-{w}.webp').exists()]
            if not falta:
                existentes += 1
                continue
            try:
                im = carregar(f)
            except Exception as e:
                print(f'  !! {f.name}: {e}')
                continue
            n = variantes(im, f.with_suffix('.webp'))
            novas += 1
            print(f'  + {f.relative_to(RAIZ)}  ({im.width}x{im.height}, {n} variantes)')

    # UM CARTÃO DE PARTILHA POR ARTIGO, feito da fotografia de CAPA — a primeira da
    # lista do artigo, que é a que o site mostra primeiro.
    #
    # Isto lia-se do disco, e estava errado por duas razões que só apareceram quando
    # a cliente criou o primeiro artigo pelo backoffice:
    #
    #   1. Percorria as PASTAS e apanhava a primeira fotografia por ordem
    #      ALFABÉTICA. A ordem das fotografias de um artigo é escolhida por ela e
    #      não é alfabética — no «Box de presente» é 01, 04, 05, 03… — portanto o
    #      cartão podia ser uma fotografia qualquer, e reordenar a galeria não o
    #      mudava. O comentário antigo prometia o contrário.
    #   2. As fotografias que ela carrega pelo backoffice caem na RAIZ de
    #      assets/produtos/, não numa subpasta. O gerador aponta o og:image para
    #      assets/produtos/<slug>/og.jpg, que nunca era escrito — ou seja, TODOS os
    #      artigos criados por ela ficavam sem imagem de partilha no WhatsApp, que
    #      para esta loja é o canal principal.
    #
    # A capa só a ficha do artigo a conhece. Por isso lê-se dos dados.
    import json
    for ficheiro in sorted((RAIZ / 'data' / 'produtos').glob('*.json')):
        artigo = json.loads(ficheiro.read_text(encoding='utf-8'))
        if artigo.get('publicado') is False:
            continue
        capa = (artigo.get('fotos') or [None])[0]
        if not capa:
            continue
        origem = RAIZ / capa
        variante = origem.with_name(f'{origem.stem}-1600.webp')
        if not variante.exists():
            print(f'  !! {ficheiro.stem}: a capa {capa} não tem variantes')
            continue
        destino = PRODUTOS / ficheiro.stem
        destino.mkdir(parents=True, exist_ok=True)
        try:
            cartao_partilha(Image.open(variante), destino)
            cartoes += 1
        except Exception as e:
            print(f'  !! cartão de {ficheiro.stem}: {e}')

    print(f'\nvariantes novas: {novas} · já existentes: {existentes} · '
          f'cartões de partilha: {cartoes}')


if __name__ == '__main__':
    varrer()
