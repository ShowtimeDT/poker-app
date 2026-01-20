import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get('Authorization');

    console.log('[API Proxy] Forwarding room creation request to:', `${API_URL}/api/rooms`);
    console.log('[API Proxy] Has auth header:', !!authHeader);

    const response = await fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('[API Proxy] Room creation response:', data.success ? 'success' : 'failed');

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to server' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('[API Proxy] Forwarding room list request to:', `${API_URL}/api/rooms`);

    const response = await fetch(`${API_URL}/api/rooms`);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to connect to server' },
      { status: 500 }
    );
  }
}
