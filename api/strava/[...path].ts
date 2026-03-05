/**
 * Vercel Serverless Function: Strava API Proxy
 *
 * Proxies all requests to Strava's API to avoid CORS issues.
 * Passes through the Authorization header for authenticated requests.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const STRAVA_API_URL = 'https://www.strava.com/api/v3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the path from the catch-all route
    const { path } = req.query;
    const apiPath = Array.isArray(path) ? path.join('/') : path || '';

    // Build the full Strava API URL with query params
    const url = new URL(`${STRAVA_API_URL}/${apiPath}`);

    // Add query parameters (except 'path' which is our routing param)
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    // Forward the request to Strava
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.authorization && { Authorization: req.headers.authorization as string }),
      },
      ...(req.method !== 'GET' && req.body && { body: JSON.stringify(req.body) }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Strava API proxy error:', error);
    return res.status(500).json({
      error: 'Failed to proxy request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
