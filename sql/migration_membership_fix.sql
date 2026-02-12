-- Run these commands in your Supabase SQL Editor to fix the membership system columns

-- 1. Rename misnamed column in users table
ALTER TABLE public.users 
RENAME COLUMN member_expired_at TO membership_expires_at;

-- 2. Add metadata column to memberships table (used for tracking requested tiers)
ALTER TABLE public.memberships 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 3. Ensure users table has all necessary columns (if they don't exist)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS membership_tier text DEFAULT 'verified_user',
ADD COLUMN IF NOT EXISTS membership_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_member boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS member_status text DEFAULT 'none';
