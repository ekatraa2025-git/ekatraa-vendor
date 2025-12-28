-- SUPABASE SCHEMA FOR EKATRAA VENDOR APP

-- 1. Vendors Table (Extends Supabase Auth)
CREATE TABLE public.vendors (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  business_name TEXT NOT NULL,
  category TEXT,
  phone TEXT UNIQUE NOT NULL,
  address TEXT,
  logo_url TEXT,
  description TEXT,
  aadhaar_number TEXT UNIQUE,
  aadhaar_front_url TEXT,
  aadhaar_back_url TEXT,
  gst_number TEXT,
  pan_number TEXT,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  profile_views INTEGER DEFAULT 0,
  total_revenue DECIMAL(15,2) DEFAULT 0.0,
  active_bookings_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  accepting_bookings BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors can view their own profile" ON public.vendors FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Vendors can insert their own profile" ON public.vendors FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Vendors can update their own profile" ON public.vendors FOR UPDATE USING (auth.uid() = id);

-- 2. Services Table
CREATE TABLE public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_amount DECIMAL(12,2) NOT NULL,
  price_currency TEXT DEFAULT 'INR',
  price_unit TEXT, -- e.g., 'per plate', 'per event'
  description TEXT,
  image_urls TEXT[], -- Array of image URLs
  rating DECIMAL(3,2) DEFAULT 0.0,
  reviews_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);
CREATE POLICY "Vendors can manage their own services" ON public.services FOR ALL USING (vendor_id = auth.uid());

-- 3. Bookings Table
CREATE TABLE public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  guests_count INTEGER,
  total_price DECIMAL(12,2),
  status TEXT DEFAULT 'pending', -- pending, confirmed, declined, completed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors can view their own bookings" ON public.bookings FOR SELECT USING (vendor_id = auth.uid());
CREATE POLICY "Vendors can update their own bookings" ON public.bookings FOR UPDATE USING (vendor_id = auth.uid());

-- 4. Availability/Unavailability Blocks
CREATE TABLE public.unavailability_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE NOT NULL,
  block_date DATE NOT NULL,
  reason TEXT,
  is_full_day BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Unavailability Blocks
ALTER TABLE public.unavailability_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vendors can manage their own unavailability" ON public.unavailability_blocks FOR ALL USING (vendor_id = auth.uid());
CREATE POLICY "Unavailability is viewable by everyone" ON public.unavailability_blocks FOR SELECT USING (true);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.vendors (id, phone, business_name)
  VALUES (new.id, new.phone, 'New Business');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create vendor profile on signup
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
