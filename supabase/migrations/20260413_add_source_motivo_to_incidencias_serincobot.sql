ALTER TABLE public.incidencias_serincobot
  ADD COLUMN IF NOT EXISTS source       text CHECK (source IN ('visita comunidad','whatsapp','llamada','email','tratar proxima junta')),
  ADD COLUMN IF NOT EXISTS motivo_ticket text;
