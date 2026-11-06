-- Reda's vak "Programmeren / ICT" opgesplitst in drie vakken.
-- Alleen als het profiel nog de oude waarde heeft, zodat latere aanpassingen niet overschreven worden.
UPDATE tutors
SET subjects = ARRAY['programmeren', 'ict', 'elektronica'], updated_at = now()
WHERE slug = 'reda' AND subjects = ARRAY['programmeren'];
