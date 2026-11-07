create table if not exists scores (
  id serial primary key,
  nick text not null,
  tiles_left integer not null,
  moves integer not null,
  mispicks integer not null,
  created_at timestamptz not null default now()
);

create index if not exists scores_rank_idx on scores (tiles_left, mispicks, moves, created_at);
