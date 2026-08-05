-- Стартовые тексты библиотеки приложения (owner_id = null, раздел 4.2 ТЗ)

-- M3 Slice 3: a system-seeded YouTube material — e2e/library.spec.ts's
-- video-filter and thumbnail tests need a real youtube_video_id row that
-- survives `supabase db reset` (previously this only existed as an ad-hoc
-- manually-imported row in a developer's local test account, which broke
-- the moment the local DB was reset — not actually reproducible from a
-- clean database, contrary to this file's own "real seeded materials"
-- claim). jNQXAC9IVRw is the real "Me at the zoo" video id.
insert into texts (owner_id, title, body, source_type, language, level_tag, word_count, youtube_video_id) values
(
  null,
  'Me at the zoo (test)',
  'All right, so here we are in front of the elephants. The cool thing about these guys is that they have really, really, really long trunks. And that''s cool. And that''s pretty much all there is to say.',
  'system',
  'en',
  'a1',
  36,
  'jNQXAC9IVRw'
);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count) values
(
  null,
  'A Walk in the Park',
  'Every morning, Maria takes a walk in the park near her house. She likes to watch the birds and listen to the wind in the trees. Sometimes she brings a book and sits on a bench for an hour. Today the sky is blue and the air is cool. She feels happy and calm. After her walk, she goes home and makes a cup of tea.',
  'system',
  'en',
  'a2',
  70
),
(
  null,
  'The Coffee Shop on the Corner',
  'There is a small coffee shop on the corner of my street. I go there almost every day before work. The owner, an old man named Tom, always remembers my order. He says that a good cup of coffee can change your whole morning. I usually sit by the window and watch people walking by. It is a simple habit, but it makes me feel like part of the neighborhood.',
  'system',
  'en',
  'b1',
  85
),
(
  null,
  'Un día en la playa',
  'Ayer fuimos a la playa con toda la familia. Hacía mucho sol y el agua estaba fría pero agradable. Los niños construyeron un castillo de arena mientras nosotros preparábamos la comida. Por la tarde caminamos por la orilla y recogimos conchas. Fue un día tranquilo y perfecto para descansar.',
  'system',
  'es',
  'a2',
  55
);
