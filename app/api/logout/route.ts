import { NextRequest, NextResponse } from '../../../server/next-server.js';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '../../../lib/session.js';
import { cookies } from '../../../server/next-headers.js';

export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  return NextResponse.json({ success: true });
}
