# Hipotético

Corrida lateral em Three.js. O piloto de terno vai montado no tiranossauro pelo deserto e atira um raio roxo. Quem está de camisa vermelha some, veste verde e amarelo e passa a andar junto.

```bash
npm install
npm run dev
```

Abre em [http://127.0.0.1:5180](http://127.0.0.1:5180).

O piloto é um modelo 3D gerado a partir de `jogador.jpg`. O céu, as dunas, a areia e as duas camisas são imagens geradas. O som (tiro, transformação, rugido, fala e percussão) fica em `public/audio`. Para gerar de novo, com as chaves só no `.env` local:

```bash
npm run assets
```

O jogo no navegador não recebe essas chaves. Ele só lê os arquivos de `public/`.

## Controles

- `A` `D` ou setas — mover
- `Z`, `W` ou espaço — pular
- `X`, `J` ou clique — atirar
- seta para cima, ou o mouse acima do piloto — mirar para cima
- `V` — rugido do dinossauro, converte quem está perto
- `Esc` — pausa
- `M` — som

São oito pessoas de camisa vermelha. Quando as oito entram no time, a missão acaba.
