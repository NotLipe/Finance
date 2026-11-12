# Changelog

Todas as mudanças relevantes do projeto ficam registradas aqui.
Cada versão tem sua própria pasta no repositório (ex.: `alpha_0.2/`).

## [alpha 0.4] — 2026-11-12

Nova tela **Metas**. (Não houve versão 0.3.)

### Adicionado
- **Orçamento**: limite mensal por categoria de despesa e teto opcional para o mês inteiro.
  - Status por categoria: *Dentro*, *Atenção* (a partir de 80% do limite ou quando a previsão passa do limite) e *Estourou*.
  - **Previsão de fechamento do mês**: no começo do mês pesa mais a média dos meses anteriores; conforme o mês avança, pesa mais o ritmo atual.
  - Barra de progresso com marcador de "hoje", valor disponível e quanto ainda dá para gastar por dia.
  - Categorias podem ser marcadas como **gasto fixo** (previstas pela média, não pelo ritmo). Moradia, Educação, Assinaturas, Cartão de crédito e Investimentos já vêm marcadas.
  - **Sugestão automática de limites** pela média dos últimos 3 meses (arredondada para cima em múltiplos de R$ 50).
  - Navegação por mês: meses passados mostram o resultado; meses futuros, limites e médias.
- **Projeção**: renda mensal fixa informada pelo usuário e sobra acumulada do mês atual + 6 meses, em dois cenários
  (*se cumprir as metas* e *se continuar como está*), com gráfico de linhas e tabela mês a mês.
- **Objetivos de economia**: nome, valor, prazo, valor já guardado, cor e ícone.
  - Mostra quanto falta, o necessário por mês até o prazo, o ritmo atual de aportes e a data prevista para chegar lá (dentro ou fora do prazo).
  - Aportes são transações na categoria Investimentos (despesa) destinadas a um objetivo. O formulário de transação ganhou o campo "Destinar a um objetivo", e o botão "Registrar aporte" já preenche tudo.
  - Transações destinadas a um objetivo mostram o nome dele na lista.
- Dados de exemplo agora incluem renda mensal, limites e dois objetivos com aportes.

### Alterado
- "Metas" saiu do "Em breve" e virou item do menu.
- Migração automática dos dados para a versão 3 (orçamentos, objetivos, renda e marcação de gasto fixo), sem perder nada da 0.2.

### Corrigido
- Elementos com o atributo `hidden` agora ficam sempre ocultos, mesmo quando o CSS define outro `display`.

## [alpha 0.2] — 2026-11-10

### Adicionado
- **Criar categoria direto do formulário de transação**: o seletor de categorias ganhou o botão
  "+ Nova categoria". Ele abre o cadastro de categoria já no tipo certo (despesa ou receita) e,
  ao salvar, a categoria nova já fica selecionada na transação.

## [alpha 0.2] — 2026-11-09

### Adicionado
- Nova categoria de despesa **Cartão de crédito** (com ícone de cartão, também disponível no seletor de ícones).
- Nova categoria de despesa **Investimentos**, para registrar os aportes mensais. A categoria
  "Investimentos" de receita continua existindo para rendimentos.
- A importação de CSV sugere as novas categorias (ex.: "Pagamento de fatura", "Aplicação CDB").

### Alterado
- Migração automática dos dados da alpha 0.1: as duas categorias novas são adicionadas uma única vez,
  sem mexer nos dados existentes.

## [alpha 0.1] — 2026-11-06

### Adicionado
- Primeiro esboço do web app (HTML, CSS e JavaScript puros, sem dependências).
- Visão geral: saldo do mês, receitas x despesas, comparação com o mês anterior, taxa de economia,
  gráfico dos últimos 6 meses e rosca por categoria.
- Transações: criar, editar, excluir, buscar, filtrar e exportar em CSV.
- Categorias padrão e personalizadas (nome, cor e ícone).
- Importação de extrato CSV com detecção de colunas, categorização automática e aviso de duplicadas.
- Ajustes: backup/restauração em JSON, dados de exemplo e apagar tudo.
- Layout horizontal no desktop e navegação inferior no celular.
