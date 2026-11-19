-- Production-safe seed: badges, FAQs, sourced facts, settings. No users, no fake statistics.
-- The first admin is created with backend/scripts/create_admin.py (see docs/SETUP.md).

insert into public.badge_definitions (code, name, description, audience, metric, threshold, issues_certificate, sort) values
  ('pickup_1',     'First Pickup',        'Completed your first OTP-confirmed pickup.',           'both', 'pickups', 1, true, 10),
  ('pickup_10',    '10 Pickups',          'Ten pickups completed through AnnSetu.',                'both', 'pickups', 10, true, 20),
  ('pickup_50',    '50 Pickups',          'Fifty pickups completed through AnnSetu.',              'both', 'pickups', 50, true, 30),
  ('pickup_100',   '100 Pickups',         'One hundred pickups completed through AnnSetu.',        'both', 'pickups', 100, true, 40),
  ('pickup_500',   '500 Pickups',         'Five hundred pickups completed through AnnSetu.',       'both', 'pickups', 500, true, 50),
  ('units_100',    '100 Units',           '100 units of food redistributed.',                      'both', 'units', 100, true, 60),
  ('units_500',    '500 Units',           '500 units of food redistributed.',                      'both', 'units', 500, true, 70),
  ('units_1000',   '1,000 Units',         '1,000 units of food redistributed.',                    'both', 'units', 1000, true, 80),
  ('units_5000',   '5,000 Units',         '5,000 units of food redistributed.',                    'both', 'units', 5000, true, 90),
  ('units_10000',  '10,000 Units',        '10,000 units of food redistributed.',                   'both', 'units', 10000, true, 100),
  ('partners_10',  '10 Partners',         'Worked with ten different partner organisations.',      'both', 'partners', 10, true, 110),
  ('partners_25',  '25 Partners',         'Worked with twenty-five partner organisations.',        'both', 'partners', 25, true, 120),
  ('year_1',       'One Year with AnnSetu', 'Verified and active on AnnSetu for a year.',          'both', 'years', 1, true, 130),
  ('rep_first',    'First Collection',    'Collected food for the first time.',                    'representative', 'pickups', 1, false, 200),
  ('rep_10',       'Reliable Collector',  'Ten collections completed.',                            'representative', 'pickups', 10, false, 210),
  ('rep_50',       'Community Hero',      'Fifty collections completed.',                          'representative', 'pickups', 50, false, 220)
on conflict (code) do nothing;

insert into public.facts (headline, detail, stat_value, source_name, source_url, verified_at, active, sort) values
  ('Food wasted worldwide in 2022',
   'Households, food service and retail together wasted about a fifth of the food available to consumers.',
   '1.05 billion tonnes', 'UNEP Food Waste Index Report 2024',
   'https://www.unep.org/resources/publication/food-waste-index-report-2024', '2026-11-19', true, 10),
  ('People who faced hunger in 2023',
   'Mid-range estimate (713–757 million), about one in eleven people worldwide.',
   '≈733 million', 'FAO et al., The State of Food Security and Nutrition in the World 2024',
   'https://www.fao.org/newsroom/detail/hunger-numbers-stubbornly-high-for-three-consecutive-years-as-global-crises-deepen--un-report/en',
   '2026-11-19', true, 20),
  -- Not yet verified against the report's country table: inactive until an admin confirms it.
  ('Food wasted per person each year in Indian homes',
   'Household food waste estimate for India.',
   '≈55 kg', 'UNEP Food Waste Index Report 2024',
   'https://www.unep.org/resources/publication/food-waste-index-report-2024', '2026-11-19', false, 30);

insert into public.app_settings (key, value, is_public) values
  ('co2_factor', jsonb_build_object(
     'kg_co2e_per_kg', 2.5,
     'source', 'FAO (2013) Food Wastage Footprint: 3.3 Gt CO2e for 1.3 bn t of food wasted ≈ 2.5 kg CO2e per kg',
     'source_url', 'https://www.fao.org/4/i3347e/i3347e.pdf'), true),
  ('leaderboard_percentile', '25'::jsonb, true),
  ('app_section', jsonb_build_object('state', 'coming_soon', 'play_store_url', null, 'apk_path', null), true),
  ('meal_method', to_jsonb('portions + kg ÷ 0.42 (WRAP 420 g meal equivalent); packs are not converted'::text), true)
on conflict (key) do nothing;

-- FAQs only on a fresh database (an upgraded project keeps its own FAQs; see 20261119000005)
insert into public.faqs (question, answer, category, sort)
select * from (values
  ('Does AnnSetu deliver food?',
   'No. AnnSetu is a bridge, not a delivery fleet. Verified receivers send their own representatives to collect food from donors.', 'general', 10),
  ('Who can donate?',
   'Restaurants, hotels, canteens, caterers, event organisers, food businesses and community kitchens. Every donor is verified before listing food.', 'donors', 20),
  ('Who can receive food?',
   'NGOs, shelters, orphanages, old-age homes, community kitchens and local community groups, after verification.', 'receivers', 30),
  ('We do not have a registration certificate. Can we join?',
   'Yes, if you are an NGO, a local community group or a community kitchen. Explain who you serve and add references; an admin reviews your request within 3–5 business days.', 'receivers', 40),
  ('How is a pickup confirmed?',
   'When the donor accepts a request, the receiver gets a 4-digit code. The representative shows it to the donor, who enters it to confirm the collection.', 'pickups', 50),
  ('How do you calculate meals and CO₂?',
   'Only OTP-confirmed pickups count. Meals are estimated as portions plus kilograms ÷ 0.42 (WRAP''s 420 g meal equivalent); packs are not converted. CO₂ is kilograms × a cited emissions factor. Estimates are always labelled "est.".', 'impact', 60),
  ('Is my data private?',
   'Contact details and documents are visible only to verified partners in a pickup and to AnnSetu admins. See the privacy page for details.', 'general', 70)
) as v(question, answer, category, sort)
where not exists (select 1 from public.faqs);

-- first snapshot so the landing page has a real (possibly zero) baseline
select public.rebuild_landing_snapshot();
