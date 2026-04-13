-- Tabla principal de reuniones
CREATE TABLE IF NOT EXISTS reuniones (
  id              BIGSERIAL PRIMARY KEY,
  comunidad_id    INTEGER NOT NULL REFERENCES comunidades(id) ON DELETE CASCADE,
  fecha_reunion   DATE NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('JGO', 'JGE', 'JV')),

  -- Campos de proceso (booleanos del Excel "Seg. Juntas")
  estado_cuentas  BOOLEAN NOT NULL DEFAULT FALSE,
  pto_ordinario   BOOLEAN NOT NULL DEFAULT FALSE,
  pto_extra       BOOLEAN NOT NULL DEFAULT FALSE,
  morosos         BOOLEAN NOT NULL DEFAULT FALSE,
  citacion_email  BOOLEAN NOT NULL DEFAULT FALSE,
  citacion_carta  BOOLEAN NOT NULL DEFAULT FALSE,
  redactar_acta   BOOLEAN NOT NULL DEFAULT FALSE,
  vb_pendiente    BOOLEAN NOT NULL DEFAULT FALSE,
  acta_email      BOOLEAN NOT NULL DEFAULT FALSE,
  acta_carta      BOOLEAN NOT NULL DEFAULT FALSE,
  pasar_acuerdos  BOOLEAN NOT NULL DEFAULT FALSE,

  notas           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reuniones_updated_at
  BEFORE UPDATE ON reuniones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Índices para filtros frecuentes
CREATE INDEX IF NOT EXISTS idx_reuniones_comunidad ON reuniones(comunidad_id);
CREATE INDEX IF NOT EXISTS idx_reuniones_fecha ON reuniones(fecha_reunion DESC);
CREATE INDEX IF NOT EXISTS idx_reuniones_tipo ON reuniones(tipo);

-- RLS
ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver reuniones"
  ON reuniones FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden crear reuniones"
  ON reuniones FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuarios autenticados pueden actualizar reuniones"
  ON reuniones FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Solo admin puede eliminar reuniones"
  ON reuniones FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.rol = 'admin'
    )
  );
