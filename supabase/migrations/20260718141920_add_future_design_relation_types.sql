alter table public.element_relations drop constraint element_relations_relation_type_check;
alter table public.element_relations add  constraint element_relations_relation_type_check
  check (relation_type = any (array[
    'guides','evidencedBy','promisedTo','communicatedAs','constrainedBy','conflictsWith',
    'aspiresTo','requires','toBeEvidencedBy','verifies']));
notify pgrst, 'reload schema';
