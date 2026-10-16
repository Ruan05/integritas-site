-- Private durable conversations. Only the authenticated broker has table/RPC access.
create table public.integritas_case_conversations (
 id uuid primary key default gen_random_uuid(), case_id uuid not null references public.integritas_cases(id) on delete cascade,
 user_id uuid not null, memory jsonb not null default '{}'::jsonb, memory_version integer not null default 0,
 created_at timestamptz not null default now(), unique(case_id,user_id)
);
create table public.integritas_case_chat_messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.integritas_case_conversations(id) on delete cascade,
 role text not null check(role in ('user','assistant')), content text not null check(length(content) between 1 and 12000),
 client_key text, reply_to uuid references public.integritas_case_chat_messages(id) on delete cascade,
 status text not null check(status in ('queued','processing','completed','failed')),
 worker_id text, lease_token uuid, lease_expires_at timestamptz, error_code text,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 unique(conversation_id,client_key), unique(reply_to)
);
create index integritas_case_chat_history on public.integritas_case_chat_messages(conversation_id,created_at,id);
create unique index integritas_case_chat_single_turn on public.integritas_case_chat_messages(conversation_id) where role='user' and status in ('queued','processing');
create table public.integritas_case_chat_workers (
 worker_id text primary key, token_sha256 text not null, user_id uuid not null, enabled boolean not null default true,
 last_seen_at timestamptz, state text not null default 'starting'
);
alter table public.integritas_case_conversations enable row level security;
alter table public.integritas_case_chat_messages enable row level security;
alter table public.integritas_case_chat_workers enable row level security;
revoke all on public.integritas_case_conversations,public.integritas_case_chat_messages,public.integritas_case_chat_workers from public,anon,authenticated;
grant all on public.integritas_case_conversations,public.integritas_case_chat_messages,public.integritas_case_chat_workers to service_role;

create function public.integritas_chat_enqueue(p_conversation uuid,p_key text,p_content text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare m integritas_case_chat_messages;
begin
 perform 1 from integritas_case_conversations where id=p_conversation for update;
 if not found then raise exception 'Conversation unavailable'; end if;
 select * into m from integritas_case_chat_messages where conversation_id=p_conversation and client_key=p_key;
 if found then
   if m.content<>p_content then raise exception 'Message identity conflict'; end if;
   return to_jsonb(m);
 end if;
 if length(p_key) not between 8 and 160 or length(p_content) not between 1 and 6000 then raise exception 'Invalid message'; end if;
 if exists(select 1 from integritas_case_chat_messages where conversation_id=p_conversation and role='user' and status in ('queued','processing')) then raise exception 'Wait for the current reply'; end if;
 if (select count(*) from integritas_case_chat_messages where conversation_id=p_conversation and role='user' and created_at>now()-interval '1 hour')>=30 then raise exception 'Conversation rate limit reached'; end if;
 insert into integritas_case_chat_messages(conversation_id,role,content,client_key,status) values(p_conversation,'user',p_content,p_key,'queued') returning * into m;
 return to_jsonb(m);
end $$;

create function public.integritas_chat_claim(p_worker text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare m integritas_case_chat_messages; owner_id uuid;
begin
 select user_id into owner_id from integritas_case_chat_workers where worker_id=p_worker and enabled;
 if not found then raise exception 'Worker disabled'; end if;
 update integritas_case_chat_messages x set status='failed',error_code='REPLY_INTERRUPTED' from integritas_case_conversations c
 where x.conversation_id=c.id and c.user_id=owner_id and x.status='processing' and x.lease_expires_at<now();
 select x.* into m from integritas_case_chat_messages x join integritas_case_conversations c on c.id=x.conversation_id
 join integritas_cases k on k.id=c.case_id
 join integritas_case_access a on a.case_id=c.case_id and a.user_id=c.user_id and a.role in ('owner','analyst')
 where c.user_id=owner_id and x.role='user' and x.status='queued' and k.status<>'archived'
 order by x.created_at,x.id for update of x skip locked limit 1;
 if not found then return null; end if;
 update integritas_case_chat_messages set status='processing',worker_id=p_worker,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '180 seconds' where id=m.id returning * into m;
 return to_jsonb(m);
end $$;

create function public.integritas_chat_complete(p_worker text,p_message uuid,p_lease uuid,p_reply text,p_memory jsonb,p_metadata jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare m integritas_case_chat_messages; reply_id uuid;
begin
 select x.* into m from integritas_case_chat_messages x join integritas_case_conversations c on c.id=x.conversation_id
 join integritas_case_chat_workers w on w.user_id=c.user_id and w.worker_id=p_worker and w.enabled
 join integritas_case_access a on a.case_id=c.case_id and a.user_id=c.user_id and a.role in ('owner','analyst')
 join integritas_cases k on k.id=c.case_id and k.status<>'archived'
 where x.id=p_message and x.worker_id=p_worker and x.lease_token=p_lease for update of x;
 if not found then raise exception 'Reply ownership denied'; end if;
 if m.status='completed' then return jsonb_build_object('ok',true,'replayed',true); end if;
 if m.status<>'processing' or m.lease_expires_at<now() then raise exception 'Reply lease expired'; end if;
 if length(p_reply) not between 1 and 12000 or octet_length(p_memory::text)>16000 then raise exception 'Reply capacity exceeded'; end if;
 insert into integritas_case_chat_messages(conversation_id,role,content,reply_to,status,metadata)
 values(m.conversation_id,'assistant',p_reply,m.id,'completed',p_metadata) returning id into reply_id;
 update integritas_case_chat_messages set status='completed',error_code=null where id=m.id;
 update integritas_case_conversations set memory=p_memory,memory_version=memory_version+1 where id=m.conversation_id;
 return jsonb_build_object('ok',true,'reply_id',reply_id);
end $$;
revoke all on function public.integritas_chat_enqueue(uuid,text,text),public.integritas_chat_claim(text),public.integritas_chat_complete(text,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.integritas_chat_enqueue(uuid,text,text),public.integritas_chat_claim(text),public.integritas_chat_complete(text,uuid,uuid,text,jsonb,jsonb) to service_role;
