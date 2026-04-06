import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/logActivity";
import { getEmisor } from "@/lib/getEmisor";

// --- CONSTANTS & HELPERS ---
const A4 = { w: 595.28, h: 841.89 };
const YELLOW = rgb(0.75, 0.29, 0.31); // #bf4b50
const BORDER = rgb(0.82, 0.82, 0.82);
const BLACK = rgb(0, 0, 0);

// EMISOR se carga dinámicamente desde company_settings en el handler POST

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function downloadAssetPng(path: string): Promise<Uint8Array> {
    let { data, error } = await supabaseAdmin.storage
        .from("doc-assets")
        .download(path);

    if (error || !data) {
        if (path.includes('/')) {
            const rootPath = path.split('/').pop()!;
            const retry = await supabaseAdmin.storage
                .from("doc-assets")
                .download(rootPath);
            if (!retry.error) {
                data = retry.data;
                error = null;
            }
        }
    }

    if (error || !data) {
        throw new Error(`Error downloading asset ${path}: ${error?.message}`);
    }
    return new Uint8Array(await data.arrayBuffer());
}

function drawYellowBlock(params: {
    page: any;
    x: number;
    yTop: number;
    w: number;
    lineH: number;
    paddingX: number;
    paddingY: number;
    lines: string[];
    font: any;
    size: number;
    color: any;
    bg: any;
}) {
    const { page, x, yTop, w, lineH, paddingX, paddingY, lines, font, size, color, bg } = params;
    const h = paddingY * 2 + lines.length * lineH;
    const y = yTop - h;
    page.drawRectangle({ x, y, width: w, height: h, color: bg, borderColor: BORDER, borderWidth: 1 });
    let ty = yTop - paddingY - size;
    for (const line of lines) {
        page.drawText(line ?? "", { x: x + paddingX, y: +ty + 2, size, font, color });
        ty -= lineH;
    }
    return { h, yBottom: y };
}

async function drawImage(pdfDoc: any, page: any, base64: string, x: number, yTop: number, maxW: number) {
    if (!base64 || !base64.startsWith('data:image')) return yTop;
    try {
        const base64Data = base64.split(',')[1];
        const imageBytes = Buffer.from(base64Data, 'base64');
        const img = base64.includes('png') ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
        const ratio = img.height / img.width;

        // Force scaling to maxW for consistent chart sizes
        const w = maxW;
        const h = w * ratio;

        const y = yTop - h;
        page.drawImage(img, { x, y, width: w, height: h });
        return y - 10;
    } catch (e) {
        console.error("Error drawing image:", e);
        return yTop;
    }
}

export async function POST(req: Request) {
    console.log("[Report] Starting PDF generation...");
    const supabase = await supabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Body inválido" }, { status: 400 });

    const { stats, period, communityName, charts, userPerformance, cronoStats } = body;

    const formatDuration = (totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${h}h ${m}m`;
    };

    // Log report generation
    await logActivity({
        action: 'generate',
        entityType: 'documento',
        entityName: `Reporte Control Gestión - ${communityName || 'Todas'}`,
        details: { period, community: communityName || 'Todas' },
        supabaseClient: supabase
    });

    try {
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([A4.w, A4.h]);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const marginX = 50;
        const contentW = A4.w - marginX * 2;

        // 0) Leer datos del emisor desde BD
        const emisorData = await getEmisor();

        // 1) Logo (Optional) — usa logo de company_settings, fallback al logo por defecto
        let currentY = A4.h - 50;
        try {
            const headerStoragePath = emisorData.headerPath || "certificados/logo-retenciones.png";
            const logoBytes = await downloadAssetPng(headerStoragePath);
            const img = await pdfDoc.embedPng(logoBytes);
            const targetW = A4.w - 20;
            const targetH = (img.height / img.width) * targetW;
            page.drawImage(img, { x: 10, y: A4.h - 10 - targetH, width: targetW, height: targetH });
            currentY = A4.h - 20 - targetH - 30;
            console.log("[Report] Logo added.");
        } catch (e) {
            console.warn("[Report] Logo skip:", e);
        }

        // 2) Header Title
        page.drawText("REPORTE DE CONTROL DE GESTIÓN", { x: marginX, y: currentY, size: 16, font: bold, color: BLACK });
        currentY -= 20;
        page.drawText(`Comunidad: ${communityName || 'Todas'}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 14;
        page.drawText(`Periodo: ${period === 'all' ? 'Todo' : period + ' días'}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 14;
        page.drawText(`Fecha del Informe: ${new Date().toLocaleString()}`, { x: marginX, y: currentY, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
        currentY -= 30;

        // 3) KPIs
        const kpiW = (contentW - 20) / 3;
        const kpiY = currentY;

        const WHITE = rgb(1, 1, 1);
        drawYellowBlock({
            page, x: marginX, yTop: kpiY, w: kpiW, lineH: 18, paddingX: 10, paddingY: 10,
            lines: ["COMUNIDADES", String(communityName || 'Todas')], font: bold, size: 10, color: WHITE, bg: YELLOW
        });

        drawYellowBlock({
            page, x: marginX + kpiW + 10, yTop: kpiY, w: kpiW, lineH: 18, paddingX: 10, paddingY: 10,
            lines: ["INCIDENCIAS", `Pend: ${stats.incidenciasPendientes}   Res: ${stats.incidenciasResueltas}`], font: bold, size: 10, color: WHITE, bg: YELLOW
        });

        drawYellowBlock({
            page, x: marginX + (kpiW + 10) * 2, yTop: kpiY, w: kpiW, lineH: 18, paddingX: 10, paddingY: 10,
            lines: ["DEUDA TOTAL", stats.totalDeuda], font: bold, size: 10, color: WHITE, bg: YELLOW
        });

        currentY -= 80;

        // 4) Charts
        if (charts) {
            console.log("[Report] Drawing charts...");
            if (charts.evolution) {
                page.drawText("Evolución de Incidencias", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.evolution, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.topCommunities) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Comunidades con Más Incidencias", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.topCommunities, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.debtByCommunity) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Deuda por Comunidad", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.debtByCommunity, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (currentY < 300) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

            const diagnosticCharts = [
                { id: 'incidentStatus', label: 'Incidencias', img: charts.incidentStatus },
                { id: 'urgency', label: 'Urgencia', img: charts.urgency },
                { id: 'sentiment', label: 'Sentimiento', img: charts.sentiment },
                { id: 'debtStatus', label: 'Estado Deuda', img: charts.debtStatus }
            ].filter(c => c.img);

            if (diagnosticCharts.length > 0) {
                const gap = 10;
                // Use 4 columns layout to fit all indicators together if they exist
                const chartW = (contentW - (gap * 3)) / 4;
                let minCharY = currentY;

                for (let i = 0; i < diagnosticCharts.length; i++) {
                    const c = diagnosticCharts[i];
                    const x = marginX + (chartW + gap) * i;
                    page.drawText(c.label, { x, y: currentY, size: 10, font: bold });
                    const resY = await drawImage(pdfDoc, page, c.img, x, currentY - 15, chartW);
                    if (resY < minCharY) minCharY = resY;
                }
                currentY = minCharY - 20;
            }
        }

        // 4b) Gráficas nativas de barras (rendimiento por usuario)
        if (userPerformance && userPerformance.length > 0) {
            currentY -= 20;
            if (currentY < 220) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
            page.drawText("Rendimiento por Gestor", { x: marginX, y: currentY, size: 11, font: bold, color: BLACK });
            currentY -= 15;

            const barMaxH = 80;
            const barW = Math.min(40, (contentW - 20) / userPerformance.length - 10);
            const barGap = Math.min(20, (contentW - userPerformance.length * barW) / (userPerformance.length + 1));
            const maxVal = Math.max(...userPerformance.map((u: any) => u.assigned || 0), 1);
            const GREEN = rgb(0, 0.77, 0.62);

            let bx = marginX + barGap;
            for (const u of userPerformance) {
                const assignedH = ((u.assigned || 0) / maxVal) * barMaxH;
                const resolvedH = ((u.resolved || 0) / maxVal) * barMaxH;
                const baseY = currentY - barMaxH;

                // Barra asignadas
                page.drawRectangle({ x: bx, y: baseY, width: barW * 0.45, height: assignedH || 1, color: YELLOW });
                // Barra resueltas
                page.drawRectangle({ x: bx + barW * 0.5, y: baseY, width: barW * 0.45, height: resolvedH || 1, color: GREEN });

                // Etiqueta nombre
                const nameShort = (u.name || 'N/A').split(' ')[0].substring(0, 8);
                page.drawText(nameShort, { x: bx, y: baseY - 12, size: 7, font, color: BLACK });

                bx += barW + barGap;
            }

            // Leyenda
            const legY = currentY - barMaxH - 25;
            page.drawRectangle({ x: marginX, y: legY - 8, width: 10, height: 8, color: YELLOW });
            page.drawText("Asignadas", { x: marginX + 13, y: legY - 7, size: 7, font, color: BLACK });
            page.drawRectangle({ x: marginX + 70, y: legY - 8, width: 10, height: 8, color: GREEN });
            page.drawText("Resueltas", { x: marginX + 83, y: legY - 7, size: 7, font, color: BLACK });

            currentY = legY - 20;
        }

        currentY -= 20;
        if (currentY < 180) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

        // 5) User Performance Table
        if (userPerformance && userPerformance.length > 0) {
            console.log("[Report] Drawing performance table...");
            page.drawText("RENDIMIENTO DEL EQUIPO", { x: marginX, y: currentY, size: 12, font: bold });
            currentY -= 15;

            const colW = { name: 150, ass: 80, res: 80, eff: 80 };
            let x = marginX;

            page.drawRectangle({ x, y: currentY - 20, width: contentW, height: 20, color: YELLOW });
            page.drawText("Usuario", { x: x + 5, y: currentY - 15, size: 9, font: bold, color: WHITE }); x += colW.name;
            page.drawText("Asignadas", { x: x + 5, y: currentY - 15, size: 9, font: bold, color: WHITE }); x += colW.ass;
            page.drawText("Resueltas", { x: x + 5, y: currentY - 15, size: 9, font: bold, color: WHITE }); x += colW.res;
            page.drawText("Eficacia", { x: x + 5, y: currentY - 15, size: 9, font: bold, color: WHITE });

            currentY -= 20;

            for (const u of userPerformance) {
                if (currentY < 50) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                let xx = marginX;
                page.drawText(u.name || "N/A", { x: xx + 5, y: currentY - 15, size: 9, font }); xx += colW.name;
                page.drawText(String(u.assigned || 0), { x: xx + 5, y: currentY - 15, size: 9, font }); xx += colW.ass;
                page.drawText(String(u.resolved || 0), { x: xx + 5, y: currentY - 15, size: 9, font }); xx += colW.res;
                page.drawText(`${u.efficiency || 0}%`, { x: xx + 5, y: currentY - 15, size: 9, font });

                page.drawLine({ start: { x: marginX, y: currentY - 20 }, end: { x: marginX + contentW, y: currentY - 20 }, thickness: 0.5, color: BORDER });
                currentY -= 20;
            }
        }

        // 6) Cronometraje Section
        if (cronoStats) {
            currentY -= 30;
            if (currentY < 250) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }

            page.drawText("RENDIMIENTO DE CRONOMETRAJE", { x: marginX, y: currentY, size: 12, font: bold });
            currentY -= 25;

            const cronoKpiW = (contentW - 20) / 3;
            drawYellowBlock({
                page, x: marginX, yTop: currentY, w: cronoKpiW, lineH: 18, paddingX: 10, paddingY: 10,
                lines: ["TOTAL HORAS", formatDuration(cronoStats.totalSeconds || 0)], font: bold, size: 10, color: WHITE, bg: YELLOW
            });
            drawYellowBlock({
                page, x: marginX + cronoKpiW + 10, yTop: currentY, w: cronoKpiW, lineH: 18, paddingX: 10, paddingY: 10,
                lines: ["TAREAS REALIZADAS", String(cronoStats.totalTasks || 0)], font: bold, size: 10, color: WHITE, bg: YELLOW
            });
            drawYellowBlock({
                page, x: marginX + (cronoKpiW + 10) * 2, yTop: currentY, w: cronoKpiW, lineH: 18, paddingX: 10, paddingY: 10,
                lines: ["MEDIA POR TAREA", formatDuration(cronoStats.avgSeconds || 0)], font: bold, size: 10, color: WHITE, bg: YELLOW
            });
            currentY -= 80;

            // Gráfica nativa: horas por gestor
            const cronoByGestor = body.cronoByGestor || [];
            if (cronoByGestor.length > 0) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Horas por Gestor", { x: marginX, y: currentY, size: 11, font: bold, color: BLACK });
                currentY -= 15;

                const cBarMaxH = 70;
                const cBarW = Math.min(45, (contentW - 20) / cronoByGestor.length - 10);
                const cBarGap = Math.min(20, (contentW - cronoByGestor.length * cBarW) / (cronoByGestor.length + 1));
                const maxSecs = Math.max(...cronoByGestor.map((g: any) => g.seconds || 0), 1);

                let cbx = marginX + cBarGap;
                for (const g of cronoByGestor) {
                    const h = ((g.seconds || 0) / maxSecs) * cBarMaxH;
                    page.drawRectangle({ x: cbx, y: currentY - cBarMaxH, width: cBarW, height: h || 1, color: YELLOW });
                    const label = formatDuration(g.seconds || 0);
                    page.drawText(label, { x: cbx, y: currentY - cBarMaxH - 10, size: 6, font, color: BLACK });
                    const nameShort = (g.name || '').split(' ')[0].substring(0, 8);
                    page.drawText(nameShort, { x: cbx, y: currentY - cBarMaxH - 20, size: 6, font, color: BLACK });
                    cbx += cBarW + cBarGap;
                }
                currentY -= cBarMaxH + 30;
            }

            if (charts.cronoTopCommunities) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Top Comunidades por Tiempo", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.cronoTopCommunities, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.cronoGestor) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Rendimiento por Gestor", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.cronoGestor, marginX, currentY, contentW);
                currentY -= 20;
            }

            if (charts.cronoWeekly) {
                if (currentY < 200) { page = pdfDoc.addPage([A4.w, A4.h]); currentY = A4.h - 50; }
                page.drawText("Evolución Semanal de Horas", { x: marginX, y: currentY, size: 12, font: bold });
                currentY -= 15;
                currentY = await drawImage(pdfDoc, page, charts.cronoWeekly, marginX, currentY, contentW);
                currentY -= 20;
            }
        }

        console.log("[Report] Adding footers...");
        const pages = pdfDoc.getPages();
        const footerText = emisorData.nombre || "Serincosol | Administración de Fincas Málaga";
        const footerSize = 8;
        const footerFont = font;

        for (const p of pages) {
            const { width } = p.getSize();
            const textWidth = footerFont.widthOfTextAtSize(footerText, footerSize);
            p.drawText(footerText, {
                x: width / 2 - textWidth / 2,
                y: 25,
                size: footerSize,
                font: footerFont,
                color: rgb(0.5, 0.5, 0.5),
            });
        }

        console.log("[Report] Saving PDF...");
        const pdfBytes = await pdfDoc.save();

        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        const safeName = (communityName || 'Todas').replace(/[^a-z0-9]/gi, '_');
        const filename = `${dateStr}_Reporte_${safeName}.pdf`;

        return new Response(pdfBytes as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (err: any) {
        console.error("[Report] Final error:", err);
        return NextResponse.json({ error: "Error interno: " + err.message }, { status: 500 });
    }
}
