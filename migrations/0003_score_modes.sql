alter table scores add column if not exists mode text not null default 'normal';
alter table scores add column if not exists elapsed_sec integer not null default 0;

create index if not exists scores_mode_rank_idx on scores (mode, tiles_left, elapsed_sec, mispicks, moves);
