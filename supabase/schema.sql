-- DikzCryz: token, perangkat, dan chat. Jalankan SELURUHNYA di Supabase > SQL Editor > Run.
create extension if not exists pgcrypto;

create table if not exists licenses (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  buyer text not null default '',
  max_devices int not null default 2 check (max_devices between 1 and 50),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  device_id text not null,
  name text not null,
  session uuid not null default gen_random_uuid(),
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (license_id, device_id)
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  room text not null,
  activation_id uuid references activations(id) on delete set null,
  author text not null,
  body text not null check (char_length(body) between 1 and 1000),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_room_id on messages (room, id);

create table if not exists admins (email text primary key);

-- Pembantu: apakah yang login adalah admin
create or replace function is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select exists (select 1 from admins where email = (auth.jwt() ->> 'email'))
$$;

-- RLS: pengguna aplikasi (anon) TIDAK bisa membaca/menulis tabel langsung. Hanya admin.
alter table licenses    enable row level security;
alter table activations enable row level security;
alter table messages    enable row level security;
alter table admins      enable row level security;

drop policy if exists admin_all on licenses;
drop policy if exists admin_all on activations;
drop policy if exists admin_all on messages;
drop policy if exists admin_read on admins;
create policy admin_all on licenses    for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on activations for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_all on messages    for all to authenticated using (is_admin()) with check (is_admin());
create policy admin_read on admins     for select to authenticated using (is_admin());

-- Cek sesi (internal, tidak bisa dipanggil dari aplikasi)
create or replace function _sess(p_session uuid) returns activations
language plpgsql security definer set search_path = public as $$
declare a activations; l licenses;
begin
  select * into a from activations where session = p_session;
  if not found then raise exception 'Sesi tidak valid, silakan masuk lagi'; end if;
  select * into l from licenses where id = a.license_id;
  if a.banned or not l.active then raise exception 'Akses dicabut oleh admin'; end if;
  if a.last_seen < now() - interval '1 minute' then
    update activations set last_seen = now() where id = a.id;
  end if;
  return a;
end $$;

-- Daftar / masuk dengan token
create or replace function activate(p_token text, p_device text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
declare l licenses; a activations; n int; nm text := left(btrim(coalesce(p_name, '')), 30);
begin
  if nm = '' then raise exception 'Nama wajib diisi'; end if;
  if length(coalesce(p_device, '')) < 8 then raise exception 'Perangkat tidak dikenali'; end if;
  select * into l from licenses where token = upper(btrim(coalesce(p_token, '')));
  if not found or not l.active then raise exception 'Token tidak valid atau sudah dicabut'; end if;

  select * into a from activations where license_id = l.id and device_id = p_device;
  if found then
    if a.banned then raise exception 'Akses dicabut oleh admin'; end if;
    update activations set name = nm, last_seen = now() where id = a.id returning * into a;
  else
    select count(*) into n from activations where license_id = l.id and not banned;
    if n >= l.max_devices then
      raise exception 'Token sudah dipakai di % perangkat (batas tercapai). Hubungi developer.', l.max_devices;
    end if;
    insert into activations (license_id, device_id, name) values (l.id, p_device, nm) returning * into a;
  end if;
  return json_build_object('session', a.session, 'name', a.name, 'id', a.id);
end $$;

-- Validasi sesi saat aplikasi dibuka
create or replace function whoami(p_session uuid) returns json
language plpgsql security definer set search_path = public as $$
declare a activations;
begin
  a := _sess(p_session);
  return json_build_object('name', a.name, 'id', a.id);
end $$;

-- Ambil pesan: ruang 'group' (komunitas) atau 'dm:<id sendiri>' (chat pribadi ke admin)
create or replace function chat_get(p_session uuid, p_room text, p_after bigint default 0) returns json
language plpgsql security definer set search_path = public as $$
declare a activations; r json;
begin
  a := _sess(p_session);
  if p_room <> 'group' and p_room <> ('dm:' || a.id::text) then
    raise exception 'Ruang chat tidak valid';
  end if;
  select coalesce(json_agg(x order by x.id), '[]'::json) into r from (
    select id, author, body, is_admin, created_at, (activation_id = a.id) as mine
    from messages
    where room = p_room and id > coalesce(p_after, 0)
    order by id desc limit 100
  ) x;
  return r;
end $$;

-- Kirim pesan (maks 1000 karakter, maks 5 pesan per 10 detik)
create or replace function chat_send(p_session uuid, p_room text, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare a activations; b text := btrim(coalesce(p_body, '')); n int;
begin
  a := _sess(p_session);
  if p_room <> 'group' and p_room <> ('dm:' || a.id::text) then
    raise exception 'Ruang chat tidak valid';
  end if;
  if b = '' or char_length(b) > 1000 then raise exception 'Pesan kosong atau terlalu panjang'; end if;
  select count(*) into n from messages where activation_id = a.id and created_at > now() - interval '10 seconds';
  if n >= 5 then raise exception 'Terlalu cepat, tunggu sebentar'; end if;
  insert into messages (room, activation_id, author, body) values (p_room, a.id, a.name, b);
  return json_build_object('ok', true);
end $$;

-- Hak akses fungsi: aplikasi hanya boleh memanggil 4 fungsi ini
revoke all on function _sess(uuid) from public, anon, authenticated;
revoke all on function activate(text, text, text) from public;
revoke all on function whoami(uuid) from public;
revoke all on function chat_get(uuid, text, bigint) from public;
revoke all on function chat_send(uuid, text, text) from public;
grant execute on function activate(text, text, text) to anon, authenticated;
grant execute on function whoami(uuid) to anon, authenticated;
grant execute on function chat_get(uuid, text, bigint) to anon, authenticated;
grant execute on function chat_send(uuid, text, text) to anon, authenticated;

-- TERAKHIR: daftarkan email admin-mu (ganti dulu dengan email akun admin di Supabase > Authentication > Users)
-- insert into admins (email) values ('emailmu@contoh.com');
