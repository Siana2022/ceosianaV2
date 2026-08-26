import { NextRequest, NextResponse } from 'next/server'

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

// Dynamic Client Registration (RFC 7591)
// Claude.ai calls this to register itself as an OAuth client automatically.
export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>

  // Accept any client and return a static client_id
  const clientId = `ceosiana-client-${Date.now()}`

  return cors(NextResponse.json({
    client_id: clientId,
    client_secret: 'ceosiana-secret',
    redirect_uris: body.redirect_uris ?? [],
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, { status: 201 }))
}
