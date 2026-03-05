import { useState } from 'react';
import { Key, CheckCircle, AlertCircle, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { OuraClient, isValidOuraToken } from '@/api/oura';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function OuraConnect() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ sleep: number; hrv: number; avgSleepHrs: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { addSleepRecords, addHRVReadings, setLoading, clearDataBySource } = useHealthStore();
  const { apiKeys, updateAPIKeys } = useSettingsStore();

  const isConnected = !!apiKeys.ouraToken;

  const handleConnect = async () => {
    if (!isValidOuraToken(token)) {
      setError('Invalid token format. Please check your personal access token.');
      return;
    }

    setStatus('connecting');
    setError(null);
    setLoading(true, 'Connecting to Oura...');

    try {
      const client = new OuraClient(token);
      const isValid = await client.testConnection();

      if (!isValid) {
        throw new Error('Failed to connect to Oura. Please check your token.');
      }

      // Save token
      updateAPIKeys({ ouraToken: token });

      // Sync data - fetch 90 days to match other data sources
      const data = await client.fetchAllData(90);

      await Promise.all([
        addSleepRecords(data.sleepRecords),
        addHRVReadings(data.hrvReadings),
      ]);

      // Calculate average sleep for verification
      const avgSleepHrs = data.sleepRecords.length > 0
        ? data.sleepRecords.reduce((sum, s) => sum + s.duration, 0) / data.sleepRecords.length / 60
        : 0;

      setSyncResult({
        sleep: data.sleepRecords.length,
        hrv: data.hrvReadings.length,
        avgSleepHrs,
      });
      setStatus('connected');
    } catch (err) {
      console.error('Oura connection error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!apiKeys.ouraToken) return;

    setIsSyncing(true);
    setError(null);
    setLoading(true, 'Syncing Oura data...');

    try {
      const client = new OuraClient(apiKeys.ouraToken);
      const data = await client.fetchAllData(90);

      await Promise.all([
        addSleepRecords(data.sleepRecords),
        addHRVReadings(data.hrvReadings),
      ]);

      const avgSleepHrs = data.sleepRecords.length > 0
        ? data.sleepRecords.reduce((sum, s) => sum + s.duration, 0) / data.sleepRecords.length / 60
        : 0;

      setSyncResult({
        sleep: data.sleepRecords.length,
        hrv: data.hrvReadings.length,
        avgSleepHrs,
      });
    } catch (err) {
      console.error('Oura sync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    updateAPIKeys({ ouraToken: undefined });
    await clearDataBySource('oura');
    setStatus('disconnected');
    setSyncResult(null);
    setToken('');
  };

  if (isConnected) {
    return (
      <div className="space-y-6">
        {/* Connected State */}
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-success-500" />
              <span className="font-medium text-success-700">Connected to Oura</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="btn btn-ghost text-danger-600 hover:bg-danger-50"
            >
              <Trash2 size={16} />
              Disconnect
            </button>
          </div>
        </div>

        {/* Sync Results */}
        {syncResult && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{syncResult.sleep}</p>
                <p className="text-sm text-gray-500">Nights</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{syncResult.avgSleepHrs.toFixed(1)}</p>
                <p className="text-sm text-gray-500">Avg hrs/night</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{syncResult.hrv}</p>
                <p className="text-sm text-gray-500">HRV Readings</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Last 90 days from Oura</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-danger-500" />
              <span className="text-danger-700">{error}</span>
            </div>
          </div>
        )}

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="btn btn-secondary w-full"
        >
          {isSyncing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              Sync Last 90 Days
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Get your Oura Personal Access Token:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>
            Go to{' '}
            <a
              href="https://cloud.ouraring.com/personal-access-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              cloud.ouraring.com/personal-access-tokens
            </a>
          </li>
          <li>Log in to your Oura account</li>
          <li>Click "Create New Personal Access Token"</li>
          <li>Copy the token and paste it below</li>
        </ol>
      </div>

      {/* Token Input */}
      <div>
        <label className="label">Personal Access Token</label>
        <div className="relative">
          <Key size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste your Oura token here"
            className="input pl-10"
            disabled={status === 'connecting'}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-danger-500" />
            <span className="text-danger-700">{error}</span>
          </div>
        </div>
      )}

      {/* Connect Button */}
      <button
        onClick={handleConnect}
        disabled={!token || status === 'connecting'}
        className="btn btn-primary w-full"
      >
        {status === 'connecting' ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Connecting...
          </>
        ) : (
          'Connect Oura Ring'
        )}
      </button>
    </div>
  );
}
