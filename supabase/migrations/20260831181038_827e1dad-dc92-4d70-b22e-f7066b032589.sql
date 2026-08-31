CREATE TYPE public.deal_stage AS ENUM ('searching','viewing','negotiating','closed');

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  stage public.deal_stage NOT NULL DEFAULT 'searching',
  size_sqm_min integer,
  size_sqm_max integer,
  preferred_areas text NOT NULL DEFAULT '',
  target_move_date date,
  notes text NOT NULL DEFAULT '',
  contact_name text,
  contact_email text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX log_entries_company_id_idx ON public.log_entries(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.companies TO anon, authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT SELECT, INSERT ON public.log_entries TO anon, authenticated;
GRANT ALL ON public.log_entries TO service_role;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_read" ON public.companies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "companies_insert" ON public.companies FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "companies_update" ON public.companies FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "log_entries_read" ON public.log_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "log_entries_insert" ON public.log_entries FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.companies (id, name, stage, size_sqm_min, size_sqm_max, preferred_areas, target_move_date, notes, contact_name, contact_email, created_at) VALUES
('11111111-1111-4111-8111-111111111111','Northgate Analytics','searching',800,1000,'City centre, Riverside','2027-01-15','Growing data team, 45 desks today, expect 70 by move-in. Wants raw/industrial feel, good bike storage.','Elena Fischer','elena.fischer@northgate-analytics.example', now() - interval '40 days'),
('22222222-2222-4222-8222-222222222222','Halden & Roe','viewing',400,550,'Old Town, Harbour District','2026-11-01','Law firm, needs 6 partner offices plus meeting suite. Sensitive to acoustic quality.','Martin Roe','martin.roe@haldenroe.example', now() - interval '70 days'),
('33333333-3333-4333-8333-333333333333','Verity Health Group','negotiating',1200,1600,'Business Park North','2027-03-01','Clinical admin HQ consolidation from three sites. Parking for 60 cars is a hard requirement.','Priya Anand','priya.anand@verityhealth.example', now() - interval '120 days'),
('44444444-4444-4444-8444-444444444444','Stellar Freight','closed',250,300,'Docklands',NULL,'Signed 5-year lease at Warehouse 12. Fit-out starts next month.','Tomas Brandt','tomas.brandt@stellarfreight.example', now() - interval '200 days');

INSERT INTO public.log_entries (company_id, body, created_at) VALUES
('11111111-1111-4111-8111-111111111111','Kick-off call. Confirmed budget band and that they will not consider anything above the second ring road.', now() - interval '39 days'),
('11111111-1111-4111-8111-111111111111','Sent first shortlist of five buildings. Elena is circulating internally, expects feedback next week.', now() - interval '21 days'),
('22222222-2222-4222-8222-222222222222','Viewed Old Town 14 and Harbour Quay 3. Old Town 14 too dark, Harbour Quay 3 strong contender.', now() - interval '5 days'),
('22222222-2222-4222-8222-222222222222','Martin asked for an acoustic report on Harbour Quay 3 before a second viewing.', now() - interval '2 days'),
('33333333-3333-4333-8333-333333333333','Heads of terms exchanged. Landlord pushing for 10-year term, tenant wants a break at year 5.', now() - interval '9 days'),
('33333333-3333-4333-8333-333333333333','Landlord verbally agreed to a year-6 break with 9 months notice. Drafting revised HoT.', now() - interval '1 day'),
('44444444-4444-4444-8444-444444444444','Lease signed. Commission invoice issued.', now() - interval '30 days');