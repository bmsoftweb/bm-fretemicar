import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../../../lib/session.js';
import { cookies } from '../../../server/next-headers.js';

export async function GET(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  
  if (!session.isLoggedIn) {
    return NextResponse.json({ isLoggedIn: false }, { status: 401 });
  }

  return NextResponse.json(session);
}
