# A proposta e o modelo de propostas

Registro do que a área definiu em 16/08/2026, a partir de uma proposta real
(`É de Casa` para HAVAN, gerada em 08/08/2026) e do print da seção "Modelo de
propostas" do chatbot atual, que o CHATBOT 2.0 vai substituir.

## O que é o "pré-projeto"

É a **proposta em PDF**. O termo aparece nas regras das ações regionais
("Emitir pré-projeto") e não significa artefato diferente: é o mesmo documento
que o executivo gera hoje.

## Como a proposta é montada

O PDF tem doze páginas, e **apenas uma é gerada pelo sistema**. As demais são
imagens que o consultor do programa sobe na seção "Modelo de propostas", em
seções nomeadas:

| Seção | Conteúdo |
| --- | --- |
| Capa | 1 slide, com o nome do cliente sobreposto |
| Conteúdo | vários slides — formato comercial, dados de audiência, elenco |
| Digital | slides da entrega digital |
| **Valor** | **a página gerada pelo sistema** |
| Observações | observações comerciais, texto jurídico |
| Contracapa | 1 slide |

O consultor monta a ordem dos slides; o sistema injeta a página de valor no
lugar certo e produz o PDF.

## A página de valor, com números reais

Da proposta HAVAN — É de Casa, 08/08/2026, 1 ação na TV e 1 no Digital:

```
CLIENTE     HAVAN - Multi Varejo
CONTEÚDO    No programa É DE CASA, previsto no ar em 08/08/2026
            com 1 ação na TV e 1 ação no Digital.
OBJETIVO    Varejo

Mídia                                    R$ 376.000,00
Digital                                  R$  45.300,00
Globoplay Simulcast - Audiência Agregada R$   6.768,00
Total                                    R$ 428.068,00

Direitos e Conexos                       R$  57.415,20
Direitos e Conexos Digital               R$   6.795,00
Custo de Produção                        R$   8.300,00
Custo de Produção Digital                R$   6.795,00

Proposta gerada por: Diogo Lutz
Proposta criada em 23/07/2026 com validade até 07/08/2026 (30 dias)
Importante: Projeto pré-aprovado, pendente de disponibilidade do
apresentador para marca.
```

### O que esses números confirmam

**A fórmula dos direitos e conexos está correta.** Conferido contra
`src/lib/dominio/direitos-e-conexos.ts`:

- Simulcast: 6.768,00 = **1,8%** de 376.000,00
- Direitos TV: 15% × (376.000,00 + 6.768,00) = **57.415,20** ✓
- Direitos Digital: 15% × 45.300,00 = **6.795,00** ✓

O percentual de simulcast desta proposta (1,8%) é diferente do que está hoje
no cadastro do É de Casa (3%). O percentual é por programa e muda com o tempo;
o que a proposta prova é a **fórmula**, não o parâmetro.

### O que esses números contradizem

**O "Total" da proposta NÃO inclui direitos e conexos nem custo de produção:**

```
Total = mídia TV + mídia digital + simulcast = 428.068,00
```

Direitos e produção aparecem listados **abaixo** do total, como valores à
parte. Isso diverge de `src/lib/dominio/custo-da-acao-regional.ts`, que soma
mídia + direitos + produção num único número.

Os dois números são legítimos e servem a perguntas diferentes — "quanto o
cliente paga de veiculação" e "quanto custa a ação inteira" —, mas a **proposta
usa a definição acima**, e é ela que o cliente recebe. Ajustar antes da
Entrega 4.

## Regras da página de valor

- **Validade de 30 dias** a partir da criação.
- Assinada com o **nome de quem gerou** ("Proposta gerada por").
- Traz um aviso de que o projeto é pré-aprovado e depende de disponibilidade do
  apresentador.

## Duas coisas que o modelo atual revela e o CHATBOT 2.0 ainda não comporta

**1. Datas especiais são outra coisa que datas bloqueadas.** O modelo atual tem
uma seção "Datas especiais" e, dentro do modelo de propostas, um período
nomeado com data inicial, data final e valor — no exemplo, `BLACK FRIDAY,
20/11/2026 a 30/11/2026, valor 20`. É **precificação diferenciada por período**,
não bloqueio. O CHATBOT 2.0 tem apenas datas bloqueadas; a regra de preço por
período ainda não existe em lugar nenhum.

**2. Os valores base moram no modelo, não no programa.** No chatbot atual,
mídia digital, custos de produção e os percentuais de direitos ficam no
*modelo de propostas*; no CHATBOT 2.0, ficam no *cadastro do programa*. Se um
programa puder ter mais de um modelo ativo com valores diferentes, a estrutura
atual não comporta — e a decisão sobre qual é a fonte de verdade precisa vir
antes de construir a seção de modelo.

## Decisões da área em 16/08/2026

- **A ação regional consome slot nacional.** Confirmado. A R15, que era uma
  suposição conservadora, passa a ser regra — mas continua **não implementada**:
  `regionalConsomeSlotNacional()` existe e devolve `true`, e
  `src/lib/dominio/ocupacao.ts` ainda ignora `acoes_regionais`. Ligar as duas
  pontas é trabalho da Entrega 3.
- **Altas Horas fica fora do piloto.** Seguimos com os três programas
  cadastrados.
- **O regional vende digital**, mas os valores ainda não existem. Os campos
  ficam, vazios.
- **Os avisos de "checar com Pricing" saem.** Era nota mental de um consultor
  para validar mídia com Pricing, não um alerta de produto.
