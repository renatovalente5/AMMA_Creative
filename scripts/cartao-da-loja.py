#!/usr/bin/env python3
"""
O cartão de partilha da loja (assets/img/og.jpg): o que aparece no Google, no
WhatsApp e no Facebook quando se partilha ammacreative.pt.

Porque existe: o cartão antigo era um fundo cacau só com texto, com «Artigos
personalizados» duas vezes e a legenda «Viana do Castelo» (a morada mudou). O
Renato pediu o SEO todo, «inclusive a imagem que aparece no Google» (23 out
2026). Este mostra o que a loja vende: o logótipo verdadeiro (logo-creme.png,
extraído do original — nunca redesenhado) numa faixa cacau, e três fotografias
de artigos reais por baixo, de categorias diferentes e sem caras de pessoas.

Correr à mão quando se quiser outras fotografias: python3 scripts/cartao-da-loja.py
(precisa do Pillow). As fotografias escolhem-se em FOTOS, abaixo.
"""
from pathlib import Path
from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
FOTOS = [
    'assets/produtos/body-convite-madrinha/01.jpg',   # bodies
    'assets/produtos/colar-nome-gravado/01.jpg',      # aço
    'assets/produtos/tshirt-pai/16.jpg',              # têxtil
]
LARGURA, ALTURA = 1200, 630
FAIXA = 150                     # a faixa cacau do logótipo, em cima
CACAU = (0x60, 0x26, 0x01)      # --cacau do estilo.css, medido no logótipo
FIO = 6                         # o fio creme entre as fotografias
CREME = (0xFA, 0xF1, 0xE8)


def main():
    cartao = Image.new('RGB', (LARGURA, ALTURA), CREME)
    cartao.paste(Image.new('RGB', (LARGURA, FAIXA), CACAU), (0, 0))

    logo = Image.open(RAIZ / 'assets/img/logo-creme.png').convert('RGBA')
    alto = 86
    logo = logo.resize((round(logo.width * alto / logo.height), alto), Image.LANCZOS)
    cartao.paste(logo, ((LARGURA - logo.width) // 2, (FAIXA - alto) // 2), logo)

    n = len(FOTOS)
    largura = (LARGURA - FIO * (n - 1)) // n
    for i, caminho in enumerate(FOTOS):
        foto = ImageOps.exif_transpose(Image.open(RAIZ / caminho)).convert('RGB')
        foto = ImageOps.fit(foto, (largura, ALTURA - FAIXA), Image.LANCZOS, centering=(0.5, 0.5))
        cartao.paste(foto, (i * (largura + FIO), FAIXA))

    saida = RAIZ / 'assets/img/og.jpg'
    cartao.save(saida, 'JPEG', quality=85, optimize=True, progressive=True)
    print(f'{saida.relative_to(RAIZ)}: {LARGURA}x{ALTURA}, {saida.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
