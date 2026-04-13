# PRP-002: Administración de Reuniones

> **Estado**: PENDIENTE
> **Fecha**: 2026-04-13
> **Proyecto**: Panel Gestión de Fincas

---

## Objetivo

Crear el módulo "Administración de Reuniones" (`/dashboard/reuniones`) que replica la hoja "Seg. Juntas" del Excel de gestión, permitiendo registrar, consultar y actualizar el estado de juntas de comunidades (JGO, JGE, JV) con todos sus campos de seguimiento, y generar documentos "Acuerdo" y "Visto Bueno Presidente" directamente desde la tabla.

## Por Qué

| Problema | Solución |
|----------|----------|
| El seguimiento de juntas se hace en Excel manual, sin trazabilidad ni historial centralizado | Módulo en BD con registro de todas las juntas y su estado en tiempo real |
| No hay visibilidad de qué pasos del proceso de junta están pendientes por comunidad | Tabla de estado con checkboxes visuales por cada etapa del flujo |
| Generar el acta o el visto bueno implica redactar manualmente | Botones de acción "Pasar Acuerdo" y "Redactar Visto Bueno Presidente" que disparan generación de documentos |
| No hay diferenciación entre juntas pasadas y futuras ni filtro por tipo | Tabla con filtros por tipo (JGO/JGE/JV), comunidad y estado de completitud |

**Valor de negocio**: Elimina el Excel manual de seguimiento, centraliza el estado de todas las juntas, y permite a Maria Jose gestionar el ciclo completo de una junta desde el panel sin salir de la aplicación.

## Qué

### Criterios de Éxito
- [ ] Nueva entrada "Reuniones" visible en el sidebar bajo la sección "GESTIÓN"
- [ ] Tabla lista todas las reuniones con columnas: Comunidad, Fecha, Tipo, y estado visual (badges/checks) para cada etapa
- [ ] Modal "Nueva Reunión" con todos los campos del Excel hasta "Pasar Acuerdos" (columnas A-N)
- [ ] Todos los campos booleanos (columnas D-N) son toggles/checkboxes editables directamente en la tabla o en el modal de detalle
- [ ] Botón "Pasar Acuerdo" por fila abre un modal con texto generado (o navegación a generación de documento)
- [ ] Botón "Redactar Visto Bueno Presidente" por fila abre modal similar
- [ ] Filtros funcionales: por tipo de junta, por comunidad, por año
- [ ] `npm run typecheck` y `npm run build` pasan sin errores
- [ ] RLS activo en la tabla `reuniones`

### Comportamiento Esperado (Happy Path)

1. El usuario navega a "Reuniones" en el sidebar
2. Ve la tabla con todas las reuniones ordenadas por fecha descendente (más recientes primero)
3. Puede filtrar por tipo (JGO / JGE / JV), por comunidad y por año
4. Hace clic en "+ Nueva Reunión" — se abre un modal con formulario
5. Selecciona comunidad (selector con búsqueda), fecha, tipo de junta, y rellena los campos del proceso
6. Guarda → la reunión aparece en la tabla
7. En la tabla, puede hacer clic en cualquier checkbox/toggle de estado para actualizar directamente (guardado inmediato)
8. Puede hacer clic en el icono de edición de una fila para abrir el modal de detalle completo
9. En una reunión completada, el botón "Pasar Acuerdo" abre un modal que muestra el texto del acuerdo (a definir en Fase 4) y permite copiar o descargar
10. El botón "Redactar Visto Bueno Presidente" abre un modal similar con el texto de visto bueno

---

## Contexto

### Columnas del Excel "Seg. Juntas" (hoja completa, fila 1 = cabeceras)

| Col | Nombre Excel | Tipo | Campo BD |
|-----|-------------|------|----------|
| A | COMUNIDAD | Relación FK | `comunidad_id` (FK → comunidades.id) |
| B | FECHA REUNIÓN | Fecha | `fecha_reunion` DATE |
| C | TIPO | Enum | `tipo` TEXT CHECK IN ('JGO','JGE','JV') |
| D | ESTADO DE CUENTAS | Booleano | `estado_cuentas` BOOLEAN |
| E | PTO. ORDINARIO | Booleano | `pto_ordinario` BOOLEAN |
| F | PTO. EXTRA | Booleano | `pto_extra` BOOLEAN |
| G | MOROSOS | Booleano | `morosos` BOOLEAN |
| H | CITACIÓN @ | Booleano | `citacion_email` BOOLEAN |
| I | CIT. CARTA | Booleano | `citacion_carta` BOOLEAN |
| J | REDACTAR ACTA | Booleano | `redactar_acta` BOOLEAN |
| K | Vº Bº PDT. | Booleano | `vb_pendiente` BOOLEAN |
| L | ACTA @ | Booleano | `acta_email` BOOLEAN |
| M | ACTA CARTA | Booleano | `acta_carta` BOOLEAN |
| N | PASAR ACUERDOS | Booleano | `pasar_acuerdos` BOOLEAN |

> Las columnas O ("EJECUTAR"), P ("REC MOROSOS"), Q ("CAMBIO DE FIRMAS"), R ("PASADO A NETFINCAS Y RYP") están **fuera del scope** del formulario principal pero se incluyen en la tabla como campos opcionales para expansión futura.

**Acciones especiales** (botones de fila, no columnas de estado):
- **Pasar Acuerdo**: Genera/muestra el documento de acuerdo de la junta
- **Redactar Visto Bueno Presidente**: Genera/muestra el texto de visto bueno

### Referencias de código existente
- `src/app/dashboard/incidencias/page.tsx` — Patrón completo de página con tabla + modal (patrón principal a seguir)
- `src/app/dashboard/incidencias/IncidenciaFormModal.tsx` — Patrón de modal de formulario
- `src/app/dashboard/deudas/page.tsx` — Patrón alternativo con inline editing en tabla
- `src/components/DataTable.tsx` — Componente de tabla reutilizable (columnas, sorting, selección)
- `src/components/SearchableSelect.tsx` — Selector con búsqueda para comunidades
- `src/components/Sidebar.tsx` — Añadir entrada en sección "GESTIÓN"
- `src/lib/schemas.ts` — Centralizar tipo `Reunion` y schema Zod
- `src/lib/supabaseClient.ts` — Cliente browser para componentes cliente
- `src/lib/supabase/admin.ts` — Cliente admin para API routes
- `src/lib/logActivity.ts` — Helper de log de actividad (usar en create/update/delete)

### Arquitectura Propuesta

```
src/app/dashboard/reuniones/
├── page.tsx                    # Página principal (tabla + filtros + estado)
├── ReunionFormModal.tsx        # Modal crear/editar reunión
├── ReunionDetailModal.tsx      # Modal detalle con todos los campos y acciones
├── PasarAcuerdoModal.tsx       # Modal generación de texto de acuerdo
├── VistoBuenoModal.tsx         # Modal redacción visto bueno presidente
└── columns.tsx                 # Definición de columnas para DataTable

src/app/api/reuniones/
├── route.ts                    # GET (listar) + POST (crear)
└── [id]/
    └── route.ts                # GET (detalle) + PATCH (actualizar) + DELETE
```

### Modelo de Datos SQL

```sql
-- Tabla principal de reuniones
CREATE TABLE reuniones (
  id              BIGSERIAL PRIMARY KEY,
  comunidad_id    INTEGER NOT NULL REFERENCES comunidades(id) ON DELETE CASCADE,
  fecha_reunion   DATE NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('JGO', 'JGE', 'JV')),

  -- Campos de proceso (booleanos del Excel)
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

  -- Campos adicionales
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
CREATE INDEX idx_reuniones_comunidad ON reuniones(comunidad_id);
CREATE INDEX idx_reuniones_fecha ON reuniones(fecha_reunion DESC);
CREATE INDEX idx_reuniones_tipo ON reuniones(tipo);

-- RLS
ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;

-- Usuarios autenticados pueden ver todas las reuniones
CREATE POLICY "Usuarios autenticados pueden ver reuniones"
  ON reuniones FOR SELECT
  TO authenticated
  USING (true);

-- Usuarios autenticados pueden crear reuniones
CREATE POLICY "Usuarios autenticados pueden crear reuniones"
  ON reuniones FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Usuarios autenticados pueden actualizar reuniones
CREATE POLICY "Usuarios autenticados pueden actualizar reuniones"
  ON reuniones FOR UPDATE
  TO authenticated
  USING (true);

-- Solo admin puede eliminar
CREATE POLICY "Solo admin puede eliminar reuniones"
  ON reuniones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.rol = 'admin'
    )
  );
```

### Tipos TypeScript (añadir a `src/lib/schemas.ts`)

```typescript
export interface Reunion {
  id: number;
  comunidad_id: number;
  comunidad?: ComunidadOption;
  fecha_reunion: string;
  tipo: 'JGO' | 'JGE' | 'JV';
  estado_cuentas: boolean;
  pto_ordinario: boolean;
  pto_extra: boolean;
  morosos: boolean;
  citacion_email: boolean;
  citacion_carta: boolean;
  redactar_acta: boolean;
  vb_pendiente: boolean;
  acta_email: boolean;
  acta_carta: boolean;
  pasar_acuerdos: boolean;
  notas?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const reunionFormSchema = z.object({
  comunidad_id: z.coerce.number().positive('Selecciona una comunidad'),
  fecha_reunion: z.string().min(1, 'La fecha es obligatoria'),
  tipo: z.enum(['JGO', 'JGE', 'JV'], { errorMap: () => ({ message: 'Tipo inválido' }) }),
  estado_cuentas: z.boolean().default(false),
  pto_ordinario: z.boolean().default(false),
  pto_extra: z.boolean().default(false),
  morosos: z.boolean().default(false),
  citacion_email: z.boolean().default(false),
  citacion_carta: z.boolean().default(false),
  redactar_acta: z.boolean().default(false),
  vb_pendiente: z.boolean().default(false),
  acta_email: z.boolean().default(false),
  acta_carta: z.boolean().default(false),
  pasar_acuerdos: z.boolean().default(false),
  notas: z.string().optional(),
});
```

---

## Blueprint (Assembly Line)

> IMPORTANTE: Solo fases. Las subtareas se generan al entrar a cada fase con el bucle agéntico.

### Fase 1: Base de Datos y Tipos
**Objetivo**: Tabla `reuniones` creada en Supabase con RLS, tipos TypeScript añadidos a `schemas.ts`, y migración documentada.
**Validación**: `mcp__supabase__list_tables` muestra `reuniones`; `npm run typecheck` pasa.

### Fase 2: API Routes
**Objetivo**: Endpoints REST completos en `src/app/api/reuniones/` para listar, crear, actualizar (incluido toggle de booleano individual) y eliminar reuniones.
**Validación**: `curl` o test manual de los 4 métodos HTTP devuelve datos correctos y respeta RLS.

### Fase 3: UI — Página Principal y Tabla
**Objetivo**: Página `/dashboard/reuniones` con tabla funcional (DataTable), filtros por tipo/comunidad/año, y entrada en el Sidebar bajo "GESTIÓN".
**Validación**: Playwright screenshot muestra la página con tabla, filtros y entrada en sidebar activa.

### Fase 4: UI — Formulario y Edición
**Objetivo**: Modal "Nueva Reunión" (`ReunionFormModal`) y modal de detalle (`ReunionDetailModal`) con todos los campos del Excel, toggles para booleanos, y guardado con validación Zod.
**Validación**: Se puede crear una reunión nueva y editarla; los datos persisten en BD.

### Fase 5: Acciones Especiales — Pasar Acuerdo y Visto Bueno
**Objetivo**: Botones de fila "Pasar Acuerdo" y "Redactar Visto Bueno Presidente" que abren modales con texto generado dinámicamente a partir de los datos de la reunión (comunidad, fecha, tipo). Los textos son copiables.
**Validación**: Al clicar los botones, el modal muestra texto con datos correctos de la reunión seleccionada.

### Fase 6: Validación Final
**Objetivo**: Sistema funcionando end-to-end sin errores de TypeScript ni de build.
**Validación**:
- [ ] `npm run typecheck` pasa sin errores
- [ ] `npm run build` exitoso
- [ ] Playwright screenshot confirma UI completa (tabla, modales, filtros, sidebar)
- [ ] Todos los criterios de éxito marcados como completados

---

## Aprendizajes (Self-Annealing)

> Esta sección crece con cada error encontrado durante la implementación.

---

## Gotchas

- [ ] La tabla `comunidades` usa `nombre_cdad` y `codigo` — usar `ComunidadOption` existente, no crear un tipo nuevo
- [ ] `DataTable` requiere `Column[]` tipado — ver patrón en `src/app/dashboard/deudas/page.tsx` o `incidencias/columns.tsx`
- [ ] Los toggles booleanos en tabla deben hacer `PATCH` inmediato al cambiar (optimistic update + rollback en error)
- [ ] Los textos de "Pasar Acuerdo" y "Visto Bueno" no están definidos en el Excel — coordinar con usuario en Fase 5 qué texto exacto debe generarse
- [ ] `exceljs` ya está como dependencia del proyecto (migrado de `xlsx`) — si en el futuro se necesita exportar a Excel usar `exceljs`
- [ ] La función `update_updated_at_column` puede ya existir en Supabase — usar `CREATE OR REPLACE` para evitar error

## Anti-Patrones

- NO crear un cliente Supabase nuevo — usar los 4 existentes (`supabaseClient`, `admin`, `server`, `route`)
- NO hardcodear textos de "Pasar Acuerdo" en el código — usar variables configurables o al menos constantes en un archivo separado
- NO usar `any` en TypeScript — tipar todo con `Reunion` y `ComunidadOption`
- NO omitir `logActivity` en las operaciones create/update/delete
- NO poner lógica de negocio en el componente de página — extraer a API routes

---

*PRP pendiente aprobación. No se ha modificado código.*
