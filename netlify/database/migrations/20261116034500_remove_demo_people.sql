ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

DELETE FROM message_reactions
WHERE user_id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova')
   OR message_id IN (
     SELECT id FROM messages
     WHERE sender_id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova')
        OR target_id IN (
          'dm_nacho_sofia', 'dm_nacho_nova', 'dm_nacho_mateo', 'dm_nacho_lucia',
          'ch_design_welcome', 'ch_design_showcase', 'ch_design_ui',
          'ch_design_voice_creative', 'ch_design_voice_lofi',
          'ch_devs_ann', 'ch_devs_general', 'ch_devs_realtime',
          'ch_devs_voice_standup', 'ch_devs_voice_pair'
        )
   );

DELETE FROM messages
WHERE sender_id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova')
   OR target_id IN (
     'dm_nacho_sofia', 'dm_nacho_nova', 'dm_nacho_mateo', 'dm_nacho_lucia',
     'ch_design_welcome', 'ch_design_showcase', 'ch_design_ui',
     'ch_design_voice_creative', 'ch_design_voice_lofi',
     'ch_devs_ann', 'ch_devs_general', 'ch_devs_realtime',
     'ch_devs_voice_standup', 'ch_devs_voice_pair'
   );

DELETE FROM dm_participants
WHERE user_id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova')
   OR conversation_id IN ('dm_nacho_sofia', 'dm_nacho_nova', 'dm_nacho_mateo', 'dm_nacho_lucia');

DELETE FROM dm_conversations
WHERE id IN ('dm_nacho_sofia', 'dm_nacho_nova', 'dm_nacho_mateo', 'dm_nacho_lucia');

DELETE FROM contacts
WHERE owner_id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova')
   OR contact_user_id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova');

DELETE FROM server_members
WHERE user_id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova')
   OR server_id IN ('srv_design', 'srv_devs');

DELETE FROM channels
WHERE server_id IN ('srv_design', 'srv_devs');

DELETE FROM servers
WHERE id IN ('srv_design', 'srv_devs');

DELETE FROM users
WHERE id IN ('user_sofia', 'user_mateo', 'user_lucia', 'user_nova');

UPDATE users
SET session_token = 'tok_login_required_nacho'
WHERE id = 'user_nacho' AND session_token = 'tok_nacho_default';

UPDATE users
SET session_token = 'tok_login_required_felipe'
WHERE id = 'user_felipe' AND session_token = 'tok_felipe_invite';
