import { store } from '../store.js';
import { icon } from '../icons.js';
import { pageHeader, toast } from '../components/ui.js';
import { confirmDialog } from '../components/modal.js';
import { download, readTextFile, todayISO } from '../utils.js';

export function render(root) {
  const { transactions, categories } = store.state;
  const sizeKb = (new Blob([JSON.stringify(store.state)]).size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  root.innerHTML = `
    ${pageHeader({ title: '<span class="ring">Configurações</span>', subtitle: 'Backup, dados de exemplo e informações do app' })}
    <div class="settings-grid">
      <section class="card">
        <div class="card-head"><h2>Backup dos dados</h2><span class="tx-icon" style="--c:var(--blue)">${icon('database')}</span></div>
        <p class="muted">Seus dados ficam salvos apenas neste navegador. Exporte um backup de vez em quando — e para levar seus dados para outro computador.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-primary" data-export>${icon('download', 18)} Exportar backup (.json)</button>
          <button type="button" class="btn btn-ghost" data-import>${icon('upload', 18)} Restaurar backup</button>
          <input type="file" accept=".json,application/json" hidden data-import-file>
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>Armazenamento</h2><span class="tx-icon" style="--c:var(--primary)">${icon('info')}</span></div>
        <ul class="summary">
          <li><span>Transações</span><strong>${transactions.length}</strong></li>
          <li><span>Categorias</span><strong>${categories.length}</strong></li>
          <li><span>Tamanho aproximado</span><strong>${sizeKb} KB</strong></li>
          <li><span>Local</span><strong>localStorage do navegador</strong></li>
        </ul>
      </section>

      <section class="card">
        <div class="card-head"><h2>Dados de exemplo</h2><span class="tx-icon" style="--c:var(--income)">${icon('sparkles')}</span></div>
        <p class="muted">Gera transações fictícias dos últimos 6 meses para você explorar gráficos e telas.
        <strong>Substitui</strong> as transações atuais.</p>
        <div class="btn-row"><button type="button" class="btn btn-ghost" data-sample>${icon('sparkles', 18)} Carregar dados de exemplo</button></div>
      </section>

      <section class="card danger-card">
        <div class="card-head"><h2>Zona de perigo</h2><span class="tx-icon" style="--c:var(--expense)">${icon('trash')}</span></div>
        <p class="muted">Apaga todas as transações e restaura as categorias padrão. Não dá para desfazer.</p>
        <div class="btn-row"><button type="button" class="btn btn-danger" data-reset>${icon('trash', 18)} Apagar todos os dados</button></div>
      </section>

      <section class="card about-card">
        <div class="card-head"><h2>Sobre o Finance</h2><span class="chip">alpha 0.2</span></div>
        <p class="muted">Primeiro esboço da ferramenta de controle de gastos. Próximos passos planejados:</p>
        <ul class="roadmap">
          <li>${icon('repeat', 18)} Assinaturas e gastos recorrentes</li>
          <li>${icon('target', 18)} Metas financeiras</li>
          <li>${icon('wallet', 18)} Contas e saldos por banco</li>
          <li>${icon('database', 18)} Sincronização na nuvem e login</li>
          <li>${icon('laptop', 18)} Versões desktop e mobile</li>
        </ul>
      </section>
    </div>`;

  root.querySelector('[data-export]').addEventListener('click', () => {
    download(`finance-backup-${todayISO()}.json`, JSON.stringify(store.exportData(), null, 2), 'application/json');
    toast('Backup exportado');
  });

  const fileInput = root.querySelector('[data-import-file]');
  root.querySelector('[data-import]').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await readTextFile(file));
      if (!Array.isArray(data?.transactions) || !Array.isArray(data?.categories)) throw new Error('formato');
    } catch {
      return toast('Arquivo de backup inválido.', 'error');
    }
    const ok = await confirmDialog({
      title: 'Restaurar backup?',
      message: `O backup tem ${data.transactions.length} transações e ${data.categories.length} categorias. Os dados atuais serão substituídos.`,
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    store.replaceAll(data);
    toast('Backup restaurado');
  });

  root.querySelector('[data-sample]').addEventListener('click', async () => {
    if (store.state.transactions.length) {
      const ok = await confirmDialog({
        title: 'Carregar dados de exemplo?',
        message: `Suas ${store.state.transactions.length} transações atuais serão substituídas. Exporte um backup antes se quiser guardá-las.`,
        confirmLabel: 'Substituir',
        danger: true,
      });
      if (!ok) return;
    }
    store.loadSample();
    toast('Dados de exemplo carregados');
  });

  root.querySelector('[data-reset]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Apagar todos os dados?',
      message: 'Todas as transações e categorias personalizadas serão removidas permanentemente.',
      confirmLabel: 'Apagar tudo',
      danger: true,
    });
    if (!ok) return;
    store.reset();
    toast('Dados apagados');
  });
}
