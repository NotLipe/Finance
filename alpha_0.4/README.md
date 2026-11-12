# alpha_0.4

Versão com **Metas** da ferramenta de controle de gastos: um web app em **HTML, CSS e JavaScript puros** (ES modules), sem framework, sem dependências e sem etapa de build.

## Como rodar

Como o app usa ES modules, ele precisa ser aberto por um servidor local (abrir o `index.html` direto com `file://` não funciona). Qualquer um serve, por exemplo:

```bash
cd alpha_0.4
python3 -m http.server 8080
```

ou

```bash
npx serve alpha_0.4
```

Depois acesse http://localhost:8080. A extensão **Live Server** do VS Code também funciona.

## Novidades da 0.4: Metas

Nova tela **Metas**, com três abas:

- **Orçamento**: limite mensal por categoria e teto para o mês inteiro. Cada categoria mostra se está *Dentro*, em *Atenção* (80% do limite ou previsão de passar) ou *Estourou*, com um marcador de "hoje" na barra e a **previsão de fechamento do mês**. Categorias marcadas como **gasto fixo** (aluguel, assinaturas…) são previstas pela média, não pelo ritmo. Há **sugestão automática de limites** pela média dos últimos meses.
- **Projeção**: com a sua **renda mensal** (valor fixo que você informa), mostra a sobra acumulada dos próximos 6 meses em dois cenários: *se cumprir as metas* e *se continuar como está*.
- **Objetivos**: valor, prazo e quanto já tem guardado. Mostra quanto falta, quanto guardar por mês e, pelo ritmo dos aportes, **quando você deve chegar lá** (dentro ou fora do prazo). Aportes são transações na categoria **Investimentos** (despesa) destinadas a um objetivo; o botão "Registrar aporte" já preenche tudo.

O histórico completo de mudanças está no [CHANGELOG](../CHANGELOG.md).

## O que já funciona

- **Visão geral**: saldo do mês, receitas x despesas, comparação com o mês anterior, taxa de economia, gráfico dos últimos 6 meses (clique em um mês para selecioná-lo), rosca por categoria e últimas transações.
- **Transações**: criar, editar e excluir; busca, filtros por tipo e categoria, agrupamento por dia, resumo lateral e exportação em CSV (abre no Excel).
- **Categorias**: categorias padrão + criar/editar/excluir com cor e ícone (também direto do formulário de transação). Ao excluir, as transações vão para "Outros".
- **Metas**: orçamento com previsão de fechamento, projeção de 6 meses e objetivos de economia.
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
    ├── charts.js               # gráficos SVG (rosca, barras e linhas)
    ├── csv.js                  # leitura de CSV e categorização automática
    ├── planning.js             # cálculos de metas: ritmo, previsão, projeção e objetivos
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
