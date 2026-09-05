# Assets — PRANCHA

Sprites de produção com fundo recortado (alpha). Texto de UI **não** vai na arte.

Prévia com xadrez: abra `catalog.html` no navegador.

## Pastas

| Pasta | Uso |
|---|---|
| `sprites/materials/` | Barras esticáveis (madeira, aço, concreto, cabo, apoio, junta) |
| `sprites/vehicles/` | Van, caminhão, ônibus, bitrem (perfil direito) |
| `sprites/structures/` | Encontros E/D, pilar, escoramento |
| `sprites/ui/` | Ícones 256² da toolbox (sem letra) |
| `sprites/fx/` | Splash, poeira, 16 detritos |
| `env/plains/` | Céu, far, água, plate da obra 01 |
| `env/canyon/` | Parallax + plate de gameplay (obra 05+) |
| `raw/` | JPG originais (magenta de estúdio, não usar no runtime) |

## Regras

- Runtime usa os PNG em `sprites/` e `env/`.
- Overlay de tensão (verde/amarelo/vermelho) é tint no motor, não um sprite por cor.
- Painéis, carimbos e cotas são DOM/Canvas de texto.
- Fonte da verdade de custos: `../data/materials.json` e `../01-gdd/economia-e-niveis.xlsx`.

Reprocessar: `python tools/process_assets.py`
