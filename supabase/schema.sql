-- Run once in Supabase: SQL Editor -> paste -> Run.
create table if not exists public.records (
  owner text not null,
  id text not null,
  kind text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists records_owner_kind on public.records (owner, kind);

-- Lock the table: no policies = no access for the public anon/authenticated keys.
-- Only the server (service-role key) can read or write.
alter table public.records enable row level security;

create or replace function public.put_record(p_owner text, p_id text, p_kind text, p_data jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare result jsonb;
begin
  insert into public.records as r (owner, id, kind, data) values (p_owner, p_id, p_kind, p_data)
  on conflict (owner, id) do update set
    updated_at = now(),
    data = case
      when r.kind = 'lead' and r.data->>'stage' = 'Do not contact'
      then excluded.data || jsonb_build_object('stage','Do not contact','verdict','Suppressed','draft',null,'followUp','')
      else excluded.data
    end
  returning r.data into result;
  return result;
end $$;

revoke all on function public.put_record(text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.put_record(text,text,text,jsonb) to service_role;
