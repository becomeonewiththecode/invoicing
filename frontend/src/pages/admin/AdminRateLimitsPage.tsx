import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import { getRateLimitConfigs, createRateLimitConfig, updateRateLimitConfig, getRateLimitAnalytics } from '../../api/admin';

export function AdminRateLimitsPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'analytics'>('config');
  const [newConfig, setNewConfig] = useState({ route_pattern: '', window_ms: 60000, max_requests: 100, is_enabled: true });
  const [showNewForm, setShowNewForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: configs } = useQuery({
    queryKey: ['admin-rate-limits'],
    queryFn: getRateLimitConfigs,
    enabled: activeTab === 'config',
  });

  const { data: analytics } = useQuery({
    queryKey: ['admin-rate-limit-analytics'],
    queryFn: () => getRateLimitAnalytics(24),
    enabled: activeTab === 'analytics',
  });

  const createMutation = useMutation({
    mutationFn: () => createRateLimitConfig(newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rate-limits'] });
      setShowNewForm(false);
      setNewConfig({ route_pattern: '', window_ms: 60000, max_requests: 100, is_enabled: true });
      toast.success('Config created');
    },
    onError: () => toast.error('Failed to create config'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: unknown }) => updateRateLimitConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rate-limits'] });
      toast.success('Config updated');
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Rate Limiting</h1>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {(['config', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'config' ? 'Configuration' : 'Analytics'}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <>
          <div className="mb-4">
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Add Config
            </button>
          </div>

          {showNewForm && (
            <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Route Pattern</label>
                <input
                  type="text"
                  value={newConfig.route_pattern}
                  onChange={(e) => setNewConfig({ ...newConfig, route_pattern: e.target.value })}
                  placeholder="/api/auth/login"
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Window (ms)</label>
                <input
                  type="number"
                  value={newConfig.window_ms}
                  onChange={(e) => setNewConfig({ ...newConfig, window_ms: Number(e.target.value) })}
                  className="w-28 rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max Requests</label>
                <input
                  type="number"
                  value={newConfig.max_requests}
                  onChange={(e) => setNewConfig({ ...newConfig, max_requests: Number(e.target.value) })}
                  className="w-28 rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newConfig.route_pattern}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => setShowNewForm(false)}
                className="rounded border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route Pattern</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Window (ms)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Requests</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enabled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {configs?.map((config) => (
                  <tr key={config.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-700">{config.route_pattern}</td>
                    <td className="px-6 py-4 text-sm">
                      <input
                        type="number"
                        defaultValue={config.window_ms}
                        onBlur={(e) => updateMutation.mutate({ id: config.id, window_ms: Number(e.target.value) })}
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <input
                        type="number"
                        defaultValue={config.max_requests}
                        onBlur={(e) => updateMutation.mutate({ id: config.id, max_requests: Number(e.target.value) })}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <input
                        type="checkbox"
                        defaultChecked={config.is_enabled}
                        onChange={(e) => updateMutation.mutate({ id: config.id, is_enabled: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                    </td>
                  </tr>
                ))}
                {configs && configs.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No rate limit configs</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'analytics' && analytics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Total Requests (24h)</p>
              <p className="text-2xl font-bold text-indigo-600">{analytics.totalRequests.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Blocked Requests</p>
              <p className="text-2xl font-bold text-red-600">{analytics.blockedRequests.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Block Rate</p>
              <p className="text-2xl font-bold text-orange-600">{analytics.blockRate}%</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Volume (24h)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analytics.timeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} tickFormatter={(v) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                <YAxis />
                <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Area type="monotone" dataKey="requests" stroke="#6366f1" fill="#e0e7ff" name="Requests" />
                <Area type="monotone" dataKey="blocked" stroke="#ef4444" fill="#fee2e2" name="Blocked" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top IPs</h2>
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">IP</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Requests</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Blocked</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topIps.map((ip) => (
                    <tr key={ip.ip}>
                      <td className="py-1 font-mono text-gray-700">{ip.ip}</td>
                      <td className="py-1 text-gray-600">{ip.count}</td>
                      <td className="py-1 text-red-600">{ip.blocked}</td>
                    </tr>
                  ))}
                  {analytics.topIps.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-gray-500 text-center">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Blocked Routes</h2>
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Route</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Requests</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Blocked</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topRoutes.map((route) => (
                    <tr key={route.path}>
                      <td className="py-1 font-mono text-gray-700 truncate max-w-[200px]">{route.path}</td>
                      <td className="py-1 text-gray-600">{route.count}</td>
                      <td className="py-1 text-red-600">{route.blocked}</td>
                    </tr>
                  ))}
                  {analytics.topRoutes.length === 0 && (
                    <tr><td colSpan={3} className="py-2 text-gray-500 text-center">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
