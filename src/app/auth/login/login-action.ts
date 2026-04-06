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
    // Descargar el archivo y devolverlo como data URL para que funcione sin sesión
    const { data, error } = await supabaseAdmin.storage
        .from("doc-assets")
        .download(emisor.logoPath);
    if (error || !data) return "";
    const buffer = Buffer.from(await data.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mimeType = data.type || "image/png";
    return `data:${mimeType};base64,${base64}`;
}

export async function fetchEmisorData(): Promise<{ nombre: string; logoPath: string }> {
    const emisor = await getEmisor();
    return { nombre: emisor.nombre, logoPath: emisor.logoPath };
}
