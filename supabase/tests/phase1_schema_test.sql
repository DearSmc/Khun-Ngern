-- Constraint checks for the Phase 1 schema. Run after migrations and seed:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/phase1_schema_test.sql
-- Each block must fail; if it succeeds, the test raises.

create or replace function pg_temp.expect_error(sql text, label text) returns void
language plpgsql as $$
begin
  execute sql;
  raise exception 'expected failure: %', label;
exception
  when others then
    if sqlerrm like 'expected failure:%' then raise; end if;
end $$;

select pg_temp.expect_error(
  $q$insert into public.bills (group_id, creator_user_id, owner_user_id, description, total_amount_satang, split_type)
     values ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000001', 'Udev0000000000000000000000000001', 'x', 0, 'even')$q$,
  'zero total');

select pg_temp.expect_error(
  $q$insert into public.bills (group_id, creator_user_id, owner_user_id, description, total_amount_satang, split_type)
     values ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000001', 'Udev0000000000000000000000000001', '  ', 100, 'even')$q$,
  'blank description');

select pg_temp.expect_error(
  $q$insert into public.bills (group_id, creator_user_id, owner_user_id, description, total_amount_satang, split_type)
     values ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000001', 'Uunknown', 'x', 100, 'even')$q$,
  'owner not in registry');

select pg_temp.expect_error(
  $q$insert into public.bills (group_id, creator_user_id, owner_user_id, description, total_amount_satang, split_type)
     values ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000001', 'Udev0000000000000000000000000001', 'x', 100, 'half')$q$,
  'unknown split type');

select pg_temp.expect_error(
  $q$update public.bills set status = 'cancelled'$q$,
  'cancelled without cancelled_at');

select pg_temp.expect_error(
  $q$insert into public.bill_shares (bill_id, group_id, user_id, amount_satang, joined_order)
     select bill_id, group_id, 'Udev0000000000000000000000000002', 1, 9 from public.bills limit 1$q$,
  'same person twice on a bill');

select pg_temp.expect_error(
  $q$insert into public.bill_shares (bill_id, group_id, user_id, amount_satang, joined_order)
     select bill_id, 'Cother', 'Udev0000000000000000000000000002', 1, 9 from public.bills limit 1$q$,
  'share in a different group than its bill');

select pg_temp.expect_error(
  $q$insert into public.processed_webhook_events (webhook_event_id) values ('e1'), ('e1')$q$,
  'duplicate webhook event');

-- Seed bill shares sum to the bill total.
do $$
begin
  if exists (
    select 1 from public.bills b
    where b.total_amount_satang <> (select sum(amount_satang) from public.bill_shares s where s.bill_id = b.bill_id)
  ) then
    raise exception 'seed shares do not sum to total';
  end if;
end $$;

select 'phase1 schema tests passed' as result;
