'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend
} from 'recharts'

const COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#06b6d4']

interface Props {
  powerBuckets: { label: string; count: number }[]
  troopDistribution: { name: string; value: number }[]
  participationData: { label: string; rate: number }[]
  tzCoverage: { hour: number; count: number }[]
  topRallyLeaders: { name: string; score: number }[]
  topJoiners: { name: string; score: number }[]
}

export function AnalyticsCharts({ powerBuckets, troopDistribution, participationData, tzCoverage, topRallyLeaders, topJoiners }: Props) {
  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#f1f5f9',
    fontSize: '12px',
  }

  return (
    <div className="space-y-6">
      {/* Power Distribution */}
      {powerBuckets.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-slate-300 mb-4">Power Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={powerBuckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
              <Bar dataKey="count" name="Members" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Troop Type Distribution */}
        {troopDistribution.some(d => d.value > 0) && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-slate-300 mb-4">Troop Type Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={troopDistribution.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {troopDistribution.filter(d => d.value > 0).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Event Participation Trend */}
        {participationData.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-slate-300 mb-4">Event Participation Rate</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={participationData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'Participation']} />
                <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Timezone Coverage */}
      {tzCoverage.some(h => h.count > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="font-semibold text-sm text-slate-300 mb-4">Timezone Coverage (UTC)</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={tzCoverage} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={h => `${String(h).padStart(2,'0')}:00`} interval={3} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={h => `${String(h).padStart(2,'0')}:00 UTC`} formatter={(v: number) => [v, 'Members online']} cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Rally Leaders */}
        {topRallyLeaders.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-slate-300 mb-4">Top 10 Rally Leaders</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topRallyLeaders} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={55} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(2), 'Score']} cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
                <Bar dataKey="score" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Joiners */}
        {topJoiners.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-sm text-slate-300 mb-4">Top 10 Joiners</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topJoiners} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={55} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toFixed(2), 'Score']} cursor={{ fill: 'rgba(245,158,11,0.08)' }} />
                <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
