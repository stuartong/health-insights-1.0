/**
 * Vercel Serverless Function: Oura API Proxy
 *
 * Proxies requests to Oura's API to avoid CORS issues.
 * URL format: /api/oura?path=/sleep&start_date=2024-01-01&end_date=2024-01-31
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const OURA_API_URL = 'https://api.ouraring.com/v2/usercollection';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the path from query parameter
    const apiPath = req.query.path as string;

    if (!apiPath) {
      return res.status(400).json({
        error: 'Missing path parameter',
        hint: 'Use format: /api/oura?path=/sleep&start_date=...'
      });
    }

    // Build the full Oura API URL
    const url = new URL(`${OURA_API_URL}${apiPath}`);

    // Add other query parameters (except 'path')
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'path' && value) {
        url.searchParams.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    console.log('Proxying to Oura:', url.toString());

    // Get authorization header from request
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing Authorization header' });
    }

    // Forward the request to Oura
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Oura API error:', response.status, data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Oura API proxy error:', error);
    return res.status(500).json({
      error: 'Failed to proxy request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
