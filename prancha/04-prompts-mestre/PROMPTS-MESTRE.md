# Prompts-mestre — PRANCHA

Copie o bloco inteiro. Não resuma na hora de colar.

---

## 1. Prompt mestre — GDD + conceito

```
Você é lead designer + diretor de arte de um jogo de puzzle de física.

Crie o conceito completo de um jogo chamado "PRANCHA": construtor de pontes 2.5D em vista lateral, com física crível e identidade visual de engenharia civil — não cartoon, não Poly Bridge colorido genérico.

VISÃO
O jogador é um engenheiro responsável por vencer vãos com orçamento, materiais reais e restrições de obra. Cada nível é um problema de projeto: terreno, carga, vento, gabarito náutico, solo, prazo. O prazer vem de projetar, testar, ver a estrutura "falar" (cores de tensão) e otimizar.

ESTILO VISUAL (obrigatório)
- Linguagem de prancheta / desenho técnico vivo: fundo azul-planta (#0B1F3A a #12355B), malha milimetrada branca/ciano 8% opacidade, cotas, carimbo de projeto no canto (CREA, escala, data, revisão).
- Mundo 2.5D: jogabilidade no plano 2D, modelos 3D simples com sombreamento flat/técnico.
- Materiais reconhecíveis: concreto aparente, perfis I/U e treliça, cabos de aço (só tração), madeira de escoramento, apoios elastoméricos, encontros e fundações.
- Overlay de esforço: verde (ok) → amarelo (atenção) → vermelho (ruptura). Compressão e tração com hachura diferente.
- UI tipo mesa de engenheiro. Tipografia técnica (DIN / desenhista). Sem Comic Sans, sem UI gamer neon.
- Referências de forma: Maillart, treliça metálica, estaiada, viga contínua, pênsil. Set-piece inspirado na Ponte Hercílio Luz (Florianópolis).

FÍSICA E MATERIAIS
- Madeira: barata, boa à compressão leve, ruim à tração longa.
- Aço: caro, alta resistência, peso médio.
- Concreto: ótimo à compressão, ruim à tração sem armadura, pesado.
- Cabo: só tração, excelente custo/vão em suspensão e estaiada.
- Apoio: rotação livre vs encontro engastado muda o comportamento.
- Orçamento limita metros de cada material.

LOOP
1. Briefing da obra.
2. Modo projeto (física pausada): nós, snap em grade, apagar, espelhar.
3. Teste de carga: veículos + vento/enchente/sismo conforme o nível.
4. Relatório: passou / colapsou / estourou orçamento / fator de segurança baixo.
5. Estrelas: 1 atravessou · 2 dentro do orçamento · 3 FS ≥ alvo ou menor uso de material.

CAMPANHA
24 níveis em 6 biomas: planície, canyon, estuário com maré, serra com vento, solo mole/mangue, urbano com gabarito.
Cada nível ensina UMA restrição nova (gabarito, carga móvel, vento, solo, etapa de obra, patrimônio).

TOM
Respeito pela engenharia + humor seco de canteiro ("a natureza não assina ART").
Evitar explosões cartoonescas, mascotes, física de brinquedo sem leitura estrutural.

ENTREGUE
Pitch, 5 pilares, loop, 12–24 níveis nomeados, direção de arte com hex, diferencial vs Poly Bridge / Bridge Constructor, nome + tagline.
```

---

## 2. Prompt — protótipo jogável (código)

```
Implemente um protótipo jogável no navegador (HTML + JS + canvas 2D ou Three.js 2.5D) do jogo PRANCHA.

REQUISITOS MÍNIMOS JOGÁVEIS
- Vista lateral. Dois encontros com vão no meio (rio).
- Modo construir: clicar nó → arrastar até outro nó cria uma barra. Snap em grade.
- 4 materiais: madeira, aço, concreto, cabo (cabo só tração). Custo por metro e cor diferentes.
- Orçamento no HUD. Não permite construir além do saldo.
- Botão TESTAR CARGA: liga gravidade + um caminhão que atravessa da esquerda para a direita.
- Barras mudam de cor conforme esforço (verde/amarelo/vermelho). Se passar do limite, a barra ou o nó quebra.
- Vitória: caminhão chega. Derrota: queda.
- Botão resetar nível.
- Estética blueprint: fundo #0B1F3A, grid ciano, HUD técnico, botões estilo carimbo.

Comece por um único nível tutorial de 18 m. Código limpo, comentado. Use matter.js, Planck ou constraints Verlet. Não pergunte; entregue um index.html funcional.
```

Variante Godot: troque a primeira linha por “Crie um projeto Godot 4 2D com os mesmos requisitos.”

---

## 3. Prompt — arte / Grok Imagine (base)

```
Screenshot de jogo 2.5D de construção de pontes, vista lateral, estética de engenharia civil e prancheta técnica. Fundo azul blueprint com malha milimetrada branca. Ponte mista de concreto aparente, treliça de aço e cabos estaiados sobre canyon com rio. Overlay de tensões estruturais verde-amarelo-vermelho nas barras. HUD de obra: orçamento R$, vão em metros, classe de carga, botão TESTAR CARGA estilo carimbo CREA. Toolbox de materiais (concreto, perfil I, cabo, madeira). Tipografia técnica DIN, cotas, norte, escala. Iluminação clara de escritório de projeto, nítido, profissional, 16:9, não cartoon, não low-poly infantil.
```

Para telas específicas, use os 8 prompts em `02-ui-prompts/PROMPTS-8-TELAS.md`.
