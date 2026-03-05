# Health Insights & Coaching App

A privacy-first web app combining Apple Health, Oura Ring, and Strava data to provide AI-powered training, nutrition, and recovery insights.

## Features

- **Data Import**: Apple Health XML export, Oura Ring API, Strava OAuth integration
- **Weight Tracking**: Happy Scale-style exponential smoothing with trend analysis
- **Training Load Management**: ACWR calculation, injury risk assessment, recovery recommendations
- **Performance Benchmarks**: Running PR tracking, race predictions, lifting 1RM estimates, strength standards
- **Nutrition Coaching**: Pre/post workout fueling, macro targets based on training load
- **AI Insights**: Claude-powered personalized coaching and pattern detection
- **Privacy First**: All data stored locally in IndexedDB

## Tech Stack

- React + TypeScript
- Vite
- TailwindCSS
- Zustand (state management)
- Dexie.js (IndexedDB)
- Recharts (visualizations)
- date-fns

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
npm run dev
```

Open http://localhost:3000

### Demo Mode

Enable demo mode in Settings to generate 90 days of sample data for testing without connecting real devices.

## Data Sources

### Apple Health

1. On your iPhone: Health app → Profile → Export All Health Data
2. Unzip the export
3. Upload the `export.xml` file in the Data Import page

### Oura Ring

1. Get a Personal Access Token from https://cloud.ouraring.com/personal-access-tokens
2. Enter the token in Settings → Integrations

### Strava

1. Create an app at https://www.strava.com/settings/api
2. Enter Client ID and Secret in Settings → Integrations
3. Click "Connect" to complete OAuth flow

### Claude API (for AI Insights)

1. Get an API key from https://console.anthropic.com
2. Enter the key in Settings → API Keys

## Key Algorithms

### Exponential Smoothing (Weight Trend)
Smooths daily weight fluctuations to show true trend:
```
smoothed[i] = α × raw[i] + (1 - α) × smoothed[i-1]
```

### ACWR (Acute:Chronic Workload Ratio)
Monitors training load for injury prevention:
- Acute: 7-day rolling sum
- Chronic: 28-day average
- Optimal zone: 0.8 - 1.3

### Race Prediction (Riegel Formula)
Predicts race times from known performances:
```
T2 = T1 × (D2/D1)^1.06
```

### Estimated 1RM (Epley Formula)
Estimates max lift from submaximal effort:
```
1RM = weight × (1 + reps/30)
```

## Project Structure

```
src/
├── algorithms/      # ACWR, smoothing, predictions
├── api/             # Oura, Strava, Claude clients
├── components/      # React components by feature
├── db/              # Dexie IndexedDB setup
├── demo/            # Sample data generator
├── hooks/           # Custom React hooks
├── parsers/         # Apple Health XML parser
├── stores/          # Zustand state management
├── types/           # TypeScript interfaces
└── utils/           # Formatters, date helpers
```

## License

MIT
