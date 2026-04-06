'use server';

import { getEmisor } from "@/lib/getEmisor";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function fetchEmisorName(): Promise<string> {
    const emisor = await getEmisor();
    return emisor.nombre;
}

export async function fetchEmisorData(): Promise<{ nombre: string; logoUrl: string }> {
    const emisor = await getEmisor();
    let logoUrl = "";
    if (emisor.logoPath) {
        const { data } = await supabaseAdmin.storage
            .from("doc-assets")
            .createSignedUrl(emisor.logoPath, 3600);
        logoUrl = data?.signedUrl || "";
    }
    return { nombre: emisor.nombre, logoUrl };
}
