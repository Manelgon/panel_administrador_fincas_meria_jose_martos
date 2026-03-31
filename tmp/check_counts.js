
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dxpufxpzplkltljhevug.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cHVmeHB6cGxrbHRsamhldnVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODIwMjgyNiwiZXhwIjoyMDgzNzc4ODI2fQ.79CrJ_5oov9alN2q1MVO03UzX31i-MkLWUSi-r3Lu1k';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    console.log('--- LOCAL TICKET COUNTS ---');
    
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

    // Check if any Aplazado has resuelto: true
    const { count: aplazadasResueltas } = await supabase.from('incidencias').select('*', { count: 'exact', head: true }).eq('estado', 'Aplazado').eq('resuelto', true);
    console.log(`Aplazadas with resuelto: true: ${aplazadasResueltas}`);
}

checkCounts();
