#!/usr/bin/env node

/**
 * Simple server for Health Insights app
 * Handles large Apple Health file uploads via streaming
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PORT = 3001;
const DIST_DIR = path.join(__dirname, 'dist');

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Health data storage
let healthData = {
  workouts: [],
  sleepRecords: [],
  weightEntries: [],
  hrvReadings: [],
};

function parseAppleDate(dateStr) {
  if (!dateStr) return new Date();
  return new Date(dateStr.replace(' ', 'T').replace(' ', ''));
}

function mapWorkoutType(appleType) {
  const typeMap = {
    HKWorkoutActivityTypeRunning: 'run',
    HKWorkoutActivityTypeCycling: 'cycle',
    HKWorkoutActivityTypeSwimming: 'swim',
    HKWorkoutActivityTypeTraditionalStrengthTraining: 'strength',
    HKWorkoutActivityTypeFunctionalStrengthTraining: 'strength',
    HKWorkoutActivityTypeWalking: 'walk',
    HKWorkoutActivityTypeHiking: 'hike',
  };
  return typeMap[appleType] || 'other';
}

function parseAttributes(str) {
  const attrs = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

async function parseAppleHealthStream(filePath) {
  const workouts = [];
  const sleepRecords = [];
  const weightEntries = [];
  const hrvReadings = [];
  const sleepMap = new Map();

  let idCounter = 0;
  const generateId = () => `ah_${Date.now()}_${++idCounter}`;

  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let buffer = '';

    rl.on('line', (line) => {
      buffer += line;

      if (buffer.includes('/>') || buffer.includes('</')) {
        // Process Workout elements
        if (buffer.includes('<Workout ')) {
          const attrs = parseAttributes(buffer);
          if (attrs.workoutActivityType) {
            workouts.push({
              id: generateId(),
              source: 'apple_health',
              type: mapWorkoutType(attrs.workoutActivityType),
              name: attrs.workoutActivityType.replace('HKWorkoutActivityType', ''),
              date: parseAppleDate(attrs.startDate),
              duration: parseFloat(attrs.duration) || 0,
              distance: attrs.totalDistance ? parseFloat(attrs.totalDistance) * 1000 : undefined,
              calories: attrs.totalEnergyBurned ? parseFloat(attrs.totalEnergyBurned) : undefined,
            });
          }
        }
        // Process Record elements
        else if (buffer.includes('<Record ')) {
          const attrs = parseAttributes(buffer);
          const type = attrs.type;

          if (type === 'HKQuantityTypeIdentifierBodyMass') {
            const value = parseFloat(attrs.value || '0');
            if (value > 0) {
              weightEntries.push({
                id: generateId(),
                source: 'apple_health',
                date: parseAppleDate(attrs.startDate),
                weight: value,
              });
            }
          }
          else if (type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
            const value = parseFloat(attrs.value || '0');
            if (value > 0) {
              hrvReadings.push({
                id: generateId(),
                source: 'apple_health',
                date: parseAppleDate(attrs.startDate),
                value,
              });
            }
          }
          else if (type === 'HKCategoryTypeIdentifierSleepAnalysis') {
            const date = parseAppleDate(attrs.startDate);
            const sleepDateKey = date.toISOString().split('T')[0];

            if (!sleepMap.has(sleepDateKey)) {
              sleepMap.set(sleepDateKey, {
                id: generateId(),
                source: 'apple_health',
                date,
                duration: 0,
                deepSleep: 0,
                remSleep: 0,
                lightSleep: 0,
                awake: 0,
              });
            }

            const sleepRecord = sleepMap.get(sleepDateKey);
            const endDate = attrs.endDate ? parseAppleDate(attrs.endDate) : date;
            const durationMins = (endDate.getTime() - date.getTime()) / 1000 / 60;

            const sleepValue = attrs.value || '';
            if (sleepValue.includes('Asleep') || sleepValue.includes('Core') || sleepValue.includes('Deep') || sleepValue.includes('REM')) {
              sleepRecord.duration += durationMins;
              if (sleepValue.includes('Deep')) {
                sleepRecord.deepSleep += durationMins;
              } else if (sleepValue.includes('REM')) {
                sleepRecord.remSleep += durationMins;
              } else {
                sleepRecord.lightSleep += durationMins;
              }
            } else if (sleepValue.includes('Awake')) {
              sleepRecord.awake += durationMins;
            }
          }
        }
        buffer = '';
      }
    });

    rl.on('close', () => {
      // Finalize sleep records
      for (const sleep of sleepMap.values()) {
        if (sleep.duration > 0) {
          const totalInBed = sleep.duration + sleep.awake;
          sleep.efficiency = totalInBed > 0 ? (sleep.duration / totalInBed) * 100 : undefined;
          sleepRecords.push(sleep);
        }
      }

      resolve({
        workouts: workouts.sort((a, b) => new Date(b.date) - new Date(a.date)),
        sleepRecords: sleepRecords.sort((a, b) => new Date(b.date) - new Date(a.date)),
        weightEntries: weightEntries.sort((a, b) => new Date(b.date) - new Date(a.date)),
        hrvReadings: hrvReadings.sort((a, b) => new Date(b.date) - new Date(a.date)),
      });
    });

    rl.on('error', reject);
    fileStream.on('error', reject);
  });
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: Import from file path
  if (req.method === 'POST' && req.url === '/api/import-apple-health') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { filePath } = JSON.parse(body);

        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
          return;
        }

        console.log(`Parsing: ${filePath}`);
        const data = await parseAppleHealthStream(filePath);
        healthData = data;

        console.log(`Found: ${data.workouts.length} workouts, ${data.weightEntries.length} weight entries`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          counts: {
            workouts: data.workouts.length,
            sleepRecords: data.sleepRecords.length,
            weightEntries: data.weightEntries.length,
            hrvReadings: data.hrvReadings.length,
          }
        }));
      } catch (err) {
        console.error('Parse error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API: Get imported data
  if (req.method === 'GET' && req.url === '/api/health-data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthData));
    return;
  }

  // Proxy: Oura API (to avoid CORS)
  if (req.url.startsWith('/api/oura/')) {
    const ouraPath = req.url.replace('/api/oura', '');
    const token = req.headers['authorization'];

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing authorization header' }));
      return;
    }

    const options = {
      hostname: 'api.ouraring.com',
      port: 443,
      path: `/v2/usercollection${ouraPath}`,
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Oura proxy error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to connect to Oura API' }));
    });

    proxyReq.end();
    return;
  }

  // Proxy: Strava token exchange
  if (req.method === 'POST' && req.url === '/api/strava-token') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const options = {
        hostname: 'www.strava.com',
        port: 443,
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', chunk => data += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(data);
        });
      });

      proxyReq.on('error', (err) => {
        console.error('Strava token error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to exchange token' }));
      });

      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // Proxy: Strava API (to avoid CORS)
  if (req.url.startsWith('/api/strava/')) {
    const stravaPath = req.url.replace('/api/strava', '');
    const token = req.headers['authorization'];

    const options = {
      hostname: 'www.strava.com',
      port: 443,
      path: `/api/v3${stravaPath}`,
      method: req.method,
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Strava proxy error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to connect to Strava API' }));
    });

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => proxyReq.end(body));
    } else {
      proxyReq.end();
    }
    return;
  }

  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(DIST_DIR, filePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveStatic(res, filePath);
  } else {
    // SPA fallback
    serveStatic(res, path.join(DIST_DIR, 'index.html'));
  }
});

server.listen(PORT, () => {
  console.log(`Health Insights server running at http://localhost:${PORT}`);
  console.log('');
  console.log('The app can now import large Apple Health files directly.');
});
