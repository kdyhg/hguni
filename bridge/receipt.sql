-- Apply manually only after schema, trigger, backup, and least-privilege review.
create table dbo.HguniControl (
  id tinyint not null primary key check (id = 1),
  data_scope nvarchar(100) not null
);

create table dbo.HguniReceipt (
  request_id uniqueidentifier not null primary key,
  operation varchar(20) not null check (operation in ('penalty','cancel')),
  source_scope nvarchar(100) not null,
  payload_hash char(64) not null,
  source_record_id nvarchar(100) null,
  result_json nvarchar(max) not null,
  audit_json nvarchar(max) not null,
  committed_at datetime2 not null constraint DF_HguniReceipt_committed_at default sysutcdatetime()
);

-- Insert the exact production scope manually after review:
-- insert into dbo.HguniControl(id,data_scope) values(1,N'hguni-production-school-a');
