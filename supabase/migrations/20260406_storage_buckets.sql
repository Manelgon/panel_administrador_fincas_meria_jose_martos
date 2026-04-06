-- ============================================================
-- Storage Buckets: documentos, doc-assets, FACTURAS
-- ============================================================
-- Este archivo consolida la creación y políticas de los 3 buckets
-- usados en la aplicación. Es idempotente (ON CONFLICT DO NOTHING).
-- ============================================================

-- ------------------------------------------------------------
-- 1. BUCKET: documentos (privado)
--    Adjuntos de incidencias, deudas, PDFs generados, documentos
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Leer: solo usuarios autenticados
DROP POLICY IF EXISTS "documentos: authenticated read" ON storage.objects;
CREATE POLICY "documentos: authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documentos');

-- Subir: solo usuarios autenticados
DROP POLICY IF EXISTS "documentos: authenticated upload" ON storage.objects;
CREATE POLICY "documentos: authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

-- Borrar/actualizar: propietario del archivo o admin
DROP POLICY IF EXISTS "documentos: owner or admin modify" ON storage.objects;
CREATE POLICY "documentos: owner or admin modify"
ON storage.objects FOR ALL
TO authenticated
USING (
    bucket_id = 'documentos'
    AND (auth.uid() = owner OR public.is_admin())
)
WITH CHECK (
    bucket_id = 'documentos'
    AND (auth.uid() = owner OR public.is_admin())
);

-- Eliminar policy pública si existe
DROP POLICY IF EXISTS "Public read access" ON storage.objects;


-- ------------------------------------------------------------
-- 2. BUCKET: doc-assets (privado)
--    Logo, sello y assets estáticos para generación de PDFs
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('doc-assets', 'doc-assets', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Leer: solo usuarios autenticados
DROP POLICY IF EXISTS "doc-assets: authenticated read" ON storage.objects;
CREATE POLICY "doc-assets: authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'doc-assets');

-- Subida gestionada desde el Dashboard con service_role (no policy de INSERT pública)


-- ------------------------------------------------------------
-- 3. BUCKET: FACTURAS (privado)
--    Facturas de comunidades subidas desde el módulo de facturas
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('FACTURAS', 'FACTURAS', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Leer: solo usuarios autenticados
DROP POLICY IF EXISTS "FACTURAS: authenticated read" ON storage.objects;
CREATE POLICY "FACTURAS: authenticated read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'FACTURAS');

-- Subir: solo usuarios autenticados
DROP POLICY IF EXISTS "FACTURAS: authenticated upload" ON storage.objects;
CREATE POLICY "FACTURAS: authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'FACTURAS');

-- Borrar: propietario o admin
DROP POLICY IF EXISTS "FACTURAS: owner or admin delete" ON storage.objects;
CREATE POLICY "FACTURAS: owner or admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'FACTURAS'
    AND (auth.uid() = owner OR public.is_admin())
);

-- Eliminar policy pública legada si existe
DROP POLICY IF EXISTS "Public read facturas" ON storage.objects;
