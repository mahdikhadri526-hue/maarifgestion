
-- ============ ENUM ============
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'operator', 'viewer');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ USER PERMISSIONS ============
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_key)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- ============ FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN _user_id IS NULL THEN false
      WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') THEN true
      WHEN EXISTS (SELECT 1 FROM public.user_permissions WHERE user_id = _user_id AND permission_key = _permission_key AND allowed = true) THEN true
      ELSE false
    END
$$;

-- ============ AUTO CREATE PROFILE + ADMIN BOOTSTRAP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- Bootstrap admin
  IF lower(NEW.email) = 'e.khadri1982@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PROFILES RLS ============
CREATE POLICY "Users view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin(auth.uid()));

-- ============ USER ROLES RLS ============
CREATE POLICY "Users see their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage roles select" ON public.user_roles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete roles" ON public.user_roles FOR DELETE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update roles" ON public.user_roles FOR UPDATE USING (public.is_admin(auth.uid()));

-- ============ USER PERMISSIONS RLS ============
CREATE POLICY "Users see their own permissions" ON public.user_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins see permissions" ON public.user_permissions FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert permissions" ON public.user_permissions FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update permissions" ON public.user_permissions FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete permissions" ON public.user_permissions FOR DELETE USING (public.is_admin(auth.uid()));

-- ============ REPLACE PERMISSIVE POLICIES ON DATA TABLES ============
-- stock_movements
DROP POLICY IF EXISTS "Allow all access to stock_movements" ON public.stock_movements;
CREATE POLICY "auth select movements" ON public.stock_movements FOR SELECT USING (public.has_permission(auth.uid(), 'view_movements'));
CREATE POLICY "auth insert movements" ON public.stock_movements FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'edit_movements'));
CREATE POLICY "auth update movements" ON public.stock_movements FOR UPDATE USING (public.has_permission(auth.uid(), 'edit_movements'));
CREATE POLICY "auth delete movements" ON public.stock_movements FOR DELETE USING (public.has_permission(auth.uid(), 'delete_movements'));

-- initial_stocks
DROP POLICY IF EXISTS "Allow all access to initial_stocks" ON public.initial_stocks;
CREATE POLICY "auth select initial_stocks" ON public.initial_stocks FOR SELECT USING (public.has_permission(auth.uid(), 'view_stock'));
CREATE POLICY "auth insert initial_stocks" ON public.initial_stocks FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'edit_stock'));
CREATE POLICY "auth update initial_stocks" ON public.initial_stocks FOR UPDATE USING (public.has_permission(auth.uid(), 'edit_stock'));
CREATE POLICY "auth delete initial_stocks" ON public.initial_stocks FOR DELETE USING (public.has_permission(auth.uid(), 'delete_stock'));

-- lot_entries
DROP POLICY IF EXISTS "Allow all access to lot_entries" ON public.lot_entries;
CREATE POLICY "auth select lots" ON public.lot_entries FOR SELECT USING (public.has_permission(auth.uid(), 'view_lots'));
CREATE POLICY "auth insert lots" ON public.lot_entries FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'edit_lots'));
CREATE POLICY "auth update lots" ON public.lot_entries FOR UPDATE USING (public.has_permission(auth.uid(), 'edit_lots'));
CREATE POLICY "auth delete lots" ON public.lot_entries FOR DELETE USING (public.has_permission(auth.uid(), 'delete_lots'));

-- requisitions
DROP POLICY IF EXISTS "Allow all access to requisitions" ON public.requisitions;
CREATE POLICY "auth select req" ON public.requisitions FOR SELECT USING (public.has_permission(auth.uid(), 'view_requisitions'));
CREATE POLICY "auth insert req" ON public.requisitions FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'edit_requisitions'));
CREATE POLICY "auth update req" ON public.requisitions FOR UPDATE USING (public.has_permission(auth.uid(), 'edit_requisitions'));
CREATE POLICY "auth delete req" ON public.requisitions FOR DELETE USING (public.has_permission(auth.uid(), 'delete_requisitions'));

-- autocontrols
DROP POLICY IF EXISTS "Allow all access to autocontrols" ON public.autocontrols;
CREATE POLICY "auth select auto" ON public.autocontrols FOR SELECT USING (public.has_permission(auth.uid(), 'view_autocontrol'));
CREATE POLICY "auth insert auto" ON public.autocontrols FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'edit_autocontrol'));
CREATE POLICY "auth update auto" ON public.autocontrols FOR UPDATE USING (public.has_permission(auth.uid(), 'edit_autocontrol'));
CREATE POLICY "auth delete auto" ON public.autocontrols FOR DELETE USING (public.has_permission(auth.uid(), 'delete_autocontrol'));

-- weekly_tracking
DROP POLICY IF EXISTS "Allow all access to weekly_tracking" ON public.weekly_tracking;
CREATE POLICY "auth select weekly" ON public.weekly_tracking FOR SELECT USING (public.has_permission(auth.uid(), 'view_weekly'));
CREATE POLICY "auth insert weekly" ON public.weekly_tracking FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'edit_weekly'));
CREATE POLICY "auth update weekly" ON public.weekly_tracking FOR UPDATE USING (public.has_permission(auth.uid(), 'edit_weekly'));
CREATE POLICY "auth delete weekly" ON public.weekly_tracking FOR DELETE USING (public.has_permission(auth.uid(), 'delete_weekly'));

-- updated_at trigger on profiles
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
