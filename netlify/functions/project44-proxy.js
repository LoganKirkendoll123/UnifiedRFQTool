const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Set CORS headers to allow all origins
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Cross-Origin-Embedder-Policy': 'credentialless'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/project44-proxy', '');
    const url = `https://na12.api.project44.com${path}`;
    
    // Forward the request to Project44
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': event.headers.authorization,
        'Accept': 'application/json'
      },
      body: event.body
    });

    const responseText = await response.text();
    
    return {
      statusCode: response.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: responseText
    };
  } catch (error) {
    console.error('Error proxying to Project44:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to proxy request to Project44' })
    };
  }
};