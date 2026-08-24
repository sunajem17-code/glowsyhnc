-- Pin search_path on the two functions that were missing it, and revoke
-- direct RPC-callability on trigger-only SECURITY DEFINER functions.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_submission_posted_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.submitted_at := now();

  if new.posted_at > now() then
    raise exception 'posted_at cannot be in the future';
  end if;

  if new.posted_at < now() - interval '30 days' then
    raise exception 'posted_at cannot be more than 30 days ago';
  end if;

  return new;
end;
$$;

-- Trigger-only functions must never be invoked directly as PostgREST RPC
-- endpoints by anon/authenticated. Triggers still fire regardless of these
-- grants since the executor invokes them, not the calling role.
revoke execute on function public.handle_new_creator() from public, anon, authenticated;
revoke execute on function public.protect_creator_admin_columns() from public, anon, authenticated;
revoke execute on function public.protect_submission_admin_columns() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_submission_posted_at() from public, anon, authenticated;
