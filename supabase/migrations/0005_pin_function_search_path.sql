-- Pin the trigger function's search_path to the empty string. Closes the
-- function_search_path_mutable advisory; no behavior change because the
-- function only touches NEW/OLD columns, not schema-qualified objects.

alter function public.runs_only_match_id_update() set search_path = '';
