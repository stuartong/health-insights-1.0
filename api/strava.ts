/**
 * Vercel Serverless Function: Strava API Proxy
 *
 * Proxies all requests to Strava's API to avoid CORS issues.
 * URL format: /api/strava?path=/athlete/activities&per_page=30
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
    // Get the path from query parameter
    const apiPath = req.query.path as string;

    // Validate that path is provided
    if (!apiPath) {
      console.error('Missing path parameter. Query:', req.query);
      return res.status(400).json({
        error: 'Missing path parameter',
        query: req.query,
        hint: 'Use format: /api/strava?path=/athlete/activities'
      });
    }

    // Build the full Strava API URL
    const url = new URL(`${STRAVA_API_URL}${apiPath}`);

    // Add other query parameters (except 'path')
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    console.log('Proxying to Strava:', url.toString());

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
      console.error('Strava API error:', response.status, data);
      return res.status(response.status).json({
        ...data,
        _debug: {
          requestedUrl: url.toString(),
          stravaStatus: response.status,
          stravaStatusText: response.statusText,
        }
      });
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
