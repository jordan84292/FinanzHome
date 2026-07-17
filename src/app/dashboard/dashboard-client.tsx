'use client';

import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import type {
  ExpenseByCategoryRecord,
  MemberBalanceRecord,
  MonthlyTrendRecord,
} from '@/lib/db/procedures/dashboard';

const CURRENCY_SYMBOL = '₡';

function formatAmount(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString('es-CR')}`;
}

export function DashboardClient({
  byCategory,
  monthlyTrend,
  memberBalances,
}: {
  byCategory: ExpenseByCategoryRecord[];
  monthlyTrend: MonthlyTrendRecord[];
  memberBalances: MemberBalanceRecord[];
}) {
  const categoryOptions: Highcharts.Options = {
    chart: { type: 'pie', backgroundColor: 'transparent', height: 260 },
    title: { text: undefined },
    credits: { enabled: false },
    series: [
      {
        type: 'pie',
        name: 'Gasto',
        data: byCategory.map((row) => ({ name: row.category_name, y: Number(row.total_amount) })),
      },
    ],
  };

  const trendOptions: Highcharts.Options = {
    chart: { type: 'column', backgroundColor: 'transparent', height: 260 },
    title: { text: undefined },
    credits: { enabled: false },
    xAxis: { categories: monthlyTrend.map((row) => row.period_month) },
    yAxis: { title: { text: undefined } },
    legend: { enabled: false },
    series: [
      {
        type: 'column',
        name: 'Gasto pagado',
        data: monthlyTrend.map((row) => Number(row.total_amount)),
        color: 'var(--bs-primary, #6c5ce7)',
      },
    ],
  };

  return (
    <main className="container-fluid px-3 py-4" style={{ paddingBottom: '5rem' }}>
      <h1 className="h4 mb-4">Dashboard</h1>

      <h2 className="h6 text-body-secondary text-uppercase mb-2">Gasto por categoría (este mes)</h2>
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
        <ul className="list-group">
          {memberBalances.map((member) => (
            <li key={member.member_id} className="list-group-item">
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-semibold">{member.display_name}</span>
                <span className={member.net_balance >= 0 ? 'text-success' : 'text-danger'}>
                  {member.net_balance >= 0 ? 'Le deben ' : 'Debe '}
                  {formatAmount(Math.abs(member.net_balance))}
                </span>
              </div>
              <div className="text-body-secondary small mt-1">
                Aporte en compras compartidas: {formatAmount(member.shopping_share_amount)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
