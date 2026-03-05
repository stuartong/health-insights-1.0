#!/usr/bin/env node

/**
 * CLI tool to import Apple Health export.xml files
 * Uses streaming for large files (500MB+)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const workouts = [];
const sleepRecords = [];
const weightEntries = [];
const hrvReadings = [];
const sleepMap = new Map();

let idCounter = 0;
const generateId = () => `ah_${Date.now()}_${++idCounter}`;

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

function processLine(line) {
  // Process Workout elements
  if (line.includes('<Workout ')) {
    const attrs = parseAttributes(line);
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
  else if (line.includes('<Record ')) {
    const attrs = parseAttributes(line);
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
}

async function processFile(inputFile) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(inputFile, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineCount = 0;
    let buffer = '';

    rl.on('line', (line) => {
      lineCount++;

      // Handle lines that might be split across multiple lines
      buffer += line;

      // Process complete elements
      if (buffer.includes('/>') || buffer.includes('</')) {
        processLine(buffer);
        buffer = '';
      }

      if (lineCount % 100000 === 0) {
        process.stdout.write(`\rProcessed ${(lineCount / 1000000).toFixed(1)}M lines...`);
      }
    });

    rl.on('close', () => {
      console.log(`\rProcessed ${lineCount.toLocaleString()} lines total.`);
      resolve();
    });

    rl.on('error', reject);
    fileStream.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node scripts/import-apple-health.cjs <path-to-export.xml>');
    console.log('');
    console.log('Example:');
    console.log('  node scripts/import-apple-health.cjs "/mnt/c/Users/Admin/Downloads/export.xml"');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = path.join(__dirname, '..', 'public', 'imported-health-data.json');

  console.log(`Reading: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputFile);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  console.log('Parsing with streaming (this may take a few minutes)...\n');

  await processFile(inputFile);

  // Finalize sleep records
  for (const sleep of sleepMap.values()) {
    if (sleep.duration > 0) {
      const totalInBed = sleep.duration + sleep.awake;
      sleep.efficiency = totalInBed > 0 ? (sleep.duration / totalInBed) * 100 : undefined;
      sleepRecords.push(sleep);
    }
  }

  // Sort by date descending
  workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
  sleepRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
  weightEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
  hrvReadings.sort((a, b) => new Date(b.date) - new Date(a.date));

  console.log(`\nFound:`);
  console.log(`  - ${workouts.length} workouts`);
  console.log(`  - ${sleepRecords.length} sleep records`);
  console.log(`  - ${weightEntries.length} weight entries`);
  console.log(`  - ${hrvReadings.length} HRV readings`);

  // Ensure public directory exists
  const publicDir = path.dirname(outputFile);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const data = { workouts, sleepRecords, weightEntries, hrvReadings };
  fs.writeFileSync(outputFile, JSON.stringify(data));

  const outputStats = fs.statSync(outputFile);
  console.log(`\nSaved to: ${outputFile} (${(outputStats.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log('\nNow open the app and click "Load Imported Data"');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
