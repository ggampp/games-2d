# 🧱 Brick Territories

Recreação aprimorada da simulação interativa **Brick Territories**, inspirada no projeto original de [Étienne Jacob (@etiennejcb)](https://bleuje.com/js_sketches/brick-territories/).

---

## ✨ Funcionalidades e Aprimoramentos

- 🖌️ **Pincel de Conquista Interativo (Seleção de Cor)**:
  - Barra de seleção de cor para escolher exatamente qual território pintar no grid (`Cor 1`, `Cor 2`, ... ou `🎲 Aleatório`).
  - Suporte a clique pontual ou **arrastar com o mouse/touch** para desenhar caminhos de conquista contínuos.
  - Seleção de tamanho do pincel: **P** (pequeno 3x3), **M** (médio 7x7) e **G** (grande 13x13).
  - Clique direto em qualquer segmento da barra de dominância ou do Top 3 para selecionar aquela cor para o pincel instantaneamente!
- 🎨 **Seleção de Número de Cores / Territórios**: Configure de 2 a 32 territórios/cores concorrentes.
- ⚽ **Bolinhas por Território**: Suporte a múltiplas bolinhas por cor (1 a 8 bolinhas por território), permitindo batalhas caóticas e dinâmicas com dezenas de bolinhas simultâneas.
- ⚡ **Controle de Velocidade em Tempo Real**: Ajuste a velocidade das bolinhas de 0.2x a 5.0x sem reiniciar o jogo.
- 🧱 **Tamanho dos Blocos e das Bolinhas**: Sliders para calibrar o tamanho dos blocos da grade e o raio de colisão das bolinhas.
- 🎲 **Controle de Seed**: Gerador determinístico pseudoaleatório (*mulberry32*) com botão de dado para sortear novos mapas instantaneamente.
- 🌈 **Paletas de Cores Exclusivas**:
  - *Clássico Bleuje* (paleta editorial original de 24+ cores)
  - *Neon Cyberpunk*
  - *Pastel Elegante*
  - *Solar / Fogo*
  - *Oceano & Floresta*
- 📊 **Barra de Dominância em Tempo Real**: Medidor horizontal no topo que calcula e exibe em tempo real a porcentagem de área dominada por cada cor + ranking dos Top 3.
- 🔊 **Efeitos Sonoros Sintetizados (Web Audio API)**: Sons de captura e quique baseados em frequências harmônicas.
- 🌙 **Modo Escuro / Claro**: Alternância de tema com um clique.
- 📸 **Exportação de Screenshot**: Salve a captura em PNG do mapa atual com a seed correspondente.
- 💥 **Interação com o Mouse**: Clique em qualquer parte do grid para detonar uma explosão que conquista blocos adjacentes.

---

## 🚀 Como Executar

Basta abrir o arquivo [`index.html`](file:///d:/claude_projects/dev-games/games-2d/brick-territories/index.html) em qualquer navegador moderno (Chrome, Firefox, Safari, Edge) ou servir localmente via VSCode Live Server / `npx serve`.

### 🎮 Atalhos de Teclado
- <kbd>Espaço</kbd>: Pausar / Continuar simulação
- <kbd>R</kbd>: Reiniciar simulação com os parâmetros atuais
