# Mesa Brasileira

Jogo 2D de futebol de botão para computador e celular, com campo visto de cima e os 20 clubes do Brasileirão Série A 2026. Feito em JavaScript e Canvas 2D, sem dependências de jogo em tempo de execução.

## Jogar

```sh
npm install
npm run dev
```

Abra o endereço indicado pelo servidor. Para jogar no celular, conecte-o à mesma rede do computador e abra o endereço `Network` exibido no terminal. O servidor aceita conexões da rede local; o firewall do computador precisa permitir a porta escolhida.

Selecione os clubes, escolha entre computador e dois jogadores locais e clique em **Entrar em campo**. Arraste um botão do seu time para trás e solte. A seta indica a direção e a barra indica a força. O mandante ataca para a direita; o visitante para a esquerda. Tela cheia ajuda a aproveitar o espaço no celular, especialmente na horizontal.

Com o campo em foco, Tab troca de jogador; setas esquerda/direita ajustam a direção; setas cima/baixo ajustam a força; Espaço chuta; P pausa; Esc cancela a mira. Ao chegar ao último jogador, Tab permite sair do campo.

## Regras da casa

- Sete botões por equipe, incluindo goleiro. Física com colisões entre botões, bola, bordas e traves.
- Até três toques por posse. Errar a bola ou acertar um adversário primeiro passa a vez.
- Limite de 25 segundos por jogada; tempo esgotado passa a vez.
- Partidas de 2, 3 ou 5 minutos. O último chute é concluído antes do apito final.
- O relógio para em pausas, regras abertas, comemorações e quando a página fica oculta.
- As bordas devolvem a bola. São regras de uma versão arcade, não uma simulação de regulamento federativo.
- Três níveis de computador, com avaliação de trajetórias usando a mesma física da partida.
- Dois jogadores dividem o mesmo aparelho, alternando turnos. Sem modo online.

## Verificação e distribuição

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Os testes cobrem colisões, traves, gols, desaceleração, IA, seleção de clubes, mouse, toque, pausa, reinício, persistência de preferências e encerramento de partida. A versão de produção está em `dist/` e pode ser servida por um servidor HTTP estático. Escudos, fontes e sons não dependem de serviços externos durante a partida; os sons são sintetizados após ativação pelo usuário.

## Fontes e créditos

- Participantes: [CBF — Série A 2026](https://www.cbf.com.br/futebol-brasileiro/times/campeonato-brasileiro/serie-a/2026).
- Dados e escudos: [ESPN, equipes da Série A](https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/teams?limit=30). Escudos locais em `public/crests/`; referências de origem em `teams-source.json`.
- Fontes: Barlow Condensed e DM Sans, sob SIL Open Font License. Licenças incluídas em `public/fonts/`.
- Marcas e símbolos pertencem aos respectivos clubes. Projeto independente, sem vínculo oficial com clubes, CBF ou ESPN.

Arquivos principais: `src/main.js` controla interface, turnos e renderização; `src/physics.js` contém física e IA; `src/style.css` define o layout responsivo.
