# Fire Walker

Escolha entre três heróis pixelados animados **sem nenhum quadro desenhado à mão** (Andarilho, Bruxa ou Paladino) e atravesse um mundo de três telas (cemitério, ruínas, vila queimada e portão) enfrentando carniçais, morcegos, cultistas e brutamontes com magia, até o chefe no fim do portão. Cada inimigo sente o golpe e começa a queimar. A silhueta do herói, a magia, as explosões, os braseiros e os inimigos em chamas são todos fontes de calor do [fogo do DOOM](../doom-fire). Canvas 2D puro, sem dependências.

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
npx serve .        # ou: python3 -m http.server
```

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `audio.js` | Áudio procedural (Web Audio API): efeitos sonoros sintetizados e o sequenciador de música |
| `walker.js` | Núcleo: configuração, paletas, herói (física, pose, desenho do Andarilho), magia, rasterização por id de parte e sombreamento, simulação do fogo |
| `melee.js` | Ataque com espada: combo de 3 golpes, golpe no ar, acerto ao longo da lâmina, rebate de orbes e arco de fogo |
| `defense.js` | Escudo (defesa e defesa perfeita) e rolamento (esquiva com invulnerabilidade) |
| `heroes.js` | Personagens jogáveis: atributos, movimento secundário, desenho da Bruxa e do Paladino, e as magias de cada um |
| `enemies.js` | Tipos de inimigo, ondas, vida, golpes, queima, projéteis e onda de choque |
| `boss.js` | O Guardião do Portão: arena, ataques, fúria, meteoros |
| `world.js` | Câmera, camadas com parallax, áreas do cenário, piso e braseiros |
| `render.js` | Composição da janela da câmera, barras de vida e esqueleto sobreposto |
| `main.js` | Teclado e toque, piloto automático, interface e loop principal |

Os scripts são clássicos (sem módulos) e compartilham o escopo global; a ordem de carga no `index.html` importa.

## Como funciona

### 1. Animação procedural

O personagem é um esqueleto: quadril, joelhos, tornozelos, pescoço, cabeça, ombros, cotovelos e pulsos. A cada quadro:

- **Pernas**: uma fase de caminhada avança com a velocidade. Cada pé alterna entre passo (sobe e vai para a frente) e apoio (fica no chão), defasados em meio ciclo. A fase avança `π · velocidade / passada`, então o pé de apoio nunca escorrega.
- **Joelhos**: IK de dois ossos (lei dos cossenos) leva coxa e canela até o alvo do pé.
- **Tronco**: inclina mais com a velocidade e balança suavemente no ritmo do passo; parado, "respira".
- **Braços**: balançam em oposição à perna do mesmo lado e dobram mais na corrida.
- **No ar** a pose se mistura com pernas encolhidas e braços erguidos; o pouso amassa o corpo por um instante.
- **Detalhes secundários**: dois rabos de cachecol (Verlet), a ponta do capuz presa por uma mola, o olho piscando a cada poucos segundos.

### 2. Do esqueleto aos pixels

Cada parte do corpo é desenhada num grid de 256×144 como uma **id de parte**, de trás para a frente: espada nas costas, cachecol, braço e perna de trás, perna da frente, tronco (mais largo no peito), saia da túnica (a barra segue as coxas), alça da espada, bolsinha, cinto com fivela, nó do cachecol, cabeça (capuz, rosto, máscara, olho, nariz), braço da frente e ombreira. Os membros são cápsulas afinadas, mais grossas na coxa que na canela.

Depois, um passe de **sombreamento** escolhe um de 4 tons por pixel, a partir de uma luz vinda da lua (canto superior direito):

| Regra | Tom |
|---|---|
| Encostado numa parte que está na frente | sombra (sombra de contato) |
| Borda virada para a luz (cima/direita) | luz |
| Borda do lado oposto (baixo/esquerda) | sombra |
| Miolo | base |
| Partes de trás do corpo | um tom mais escuro |

Por fim, um contorno de 1 px, a sombra no chão (que diminui no pulo) e o brilho do fogo nas bordas do personagem. Na resolução baixa a matemática some e parece pixel art desenhada. Desligue **Sombreado** para comparar com as cores chapadas.

Ligue **Esqueleto** (`K`) para ver os ossos, as juntas e o alvo de IK de cada pé por cima dos pixels.

### 3. Fogo alimentado pela silhueta

É o mesmo algoritmo de `doom-fire/`, mas a fonte de calor deixa de ser a linha de baixo e passa a ser o próprio personagem:

| Efeito | Fonte de calor |
|---|---|
| **Aura** | Todo pixel do personagem vale 36 (branco) a cada passo do fogo |
| **Rastro** | O personagem só aquece quando corre ou pula, proporcional à velocidade; o fogo fica para trás |
| **Dissolver** (`E`) | Uma linha de corte varre o sprite de cima para baixo e queima; ele reaparece em outro ponto, de baixo para cima |
| Pouso | Um pulo forte solta faíscas do chão |

Com o personagem em movimento, o vento do fogo aponta para trás dele. A paleta de 37 cores troca entre fogo, energia, veneno e sombra; o fogo é somado ao fundo.

### 4. Magia

Segure `F` (ou o botão **Magia**) para carregar e solte para lançar. Tudo que brilha é o mesmo algoritmo de fogo:

| Fase | O que acontece |
|---|---|
| **Carregar** | Ele firma as pernas e junta as mãos na frente do peito. Um orbe cresce na mão (até 1 s de carga) e faíscas são sugadas para ele. O orbe é fonte de calor, então solta chamas que crescem com a carga |
| **Soltar** | O braço vai para a frente, a perna da frente dá um passo e o corpo sofre um recuo. O projétil sai mais rápido e maior conforme a carga |
| **Voo** | O projétil queima uma linha contínua por onde passa, e esse rastro sobe como fogo |
| **Impacto** | Explosão (um disco e depois um anel de calor), brasas com gravidade que quicam no chão e um tremor de tela |
| **Boneco de treino** | Tomba numa mola em volta da base e pega fogo por alguns segundos (os pixels dele viram fonte de calor) |

O núcleo do orbe, do projétil e das brasas é desenhado por cima de tudo, com a cor da paleta. O brilho em volta é o próprio fogo. Trocando a paleta, a magia vira fogo, energia, veneno ou sombra.

### 5. Inimigos que sentem e queimam

Carniçais entram pelas bordas, mancando e corcundas, com braços compridos esticados para a frente. São animados pelo mesmo sistema do herói (fase de caminhada, IK de dois ossos, ângulos de braço suavizados), só que com outras proporções e outro jeito de andar. Quando chegam perto, erguem as garras e golpeiam. O herói sente o golpe também: flash branco, corpo jogado para trás e um empurrão no ar.

Quando um carniçal é atingido:

| Momento | O que acontece |
|---|---|
| **Impacto** | O jogo congela por alguns quadros (*hit-stop*), o corpo dele pisca branco, o tronco e a cabeça são jogados para trás, os braços se abrem e ele é empurrado. Golpes carregados chegam a levantá-lo do chão |
| **Queimando** | Os pixels do corpo dele viram fonte de calor do fogo. Ele entra em pânico, agitando os braços sobre a cabeça e correndo sem rumo, e solta brasas. O corpo vai escurecendo, com brasas piscando nas rachaduras |
| **Contágio** | Um carniçal em chamas incendeia quem encostar nele; com o efeito **Aura**, encostar no herói também |
| **Morte** | Cai de joelhos e queima de cima para baixo: a linha de corte é fonte de calor. Sobra um montinho de cinzas no chão, que some aos poucos |

O dano vem do golpe direto, dos respingos da explosão e da queima contínua. Um tiro carregado ao máximo quase sempre mata; dois tiros rápidos também. Em **Inimigos** dá para escolher Poucos, Muitos ou Desligados (aí volta o boneco de treino). O piloto automático mantém distância, carrega mais a magia quanto mais longe está o alvo e se teleporta quando fica encurralado.

### 6. Cenário

O mundo tem 768 px de largura (três telas) e a câmera segue o herói, olhando um pouco à frente de onde ele está virado. Três camadas andam em velocidades diferentes:

| Camada | Velocidade | Conteúdo |
|---|---|---|
| Longe | ×0,25 | Céu com dithering, estrelas, lua, duas cordilheiras e um castelo com janelas acesas |
| Meio | ×0,6 | Colinas com árvores secas e túmulos distantes |
| Perto | ×1 | As áreas, o piso e os braseiros |

As áreas são **Cemitério** (cerca de ferro, árvore seca, cripta, lápides, chão de terra com grama), **Ruínas** (pilares rachados, coluna caída, arco), **Vila** (casas queimadas, barris, carroça, calçamento) e **Portão** (muralha com ameias, torre, grade levadiça, estandartes). Os objetos de perto são desenhados como ids de forma e sombreados pela mesma regra de luz dos personagens. Os **braseiros** são fontes permanentes do fogo e incendeiam inimigos que passam por eles.

### 7. Vida

- **Herói**: barra no canto da tela com um coração. Ao levar dano, a barra cai na hora e um rastro claro vai diminuindo atrás dela. Abaixo de 30% o coração e a barra piscam. Depois de 4 s sem levar dano, a vida se regenera devagar. Se zerar, aparece "Derrotado", ele queima de cima para baixo e renasce no mesmo lugar com a vida cheia e 2 s de invulnerabilidade, piscando.
- **Inimigos**: uma barrinha sobre a cabeça, com o mesmo rastro claro. Aparece quando levam dano e some depois de 2,5 s. Pisca laranja enquanto eles queimam.

### 8. Tipos de inimigo

| Inimigo | Vida | Comportamento | Como enfrentar |
|---|---|---|---|
| **Carniçal** | 100 | Corcunda e mancando; se aproxima e golpeia com as garras | Manter distância e lançar |
| **Morcego** | 30 | Voa fora de alcance e mergulha no peito do herói. Ao queimar, voa em pânico e cai rodopiando | Lançar quando ele mergulha, ou pular e lançar no ar |
| **Cultista** | 70 | Manto e olhos roxos; mantém distância e lança orbes sombrios | Agachar (`↓`) ou pular para desviar; a magia do herói destrói o orbe no ar |
| **Brutamontes** | 320 | Grande e lento; recua pouco, não para o ataque com golpes fracos, não entra em pânico ao queimar. Esmaga o chão e solta uma onda de choque de fogo para os dois lados | Pular a onda de choque; tiros carregados |

Os tipos vão sendo liberados em **ondas**: a cada 6 inimigos queimados, a onda sobe (carniçais na 1, morcegos a partir da 2, cultistas da 3, brutamontes da 4), aparecem mais inimigos ao mesmo tempo e o intervalo entre eles diminui. O piloto automático desvia dos orbes agachando, pula as ondas de choque, pula para acertar morcegos e carrega mais a magia contra brutamontes.

### 9. Personagens

Os três usam o mesmo esqueleto, IK, poses de magia e física. Mudam a aparência (partes próprias e movimento secundário), os atributos e a magia:

| Personagem | Vida | Movimento | Visual | Magia |
|---|---|---|---|---|
| **Andarilho** | 100 | normal | Capuz com ponta, máscara e dois rabos de cachecol, espada nas costas | **Bola de fogo** carregável |
| **Bruxa** | 80 | mais rápida e pula mais alto | Chapéu de bruxa com a ponta em mola, cabelo comprido com física, vestido, meias, varinha e um frasco no cinto | **Fogos-fátuos**: de 1 a 3 projéteis em leque (conforme a carga) que perseguem o inimigo mais próximo; bons contra morcegos |
| **Paladino** | 150 | mais lento | Armadura completa, elmo com viseira e pluma, capa com física, tabardo com cruz, escudo nas costas e maça no cinto | **Onda de chamas**: uma parede de fogo corre pelo chão e acerta todos os inimigos no caminho (não alcança morcegos no alto) |

Troque em **Personagem** ou com as teclas `1`, `2` e `3`. A troca também muda para a paleta do personagem.

### 10. O Guardião do Portão

Ao chegar ao fim do portão, a câmera trava na arena, o caminho de volta fecha e os inimigos comuns param de surgir. O Guardião é um cavaleiro gigante (~60 px) de elmo com chifres, visor brilhante, capa e espada enorme, montado com o mesmo pipeline de esqueleto, sombreamento e queima.

| Ataque | Como desviar |
|---|---|
| **Golpe de espada**: preparação acima da cabeça e um corte que deixa um arco de fogo | Pular ou manter distância |
| **Pisão**: os dois punhos no chão e uma onda de choque de fogo para os dois lados | Pular a onda |
| **Chuva de meteoros**: espada erguida; marcas brilham no chão e os meteoros caem nelas | Sair de cima das marcas |

Com metade da vida ele entra em **fúria**: a espada pega fogo e ele anda e ataca mais rápido. Ele sente cada golpe (flash e brasas), mas só **cambaleia** com tiros carregados, e depois de um cambaleio fica 4 s sem cambalear de novo. Ao morrer, cai de joelhos e queima devagar até virar cinza, com "Vitória!". Se você voltar depois de 40 s, ele aparece de novo. A barra de vida dele, com o nome, fica embaixo da tela.

### 11. Som e música

Não há nenhum arquivo de som: tudo é sintetizado na hora com a Web Audio API, a partir de osciladores e ruído filtrado, com um eco (reverb) gerado e um compressor na saída. O navegador só libera o áudio depois de um clique ou de uma tecla, por isso aparece o botão **Ativar som**.

**Música**: um pequeno sequenciador que compõe enquanto toca, agendando as notas um pouco à frente do tempo.

| Momento | Música |
|---|---|
| Exploração (70 BPM) | Acordes longos em ré menor (Rém, Si♭, Fá, Dó) com sintetizadores levemente desafinados, baixo nos tempos 1 e 3, batida grave de coração e notas de sino aleatórias da pentatônica, com eco |
| Arena do chefe (132 BPM) | Bumbo, caixa e chimbal, baixo pulsante em colcheias, acordes curtos e um coro de senoides com vibrato, numa progressão com Lá maior para criar tensão |
| Fúria (146 BPM) | Mais rápida, com chimbal em semicolcheias |
| Vitória | Fanfarra em ré maior; depois volta a música de exploração |

Quando o herói cai, a música é abafada por um filtro por alguns segundos.

**Efeitos**: cada um é posicionado no estéreo conforme onde acontece e fica mais baixo fora da tela.

| Grupo | Sons |
|---|---|
| Herói | Passos a cada pisada, pulo, aterrissagem, golpe recebido (voz diferente para cada personagem; o Paladino tem o tilintar da armadura), queda, renascer, dissolver e materializar |
| Magias | Zumbido de carga que sobe de tom com a carga; bola de fogo, fogos-fátuos (um sino por projétil) e onda de chamas; explosões proporcionais à força |
| Inimigos | Cada tipo tem voz própria ao sentir o golpe e ao morrer (rosnado do carniçal, guincho do morcego, coro dissonante do cultista, urro do brutamontes), o som de pegar fogo, o orbe do cultista e o pisão do brutamontes |
| Fogo | Um crepitar contínuo que fica mais intenso com a quantidade de inimigos queimando, os braseiros próximos e a aura |
| Chefe | Gongo e rugido na entrada, corte da espada, pisão, assobio dos meteoros, rugido da fúria, estrondo longo na morte |
| Ondas | Um gongo a cada onda nova |

Em **Som** liga e desliga tudo; **Música** e **Efeitos** ajustam os volumes.

### 12. Espada

Aperte `J` (ou `X`, ou o botão **Espada**) para atacar corpo a corpo. Apertar de novo durante um golpe já guarda o próximo, até três:

| Golpe | Preparação (cotovelo dobrado) | Golpe (braço estende) | Efeito |
|---|---|---|---|
| 1 | No primeiro golpe, a mão sobe até o cabo e **saca** a espada; ela fica armada atrás da cabeça | Passa por cima e desce na diagonal para a frente | 22 de dano, empurra pouco para manter o alvo ao alcance |
| 2 | Punho recolhido junto ao quadril, lâmina baixa | Sobe para a frente | 22 de dano |
| 3 | Cotovelo bem para trás, lâmina na altura do peito | **Estocada** com avanço do corpo | 38 de dano, faz o alvo cambalear (inclusive o Guardião) e o deixa em chamas |
| No ar | Lâmina armada sobre a cabeça | Corte descendente | 28 de dano e fogo |

Cada golpe tem preparação (0,12 s, mais 0,12 s de saque quando a espada está guardada), golpe (0,12 s) e recuperação (0,2 s), escalados pela velocidade da lâmina. A preparação dobra o cotovelo sempre no sentido natural (antebraço girado para a frente ou para cima em relação ao braço). No golpe, o **cotovelo conduz**: o braço se move rápido no começo, enquanto o antebraço vem atrasado e **chicoteia** no fim, até o braço ficar estendido no impacto. Essas poses se misturam à pose procedural, e o tronco inclina e as pernas se firmam. Durante o golpe, o antebraço, a mão e a lâmina, além do arco que a ponta percorreu desde o quadro anterior, são testados contra os inimigos, o boneco e os orbes do cultista. A espada **rebate os orbes** se o golpe chegar a tempo. Cada acerto tem congelamento, faíscas e tremor, e o inimigo sente o golpe como com a magia. A ponta deixa um **arco de fogo** do mesmo algoritmo, com um traço brilhante por cima.

Cada personagem tem sua lâmina:

| Personagem | Lâmina | Alcance | Velocidade | Dano |
|---|---|---|---|---|
| Andarilho | Saca a espada das costas (o cabo some da bainha) | 11 px | normal | ×1 |
| Bruxa | Adaga mágica luminosa | 8 px | mais rápida | ×0,75 |
| Paladino | Espada longa | 14 px | mais lenta | ×1,35 |

A espada fica na mão por um instante depois do último golpe. Golpe e magia não se misturam: um espera o outro terminar. O piloto automático usa a espada contra carniçais, cultistas e morcegos que chegam perto, e a magia contra os grandes.

### 13. Escudo e rolamento

**Escudo**: segure `L` (ou o botão **Escudo**). O braço de trás ergue o escudo na frente do corpo, as pernas se firmam e o herói anda devagar, sempre virado para a ameaça.

| Situação | Resultado |
|---|---|
| Golpe pela frente com o escudo erguido | **Defesa**: passa só uma lasca do dano (Andarilho 15%, Bruxa 25%, Paladino 5%; o dobro contra o Guardião), o herói é empurrado para trás, com faíscas, som e tremor |
| Escudo erguido até 0,18 s antes do golpe | **Defesa perfeita**: dano zero, anel de luz, quem atacou cambaleia (o Guardião também, respeitando o intervalo de 4 s entre cambaleios) |
| Orbe do cultista no escudo | É absorvido; na defesa perfeita, volta como bola de fogo |
| Golpe pelas costas, onda de choque, pisão ou meteoro | O escudo não protege: pule ou role |

Cada personagem tem o seu: o **Andarilho** usa um broquel redondo de madeira com aro e cravo de ferro, o **Paladino** tira das costas o escudo com cruz, e a **Bruxa** ergue uma barreira de luz (um arco brilhante na camada de efeitos que também aquece o fogo em volta, na cor da paleta dela). O escudo não se usa junto com magia ou espada.

**Rolamento**: aperte `C` (ou o botão **Rolar**), para a direção apertada ou para a frente. O herói se encolhe numa bola e gira 360° rolando uns 50 px em 0,42 s, desacelerando no fim. Ele fica **invulnerável desde o início até 0,32 s**, então atravessa golpes, inimigos, orbes, ondas de choque e meteoros. Depois há 0,25 s até poder rolar de novo.

O giro reaproveita o esqueleto: uma pose encolhida (joelhos no peito, braços abraçando as pernas, queixo para baixo) é montada com as mesmas juntas e rotacionada em volta do centro do corpo. Ela se mistura com a pose normal na entrada e na saída do rolamento, e o cachecol e o capuz seguem pela física.

O piloto automático também se defende:
- levanta o escudo no momento certo contra golpes de frente, inclusive o do Guardião, e faz defesa perfeita;
- não começa magia nem golpe quando um inimigo próximo está preparando um ataque;
- usa o escudo contra orbes;
- rola através das ondas de choque e para fora das marcas de meteoro;
- rola por cima do inimigo quando fica encurralado.

## Controles

| Tecla | Ação |
|---|---|
| `←` `→` / `A` `D` | Andar |
| `Shift` | Correr |
| `↑` / `W` / `Espaço` | Pular |
| `↓` / `S` | Agachar (desvia dos orbes do cultista) |
| `L` (segurar) | Escudo (levantar logo antes do golpe = defesa perfeita) |
| `C` | Rolamento |
| `J` / `X` | Espada (aperte de novo durante o golpe para o combo) |
| `F` / `Q` (segurar) | Carregar e lançar a magia |
| `E` | Dissolver e teleportar |
| `1` `2` `3` | Andarilho, Bruxa, Paladino |
| `K` | Mostrar o esqueleto |

No celular aparecem botões na tela, e a câmera dá zoom e segue o personagem. O **piloto automático** luta sozinho (ou anda e treina no boneco quando os inimigos estão desligados) até você usar um controle.
