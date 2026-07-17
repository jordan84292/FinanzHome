'use client';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import type {
  ExpenseByCategoryRecord,
  MemberBalanceRecord,
  MonthlyTrendRecord,
} from '@/lib/db/procedures/dashboard';

const CURRENCY_SYMBOL = '₡';

// Categorical palette (dark-mode column, dataviz skill's validated default
// ordering) re-validated against this app's actual card surface (#2A2650):
// all hard gates pass; the green slot sits just under 3:1 contrast, mitigated
// by always pairing it with a direct label (never color alone).
const CATEGORY_COLORS = ['#3987e5', '#008300', '#d55181', '#c98500', '#199e70', '#d95926'];
const SEQUENTIAL_BLUE = '#3987e5';
const STATUS_GOOD = '#0ca30c';
const STATUS_CRITICAL = '#d03b3b';

const CHART_SURFACE = '#2A2650';
const TEXT_PRIMARY = '#F3F1FA';
const TEXT_SECONDARY = '#A9A3C9';
const GRIDLINE = '#3D3768';

function formatAmount(amount: number): string {
  return `${CURRENCY_SYMBOL}${Math.round(amount).toLocaleString('es-CR')}`;
}

const baseChartOptions: Highcharts.Options = {
  chart: { backgroundColor: 'transparent', style: { fontFamily: 'inherit' } },
  title: { text: undefined },
  credits: { enabled: false },
  legend: {
    itemStyle: { color: TEXT_SECONDARY, fontWeight: 'normal' },
    itemHoverStyle: { color: TEXT_PRIMARY },
  },
  tooltip: {
    backgroundColor: CHART_SURFACE,
    borderColor: GRIDLINE,
    style: { color: TEXT_PRIMARY },
  },
};

export function DashboardClient({
  displayName,
  byCategory,
  monthlyTrend,
  memberBalances,
}: {
  displayName: string;
  byCategory: ExpenseByCategoryRecord[];
  monthlyTrend: MonthlyTrendRecord[];
  memberBalances: MemberBalanceRecord[];
}) {
  const totalThisMonth = byCategory.reduce((acc, row) => acc + Number(row.total_amount), 0);
  const firstName = displayName.split(' ')[0];

  const categoryOptions: Highcharts.Options = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'pie', height: 280 },
    colors: CATEGORY_COLORS,
    plotOptions: {
      pie: {
        innerSize: '60%',
        borderWidth: 2,
        borderColor: CHART_SURFACE,
        dataLabels: {
          enabled: true,
          format: '{point.name}',
          style: { color: TEXT_SECONDARY, textOutline: 'none', fontWeight: 'normal' },
        },
      },
    },
    series: [
      {
        type: 'pie',
        name: 'Gasto',
        data: byCategory.map((row) => ({ name: row.category_name, y: Number(row.total_amount) })),
      },
    ],
  };

  const trendOptions: Highcharts.Options = {
    ...baseChartOptions,
    chart: { ...baseChartOptions.chart, type: 'column', height: 260 },
    xAxis: {
      categories: monthlyTrend.map((row) => row.period_month),
      lineColor: GRIDLINE,
      tickColor: GRIDLINE,
      labels: { style: { color: TEXT_SECONDARY } },
    },
    yAxis: {
      title: { text: undefined },
      gridLineColor: GRIDLINE,
      gridLineDashStyle: 'Solid',
      labels: { style: { color: TEXT_SECONDARY } },
    },
    legend: { enabled: false },
    plotOptions: {
      column: {
        borderRadius: 4,
        maxPointWidth: 24,
        color: SEQUENTIAL_BLUE,
        dataLabels: {
          enabled: true,
          format: '{point.custom.label}',
          style: { color: TEXT_SECONDARY, textOutline: 'none', fontWeight: 'normal' },
        },
      },
    },
    series: [
      {
        type: 'column',
        name: 'Gasto pagado',
        data: monthlyTrend.map((row, index) => ({
          y: Number(row.total_amount),
          custom: { label: index === monthlyTrend.length - 1 ? formatAmount(Number(row.total_amount)) : '' },
        })),
      },
    ],
  };

  return (
    <main className="container-fluid px-3 py-4" style={{ paddingBottom: '5rem' }}>
      <h1 className="h4 mb-1">¡Hola, {firstName}! 👋</h1>
      <p className="text-body-secondary small mb-4">Este es el resumen financiero de tu hogar</p>

      <div className="mb-4">
        <div className="text-body-secondary small">Gasto pagado este mes</div>
        <div className="mb-0" style={{ fontSize: '2.5rem', fontWeight: 600, lineHeight: 1.1 }}>
          {formatAmount(totalThisMonth)}
        </div>
      </div>

      <h2 className="h6 text-body-secondary text-uppercase mb-2">Por categoría</h2>
      {byCategory.length === 0 ? (
        <p className="text-body-secondary">Todavía no hay gastos pagados este mes.</p>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={categoryOptions} />
      )}

      <h2 className="h6 text-body-secondary text-uppercase mt-4 mb-2">Evolución mensual</h2>
      {monthlyTrend.length === 0 ? (
        <p className="text-body-secondary">Todavía no hay historial suficiente.</p>
      ) : (
        <HighchartsReact highcharts={Highcharts} options={trendOptions} />
      )}

      <h2 className="h6 text-body-secondary text-uppercase mt-4 mb-2">Saldo entre miembros</h2>
      {memberBalances.length === 0 ? (
        <p className="text-body-secondary">Todavía no hay miembros en el hogar.</p>
      ) : (
        <div className="d-flex flex-column gap-2">
          {memberBalances.map((member) => {
            const isPositive = member.net_balance >= 0;
            const color = isPositive ? STATUS_GOOD : STATUS_CRITICAL;
            return (
              <div key={member.member_id} className="card">
                <div className="card-body py-3 d-flex align-items-center justify-content-between">
                  <div>
                    <div className="fw-semibold">{member.display_name}</div>
                    <div className="text-body-secondary small">
                      Aporte en compras compartidas: {formatAmount(member.shopping_share_amount)}
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2" style={{ color }}>
                    <i className={`bi ${isPositive ? 'bi-arrow-down-circle-fill' : 'bi-arrow-up-circle-fill'}`} />
                    <div>
                      <div className="small">{isPositive ? 'Le deben' : 'Debe'}</div>
                      <div className="fw-semibold">{formatAmount(Math.abs(member.net_balance))}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
