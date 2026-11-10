# Changelog

Todas as mudanças relevantes do projeto ficam registradas aqui.
Cada versão tem sua própria pasta no repositório (ex.: `alpha_0.2/`).

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
