'use server';

import { getEmisor } from "@/lib/getEmisor";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function fetchEmisorName(): Promise<string> {
    const emisor = await getEmisor();
    return emisor.nombre;
}

export async function fetchEmisorLogoUrl(): Promise<string> {
    const emisor = await getEmisor();
    if (!emisor.logoPath) return "";
    const { data } = await supabaseAdmin.storage
        .from("doc-assets")
        .createSignedUrl(emisor.logoPath, 3600);
    return data?.signedUrl || "";
}
