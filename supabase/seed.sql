-- Fake local data only. Never put real LINE IDs, names or account details here.
insert into public.groups (group_id) values ('Cdev0000000000000000000000000001');

insert into public.members (group_id, user_id, display_name) values
  ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000001', 'เจ้าของบิล'),
  ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000002', 'เพื่อน A'),
  ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000003', 'เพื่อน B');

-- 100.00 THB split evenly among 3, Owner included: Owner 33.34, others 33.33.
with bill as (
  insert into public.bills (group_id, creator_user_id, owner_user_id, description,
                            total_amount_satang, split_type)
  values ('Cdev0000000000000000000000000001', 'Udev0000000000000000000000000001',
          'Udev0000000000000000000000000001', 'ข้าวเย็น', 10000, 'even')
  returning bill_id, group_id
)
insert into public.bill_shares (bill_id, group_id, user_id, amount_satang, status, joined_order)
select bill.bill_id, bill.group_id, s.user_id, s.amount, s.status, s.ord
from bill, (values
  ('Udev0000000000000000000000000001', 3334, 'paid_self', 0),
  ('Udev0000000000000000000000000002', 3333, 'unpaid', 1),
  ('Udev0000000000000000000000000003', 3333, 'unpaid', 2)
) as s (user_id, amount, status, ord);
