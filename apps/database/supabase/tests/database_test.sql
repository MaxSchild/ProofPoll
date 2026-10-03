BEGIN;

SELECT plan(2);

SELECT has_function(
    'public',
    'set_updated_at',
    'set_updated_at() trigger helper should exist'
  );

SELECT hasnt_table(
    'public',
    'private_items',
    'the starter demo table private_items should be gone'
  );

SELECT * FROM finish();
ROLLBACK;
