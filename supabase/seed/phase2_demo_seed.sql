insert into material_categories (id, code, name, hazard_level, handling_notes, is_demo) values
  ('00000000-0000-4000-8000-000000000411', 'MOBILE_PHONES', 'Mobile Phones', 'medium', 'Keep swollen batteries separate and avoid crushing devices.', true),
  ('00000000-0000-4000-8000-000000000412', 'LAPTOPS_COMPUTERS', 'Laptops / Computers', 'medium', 'Avoid crushing screens or batteries during handling.', true),
  ('00000000-0000-4000-8000-000000000413', 'CIRCUIT_BOARDS', 'Circuit Boards / PCB', 'medium', 'Use gloves around sharp boards and exposed components.', true),
  ('00000000-0000-4000-8000-000000000414', 'CABLES_WIRES', 'Cables / Wires', 'low', 'Bundle cables before pickup to avoid tangling and trip hazards.', true),
  ('00000000-0000-4000-8000-000000000415', 'BATTERIES', 'Batteries', 'high', 'Do not puncture, bend, heat, or mix leaking batteries with other lots.', true),
  ('00000000-0000-4000-8000-000000000416', 'CHARGERS_ADAPTERS', 'Chargers / Adapters', 'low', 'Keep plugs covered if damaged and bundle cords safely.', true),
  ('00000000-0000-4000-8000-000000000417', 'DISPLAYS_MONITORS', 'Displays / Monitors', 'medium', 'Handle broken glass carefully and keep screens upright when possible.', true),
  ('00000000-0000-4000-8000-000000000418', 'MIXED_ELECTRONICS', 'Mixed Electronics', 'medium', 'Separate leaking batteries, sharp parts, and damaged items when possible.', true)
on conflict (code) do update set
  name = excluded.name,
  hazard_level = excluded.hazard_level,
  handling_notes = excluded.handling_notes,
  is_demo = true;

insert into material_reference_prices (id, material_category_id, region_code, price_per_kg, currency, source_label, effective_from, is_demo)
select price_seed.id::uuid,
       material_categories.id,
       'DEMO-IN',
       price_seed.price_per_kg,
       'INR',
       'Demo reference price, not live market data',
       '2026-09-10'::date,
       true
from (values
  ('00000000-0000-4000-8000-000000000511', 'MOBILE_PHONES', 180.00),
  ('00000000-0000-4000-8000-000000000512', 'LAPTOPS_COMPUTERS', 95.00),
  ('00000000-0000-4000-8000-000000000513', 'CIRCUIT_BOARDS', 220.00),
  ('00000000-0000-4000-8000-000000000514', 'CABLES_WIRES', 120.00),
  ('00000000-0000-4000-8000-000000000515', 'BATTERIES', 60.00),
  ('00000000-0000-4000-8000-000000000516', 'CHARGERS_ADAPTERS', 80.00),
  ('00000000-0000-4000-8000-000000000517', 'DISPLAYS_MONITORS', 70.00),
  ('00000000-0000-4000-8000-000000000518', 'MIXED_ELECTRONICS', 100.00)
) as price_seed(id, code, price_per_kg)
join material_categories on material_categories.code = price_seed.code
on conflict (material_category_id, region_code, effective_from) do update set
  price_per_kg = excluded.price_per_kg,
  source_label = excluded.source_label,
  is_demo = true;
