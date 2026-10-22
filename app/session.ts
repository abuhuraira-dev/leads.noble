import {cookies} from 'next/headers';
import {checkSession,COOKIE} from '../lib/auth.mjs';
export async function isAuthed(){return checkSession((await cookies()).get(COOKIE)?.value,process.env.SESSION_SECRET)}
