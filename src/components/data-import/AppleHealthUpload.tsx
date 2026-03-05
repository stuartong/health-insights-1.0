import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseAppleHealthExportFromText, estimateParseTime } from '@/parsers/appleHealthParser';
import { useHealthStore } from '@/stores/healthStore';

type UploadStatus = 'idle' | 'reading' | 'parsing' | 'success' | 'error';

interface ParseResult {
  workouts: number;
  runs: number;
  totalRunKm: number;
  sleep: number;
  avgSleepHrs: number;
  weight: number;
  hrv: number;
}

interface SelectedFileInfo {
  name: string;
  size: number;
  content: string;
}

export function AppleHealthUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState({ stage: '', percent: 0 });
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFileInfo | null>(null);
  const [showPasteOption, setShowPasteOption] = useState(false);
  const [pastedContent, setPastedContent] = useState('');
  const [filePath, setFilePath] = useState('');

  const { addWorkouts, addSleepRecords, addWeightEntries, addHRVReadings, setLoading } = useHealthStore();

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setStatus('reading');
      setError(null);
      setResult(null);

      try {
        // Use FileReader for better browser compatibility
        const content = await readFileContent(file);
        setSelectedFile({
          name: file.name,
          size: file.size,
          content,
        });
        setStatus('idle');
      } catch (err) {
        console.error('Error reading file:', err);
        setError('Failed to read file. Try the paste option below, or copy the file to C:\\Users\\YourName\\Downloads first.');
        setStatus('error');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setStatus('parsing');
    setLoading(true, 'Parsing Apple Health data...');
    setError(null);

    try {
      const data = await parseAppleHealthExportFromText(selectedFile.content, (p) => {
        setProgress(p);
      });

      // Save to database
      setProgress({ stage: 'Saving to database', percent: 90 });

      await Promise.all([
        addWorkouts(data.workouts),
        addSleepRecords(data.sleepRecords),
        addWeightEntries(data.weightEntries),
        addHRVReadings(data.hrvReadings),
      ]);

      // Calculate verification totals
      const runs = data.workouts.filter(w => w.type === 'run');
      const totalRunKm = runs.reduce((sum, w) => sum + (w.distance || 0), 0) / 1000;
      const avgSleepHrs = data.sleepRecords.length > 0
        ? data.sleepRecords.reduce((sum, s) => sum + s.duration, 0) / data.sleepRecords.length / 60
        : 0;

      setResult({
        workouts: data.workouts.length,
        runs: runs.length,
        totalRunKm,
        sleep: data.sleepRecords.length,
        avgSleepHrs,
        weight: data.weightEntries.length,
        hrv: data.hrvReadings.length,
      });
      setStatus('success');
    } catch (err) {
      console.error('Error parsing Apple Health export:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.xml')) {
      setStatus('reading');
      setError(null);
      setResult(null);

      try {
        const content = await readFileContent(file);
        setSelectedFile({
          name: file.name,
          size: file.size,
          content,
        });
        setStatus('idle');
      } catch (err) {
        console.error('Error reading file:', err);
        setError('Failed to read file. Try the paste option below, or copy the file to C:\\Users\\YourName\\Downloads first.');
        setStatus('error');
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handlePastedContent = () => {
    if (pastedContent.trim()) {
      const content = pastedContent.trim();
      setSelectedFile({
        name: 'pasted-export.xml',
        size: content.length,
        content,
      });
      setPastedContent('');
      setShowPasteOption(false);
      setError(null);
    }
  };

  const importViaServer = async () => {
    if (!filePath.trim()) return;

    setStatus('parsing');
    setLoading(true, 'Importing Apple Health data...');
    setError(null);

    try {
      // Try server API first (port 3001)
      const importRes = await fetch('http://localhost:3001/api/import-apple-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filePath.trim() }),
      });

      if (!importRes.ok) {
        const errData = await importRes.json();
        throw new Error(errData.error || 'Import failed');
      }

      const importResult = await importRes.json();

      // Fetch the parsed data
      const dataRes = await fetch('http://localhost:3001/api/health-data');
      const data = await dataRes.json();

      // Convert date strings back to Date objects
      const workouts = data.workouts.map((w: Record<string, unknown>) => ({ ...w, date: new Date(w.date as string) }));
      const sleepRecords = data.sleepRecords.map((s: Record<string, unknown>) => ({ ...s, date: new Date(s.date as string) }));
      const weightEntries = data.weightEntries.map((w: Record<string, unknown>) => ({ ...w, date: new Date(w.date as string) }));
      const hrvReadings = data.hrvReadings.map((h: Record<string, unknown>) => ({ ...h, date: new Date(h.date as string) }));

      await Promise.all([
        addWorkouts(workouts),
        addSleepRecords(sleepRecords),
        addWeightEntries(weightEntries),
        addHRVReadings(hrvReadings),
      ]);

      // Calculate verification totals
      const runs = workouts.filter((w: { type: string }) => w.type === 'run');
      const totalRunKm = runs.reduce((sum: number, w: { distance?: number }) => sum + (w.distance || 0), 0) / 1000;
      const avgSleepHrs = sleepRecords.length > 0
        ? sleepRecords.reduce((sum: number, s: { duration: number }) => sum + s.duration, 0) / sleepRecords.length / 60
        : 0;

      setResult({
        workouts: importResult.counts.workouts,
        runs: runs.length,
        totalRunKm,
        sleep: importResult.counts.sleepRecords,
        avgSleepHrs,
        weight: importResult.counts.weightEntries,
        hrv: importResult.counts.hrvReadings,
      });
      setStatus('success');
      setFilePath('');
    } catch (err) {
      console.error('Error importing via server:', err);
      setError(err instanceof Error ? err.message : 'Failed to import. Make sure the server is running (node server.cjs)');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">How to export from Apple Health:</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
          <li>Open the Health app on your iPhone</li>
          <li>Tap your profile picture in the top right</li>
          <li>Scroll down and tap "Export All Health Data"</li>
          <li>Wait for the export to complete (may take a few minutes)</li>
          <li>Unzip the export and upload the <code className="bg-gray-200 px-1 rounded">export.xml</code> file</li>
        </ol>
        <p className="text-xs text-gray-500 mt-3">
          Tip: If you have trouble uploading, use the command-line import below.
        </p>
      </div>

      {/* Server Import Option */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <h4 className="font-medium text-primary-900 mb-2">For large files (recommended):</h4>
        <p className="text-sm text-primary-700 mb-3">
          1. Start the server: <code className="bg-primary-100 px-1 rounded">node server.cjs</code><br />
          2. Enter the file path below and click Import
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="/mnt/c/Users/YourName/Downloads/export.xml"
            className="flex-1 px-3 py-2 border border-primary-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            onClick={importViaServer}
            disabled={status === 'parsing' || !filePath.trim()}
            className="btn bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
          >
            {status === 'parsing' ? 'Importing...' : 'Import'}
          </button>
        </div>
        <p className="text-xs text-primary-600 mt-2">
          Tip: Use WSL path format, e.g., /mnt/c/Users/... for C:\Users\...
        </p>
      </div>

      {/* Upload Area */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors
          ${selectedFile ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}
          ${status === 'parsing' || status === 'reading' ? 'pointer-events-none opacity-75' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml"
          onChange={handleFileSelect}
          className="hidden"
        />

        {status === 'reading' ? (
          <div className="flex flex-col items-center">
            <Loader2 size={48} className="text-primary-500 mb-4 animate-spin" />
            <p className="font-medium text-gray-900">Reading file...</p>
            <p className="text-sm text-gray-500 mt-1">This may take a moment for large files</p>
          </div>
        ) : selectedFile ? (
          <div className="flex flex-col items-center">
            <FileText size={48} className="text-primary-500 mb-4" />
            <p className="font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-sm text-gray-500 mt-1">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
              {' · '}
              Estimated parse time: {estimateParseTime(selectedFile.size)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload size={48} className="text-gray-400 mb-4" />
            <p className="font-medium text-gray-900">Drop your export.xml here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse</p>
          </div>
        )}
      </div>

      {/* Progress */}
      {status === 'parsing' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin text-primary-500" />
            <span className="text-sm text-gray-600">{progress.stage}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Success */}
      {status === 'success' && result && (
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={20} className="text-success-500" />
            <span className="font-medium text-success-700">Import Complete!</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div>
              <p className="text-2xl font-bold text-success-700">{result.workouts}</p>
              <p className="text-sm text-success-600">Workouts</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success-700">{result.runs}</p>
              <p className="text-sm text-success-600">Runs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success-700">{result.totalRunKm.toFixed(1)}</p>
              <p className="text-sm text-success-600">Total Run km</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-success-700">{result.sleep}</p>
              <p className="text-xs text-success-600">Sleep Records</p>
            </div>
            <div>
              <p className="text-xl font-bold text-success-700">{result.avgSleepHrs.toFixed(1)}</p>
              <p className="text-xs text-success-600">Avg hrs/night</p>
            </div>
            <div>
              <p className="text-xl font-bold text-success-700">{result.weight}</p>
              <p className="text-xs text-success-600">Weight</p>
            </div>
            <div>
              <p className="text-xl font-bold text-success-700">{result.hrv}</p>
              <p className="text-xs text-success-600">HRV</p>
            </div>
          </div>
          <p className="text-xs text-success-500 mt-3 text-center">Verify totals match Apple Health app</p>
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-danger-500" />
            <span className="text-danger-700">{error}</span>
          </div>
          {!showPasteOption && (
            <button
              onClick={() => setShowPasteOption(true)}
              className="mt-3 text-sm text-primary-600 hover:text-primary-700 underline"
            >
              Try pasting XML content instead
            </button>
          )}
        </div>
      )}

      {/* Paste Option */}
      {showPasteOption && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Open export.xml in a text editor, copy all content (Ctrl+A, Ctrl+C), and paste below:
          </p>
          <textarea
            value={pastedContent}
            onChange={(e) => setPastedContent(e.target.value)}
            placeholder="Paste XML content here..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg font-mono text-xs resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handlePastedContent}
              disabled={!pastedContent.trim()}
              className="btn btn-primary"
            >
              Use Pasted Content
            </button>
            <button
              onClick={() => {
                setShowPasteOption(false);
                setPastedContent('');
              }}
              className="btn bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && status !== 'parsing' && status !== 'success' && (
        <button
          onClick={handleUpload}
          className="btn btn-primary w-full"
        >
          <Upload size={18} />
          Import Health Data
        </button>
      )}
    </div>
  );
}
