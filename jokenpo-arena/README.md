# Arena Jokenpô

Simulação de Pedra, Papel e Tesoura numa arena circular, em Canvas 2D puro, sem dependências. Você dá um palpite, as paredes se abrem e cada peça persegue a sua presa até sobrar um só tipo.

## Como rodar

Abra `index.html` no navegador, ou sirva a pasta:

```bash
npx serve .        # ou: python3 -m http.server
```

## Regras

- **Pedra** quebra tesoura, **tesoura** corta papel, **papel** embrulha pedra.
- Cada peça acelera em direção à presa mais próxima e foge do predador mais próximo (raio de fuga de 160 unidades).
- Quando um predador encosta na presa, a presa muda para o time do predador.
- A rodada termina quando só resta um tipo na arena.

## Palcos

| Palco | Início |
|---|---|
| **Pizza** | Três fatias separadas por paredes. Contagem de 3 s, depois as paredes se recolhem do centro para a borda em 1,6 s |
| **Livre** | Três grupos sem paredes, largada após a contagem |
| **Pilar Central** | Como o Livre, com um pilar no meio que bloqueia a passagem |

## Como funciona

A simulação roda em passo fixo de 1/60 s. As velocidades 2× e 4× fazem 2 ou 4 passos por quadro. Cada passo tem quatro etapas:

1. **Direção:** cada peça soma um vetor para a presa, um vetor de fuga do predador (mais forte quanto mais perto) e um pequeno desvio aleatório. A peça acelera nessa direção até a velocidade máxima.
2. **Colisão:** os pares que se sobrepõem são separados. Se forem de tipos diferentes, o predador converte a presa.
3. **Limites:** a borda do círculo, as paredes (segmentos) e o pilar empurram as peças de volta.
4. **Fim:** os tipos são recontados para detectar o vencedor.

Três ajustes evitam que a simulação trave ou acabe cedo demais:

- **Recarga de conversão (0,3 s):** uma peça recém-convertida não converte ninguém por um instante. Sem isso, a conversão se espalha em cadeia por um grupo compacto num único passo.
- **Morte súbita:** depois de 40 s de luta, a fuga perde força aos poucos (até 15%). Assim os ciclos de perseguição não ficam girando para sempre.
- **Bônus sem predador:** um tipo que ficou sem predador anda 20% mais rápido, para alcançar a última presa.

Os sprites (pedra facetada, folha pautada, tesoura) são desenhados por código em canvases fora da tela, no tamanho em pixels do aparelho.

## Controles

| Controle | Efeito |
|---|---|
| Seu palpite | Escolhe quem vai vencer. Acertos e sequência ficam salvos no `localStorage` |
| Palco | Pizza, Livre ou Pilar Central |
| Peças por time | De 10 a 80 |
| Velocidade | 1×, 2× ou 4× |
| Toque/clique na arena | Antes da rodada: começa. Durante: dá um empurrão nas peças próximas |
| `Enter` / `Espaço` com a arena em foco | Começa ou reinicia |
| Som | Liga os bipes de conversão e a fanfarra de vitória |
