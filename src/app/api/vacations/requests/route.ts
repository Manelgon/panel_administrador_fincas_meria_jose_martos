import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser, isAdminUser } from '@/lib/apiAuth';

export async function GET(request: Request) {
    const auth = await requireUser(request);
    if (!auth.user) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || auth.user.id;

        // Solo puedes ver tus propias solicitudes, salvo que seas admin
        if (userId !== auth.user.id && !(await isAdminUser(auth.user.id))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('vacation_requests')
            .select('*')
            .eq('user_id', userId)
            .order('date_from', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const auth = await requireUser(request);
    if (!auth.user) return auth.response;

    try {
        const body = await request.json();
        const { type, dateFrom, dateTo, daysCount, commentUser } = body;
        // Las solicitudes siempre se crean a nombre del usuario autenticado
        const userId = auth.user.id;

        if (!type || !dateFrom || !dateTo || !daysCount) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // 1) Overlap Check
        // Use inclusive range logic: LTE dateTo AND GTE dateFrom
        const { data: overlap, error: overlapError } = await supabaseAdmin
            .from('vacation_requests')
            .select('id')
            .eq('user_id', userId)
            .in('status', ['PENDIENTE', 'APROBADA'])
            .lte('date_from', dateTo)
            .gte('date_to', dateFrom)
            .limit(1);

        if (overlapError) throw overlapError;
        if (overlap && overlap.length > 0) {
            return NextResponse.json({ error: 'Ya tienes una solicitud pendiente o aprobada para esas fechas.' }, { status: 409 });
        }

        // 2) Balance Check
        const year = new Date(dateFrom).getFullYear();
        const { data: balance, error: balanceError } = await supabaseAdmin
            .from('vacation_balances')
            .select('*')
            .eq('user_id', userId)
            .eq('year', year)
            .maybeSingle();

        if (balanceError) throw balanceError;
        if (!balance) return NextResponse.json({ error: 'No se encontró bolsa de días para este año.' }, { status: 400 });

        let available = 0;
        if (type === 'VACACIONES') available = balance.vacaciones_total - balance.vacaciones_usados;
        else if (type === 'RETRIBUIDO') available = balance.retribuidos_total - balance.retribuidos_usados;
        else available = 999; // NO_RETRIBUIDO usually has no hard limit

        // Also subtract other PENDING requests days
        const { data: pending } = await supabaseAdmin
            .from('vacation_requests')
            .select('days_count')
            .eq('user_id', userId)
            .eq('type', type)
            .eq('status', 'PENDIENTE');

        const reserved = pending?.reduce((acc, curr) => acc + Number(curr.days_count), 0) || 0;

        if (type !== 'NO_RETRIBUIDO' && (available - reserved) < daysCount) {
            return NextResponse.json({ error: `No tienes suficientes días disponibles (${available - reserved} restantes).` }, {
                status:
                    400
            });
        }

        // 3) Create Request
        const { data, error } = await supabaseAdmin
            .from('vacation_requests')
            .insert({
                user_id: userId,
                type,
                date_from: dateFrom,
                date_to: dateTo,
                days_count: daysCount,
                comment_user: commentUser,
                status: 'PENDIENTE'
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Submit vacation error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
