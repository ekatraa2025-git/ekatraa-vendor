-- Vendor Categories table
CREATE TABLE IF NOT EXISTS vendor_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    icon_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Categories
INSERT INTO vendor_categories (name) VALUES 
('Wedding Planner'), ('Photographer'), ('Catering'), ('Venue'), ('Decorator'), ('Makeup Artist'), ('DJ/Sound'), ('Florist'), ('Transportation');

-- Quotations table
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    customer_name TEXT,
    quotation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivery_date TIMESTAMP WITH TIME ZONE,
    venue_address TEXT,
    service_type TEXT,
    amount DECIMAL(12,2),
    specifications TEXT,
    quantity_requirements TEXT,
    quality_standards TEXT,
    delivery_terms TEXT,
    payment_terms TEXT,
    attachments JSONB DEFAULT '[]', -- URLs for document images
    vendor_tc_accepted BOOLEAN DEFAULT FALSE,
    customer_tc_accepted BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending', -- pending, submitted, accepted, modified (admin only)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add UPI field refinement note: already handled as TEXT in vendors table
-- Add terms and conditions to vendors if not present
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
