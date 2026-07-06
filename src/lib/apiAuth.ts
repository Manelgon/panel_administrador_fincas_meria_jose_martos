import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseRouteClient } from '@/lib/supabase/route';
import { supabaseAdmin } from '@/lib/supabase/admin';

type AuthOk = { user: User; response: null };
type AuthFail = { user: null; response: NextResponse };
export type AuthResult = AuthOk | AuthFail;

/**
 * Verifica que la peticion viene de un usuario autenticado.
 * Acepta sesion por cookies (fetch same-origin) o header Authorization: Bearer <token>.
 */
export async function requireUser(request?: Request): Promise<AuthResult> {
    const supabase = await supabaseRouteClient();

    const authHeader = request?.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return {
            user: null,
            response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
        };
    }

    return { user, response: null };
}

/**
 * Verifica sesion + rol admin en profiles (consultado server-side con service role,
 * nunca confiando en ids enviados por el cliente).
 */
/** Comprueba en profiles si un user_id tiene rol admin. */
export async function isAdminUser(userId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('user_id', userId)
        .maybeSingle();
    return data?.rol === 'admin';
}

export async function requireAdmin(request?: Request): Promise<AuthResult> {
    const result = await requireUser(request);
    if (!result.user) return result;

    if (!(await isAdminUser(result.user.id))) {
        return {
            user: null,
            response: NextResponse.json({ error: 'Solo administradores' }, { status: 403 }),
        };
    }

    return result;
}
