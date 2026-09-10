insert into profiles (id, auth_user_id, role, display_name, email, phone, is_demo) values
  ('00000000-0000-4000-8000-000000000101', 'demo-auth-collector', 'COLLECTOR', 'Meena Collector', 'collector@demo.local', '+910000000001', true),
  ('00000000-0000-4000-8000-000000000102', 'demo-auth-recycler', 'RECYCLER', 'GreenLoop Recycler', 'recycler@demo.local', '+910000000002', true),
  ('00000000-0000-4000-8000-000000000103', 'demo-auth-admin', 'ADMIN', 'Asha Admin', 'admin@demo.local', '+910000000003', true)
on conflict (auth_user_id) do nothing;

insert into collectors (id, profile_id, locality, preferred_language, onboarding_complete) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'Demo repair lane', 'en', true)
on conflict (profile_id) do nothing;

insert into recyclers (id, profile_id, org_name, authorization_id, authorization_status, service_regions, pickup_available, is_demo) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000102', 'GreenLoop Demo Recycling', 'DEMO-AUTH-001', 'AUTHORIZED', array['DEMO-IN'], true, true)
on conflict (profile_id) do nothing;

insert into material_categories (id, code, name, hazard_level, handling_notes, is_demo) values
  ('00000000-0000-4000-8000-000000000401', 'MOBILE_MIXED', 'Mobile phones mixed', 'medium', 'Keep batteries away from heat and do not crush devices.', true),
  ('00000000-0000-4000-8000-000000000402', 'CABLES_CHARGERS', 'Cables and chargers', 'low', 'Bundle cables to avoid tripping and sharp connector injuries.', true),
  ('00000000-0000-4000-8000-000000000403', 'BATTERIES', 'Batteries hazardous', 'high', 'Do not puncture, bend, or mix leaking batteries with other lots.', true)
on conflict (code) do nothing;

insert into material_reference_prices (id, material_category_id, region_code, price_per_kg, currency, source_label, effective_from, is_demo) values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000401', 'DEMO-IN', 180.00, 'INR', 'Demo reference price, not live market data', '2026-09-10', true),
  ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000402', 'DEMO-IN', 120.00, 'INR', 'Demo reference price, not live market data', '2026-09-10', true),
  ('00000000-0000-4000-8000-000000000503', '00000000-0000-4000-8000-000000000403', 'DEMO-IN', 60.00, 'INR', 'Demo reference price, not live market data', '2026-09-10', true)
on conflict (material_category_id, region_code, effective_from) do nothing;

insert into safety_guides (id, material_category_id, title, body, icon, severity) values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000401', 'Handle phones gently', 'Do not crush devices. Keep swollen batteries separate and ask for recycler guidance.', 'smartphone', 'medium'),
  ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000402', 'Bundle cables safely', 'Tie cables together before pickup and keep sharp connectors covered.', 'cable', 'low'),
  ('00000000-0000-4000-8000-000000000603', '00000000-0000-4000-8000-000000000403', 'Battery caution', 'Avoid heat, pressure, and punctures. Keep damaged batteries isolated.', 'battery-warning', 'high')
on conflict do nothing;