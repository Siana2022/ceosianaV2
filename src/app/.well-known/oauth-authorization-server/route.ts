import { NextResponse } from 'next/server'

export async function GET() {
  const base = 'https://ceosiana-v2.vercel.app'
  return NextResponse.json({
    issuer: base,
    authorization_endpoint: `${base}/api/mcp/authorize`,
    token_endpoint: `${base}/api/mcp/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256', 'plain'],
    registration_endpoint: `${base}/api/mcp/register`,
  })
}
