UPDATE users
SET email = 'ignaciosergiodiaz@gmail.com',
    email_norm = 'ignaciosergiodiaz@gmail.com'
WHERE id = 'user_nacho'
  AND NOT EXISTS (
    SELECT 1 FROM users u2
    WHERE u2.email_norm = 'ignaciosergiodiaz@gmail.com'
      AND u2.id <> 'user_nacho'
  );

UPDATE contacts
SET email = 'ignaciosergiodiaz@gmail.com'
WHERE contact_user_id = 'user_nacho';
