# alpha_0.2

Segunda versão da ferramenta de controle de gastos: um web app em **HTML, CSS e JavaScript puros** (ES modules), sem framework, sem dependências e sem etapa de build.

## Como rodar

Como o app usa ES modules, ele precisa ser aberto por um servidor local (abrir o `index.html` direto com `file://` não funciona). Qualquer um serve, por exemplo:

```bash
cd alpha_0.2
python3 -m http.server 8080
```

ou

```bash
npx serve alpha_0.2
```

Depois acesse http://localhost:8080. A extensão **Live Server** do VS Code também funciona.

## Novidades da 0.2

- Nova categoria de despesa **Cartão de crédito**.
- Nova categoria de despesa **Investimentos**, para registrar quanto você investe por mês (aportes). A categoria de receita "Investimentos" continua existindo para rendimentos.
- A importação de CSV sugere essas categorias automaticamente (ex.: "Pagamento de fatura", "Aplicação CDB").
- Botão **"+ Nova categoria"** no formulário de transação: cria a categoria sem sair do lançamento e já a deixa selecionada.
- Quem já usava a 0.1 mantém os dados: as duas categorias novas são adicionadas automaticamente na primeira abertura.

## O que já funciona

- **Visão geral**: saldo do mês, receitas x despesas, comparação com o mês anterior, taxa de economia, gráfico dos últimos 6 meses (clique em um mês para selecioná-lo), rosca por categoria e últimas transações.
- **Transações**: criar, editar e excluir; busca, filtros por tipo e categoria, agrupamento por dia, resumo lateral e exportação em CSV (abre no Excel).
- **Categorias**: categorias padrão + criar/editar/excluir com cor e ícone. Ao excluir, as transações vão para "Outros".
- **Importar extrato (CSV)**: detecta separador, colunas e formato de data/valor automaticamente; sugere categorias pela descrição; marca duplicadas; permite ajustar tudo antes de importar.
- **Ajustes**: backup/restauração em JSON, dados de exemplo e apagar tudo.
- Layout horizontal no desktop e barra de navegação inferior no celular.
- Atalho: tecla **N** abre uma nova transação.

## Estrutura

```
alpha_0.2/
├── index.html
├── css/styles.css              # todo o visual (variáveis de cor no topo)
└── js/
    ├── app.js                  # menu, rotas (#/rota) e ações globais
    ├── store.js                # dados: estado, persistência, consultas e dados de exemplo
    ├── utils.js                # formatação de dinheiro/datas e parsing
    ├── icons.js                # ícones SVG
    ├── charts.js               # gráficos SVG (rosca e barras)
    ├── csv.js                  # leitura de CSV e categorização automática
    ├── components/             # modal, formulários e peças de interface
    └── views/                  # uma tela por arquivo
```

### Decisões importantes

- **Valores em centavos (inteiros)**: evita erros de arredondamento (`0.1 + 0.2`).
- **Datas como texto `AAAA-MM-DD`**: evita bugs de fuso horário.
- **Toda leitura/escrita passa pelo `store.js`**: hoje salva no `localStorage`. Para trocar por uma API ou banco, só esse arquivo muda.
- **Tudo que vem do usuário é escapado** (`escapeHtml`) antes de ir para o HTML.

## Caminho para desktop e mobile

O mesmo código web pode ser empacotado depois:

- **Desktop**: [Tauri](https://tauri.app) (leve) ou Electron.
- **Mobile**: [Capacitor](https://capacitorjs.com) (mesmo código como app nativo) ou PWA (instalável pelo navegador).

Quando chegar a hora de abrir para outras pessoas, entra um back-end (login + sincronização) no lugar do `localStorage`.
