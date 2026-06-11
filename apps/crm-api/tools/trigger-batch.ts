export { };

const BASE_URL = 'http://localhost:8000/api';

async function run() {
  try {
    // 1. Grab the date parameter from the command line argument
    // process.argv[2] captures the first argument passed after the file name
    const passedDate = process.argv[2];

    // Fallback to today's date if no parameter is provided
    const targetDate = passedDate || new Date().toISOString().split('T')[0];

    // Simple validation check to ensure it looks like YYYY-MM-DD
    if (passedDate && !/^\d{4}-\d{2}-\d{2}$/.test(passedDate)) {
      throw new Error(
        `Invalid date format: "${passedDate}". Please use YYYY-MM-DD.`,
      );
    }

    const email = process.env.BATCH_ADMIN_EMAIL;
    const password = process.env.BATCH_ADMIN_PASSWORD;

    if (!email || !password) {
      throw new Error('Missing BATCH_ADMIN_EMAIL or BATCH_ADMIN_PASSWORD environment variables.');
    }

    // 2. Authenticate and get the token
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

    // 3. Trigger the daily batch using the target date
    console.log(`Triggering batch for target date: ${targetDate}...`);

    const batchRes = await fetch(`${BASE_URL}/scoring/trigger-daily-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetDate: targetDate }), // Uses our validated date variable
    });

    const batchData = await batchRes.json();
    console.log('Batch Response:', batchData);
  } catch (error: any) {
    console.error('Error executing batch sequence:', error.message);
  }
}

run();
