ALTER TABLE public.companies
  ADD COLUMN budget_per_year numeric,
  ADD COLUMN target_rent_per_sqm numeric,
  ADD COLUMN office_requirements text not null default ''::text;