-- The insert RLS policy only checks creator_id = auth.uid() and that the
-- brief is active; it does not stop a client from sending status='paid' or
-- an arbitrary payout_amount directly in the INSERT payload. Force these
-- server-controlled fields to their safe defaults on every insert,
-- regardless of what the client sends.
create or replace function public.enforce_submission_insert_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.status := 'pending';
  new.payout_amount := 0;
  new.admin_notes := null;
  return new;
end;
$$;

create trigger submissions_enforce_insert_defaults
  before insert on public.submissions
  for each row execute function public.enforce_submission_insert_defaults();

revoke execute on function public.enforce_submission_insert_defaults() from public, anon, authenticated;
