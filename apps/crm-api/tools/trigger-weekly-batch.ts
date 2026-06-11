export { };

const BASE_URL = 'http://localhost:8000/api';

async function run() {
  try {
    const email = process.env.BATCH_ADMIN_EMAIL;
    const password = process.env.BATCH_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('Missing BATCH_ADMIN_EMAIL or BATCH_ADMIN_PASSWORD environment variables.');
    }

    // 1. Authenticate and get the token
    console.log('Logging in...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginRes.json();
    const token = loginData.token || loginData.accessToken;
    if (!token) {
      throw new Error('Failed to retrieve token from login response.');
    }
    console.log('Login successful. Token acquired.');

    // 2. Trigger the weekly batch
    console.log('Triggering weekly batch...');

    // Optional: If your weekly batch ever needs a target date parameter from the CLI,
    // you can pass `process.argv[2]` here just like the daily batch.
    const bodyPayload = process.argv[2]
      ? JSON.stringify({ targetDate: process.argv[2] })
      : undefined;

    const batchRes = await fetch(`${BASE_URL}/scoring/trigger-weekly-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: bodyPayload,
    });

    const batchData = await batchRes.json();
    console.log('Weekly Batch Response:', batchData);
  } catch (error: any) {
    console.error('Error executing weekly batch sequence:', error.message);
  }
}

run();
