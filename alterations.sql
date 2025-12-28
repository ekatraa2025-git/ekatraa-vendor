-- SQL TABLE ALTERATIONS FOR EKATRAA VENDOR APP
-- Run these in your Supabase SQL Editor to update existing tables.

-- 1. Updates to 'vendors' table
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS aadhaar_number TEXT UNIQUE;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS aadhaar_front_url TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS aadhaar_back_url TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS ifsc_code TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS total_revenue DECIMAL(15,2) DEFAULT 0.0;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS active_bookings_count INTEGER DEFAULT 0;

-- 2. Updates to 'services' table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_amount DECIMAL(15,2);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category TEXT;

-- 3. Updates to 'bookings' table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_date DATE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_time TIME;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- 4. Updates to 'unavailability_blocks' table (for fix)
ALTER TABLE public.unavailability_blocks ADD COLUMN IF NOT EXISTS block_date DATE;
ALTER TABLE public.unavailability_blocks ADD COLUMN IF NOT EXISTS is_full_day BOOLEAN DEFAULT false;
