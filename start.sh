#!/bin/bash
cd "$(dirname "$0")"

# Start dev server in background if not running
if ! pgrep -f "vite.*health-insights" > /dev/null; then
    echo "Starting dev server..."
    npm run dev &
    sleep 3
fi

# Open in Windows browser
echo "Opening http://localhost:3000 in browser..."
cmd.exe /c start http://localhost:3000 2>/dev/null

echo "Health Insights app is running at http://localhost:3000"
echo "Press Ctrl+C to stop the server"
wait
