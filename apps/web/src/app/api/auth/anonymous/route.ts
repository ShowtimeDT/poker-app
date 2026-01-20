import { NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';

export async function POST() {
  try {
    console.log('[API Proxy] Forwarding anonymous auth request to:', `${API_URL}/api/auth/anonymous`);

    // Don't send Content-Type for empty body requests
    const response = await fetch(`${API_URL}/api/auth/anonymous`, {
      method: 'POST',
    });

    const data = await response.json();
    console.log('[API Proxy] Auth response:', data.success ? 'success' : 'failed');

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to server' },
      { status: 500 }
    );
  }
}
