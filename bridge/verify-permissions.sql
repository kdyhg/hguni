select data_scope from dbo.HguniControl where id=1;
select
  has_perms_by_name('dbo.student','OBJECT','SELECT') as can_read_student,
  has_perms_by_name('dbo.teacher','OBJECT','SELECT') as can_read_teacher,
  has_perms_by_name('dbo.meritcode','OBJECT','SELECT') as can_read_item,
  has_perms_by_name('dbo.merit','OBJECT','SELECT') as can_read_merit,
  has_perms_by_name('dbo.merit','OBJECT','INSERT') as can_insert_merit,
  has_perms_by_name('dbo.merit','OBJECT','DELETE') as can_delete_merit,
  has_perms_by_name('dbo.HguniReceipt','OBJECT','SELECT') as can_read_receipt,
  has_perms_by_name('dbo.HguniReceipt','OBJECT','INSERT') as can_insert_receipt;
