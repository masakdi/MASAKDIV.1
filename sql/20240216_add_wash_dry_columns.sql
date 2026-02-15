-- Add breakdown columns for wash and dry prices to orders table
ALTER TABLE public.orders 
ADD COLUMN wash_price numeric DEFAULT 0 CHECK (wash_price >= 0),
ADD COLUMN dry_price numeric DEFAULT 0 CHECK (dry_price >= 0);
