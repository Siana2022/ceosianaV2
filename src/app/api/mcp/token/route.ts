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

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? ''
  let grantType: string | null = null

  if (contentType.includes('application/json')) {
    const body = await req.json() as Record<string, string>
    grantType = body.grant_type ?? null
  } else {
    const body = await req.formData()
    grantType = body.get('grant_type') as string | null
  }

  if (grantType !== 'authorization_code') {
    return cors(NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 }))
  }

  const token = process.env.CEOSIANA_MCP_KEY ?? 'ceosiana-mcp-siana'

  return cors(NextResponse.json({
    access_token: token,
    token_type: 'Bearer',
    expires_in: 31536000,
  }))
}
