import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

type Category =
  | 'Renda Fixa'
  | 'Renda Variável'
  | 'Fundos Imobiliários'
  | 'Fundos Agro'
  | 'Caixa/Reserva'
  | 'Cripto'
  | 'Outros';

type RatePeriod = 'monthly' | 'annual';
type TabKey = 'dashboard' | 'assets' | 'simulations' | 'settings';

type Asset = {
  id: string;
  name: string;
  category: Category;
  initialInvestment: number;
  currentValue: number;
  monthlyContribution: number;
  rate: number;
  ratePeriod: RatePeriod;
  notes: string;
  createdAt: string;
};

type Contribution = {
  id: string;
  assetId: string;
  amount: number;
  date: string;
  note: string;
};

type DataModel = {
  assets: Asset[];
  contributions: Contribution[];
  darkMode: boolean;
};

const STORAGE_KEY = 'myvault-v1';
const categories: Category[] = [
  'Renda Fixa',
  'Renda Variável',
  'Fundos Imobiliários',
  'Fundos Agro',
  'Caixa/Reserva',
  'Cripto',
  'Outros',
];

const emptyData: DataModel = {
  assets: [],
  contributions: [],
  darkMode: false,
};

const horizons = [
  { label: 'Mensal', months: 1 },
  { label: 'Trimestral', months: 3 },
  { label: 'Semestral', months: 6 },
  { label: 'Anual', months: 12 },
  { label: '2 anos', months: 24 },
  { label: '5 anos', months: 60 },
  { label: '10 anos', months: 120 },
];

const tabs: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'assets', label: 'Ativos' },
  { key: 'simulations', label: 'Simulações' },
  { key: 'settings', label: 'Configurações' },
];

const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

const pct = (value: number) => `${value.toFixed(2)}%`;
const today = () => new Date().toISOString().slice(0, 10);

function toMonthlyRate(rate: number, period: RatePeriod) {
  const decimal = rate / 100;
  if (period === 'monthly') return decimal;
  return Math.pow(1 + decimal, 1 / 12) - 1;
}

function projectCompound(startValue: number, monthlyContribution: number, monthlyRate: number, months: number) {
  let amount = startValue;
  for (let i = 0; i < months; i += 1) {
    amount = (amount + monthlyContribution) * (1 + monthlyRate);
  }
  return amount;
}

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [selectedSimulationId, setSelectedSimulationId] = useState<'all' | string>('all');
  const [data, setData] = useState<DataModel>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyData;
    try {
      return JSON.parse(saved) as DataModel;
    } catch {
      return emptyData;
    }
  });

  const [assetForm, setAssetForm] = useState({
    name: '',
    category: 'Renda Fixa' as Category,
    initialInvestment: '',
    currentValue: '',
    monthlyContribution: '',
    rate: '',
    ratePeriod: 'monthly' as RatePeriod,
    notes: '',
  });

  const [contributionForm, setContributionForm] = useState({
    assetId: '',
    amount: '',
    date: today(),
    note: '',
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    document.documentElement.classList.toggle('dark', data.darkMode);
  }, [data]);

  useEffect(() => {
    if (!contributionForm.assetId && data.assets[0]) {
      setContributionForm((prev) => ({ ...prev, assetId: data.assets[0].id }));
    }
  }, [data.assets, contributionForm.assetId]);

  const contributionsByAsset = useMemo(() => {
    const map = new Map<string, number>();
    data.contributions.forEach((item) => {
      map.set(item.assetId, (map.get(item.assetId) ?? 0) + item.amount);
    });
    return map;
  }, [data.contributions]);

  const portfolioRows = useMemo(() => {
    const totalCurrent = data.assets.reduce((sum, asset) => sum + asset.currentValue, 0);

    return data.assets.map((asset) => {
      const historyAmount = contributionsByAsset.get(asset.id) ?? 0;
      const totalInvested = asset.initialInvestment + historyAmount;
      const profit = asset.currentValue - totalInvested;
      const profitability = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
      const participation = totalCurrent > 0 ? (asset.currentValue / totalCurrent) * 100 : 0;
      const monthlyRate = toMonthlyRate(asset.rate, asset.ratePeriod);

      return {
        ...asset,
        historyAmount,
        totalInvested,
        profit,
        profitability,
        participation,
        projection1y: projectCompound(asset.currentValue, asset.monthlyContribution, monthlyRate, 12),
        projection2y: projectCompound(asset.currentValue, asset.monthlyContribution, monthlyRate, 24),
        projection5y: projectCompound(asset.currentValue, asset.monthlyContribution, monthlyRate, 60),
        projection10y: projectCompound(asset.currentValue, asset.monthlyContribution, monthlyRate, 120),
      };
    });
  }, [data.assets, contributionsByAsset]);

  const totals = useMemo(() => {
    const totalCurrent = portfolioRows.reduce((sum, row) => sum + row.currentValue, 0);
    const totalInvested = portfolioRows.reduce((sum, row) => sum + row.totalInvested, 0);
    const totalProfit = totalCurrent - totalInvested;
    const totalMonthlyContribution = portfolioRows.reduce((sum, row) => sum + row.monthlyContribution, 0);
    const averageReturn = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
    const projection1y = portfolioRows.reduce((sum, row) => sum + row.projection1y, 0);
    const projection5y = portfolioRows.reduce((sum, row) => sum + row.projection5y, 0);
    const projection10y = portfolioRows.reduce((sum, row) => sum + row.projection10y, 0);

    return {
      totalCurrent,
      totalInvested,
      totalProfit,
      totalMonthlyContribution,
      averageReturn,
      projection1y,
      projection5y,
      projection10y,
    };
  }, [portfolioRows]);

  const contributionsHistory = useMemo(() => {
    return [...data.contributions].sort((a, b) => b.date.localeCompare(a.date));
  }, [data.contributions]);

  const categoryChart = useMemo(() => ({
    labels: categories,
    datasets: [{
      data: categories.map((category) => portfolioRows.filter((row) => row.category === category).reduce((sum, row) => sum + row.currentValue, 0)),
      backgroundColor: ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#38bdf8', '#0f766e'],
      borderWidth: 0,
    }],
  }), [portfolioRows]);

  const assetChart = useMemo(() => ({
    labels: portfolioRows.map((row) => row.name),
    datasets: [{
      label: 'Valor Atual',
      data: portfolioRows.map((row) => row.currentValue),
      backgroundColor: '#2563eb',
      borderRadius: 10,
    }],
  }), [portfolioRows]);

  const compareChart = useMemo(() => ({
    labels: portfolioRows.map((row) => row.name),
    datasets: [
      {
        label: 'Investido',
        data: portfolioRows.map((row) => row.totalInvested),
        backgroundColor: '#93c5fd',
        borderRadius: 8,
      },
      {
        label: 'Atual',
        data: portfolioRows.map((row) => row.currentValue),
        backgroundColor: '#1d4ed8',
        borderRadius: 8,
      },
    ],
  }), [portfolioRows]);

  const monthlyContributionChart = useMemo(() => {
    const map = new Map<string, number>();
    data.contributions.forEach((item) => {
      const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' }).format(new Date(`${item.date}T00:00:00`));
      map.set(label, (map.get(label) ?? 0) + item.amount);
    });

    return {
      labels: Array.from(map.keys()),
      datasets: [{
        label: 'Histórico de aportes',
        data: Array.from(map.values()),
        backgroundColor: '#3b82f6',
        borderRadius: 10,
      }],
    };
  }, [data.contributions]);

  const selectedAssets = selectedSimulationId === 'all'
    ? portfolioRows
    : portfolioRows.filter((row) => row.id === selectedSimulationId);

  const projectionSeries = useMemo(() => {
    const labels = Array.from({ length: 120 }, (_, index) => `M${index + 1}`);
    const values = labels.map((_, index) => {
      return selectedAssets.reduce((sum, row) => {
        const monthlyRate = toMonthlyRate(row.rate, row.ratePeriod);
        return sum + projectCompound(row.currentValue, row.monthlyContribution, monthlyRate, index + 1);
      }, 0);
    });

    return {
      labels,
      datasets: [{
        label: selectedSimulationId === 'all' ? 'Projeção consolidada' : 'Projeção do ativo',
        data: values,
        borderColor: '#1d4ed8',
        backgroundColor: 'rgba(37,99,235,0.12)',
        fill: true,
        tension: 0.3,
      }],
    };
  }, [selectedAssets, selectedSimulationId]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        labels: {
          color: data.darkMode ? '#dbeafe' : '#1e3a8a',
        },
      },
    },
    scales: {
      x: {
        ticks: { color: data.darkMode ? '#dbeafe' : '#1e3a8a' },
        grid: { color: data.darkMode ? 'rgba(147,197,253,0.12)' : 'rgba(59,130,246,0.12)' },
      },
      y: {
        ticks: { color: data.darkMode ? '#dbeafe' : '#1e3a8a' },
        grid: { color: data.darkMode ? 'rgba(147,197,253,0.12)' : 'rgba(59,130,246,0.12)' },
      },
    },
  };

  function resetAssetForm() {
    setAssetForm({
      name: '',
      category: 'Renda Fixa',
      initialInvestment: '',
      currentValue: '',
      monthlyContribution: '',
      rate: '',
      ratePeriod: 'monthly',
      notes: '',
    });
    setEditingAssetId(null);
  }

  function submitAsset(event: React.FormEvent) {
    event.preventDefault();
    if (!assetForm.name.trim()) return;

    const payload: Asset = {
      id: editingAssetId ?? crypto.randomUUID(),
      name: assetForm.name.trim(),
      category: assetForm.category,
      initialInvestment: Number(assetForm.initialInvestment || 0),
      currentValue: Number(assetForm.currentValue || 0),
      monthlyContribution: Number(assetForm.monthlyContribution || 0),
      rate: Number(assetForm.rate || 0),
      ratePeriod: assetForm.ratePeriod,
      notes: assetForm.notes.trim(),
      createdAt: today(),
    };

    setData((prev) => {
      if (editingAssetId) {
        return {
          ...prev,
          assets: prev.assets.map((asset) => (asset.id === editingAssetId ? { ...payload, createdAt: asset.createdAt } : asset)),
        };
      }
      return { ...prev, assets: [...prev.assets, payload] };
    });

    if (!contributionForm.assetId) {
      setContributionForm((prev) => ({ ...prev, assetId: payload.id }));
    }
    resetAssetForm();
  }

  function startEditAsset(assetId: string) {
    const asset = data.assets.find((item) => item.id === assetId);
    if (!asset) return;
    setEditingAssetId(assetId);
    setAssetForm({
      name: asset.name,
      category: asset.category,
      initialInvestment: String(asset.initialInvestment),
      currentValue: String(asset.currentValue),
      monthlyContribution: String(asset.monthlyContribution),
      rate: String(asset.rate),
      ratePeriod: asset.ratePeriod,
      notes: asset.notes,
    });
    setActiveTab('assets');
  }

  function removeAsset(assetId: string) {
    setData((prev) => ({
      ...prev,
      assets: prev.assets.filter((asset) => asset.id !== assetId),
      contributions: prev.contributions.filter((item) => item.assetId !== assetId),
    }));
    if (selectedSimulationId === assetId) {
      setSelectedSimulationId('all');
    }
    if (contributionForm.assetId === assetId) {
      setContributionForm((prev) => ({ ...prev, assetId: '' }));
    }
  }

  function submitContribution(event: React.FormEvent) {
    event.preventDefault();
    if (!contributionForm.assetId || !contributionForm.amount) return;

    const payload: Contribution = {
      id: crypto.randomUUID(),
      assetId: contributionForm.assetId,
      amount: Number(contributionForm.amount),
      date: contributionForm.date,
      note: contributionForm.note.trim(),
    };

    setData((prev) => ({ ...prev, contributions: [...prev.contributions, payload] }));
    setContributionForm((prev) => ({ ...prev, amount: '', date: today(), note: '' }));
  }

  function removeContribution(id: string) {
    setData((prev) => ({ ...prev, contributions: prev.contributions.filter((item) => item.id !== id) }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'myvault-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as DataModel;
        setData(imported);
      } catch {
        alert('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function resetVault() {
    setData(emptyData);
    resetAssetForm();
    setContributionForm({ assetId: '', amount: '', date: today(), note: '' });
    setSelectedSimulationId('all');
  }

  return (
    <div className="shell">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="panel mb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-blue-700 dark:text-blue-300">MyVault</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Planejamento real da carteira</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-blue-100/80">
                Controle ativos, histórico de aportes, taxa manual por ativo, participação na carteira e projeções mensais até 10 anos.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setData((prev) => ({ ...prev, darkMode: !prev.darkMode }))} className="btn-secondary">
                {data.darkMode ? 'Modo claro' : 'Modo escuro'}
              </button>
              <button type="button" onClick={exportJson} className="btn-primary">Exportar JSON</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary">Importar JSON</button>
              <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importJson} />
            </div>
          </div>
        </header>

        <nav className="mb-6 flex flex-wrap gap-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`tab-btn ${activeTab === tab.key ? 'tab-active' : 'tab-idle'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'dashboard' && (
          <div className="grid gap-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Patrimônio total" value={money(totals.totalCurrent)} />
              <MetricCard title="Total aportado" value={money(totals.totalInvested)} />
              <MetricCard title="Lucro / prejuízo" value={money(totals.totalProfit)} />
              <MetricCard title="Aporte mensal total" value={money(totals.totalMonthlyContribution)} />
              <MetricCard title="Rentabilidade média" value={pct(totals.averageReturn)} />
              <MetricCard title="Projeção 1 ano" value={money(totals.projection1y)} />
              <MetricCard title="Projeção 5 anos" value={money(totals.projection5y)} />
              <MetricCard title="Projeção 10 anos" value={money(totals.projection10y)} />
            </section>

            <section className="grid gap-6 xl:grid-cols-2">
              <Panel title="Distribuição por categoria">
                <div className="mx-auto max-w-md"><Doughnut data={categoryChart} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { color: data.darkMode ? '#dbeafe' : '#1e3a8a' } } } }} /></div>
              </Panel>
              <Panel title="Distribuição por ativo">
                <Bar data={assetChart} options={chartOptions} />
              </Panel>
              <Panel title="Investido x atual">
                <Bar data={compareChart} options={chartOptions} />
              </Panel>
              <Panel title="Histórico de aportes">
                <Bar data={monthlyContributionChart} options={chartOptions} />
              </Panel>
            </section>
          </div>
        )}

        {activeTab === 'assets' && (
          <div className="grid gap-6">
            <section className="grid gap-6 lg:grid-cols-2">
              <Panel title={editingAssetId ? 'Editar ativo' : 'Cadastrar ativo'}>
                <form className="grid gap-4" onSubmit={submitAsset}>
                  <input className="input-ui" placeholder="Nome do ativo" value={assetForm.name} onChange={(e) => setAssetForm((prev) => ({ ...prev, name: e.target.value }))} />
                  <select className="input-ui" value={assetForm.category} onChange={(e) => setAssetForm((prev) => ({ ...prev, category: e.target.value as Category }))}>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input className="input-ui" type="number" step="0.01" placeholder="Valor investido inicial" value={assetForm.initialInvestment} onChange={(e) => setAssetForm((prev) => ({ ...prev, initialInvestment: e.target.value }))} />
                    <input className="input-ui" type="number" step="0.01" placeholder="Valor atual" value={assetForm.currentValue} onChange={(e) => setAssetForm((prev) => ({ ...prev, currentValue: e.target.value }))} />
                    <input className="input-ui" type="number" step="0.01" placeholder="Aporte mensal" value={assetForm.monthlyContribution} onChange={(e) => setAssetForm((prev) => ({ ...prev, monthlyContribution: e.target.value }))} />
                    <input className="input-ui" type="number" step="0.01" placeholder="Taxa (%)" value={assetForm.rate} onChange={(e) => setAssetForm((prev) => ({ ...prev, rate: e.target.value }))} />
                  </div>
                  <select className="input-ui" value={assetForm.ratePeriod} onChange={(e) => setAssetForm((prev) => ({ ...prev, ratePeriod: e.target.value as RatePeriod }))}>
                    <option value="monthly">Taxa mensal</option>
                    <option value="annual">Taxa anual</option>
                  </select>
                  <textarea className="input-ui min-h-24" placeholder="Observações" value={assetForm.notes} onChange={(e) => setAssetForm((prev) => ({ ...prev, notes: e.target.value }))} />
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-primary" type="submit">{editingAssetId ? 'Salvar alterações' : 'Adicionar ativo'}</button>
                    {editingAssetId && <button type="button" className="btn-secondary" onClick={resetAssetForm}>Cancelar</button>}
                  </div>
                </form>
              </Panel>

              <Panel title="Adicionar aporte com data">
                <form className="grid gap-4" onSubmit={submitContribution}>
                  <select className="input-ui" value={contributionForm.assetId} onChange={(e) => setContributionForm((prev) => ({ ...prev, assetId: e.target.value }))}>
                    <option value="">Selecione um ativo</option>
                    {data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                  </select>
                  <input className="input-ui" type="number" step="0.01" placeholder="Valor do aporte" value={contributionForm.amount} onChange={(e) => setContributionForm((prev) => ({ ...prev, amount: e.target.value }))} />
                  <input className="input-ui" type="date" value={contributionForm.date} onChange={(e) => setContributionForm((prev) => ({ ...prev, date: e.target.value }))} />
                  <input className="input-ui" placeholder="Observação do aporte" value={contributionForm.note} onChange={(e) => setContributionForm((prev) => ({ ...prev, note: e.target.value }))} />
                  <button className="btn-primary" type="submit">Registrar aporte</button>
                </form>
              </Panel>
            </section>

            <Panel title="Ativos cadastrados">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-blue-100 text-slate-500 dark:border-blue-900/40 dark:text-blue-200/80">
                      <th className="px-3 py-3">Ativo</th>
                      <th className="px-3 py-3">Categoria</th>
                      <th className="px-3 py-3">Investido</th>
                      <th className="px-3 py-3">Atual</th>
                      <th className="px-3 py-3">Aporte mensal</th>
                      <th className="px-3 py-3">Taxa</th>
                      <th className="px-3 py-3">P/L</th>
                      <th className="px-3 py-3">Rentab.</th>
                      <th className="px-3 py-3">Participação</th>
                      <th className="px-3 py-3">1a</th>
                      <th className="px-3 py-3">2a</th>
                      <th className="px-3 py-3">5a</th>
                      <th className="px-3 py-3">10a</th>
                      <th className="px-3 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioRows.map((row) => (
                      <tr key={row.id} className="border-b border-blue-50 dark:border-blue-900/20">
                        <td className="px-3 py-3 font-semibold">{row.name}</td>
                        <td className="px-3 py-3">{row.category}</td>
                        <td className="px-3 py-3">{money(row.totalInvested)}</td>
                        <td className="px-3 py-3">{money(row.currentValue)}</td>
                        <td className="px-3 py-3">{money(row.monthlyContribution)}</td>
                        <td className="px-3 py-3">{pct(row.rate)} / {row.ratePeriod === 'monthly' ? 'mês' : 'ano'}</td>
                        <td className={`px-3 py-3 font-semibold ${row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(row.profit)}</td>
                        <td className="px-3 py-3">{pct(row.profitability)}</td>
                        <td className="px-3 py-3">{pct(row.participation)}</td>
                        <td className="px-3 py-3">{money(row.projection1y)}</td>
                        <td className="px-3 py-3">{money(row.projection2y)}</td>
                        <td className="px-3 py-3">{money(row.projection5y)}</td>
                        <td className="px-3 py-3">{money(row.projection10y)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-secondary px-3 py-2" onClick={() => startEditAsset(row.id)}>Editar</button>
                            <button type="button" className="btn-secondary px-3 py-2" onClick={() => removeAsset(row.id)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Histórico de aportes">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-blue-100 text-slate-500 dark:border-blue-900/40 dark:text-blue-200/80">
                      <th className="px-3 py-3">Data</th>
                      <th className="px-3 py-3">Ativo</th>
                      <th className="px-3 py-3">Valor</th>
                      <th className="px-3 py-3">Obs.</th>
                      <th className="px-3 py-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contributionsHistory.map((item) => (
                      <tr key={item.id} className="border-b border-blue-50 dark:border-blue-900/20">
                        <td className="px-3 py-3">{item.date}</td>
                        <td className="px-3 py-3">{data.assets.find((asset) => asset.id === item.assetId)?.name ?? 'Ativo removido'}</td>
                        <td className="px-3 py-3">{money(item.amount)}</td>
                        <td className="px-3 py-3">{item.note || '-'}</td>
                        <td className="px-3 py-3"><button type="button" className="btn-secondary px-3 py-2" onClick={() => removeContribution(item.id)}>Excluir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        )}

        {activeTab === 'simulations' && (
          <div className="grid gap-6">
            <Panel title="Simulações por prazo">
              <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-blue-100/80">Escolha se quer simular toda a carteira ou um ativo específico.</p>
                </div>
                <select className="input-ui max-w-sm" value={selectedSimulationId} onChange={(e) => setSelectedSimulationId(e.target.value)}>
                  <option value="all">Carteira consolidada</option>
                  {data.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {horizons.map((item) => {
                  const value = selectedAssets.reduce((sum, row) => {
                    const monthlyRate = toMonthlyRate(row.rate, row.ratePeriod);
                    return sum + projectCompound(row.currentValue, row.monthlyContribution, monthlyRate, item.months);
                  }, 0);
                  return <MetricCard key={item.label} title={item.label} value={money(value)} />;
                })}
              </div>
            </Panel>
            <Panel title="Curva projetada">
              <Line data={projectionSeries} options={chartOptions} />
            </Panel>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Backup e restauração">
              <div className="grid gap-4">
                <button type="button" className="btn-primary" onClick={exportJson}>Exportar carteira</button>
                <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>Importar carteira</button>
                <p className="text-sm text-slate-600 dark:text-blue-100/80">O arquivo JSON preserva ativos, aportes, tema e configurações do app.</p>
              </div>
            </Panel>
            <Panel title="Controle de dados">
              <div className="grid gap-4">
                <button type="button" className="btn-secondary" onClick={() => setData((prev) => ({ ...prev, darkMode: !prev.darkMode }))}>
                  Alternar tema
                </button>
                <button type="button" className="btn-secondary" onClick={resetVault}>Zerar carteira</button>
                <p className="text-sm text-slate-600 dark:text-blue-100/80">Use zerar carteira apenas quando quiser apagar completamente ativos e histórico local.</p>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="panel">
      <p className="text-sm text-slate-500 dark:text-blue-100/70">{title}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default App;
