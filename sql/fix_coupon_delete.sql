-- Fix for deleting coupons that have been collected
ALTER TABLE public.user_coupons
DROP CONSTRAINT IF EXISTS user_coupons_coupon_id_fkey,
ADD CONSTRAINT user_coupons_coupon_id_fkey 
FOREIGN KEY (coupon_id) 
REFERENCES public.coupons(id) 
ON DELETE CASCADE;
