# Fire Walker

Um personagem pixelado animado **sem nenhum quadro desenhado à mão**, cuja silhueta alimenta o [fogo do DOOM](../doom-fire). Canvas 2D puro, sem dependências.

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
npx serve .        # ou: python3 -m http.server
```

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

## Controles

| Tecla | Ação |
|---|---|
| `←` `→` / `A` `D` | Andar |
| `Shift` | Correr |
| `↑` / `W` / `Espaço` | Pular |
| `↓` / `S` | Agachar |
| `E` | Dissolver e teleportar |
| `K` | Mostrar o esqueleto |

No celular aparecem botões na tela, e a câmera dá zoom e segue o personagem. O **piloto automático** anda, corre, pula e se teleporta sozinho até você usar um controle.
