# DOOM Fire

Reprodução do efeito de fogo da tela de título do DOOM de PlayStation / Nintendo 64, em Canvas 2D puro, sem dependências.

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
npx serve .        # ou: python3 -m http.server
```

## Como funciona

O fogo é só um grid de inteiros de `0` a `36`. Cada valor é um índice numa paleta de **37 cores**, do preto ao branco, passando por vermelho, laranja e amarelo.

1. A linha de baixo é a fonte de calor: todos os pixels valem `36` (branco).
2. A cada frame, cada pixel copia o valor do pixel **de baixo**:
   - subtrai `0` ou `1` aleatoriamente (o fogo esfria enquanto sobe);
   - desloca o resultado para o lado em uma quantidade aleatória (o vento).
3. O grid é desenhado mapeando cada número para a sua cor da paleta.

```js
function spreadFire(src) {
  const pixel = firePixels[src];
  if (pixel === 0) { firePixels[src - W] = 0; return; }
  const rand = Math.round(Math.random() * 3) & 3;
  const dst = src - rand + 1;
  firePixels[dst - W] = pixel - (rand & 1);
}
```

Para apagar o fogo, basta zerar a linha de baixo: as chamas morrem sozinhas ao subir.

## Controles

| Controle | Efeito |
|---|---|
| Modo **Números** (`D`) | Mostra o grid com o número de cada célula, em baixa resolução, para ver o algoritmo acontecendo |
| Vento / Direção | Intensidade e direção do deslocamento lateral (`0` = chamas retas) |
| Decaimento | Quanto calor se perde por linha: quanto maior, mais baixas as chamas |
| `Espaço` | Acende ou apaga a fonte de calor |
| `P` / `N` | Pausa / avança um passo |
| Clique ou arraste no chão | Adiciona calor naquela coluna |

## Referência

- Fabien Sanglard, *How DOOM fire was done*: https://fabiensanglard.net/doom_fire_psx/
