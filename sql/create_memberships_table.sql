-- Create memberships table for subscription purchase requests
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  slip_url text,
  amount numeric NOT NULL DEFAULT 99,
  status text NOT NULL DEFAULT 'pending'::text,
  metadata jsonb DEFAULT '{}'::jsonb, -- To store requested tier name
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_at timestamp with time zone,
  CONSTRAINT memberships_pkey PRIMARY KEY (id),
  CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);

COMMENT ON TABLE public.memberships IS 'ตารางเก็บคำขอสมัครสมาชิกพรีเมียมและการชำระเงิน';
