-- ============================================================
-- APLICAR TODOS LOS TRIGGERS DE NOTIFICACIONES
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. TABLA notifications (si no existe)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id bigint,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications select own" ON public.notifications;
CREATE POLICY "notifications select own"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications update own" ON public.notifications;
CREATE POLICY "notifications update own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications insert system" ON public.notifications;
CREATE POLICY "notifications insert system"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Habilitar realtime en notifications
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. TRIGGER: Incidencia asignada a gestor
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_incidencia_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.gestor_asignado IS NOT NULL) AND
     (TG_OP = 'INSERT' OR OLD.gestor_asignado IS DISTINCT FROM NEW.gestor_asignado) THEN

    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (
      NEW.gestor_asignado,
      'incidencia_assigned',
      'Nueva incidencia asignada',
      COALESCE(NEW.mensaje, 'Se te ha asignado una nueva incidencia.'),
      'incidencias',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_incidencia_assigned ON public.incidencias;
CREATE TRIGGER trg_notify_incidencia_assigned
  AFTER INSERT OR UPDATE OF gestor_asignado ON public.incidencias
  FOR EACH ROW EXECUTE FUNCTION public.notify_incidencia_assigned();

-- ============================================================
-- 3. TRIGGER: Nuevo mensaje en timeline de un ticket
--    Notifica a todos los participantes del ticket (gestor + quien creó)
--    excepto al propio autor del mensaje
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_record_message()
RETURNS TRIGGER AS $$
DECLARE
  v_gestor_asignado uuid;
  v_nombre_autor text;
  v_entity_label text;
BEGIN
  -- Solo aplica a mensajes de incidencias
  IF NEW.entity_type != 'incidencia' THEN
    RETURN NEW;
  END IF;

  -- Obtener nombre del autor
  SELECT nombre INTO v_nombre_autor
    FROM public.profiles WHERE user_id = NEW.user_id;

  v_entity_label := 'Ticket #' || NEW.entity_id;

  -- Notificar al gestor asignado (si existe y no es el autor)
  SELECT gestor_asignado INTO v_gestor_asignado
    FROM public.incidencias WHERE id = NEW.entity_id;

  IF v_gestor_asignado IS NOT NULL AND v_gestor_asignado != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (
      v_gestor_asignado,
      'new_message',
      'Nuevo mensaje en ' || v_entity_label,
      COALESCE(v_nombre_autor, 'Alguien') || ': ' || LEFT(NEW.content, 100),
      'incidencias',
      NEW.entity_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_record_message ON public.record_messages;
CREATE TRIGGER trg_notify_record_message
  AFTER INSERT ON public.record_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_record_message();

-- ============================================================
-- 4. TRIGGER: Solicitud de vacaciones → notificar admins
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admin_vacation_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
  user_name TEXT;
BEGIN
  SELECT (nombre || ' ' || COALESCE(apellido, '')) INTO user_name
    FROM public.profiles WHERE user_id = NEW.user_id;

  FOR admin_record IN (SELECT user_id FROM public.profiles WHERE rol = 'admin') LOOP
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id, is_read)
    VALUES (
      admin_record.user_id,
      'vacation_request',
      'Nueva solicitud de ' || NEW.type,
      COALESCE(user_name, 'Un empleado') || ' ha solicitado del ' ||
        to_char(NEW.date_from, 'DD/MM/YYYY') || ' al ' || to_char(NEW.date_to, 'DD/MM/YYYY') || '.',
      'vacation',
      0,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_admin_vacation_request ON public.vacation_requests;
CREATE TRIGGER trg_notify_admin_vacation_request
  AFTER INSERT ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admin_vacation_request();

-- ============================================================
-- 5. TRIGGER: Cambio de estado de vacaciones → notificar empleado
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_vacation_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES (
      NEW.user_id,
      'vacation_status_change',
      'Estado de solicitud actualizado',
      'Tu solicitud del ' || to_char(NEW.date_from, 'DD/MM/YYYY') ||
        ' ha cambiado a: ' || NEW.status || '.',
      'vacation',
      0
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_vacation_status_change ON public.vacation_requests;
CREATE TRIGGER trg_notify_vacation_status_change
  AFTER UPDATE ON public.vacation_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_vacation_status_change();

-- ============================================================
-- VERIFICACIÓN: muestra los triggers creados
-- ============================================================
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE 'notify%'
ORDER BY routine_name;
