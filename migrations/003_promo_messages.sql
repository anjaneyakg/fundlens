CREATE TABLE IF NOT EXISTS public.promo_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.promo_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promo_read_all" ON public.promo_messages
  FOR SELECT USING (true);
