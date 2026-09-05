# 8 prompts de UI — PRANCHA

Direção comum a todas as telas (cole no início de cada prompt se o modelo “esquecer” o estilo):

```
Estética de engenharia civil / prancheta viva.
Fundo azul-planta #0B1F3A a #12355B, malha milimetrada branca 8% opacidade.
Tipografia técnica estilo DIN / desenhista.
Carimbo de projeto (CREA, escala, revisão, data) em pelo menos um canto.
Botões como carimbos ou legendas de desenho técnico.
Sem mascote, sem neon gamer, sem glassmorphism genérico de SaaS.
Idioma: português do Brasil.
Formato 16:9, UI nítida e legível.
Paleta: navy #0B1F3A, ciano #7EC8E3, papel #E8EEF2, alerta #E6B84A, falha #D1495B, ok #3DDC97, aço #8A9AA8, concreto #C4BBB2, madeira #B08968.
```

---

## Tela 1 — Menu principal
Arquivo de referência gerado: `03-concept-art/01-menu-principal.jpg`

```
Tela de menu principal do jogo PRANCHA, 16:9, blueprint navy com grid.
Título grande "PRANCHA" em letra estêncil técnica, tagline "O VÃO NÃO PERDOA".
À direita, desenho isométrico/linha de uma ponte estaiada em branco sobre azul.
Menu central em caixa de legenda técnica:
+ NOVA OBRA
📁 CONTINUAR PROJETO
🧊 SANDBOX
🖼 GALERIA AS-BUILT
⚙ OPÇÕES
Canto: carimbo CREA-SC, REV 00, ESCALA 1:200, rosa-dos-ventos, barra de escala.
```

## Tela 2 — Caderno de obras (seleção de campanha)
Arquivo: `03-concept-art/02-caderno-de-obras.jpg`

```
Tela de seleção de campanha "PRANCHA — CADERNO DE OBRAS", 16:9.
Mapa técnico do Sul do Brasil em linha branca sobre navy (SC em destaque).
Seis pinos de bioma: Planície, Canyon, Estuário, Serra, Mangue, Urbano.
Pino selecionado "SERRA CATARINENSE" com ícone de vento.
Painel direito lista 4 níveis do bioma com estrelas (0–3).
Escala 1:2.500.000, norte, carimbo CREA-SC, barra de conclusão do bioma.
```

## Tela 3 — Briefing / memorial descritivo
Arquivo: `03-concept-art/03-briefing-memorial.jpg`

```
Tela de briefing no formato de memorial descritivo de obra, 16:9, blueprint.
Título "MEMORIAL DESCRITIVO — OBRA 12 HERCÍLIO LUZ".
Esquerda: elevação técnica da ponte pênsil com cotas de vão e gabarito 18,00 m.
Direita: restrições em cards técnicos — GABARITO 18 m, VENTO 90 km/h, ORÇAMENTO R$ 2.400.000, CARGA TREM TURÍSTICO.
Dois botões-carimbo: INICIAR PROJETO e DEVOLVER EDITAL.
Notas NBR 6123 / NBR 7188 como flavor (não precisa estar correta ao detalhe).
```

## Tela 4 — Gameplay, modo construir
Arquivo: `03-concept-art/04-gameplay-construir.jpg`

```
Screenshot de gameplay 2.5D vista lateral, MODO CONSTRUIR, 16:9.
Dois encontros de concreto sobre canyon com rio. Ponte incompleta: treliça de aço à esquerda, escoramento de madeira à direita, nós de snap visíveis.
HUD topo: nome do nível, orçamento R$, vão em metros.
Toolbox esquerda: concreto, aço estrutural (selecionado), cabo de aço, madeira, apoio elastomérico.
Cotas 28,00 m. Dicas curtas no canto. Botão inferior "CONCLUIR VÃO".
Física pausada. Grid blueprint atrás do cenário.
```

## Tela 5 — Ensaio de carga
Arquivo: `03-concept-art/05-ensaio-de-carga.jpg`

```
Screenshot de simulação ENSAIO EM ANDAMENTO, 16:9.
Bitrem 45 t atravessando ponte mista. Barras com overlay de tensão: verde nas extremidades, amarelo, vermelho no meio do vão.
Painel esquerdo: fator de segurança 1.18 (abaixo do mínimo 1.50), carga 45 t, flecha 22,7 mm.
Painel direito: legenda de cores + gráfico esforço x posição (pico no L/2).
Barra inferior: PAUSAR, REINICIAR, TESTAR CARGA, RELATÓRIO.
Carimbo CREA no canto. Clima técnico de laboratório de estruturas.
```

## Tela 6 — Colapso estrutural
Arquivo: `03-concept-art/06-colapso-estrutural.jpg`

```
Tela de falha "COLAPSO ESTRUTURAL", 16:9.
Ponte partida no meio do vão, tabuleiro rachado, caminhão caindo no rio, membros em vermelho.
Carimbo vermelho enorme no topo com fator de segurança 0.41.
Bloco "DIAGNÓSTICO DE FALHA": tração excessiva na diagonal, flambagem no montante, fissura no tabuleiro — cada um com valor.
Botões: REVER SIMULAÇÃO, TESTAR REFORÇO, RELATÓRIO DETALHADO.
Legenda de modos de falha (tração, compressão, cisalhamento, fissura, elemento crítico).
Dramático, mas lido como laudo, não como cartoon de explosão.
```

## Tela 7 — Relatório de ensaio
Arquivo: `03-concept-art/07-relatorio-ensaio.jpg`

```
Tela de resultado "RELATÓRIO DE ENSAIO DE CARGA — APROVADO COM RESSALVAS", 16:9, blueprint.
3 estrelas: duas preenchidas, uma vazia.
Tabela custos vs orçamento (materiais, mão de obra, equipamentos) com variação %.
Mini elevação da ponte construída.
Quadro de resultados: tensão máx OK, flecha L/800 OK, FS 1,62 OK*, ressalva de custo.
Carimbos APROVADO e ART.
Botões REVISAR PROJETO e PRÓXIMA OBRA.
```

## Tela 8 — Sandbox / editor de terreno
Arquivo: `03-concept-art/08-sandbox-editor.jpg`

```
Editor sandbox 16:9, vista 3/4 de um canyon com rio.
Ferramentas esquerda: elevar terreno, rebaixar, nível d'água, adicionar encontro, região de vento, envelope de navegação.
Gizmo azul do gabarito náutico no vão, região verde de vento no platô.
Painel direito "PARÂMETROS DO VÃO": comprimento, altura mín. do tabuleiro, vel. básica do vento, direção.
Mini mapa, coordenadas UTM, grade 5,0 m, abas TERRENO / VÃO / PONTE / ANÁLISE.
UI de software técnico de engenharia, não de city-builder casual.
```

---

## Checklist de consistência visual
- [ ] Mesmo navy em todas as telas
- [ ] Grid sempre visível, nunca protagonizando
- [ ] Um carimbo por tela, no máximo dois
- [ ] Números com unidade (m, t, R$, km/h, MPa)
- [ ] Botão primário = carimbo / placa de obra
- [ ] Overlay de tensão só no ensaio e no colapso
- [ ] Sem barras de XP, gems ou daily reward
