-- Allow a non-admin "owner" profile role for users managing their own vehicle.

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('driver', 'owner', 'admin'));
