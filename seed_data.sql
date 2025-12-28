-- SQL SEED SCRIPT FOR EKATRAA VENDOR APP
-- This script populates sample data for the authenticated vendor.
-- To run: Replace 'YOUR_VENDOR_ID' with your actual user ID from Supabase Auth or use the logic below.

-- 1. Update Vendor Stats (Replace 'YOUR_VENDOR_ID')
UPDATE public.vendors
SET 
  total_revenue = 45500.00,
  profile_views = 1240,
  active_bookings_count = 3,
  is_verified = true,
  gst_number = '22AAAAA0000A1Z5',
  pan_number = 'ABCDE1234F'
WHERE id = 'YOUR_VENDOR_ID';

-- 2. Insert Sample Services (if not already present)
INSERT INTO public.services (vendor_id, name, category, price_amount, price_currency, description, is_active)
VALUES 
('YOUR_VENDOR_ID', 'Premium Catering Service', 'Catering', 15000.00, 'INR', 'Full course meal for 50+ guests', true),
('YOUR_VENDOR_ID', 'Wedding Photography', 'Photography', 25000.00, 'INR', 'Full day coverage with cinematic video', true)
ON CONFLICT DO NOTHING;

-- 3. Insert Sample Bookings
INSERT INTO public.bookings (vendor_id, service_id, customer_name, customer_phone, booking_date, booking_time, status, total_price, notes)
VALUES 
(
  'YOUR_VENDOR_ID', 
  (SELECT id FROM public.services WHERE vendor_id = 'YOUR_VENDOR_ID' LIMIT 1),
  'John Doe',
  '+91 9876543210',
  CURRENT_DATE + INTERVAL '2 days',
  '18:00:00',
  'confirmed',
  15000.00,
  'Guest count: 60. Special request for vegetarian menu.'
),
(
  'YOUR_VENDOR_ID', 
  (SELECT id FROM public.services WHERE vendor_id = 'YOUR_VENDOR_ID' LIMIT 1),
  'Jane Smith',
  '+91 9876500000',
  CURRENT_DATE + INTERVAL '5 days',
  '12:00:00',
  'confirmed',
  15000.00,
  'Corporate event lunch.'
),
(
  'YOUR_VENDOR_ID', 
  (SELECT id FROM public.services WHERE vendor_id = 'YOUR_VENDOR_ID' LIMIT 1),
  'Rahul Kumar',
  '+91 9876511111',
  CURRENT_DATE - INTERVAL '1 day',
  '20:00:00',
  'completed',
  15000.00,
  'Completed successfully.'
),
(
  'YOUR_VENDOR_ID', 
  (SELECT id FROM public.services WHERE vendor_id = 'YOUR_VENDOR_ID' LIMIT 1),
  'Anita Singh',
  '+91 9876522222',
  CURRENT_DATE + INTERVAL '1 day',
  '10:00:00',
  'pending',
  12000.00,
  'Inquiry for small gathering.'
);
