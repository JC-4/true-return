import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    nextAuthUrl: process.env.NEXTAUTH_URL,
    hasSecret: !!process.env.NEXTAUTH_SECRET,
    secretLength: process.env.NEXTAUTH_SECRET?.length,
    nodeEnv: process.env.NODE_ENV,
  })
}
