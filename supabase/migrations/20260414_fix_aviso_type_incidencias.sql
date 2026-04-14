-- Fix aviso column type in incidencias: TEXT → INTEGER
-- aviso encodes: 0=ninguno, 1=whatsapp, 2=email, 3=ambos
ALTER TABLE incidencias
  ALTER COLUMN aviso TYPE INTEGER USING aviso::INTEGER;
