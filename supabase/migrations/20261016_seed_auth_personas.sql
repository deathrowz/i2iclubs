-- ============================================================================
-- 1. PILOT SCHOOL REFERENCE SEED (Ensure Target School Exists)
-- ============================================================================
ALTER TABLE IF EXISTS public.schools 
  ADD COLUMN IF NOT EXISTS division TEXT,
  ADD COLUMN IF NOT EXISTS enterprise_name TEXT;

INSERT INTO public.schools (id, code, name, district, city, division, enterprise_name, campus_lat, campus_lng, campus_radius_meters, institutional_commitment_score, penalty_points_deducted, seed_funding_base_usd, seed_funding_topoff_usd)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'SCH-01-RC', 'Royal College Colombo', 'Western Province', 'Colombo', 'Colombo South', 'Royal Eco-Plast Upcyclers', 6.9044, 79.8612, 500, 95, 0, 1500, 3000),
    ('22222222-2222-2222-2222-222222222222', 'SCH-02-VV', 'Visakha Vidyalaya Colombo', 'Western Province', 'Colombo', 'Colombo South', 'Visakha Bio-Compost', 6.8904, 79.8576, 450, 93, 0, 1500, 3000)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    enterprise_name = EXCLUDED.enterprise_name,
    division = EXCLUDED.division;

-- ============================================================================
-- 2. CREATE AUTH USERS & LINKED PROFILES
-- Passwords are generated unguessable here so no working credential is ever
-- committed. Run scripts/set-category-passwords.py after seeding to give the
-- accounts the shared per-category passwords.
-- ============================================================================

DO $$
DECLARE
    v_encrypted_pw TEXT;
    
    -- Persona Auth UUIDs
    v_giz_auth_id UUID := 'a1111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    v_expert_auth_id UUID := 'b2222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    v_teacher_auth_id UUID := 'c3333333-cccc-cccc-cccc-cccccccccccc';
    v_student_auth_id UUID := 'd4444444-dddd-dddd-dddd-dddddddddddd';

    -- Target School
    v_school_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    -- Unguessable by construction; replaced by the category passwords after
    -- seeding (scripts/set-category-passwords.py).
    v_encrypted_pw := crypt(gen_random_uuid()::text, gen_salt('bf'));

    -- ------------------------------------------------------------------------
    -- Persona 1: GIZ Project Lead / National Auditor (Admin Role)
    -- Use Case: Site-wide compliance audit, AVV GDPR review, macro exports
    -- ------------------------------------------------------------------------
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_giz_auth_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'auditor.giz@giz.de',
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Elena Schmidt (GIZ Lead)"}',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = now();

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        v_giz_auth_id, v_giz_auth_id, 'auditor.giz@giz.de',
        jsonb_build_object('sub', v_giz_auth_id::text, 'email', 'auditor.giz@giz.de'),
        'email', now(), now()
    ) ON CONFLICT (provider, provider_id) DO NOTHING;

    INSERT INTO public.profiles (id, auth_user_id, phone_number, full_name, role, school_id)
    VALUES (
        gen_random_uuid(),
        v_giz_auth_id,
        '94770001100',
        'Elena Schmidt',
        'admin',
        v_school_id
    ) ON CONFLICT (phone_number) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;

    -- ------------------------------------------------------------------------
    -- Persona 2: National Technical Expert (Expert Role)
    -- Use Case: Cross-school grading, 15-school dropdown access, weight scoring
    -- ------------------------------------------------------------------------
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_expert_auth_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'expert.evaluator@i2iclubs.lk',
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Dr. Rohan Wickramasinghe (National Expert)"}',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = now();

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        v_expert_auth_id, v_expert_auth_id, 'expert.evaluator@i2iclubs.lk',
        jsonb_build_object('sub', v_expert_auth_id::text, 'email', 'expert.evaluator@i2iclubs.lk'),
        'email', now(), now()
    ) ON CONFLICT (provider, provider_id) DO NOTHING;

    INSERT INTO public.profiles (id, auth_user_id, phone_number, full_name, role, school_id)
    VALUES (
        gen_random_uuid(),
        v_expert_auth_id,
        '94771000001',
        'Dr. Rohan Wickramasinghe',
        'expert',
        v_school_id
    ) ON CONFLICT (phone_number) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;

    -- ------------------------------------------------------------------------
    -- Persona 3: Supervising Teacher (Teacher Role)
    -- Use Case: Strictly locked to Royal College, reviews photos, approves points
    -- ------------------------------------------------------------------------
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_teacher_auth_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'teacher.royal@i2iclubs.lk',
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"K. L. Jayasinghe (Lead Teacher)"}',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = now();

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        v_teacher_auth_id, v_teacher_auth_id, 'teacher.royal@i2iclubs.lk',
        jsonb_build_object('sub', v_teacher_auth_id::text, 'email', 'teacher.royal@i2iclubs.lk'),
        'email', now(), now()
    ) ON CONFLICT (provider, provider_id) DO NOTHING;

    INSERT INTO public.profiles (id, auth_user_id, phone_number, full_name, role, school_id)
    VALUES (
        gen_random_uuid(),
        v_teacher_auth_id,
        '94772234501',
        'K. L. Jayasinghe',
        'teacher',
        v_school_id
    ) ON CONFLICT (phone_number) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;

    -- ------------------------------------------------------------------------
    -- Persona 4: Student Enterprise Lead (Student Role)
    -- Use Case: WhatsApp media sender, views animated badges, tracks enterprise rank
    -- ------------------------------------------------------------------------
    INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
        v_student_auth_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        'student.lead@i2iclubs.lk',
        v_encrypted_pw,
        now(),
        '{"provider":"email","providers":["email"]}',
        '{"full_name":"Senura Perera (I2I Club Lead)"}',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = now();

    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) VALUES (
        v_student_auth_id, v_student_auth_id, 'student.lead@i2iclubs.lk',
        jsonb_build_object('sub', v_student_auth_id::text, 'email', 'student.lead@i2iclubs.lk'),
        'email', now(), now()
    ) ON CONFLICT (provider, provider_id) DO NOTHING;

    INSERT INTO public.profiles (id, auth_user_id, phone_number, full_name, role, school_id)
    VALUES (
        gen_random_uuid(),
        v_student_auth_id,
        '94771234501',
        'Senura Perera',
        'student',
        v_school_id
    ) ON CONFLICT (phone_number) DO UPDATE SET
        auth_user_id = EXCLUDED.auth_user_id,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role;

END $$;
