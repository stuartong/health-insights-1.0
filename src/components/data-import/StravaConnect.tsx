import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { StravaClient, getStravaRedirectUri } from '@/api/strava';
import { useHealthStore } from '@/stores/healthStore';
import { useSettingsStore } from '@/stores/settingsStore';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function StravaConnect() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ workouts: number; totalKm: number; runs: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { addWorkouts, setLoading, clearDataBySource } = useHealthStore();
  const { apiKeys, updateAPIKeys } = useSettingsStore();

  const isConnected = !!apiKeys.stravaAccessToken;

  // Check for OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const storedClientId = apiKeys.stravaClientId;
      const storedClientSecret = apiKeys.stravaClientSecret;

      // Only process if we have a code and credentials
      if (code && storedClientId && storedClientSecret && !apiKeys.stravaAccessToken) {
        setStatus('connecting');
        setLoading(true, 'Completing Strava authorization...');
        setError(null);

        try {
          console.log('Exchanging Strava code for tokens...');
          const client = new StravaClient(storedClientId, storedClientSecret);
          await client.exchangeCodeForTokens(code);

          const tokens = client.getTokenInfo();
          updateAPIKeys({
            stravaAccessToken: tokens.accessToken || undefined,
            stravaRefreshToken: tokens.refreshToken || undefined,
            stravaTokenExpiry: tokens.tokenExpiry || undefined,
          });

          console.log('Fetching Strava activities...');
          // Clear previous PRs before syncing
          client.clearRunningPRs();

          // Sync activities - 90 days for training analysis
          // PRs are collected automatically from run activity details
          const workouts = await client.fetchAllActivities(90, true, apiKeys.claudeApiKey);
          await addWorkouts(workouts);

          // Get the collected running PRs from activity sync
          const runningPRs = client.getRunningPRs();
          if (runningPRs.length > 0) {
            updateAPIKeys({ stravaRunningPRs: runningPRs });
            console.log('Strava running PRs collected:', runningPRs.length);
          }

          // Fetch and save HR zones from Strava
          try {
            console.log('Fetching Strava HR zones...');
            const hrZones = await client.fetchAthleteZones();
            updateAPIKeys({ stravaHRZones: hrZones });
            console.log('Strava HR zones saved:', hrZones);
          } catch (zoneErr) {
            console.warn('Could not fetch Strava HR zones:', zoneErr);
          }

          const runs = workouts.filter(w => w.type === 'run');
          const totalKm = runs.reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
          setSyncResult({ workouts: workouts.length, totalKm, runs: runs.length });
          setStatus('connected');

          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          console.error('Strava OAuth error:', err);
          setError(err instanceof Error ? err.message : 'Authorization failed');
          setStatus('error');
          // Clean up URL even on error
          window.history.replaceState({}, document.title, window.location.pathname);
        } finally {
          setLoading(false);
        }
      }
    };

    handleCallback();
  }, [apiKeys.stravaClientId, apiKeys.stravaClientSecret, apiKeys.stravaAccessToken, addWorkouts, setLoading, updateAPIKeys]);

  const handleStartAuth = () => {
    if (!clientId || !clientSecret) {
      setError('Please enter your Client ID and Client Secret');
      return;
    }

    // Save credentials for the callback
    updateAPIKeys({
      stravaClientId: clientId,
      stravaClientSecret: clientSecret,
    });

    // Redirect to Strava authorization
    const client = new StravaClient(clientId, clientSecret);
    const authUrl = client.getAuthorizationUrl(getStravaRedirectUri());
    window.location.href = authUrl;
  };

  const handleSync = async () => {
    if (!apiKeys.stravaClientId || !apiKeys.stravaClientSecret || !apiKeys.stravaAccessToken) {
      return;
    }

    setIsSyncing(true);
    setError(null);
    setLoading(true, 'Syncing Strava activities...');

    try {
      const client = new StravaClient(
        apiKeys.stravaClientId,
        apiKeys.stravaClientSecret,
        apiKeys.stravaAccessToken,
        apiKeys.stravaRefreshToken,
        apiKeys.stravaTokenExpiry
      );

      // Clear previous PRs before syncing
      client.clearRunningPRs();

      // Sync 90 days of activities for training analysis
      // PRs are collected automatically from run activity details
      const workouts = await client.fetchAllActivities(90, true, apiKeys.claudeApiKey);
      await addWorkouts(workouts);

      // Get the collected running PRs from activity sync
      const runningPRs = client.getRunningPRs();
      if (runningPRs.length > 0) {
        updateAPIKeys({ stravaRunningPRs: runningPRs });
        console.log('Strava running PRs collected:', runningPRs.length);
      }

      // Update tokens in case they were refreshed
      const tokens = client.getTokenInfo();
      updateAPIKeys({
        stravaAccessToken: tokens.accessToken || undefined,
        stravaRefreshToken: tokens.refreshToken || undefined,
        stravaTokenExpiry: tokens.tokenExpiry || undefined,
      });

      // Refresh HR zones from Strava
      try {
        const hrZones = await client.fetchAthleteZones();
        updateAPIKeys({ stravaHRZones: hrZones });
      } catch (zoneErr) {
        console.warn('Could not refresh Strava HR zones:', zoneErr);
      }

      const runs = workouts.filter(w => w.type === 'run');
      const totalKm = runs.reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
      setSyncResult({ workouts: workouts.length, totalKm, runs: runs.length });
    } catch (err) {
      console.error('Strava sync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    updateAPIKeys({
      stravaClientId: undefined,
      stravaClientSecret: undefined,
      stravaAccessToken: undefined,
      stravaRefreshToken: undefined,
      stravaTokenExpiry: undefined,
    });
    await clearDataBySource('strava');
    setStatus('disconnected');
    setSyncResult(null);
    setClientId('');
    setClientSecret('');
  };

  if (isConnected) {
    return (
      <div className="space-y-6">
        {/* Connected State */}
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} className="text-success-500" />
              <span className="font-medium text-success-700">Connected to Strava</span>
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
                <p className="text-2xl font-bold text-gray-900">{syncResult.workouts}</p>
                <p className="text-sm text-gray-500">Activities</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{syncResult.runs}</p>
                <p className="text-sm text-gray-500">Runs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{syncResult.totalKm.toFixed(1)}</p>
                <p className="text-sm text-gray-500">Total km</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Last 90 days + all-time PRs from Strava</p>
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
              Sync Data & PRs
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
        <h4 className="font-medium text-gray-900 mb-2">Set up Strava API Access:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>
            Go to{' '}
            <a
              href="https://www.strava.com/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              strava.com/settings/api
              <ExternalLink size={12} className="inline ml-1" />
            </a>
          </li>
          <li>Create a new application (if you haven't already)</li>
          <li>Set the "Authorization Callback Domain" to <code className="bg-gray-200 px-1 rounded">{typeof window !== 'undefined' ? window.location.hostname : 'localhost'}</code></li>
          <li>Copy your Client ID and Client Secret below</li>
        </ol>
      </div>

      {/* Credentials Input */}
      <div className="space-y-4">
        <div>
          <label className="label">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Your Strava Client ID"
            className="input"
          />
        </div>
        <div>
          <label className="label">Client Secret</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Your Strava Client Secret"
            className="input"
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
        onClick={handleStartAuth}
        disabled={!clientId || !clientSecret}
        className="btn btn-primary w-full"
      >
        <ExternalLink size={18} />
        Connect with Strava
      </button>

      <p className="text-xs text-gray-500 text-center">
        You'll be redirected to Strava to authorize access, then back here to complete setup.
      </p>
    </div>
  );
}
