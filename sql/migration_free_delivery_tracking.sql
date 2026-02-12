-- Run this command in your Supabase SQL Editor to support "First Order Free" per subscription

-- 1. Add the tracking column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS has_used_free_delivery boolean DEFAULT false;

-- 2. Optional: Reset it for everyone who just subscribed (if needed)
-- UPDATE public.users SET has_used_free_delivery = false WHERE membership_tier != 'verified_user';
