-- Match only the retired password verifier by its SHA-256 fingerprint.
UPDATE users
SET password_hash = NULL,
    session_token = 'revoked_' || gen_random_uuid()::text
WHERE id = 'user_nacho'
  AND encode(sha256(convert_to(password_hash, 'UTF8')), 'hex') =
    'ad61bca307704672de33c841da3c9101b2251d54cc706704a7462d587b008074';
