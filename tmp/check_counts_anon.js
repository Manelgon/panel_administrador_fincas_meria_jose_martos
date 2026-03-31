
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dxpufxpzplkltljhevug.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cHVmeHB6cGxrbHRsamhldnVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMDI4MjYsImV4cCI6MjA4Mzc3ODgyNn0.XTQCulgGrTeQVybSXo-kxWC_eabteutDj-1rzeUsPRk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('--- ANON TICKET COUNTS ---');
    
    // Total resuelto = false
    const { count: totalActive } = await supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('resuelto', false);
    console.log(`Total active (resuelto: false): ${totalActive}`);

    // Breakdown by estado
    const { data: activeIncidencias } = await supabase.from('incidencias').select('estado').eq('resuelto', false);
    const counts = {};
    if (activeIncidencias) {
        activeIncidencias.forEach(i => {
            const estado = i.estado || 'null';
            counts[estado] = (counts[estado] || 0) + 1;
        });
    }
    console.log('Breakdown by estado (where resuelto: false):', counts);
}

checkCounts();
