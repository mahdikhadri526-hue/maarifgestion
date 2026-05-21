UPDATE auth.users
SET encrypted_password = crypt('Oliveri19501982', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE lower(email) = 'e.khadri1982@gmail.com';