import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractCode(name: string): string | null {
    const match = name?.match(/^(\d+)/);
    return match ? match[1] : null;
}

function stripCodePrefix(name: string): string {
    return name?.replace(/^\d+\s*[-–]?\s*/, '').trim() || '';
}

export async function GET() {
    try {
        const [foldersResponse, { data: comunidades }] = await Promise.all([
            fetch(process.env.ONEDRIVE_FOLDERS_WEBHOOK!, { method: 'GET' }),
            supabaseAdmin.from('comunidades').select('id, nombre_cdad, codigo'),
        ]);

        if (!foldersResponse.ok) {
            throw new Error('Failed to fetch folders from n8n');
        }

        const folders: { id: string; name?: string; displayName?: string }[] = await foldersResponse.json();

        if (!comunidades || comunidades.length === 0) {
            return NextResponse.json(folders);
        }

        // Build lookup sets for fast matching
        const codigoSet = new Set(
            comunidades.flatMap(c => {
                if (!c.codigo) return [];
                const num = parseInt(c.codigo, 10).toString();
                return [c.codigo, num];
            })
        );
        const nombreSet = new Set(comunidades.map(c => c.nombre_cdad?.toLowerCase()));

        const matched = folders.filter(folder => {
            const rawName = folder.displayName || folder.name || '';

            // Pass 1: numeric code prefix
            const code = extractCode(rawName);
            if (code) {
                const codeInt = parseInt(code, 10).toString();
                if (codigoSet.has(code) || codigoSet.has(codeInt)) return true;
            }

            // Pass 2: exact name
            if (nombreSet.has(rawName.toLowerCase())) return true;

            // Pass 3: partial name (strip code prefix)
            const nameWithoutCode = stripCodePrefix(rawName).toLowerCase();
            if (nameWithoutCode.length > 2) {
                return comunidades.some(c =>
                    c.nombre_cdad?.toLowerCase().includes(nameWithoutCode) ||
                    nameWithoutCode.includes((c.nombre_cdad || '').toLowerCase())
                );
            }

            return false;
        });

        return NextResponse.json(matched);
    } catch (error) {
        console.error('Error fetching folders:', error);
        return NextResponse.json({ error: 'Error fetching folders' }, { status: 500 });
    }
}
