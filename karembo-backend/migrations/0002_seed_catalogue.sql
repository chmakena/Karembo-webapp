-- Reference data: the salon's service menu, its stylists, and who works when.
-- User accounts are seeded from Rust instead (see src/seed.rs) because passwords
-- must go through Argon2 rather than being baked into SQL.
--
-- price_cents holds minor units of KES, so 250000 renders as "KES 2,500".

INSERT INTO services (slug, name, description, category, duration_min, price_cents) VALUES
    ('signature-cut',      'Signature Cut & Style',   'A consultation-led cut finished with a blow-dry and styling to suit your face shape.',        'Hair',   60,  250000),
    ('silk-press',         'Silk Press',              'Deep cleanse, protein treatment and a heat-styled finish that keeps movement for weeks.',     'Hair',   90,  380000),
    ('box-braids',         'Knotless Box Braids',     'Medium knotless braids, mid-back length. Includes wash and scalp prep. Hair not included.',   'Braids', 240, 650000),
    ('cornrow-lines',      'Cornrows & Lines',        'Clean straight-back cornrows or a custom pattern, sealed with a light oil finish.',            'Braids', 120, 300000),
    ('twist-out',          'Two-Strand Twist Out',    'Definition-focused twist set on freshly conditioned hair, dried and separated in-salon.',      'Hair',   120, 320000),
    ('relaxer-retouch',    'Relaxer Retouch',         'Root retouch with a protective base, neutralising shampoo and a moisture-restoring rinse.',    'Hair',   90,  400000),
    ('gel-manicure',       'Gel Manicure',            'Shaping, cuticle work and a gel colour or French finish that lasts two to three weeks.',       'Nails',  60,  180000),
    ('classic-pedicure',   'Classic Pedicure',        'Warm soak, exfoliation, nail shaping and a polish of your choice with a foot massage.',        'Nails',  75,  220000),
    ('acrylic-full-set',   'Acrylic Full Set',        'Full acrylic extensions built to your preferred length and shape, colour included.',           'Nails',  120, 450000),
    ('brow-shape-tint',    'Brow Shape & Tint',       'Threading or waxing mapped to your brow line, finished with a semi-permanent tint.',           'Beauty', 30,  120000),
    ('lash-extensions',    'Classic Lash Extensions', 'One-to-one lash application for a natural lift. Includes an aftercare kit.',                   'Beauty', 120, 500000),
    ('facial-glow',        'Glow Facial',             'Double cleanse, gentle exfoliation, extraction and a hydrating mask for a calmer barrier.',     'Beauty', 60,  350000),
    ('bridal-package',     'Bridal Hair & Makeup',    'Trial session plus wedding-day hair and makeup, with a stylist on call for touch-ups.',        'Bridal', 180, 1500000),
    ('kids-cut',           'Kids Cut (under 12)',     'A patient, quick cut for younger clients, with a wash and a light style.',                     'Hair',   30,  100000);

INSERT INTO staff (display_name, title, bio) VALUES
    ('Amina Karisa',   'Senior Stylist',      'Fifteen years behind the chair and a specialist in protective styling and knotless braid work.'),
    ('Brian Otieno',   'Barber & Stylist',    'Precision cuts, fades and beard shaping. Trained in Nairobi and Cape Town.'),
    ('Cynthia Wanjiru','Nail Technician',     'Nail artist with a light hand for gel work and a following for her custom acrylic sets.'),
    ('Doreen Achieng',  'Beauty Therapist',   'Facials, brows and lashes. Focuses on barrier-safe treatments for sensitive skin.'),
    ('Esther Mwikali', 'Bridal Lead',         'Leads the bridal team and has styled over two hundred weddings across the coast.');

-- Service coverage per stylist, expressed by slug so this stays readable.
INSERT INTO staff_services (staff_id, service_id)
SELECT s.id, sv.id
FROM staff s
JOIN services sv ON sv.slug = ANY (
    CASE s.display_name
        WHEN 'Amina Karisa'    THEN ARRAY['signature-cut','silk-press','box-braids','cornrow-lines','twist-out','relaxer-retouch']
        WHEN 'Brian Otieno'    THEN ARRAY['signature-cut','cornrow-lines','kids-cut']
        WHEN 'Cynthia Wanjiru' THEN ARRAY['gel-manicure','classic-pedicure','acrylic-full-set']
        WHEN 'Doreen Achieng'  THEN ARRAY['brow-shape-tint','lash-extensions','facial-glow','gel-manicure']
        WHEN 'Esther Mwikali'  THEN ARRAY['bridal-package','silk-press','signature-cut','facial-glow']
    END
);

-- Weekly shifts. weekday is ISO: 1 = Monday .. 7 = Sunday.
-- Most of the team works Tue-Sat with a midday break; Sunday is closed.
INSERT INTO working_hours (staff_id, weekday, start_time, end_time)
SELECT s.id, d.weekday, d.start_time, d.end_time
FROM staff s
CROSS JOIN (VALUES
    (2, TIME '09:00', TIME '13:00'),
    (2, TIME '14:00', TIME '18:00'),
    (3, TIME '09:00', TIME '13:00'),
    (3, TIME '14:00', TIME '18:00'),
    (4, TIME '09:00', TIME '13:00'),
    (4, TIME '14:00', TIME '18:00'),
    (5, TIME '09:00', TIME '13:00'),
    (5, TIME '14:00', TIME '19:00'),
    (6, TIME '08:00', TIME '13:00'),
    (6, TIME '14:00', TIME '17:00')
) AS d (weekday, start_time, end_time)
WHERE s.display_name <> 'Esther Mwikali';

-- The bridal lead runs a shorter week with long Saturday sittings.
INSERT INTO working_hours (staff_id, weekday, start_time, end_time)
SELECT s.id, d.weekday, d.start_time, d.end_time
FROM staff s
CROSS JOIN (VALUES
    (4, TIME '10:00', TIME '17:00'),
    (5, TIME '10:00', TIME '17:00'),
    (6, TIME '07:00', TIME '16:00')
) AS d (weekday, start_time, end_time)
WHERE s.display_name = 'Esther Mwikali';
