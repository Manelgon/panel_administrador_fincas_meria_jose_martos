-- Fix CHECK constraint on source column to match actual form values
ALTER TABLE public.incidencias
  DROP CONSTRAINT IF EXISTS incidencias_source_check;

ALTER TABLE public.incidencias
  ADD CONSTRAINT incidencias_source_check
  CHECK (source IN ('Llamada', 'Presencial', 'Email', 'Whatsapp', 'WhatsApp', 'App 360', 'Acuerdo Junta', 'Gestión Interna'));
