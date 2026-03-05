/**
 * Vercel Serverless Function: Strava Token Exchange
 *
 * Proxies token requests to Strava's OAuth endpoint to avoid CORS issues.
 * Handles both initial code exchange and token refresh.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { client_id, client_secret, code, refresh_token, grant_type, redirect_uri } = req.body;

    // Build request body based on grant type
    const body: Record<string, string> = {
      client_id,
      client_secret,
      grant_type,
    };

    if (grant_type === 'authorization_code' && code) {
      body.code = code;
      // redirect_uri is required for authorization_code grant
      if (redirect_uri) {
        body.redirect_uri = redirect_uri;
      }
    } else if (grant_type === 'refresh_token' && refresh_token) {
      body.refresh_token = refresh_token;
    }

    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Strava token error:', error);
    return res.status(500).json({
      error: 'Failed to exchange token',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
