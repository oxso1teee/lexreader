-- Задача из docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 4: расширение
-- системной библиотеки (owner_id null) авторским контентом на английском,
-- распределённым по уровням A1-B2 — вместо двух текстов, которые были
-- единственным содержимым раздела "Библиотека приложения".

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'Coffee in the Morning', $body$Every morning, Anna wakes up at seven. She goes to the kitchen and makes coffee. She likes her coffee hot and sweet. Anna sits by the window and drinks slowly. She looks at the street. People walk to work. Cars go past. A dog runs after a ball.

Anna eats a small piece of bread with her coffee. She reads the news on her phone. At eight, she gets ready for work. She puts on her coat and shoes. "Have a good day," she says to her cat. Then she leaves the house and closes the door.$body$, 'system', 'en', 'a1', 97);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'A Walk by the River', $body$Tom likes to walk by the river after school. The water is blue and clean. Birds sit on the trees. Tom often sees ducks in the water. They swim in small groups.

Today, the sun is warm. Tom sits on a bench and eats an apple. A boy and a girl play with a red ball near the water. An old man walks with his dog. The dog is brown and small.

Tom likes this place. It is quiet and nice. He comes here every day after his classes.$body$, 'system', 'en', 'a1', 89);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'My Best Friend', $body$My best friend is Maria. We are in the same class at school. Maria is tall, with long black hair. She is very kind and funny.

We like the same things. We both like music and books. On weekends, we go to the park together. Sometimes we watch a movie at my house.

Maria helps me with math. I help her with English. We talk every day, on the phone or at school. She is a good friend.$body$, 'system', 'en', 'a1', 78);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'The New Cat', $body$Last week, the Brown family got a new cat. Her name is Luna. Luna is small and white, with green eyes.

In the morning, Luna sleeps in the sun near the window. In the afternoon, she plays with a small ball. She likes to run around the house.

The children love Luna very much. They give her food and clean water every day. At night, Luna sleeps on the sofa. She is a happy cat in a happy home.$body$, 'system', 'en', 'a1', 79);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'A Letter to Mom', $body$Dear Mom,

How are you? I am fine. My new school is nice. My teacher is friendly and the students are kind.

I have a new friend. Her name is Sara. We sit together in class. After school, we do our homework at the library.

I miss you and Dad. I miss our home and our garden. I will call you this weekend.

With love,
Emma$body$, 'system', 'en', 'a1', 66);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'The Strange Neighbor', $body$When Mark moved into his new apartment, he noticed something strange about his neighbor. The man in apartment 4B never opened his curtains. He never said hello in the hallway. Every night, at exactly eleven o'clock, Mark heard music through the wall.

At first, Mark didn't think much about it. But after two weeks, he became curious. One evening, he decided to knock on the neighbor's door. Nobody answered, but Mark could hear footsteps inside.

The next day, Mark met the building manager. "Who lives in 4B?" he asked. The manager smiled. "Oh, that's Mr. Petrov. He's a musician. He plays the piano late at night because he works during the day, at the hospital."

Mark felt a little silly. The mystery wasn't a mystery at all. That evening, when the music started again, Mark didn't mind it anymore. He even started to like it. A few days later, he finally met Mr. Petrov in the hallway, and they talked about music for almost an hour.$body$, 'system', 'en', 'a2', 166);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'Lost in the Airport', $body$Jake had never traveled alone before. When his flight landed in a new country, he suddenly felt nervous. The airport was huge, with signs in a language he didn't understand.

He needed to find his suitcase, then a taxi to his hotel. But first, he had to find the right exit. He walked for almost twenty minutes, following signs that seemed to lead nowhere.

Finally, he saw a young woman wearing an airport uniform. "Excuse me," he said, "can you help me? I'm looking for the baggage area."

She smiled and pointed to a hallway on the left. "Just follow this corridor, and you'll see it. It's not far."

Jake thanked her and walked in that direction. Ten minutes later, he found his suitcase and a taxi outside. He felt proud of himself. Traveling alone was harder than he expected, but he was learning quickly. By his second day, he already felt more confident walking around the city on his own.$body$, 'system', 'en', 'a2', 161);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'A Weekend at the Lake', $body$Every summer, the Chen family spends a weekend at the lake house. This year, they arrived on Friday evening, just as the sun was setting behind the mountains.

On Saturday morning, the children woke up early and ran straight to the water. They swam, played games, and built a small boat out of wood. Their parents sat on the porch, drinking tea and watching them play.

In the afternoon, they went fishing together. Nobody caught anything big, but they didn't mind. It was more about spending time together than catching fish.

In the evening, they made a fire near the lake. They cooked sausages and told stories until it got dark. The stars were bright above the water, and everything felt calm and peaceful.

On Sunday, before leaving, they cleaned the house and packed their bags slowly. Nobody really wanted to go home. As they drove away, the children looked back at the lake through the car window, already thinking about next summer.$body$, 'system', 'en', 'a2', 163);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'The Old Bookshop', $body$On a quiet street in the old part of the city, there is a small bookshop that most people walk past without noticing. The sign above the door is faded, and the window is full of dusty old books.

Inside, the shop smells like paper and wood. An elderly man named Mr. Hill has owned the shop for over thirty years. He knows almost every book on his shelves, and he can always recommend the perfect one.

One day, a young student named Lily came in, looking for a book about local history. Mr. Hill thought for a moment, then walked to a shelf in the back of the shop. He pulled out a thin, old book with a green cover.

"This one isn't famous," he said, "but it's the best book about our city that I know."

Lily bought the book and read it that same night. She learned things about her own street that she had never known before. From that day, she visited the bookshop every week, and Mr. Hill always had something new to suggest.$body$, 'system', 'en', 'a2', 179);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'Cooking with Grandma', $body$Every Sunday, Sofia visits her grandmother to cook lunch together. It's a tradition that started when Sofia was a little girl, standing on a chair to reach the kitchen table.

Her grandmother doesn't use recipes. She says the best cooking comes from memory and taste, not from books. She teaches Sofia how much salt to add, how long to cook the meat, and when the soup is finally ready.

Last Sunday, they made a big pot of vegetable soup and fresh bread. While the bread was baking, Sofia's grandmother told stories about her own childhood, about the small village where she grew up and the garden her mother used to have.

Sofia loves these afternoons. It's not only about the food — it's about listening to her grandmother's stories and learning things that no book can teach. When the soup was ready, they sat together at the table and ate slowly, talking about everything and nothing at all.$body$, 'system', 'en', 'a2', 158);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'Escape from the City', $body$After five years of working in the same office, staring at the same grey walls, Daniel finally decided he needed a change. He wasn't sure exactly what he wanted, but he knew it wasn't this — the crowded subway every morning, the endless meetings, the constant noise of the city.

One evening, while scrolling through old photos on his phone, he found pictures from a trip he had taken years ago to a small village in the mountains. He remembered the silence there, the fresh air, the way time seemed to move more slowly. Without really planning it, he booked a train ticket for the following weekend.

When he arrived, the village looked almost exactly as he remembered it. The same narrow streets, the same old church, the same friendly faces in the local bakery. He rented a small room above a café and spent his days walking through the hills, reading books he had been meaning to finish for years.

By the end of the weekend, something in him had shifted. He wasn't sure if he could leave the city forever, but he knew he needed more of this — more silence, more slowness, more time to simply think. On the train back, he began writing a plan: not to escape completely, but to build a life with room for both worlds.$body$, 'system', 'en', 'b1', 223);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'The Mystery of Room 12', $body$The old hotel had been empty for almost a decade before it reopened under new owners. Most of the rooms were renovated quickly, but Room 12, at the end of the third floor, remained locked for reasons nobody could clearly explain.

When Clara took a job as the new receptionist, one of the older staff members warned her, half-joking, half-serious: "Never open Room 12 without asking the manager first." Curious by nature, Clara couldn't stop thinking about it.

One quiet afternoon, when the manager was away, she found the master key and walked upstairs. The corridor was silent except for the sound of her own footsteps. She unlocked the door slowly, expecting something dramatic — dust, cobwebs, perhaps old furniture covered in white sheets.

Instead, she found a small, carefully kept room. On the desk sat an old typewriter, a stack of letters, and a black-and-white photograph of a young couple. A note, yellowed with age, explained everything: the room had belonged to the hotel's original owner, who asked that it never be changed after his wife passed away there many years before.

Clara closed the door quietly, feeling as though she had trespassed on something private. She never told anyone what she had seen, but from that day, she understood why the room had stayed locked for so long — some places are kept not out of fear, but out of love.$body$, 'system', 'en', 'b1', 233);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'A Journey by Train', $body$There is something about long train journeys that Elena has always found comforting. Unlike flying, where the world disappears beneath the clouds, a train ride lets her watch the landscape slowly change outside the window — cities turning into fields, fields turning into forests, forests eventually giving way to mountains.

On this particular journey, she was traveling to visit her brother, whom she hadn't seen in almost two years. The trip would take nearly nine hours, but she didn't mind. She had brought a book, a notebook, and a bag of snacks for the road.

Across from her sat an elderly man reading a newspaper. After an hour of silence, he looked up and asked where she was traveling to. They ended up talking for most of the journey — about his years working on the railway, about her job in the city, about how much both of them missed simpler times.

As the train approached her stop, Elena realized she hadn't opened her book at all. Instead, she had spent hours listening to a stranger's stories, stories she would probably never hear again. When she stepped off the train, her brother was waiting on the platform, and she found herself already looking forward to the journey home.$body$, 'system', 'en', 'b1', 208);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'The Job Interview', $body$Nina had prepared for this interview for almost two weeks. She had researched the company, practiced answers to common questions, and even chosen her outfit three days in advance. Still, as she sat in the waiting room, her hands were shaking slightly.

When her name was called, she took a deep breath and walked into the office. The interviewer, a woman with a calm and friendly voice, asked her to sit down and offered her some water. The first few questions were easy — about her previous job, her strengths, her reasons for applying.

Then came a question Nina hadn't expected: "Tell me about a time you failed at something important." For a moment, her mind went blank. But instead of panicking, she decided to be honest. She talked about a project she had led the year before, one that hadn't gone as planned, and what she had learned from it.

To her surprise, the interviewer nodded and smiled. "That's exactly the kind of answer we're looking for," she said. "Most people try to hide their mistakes. We prefer people who can learn from them."

A week later, Nina received the good news: she had gotten the job. Looking back, she realized that her honest answer, the one she had been most afraid to give, was probably the reason she succeeded.$body$, 'system', 'en', 'b1', 221);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'Rain in October', $body$The rain had been falling steadily since early morning, turning the streets of the small town into rivers of grey light. Most people stayed indoors, watching the weather through their windows, but Oliver found himself drawn outside, wrapped in an old raincoat that had belonged to his father.

He walked without any real destination, letting his feet choose the direction. The town felt different in the rain — quieter, somehow more honest, as if the water had washed away all the usual noise and left only the essential things behind.

Near the old market square, he noticed a small café he had never visited before, its windows glowing warmly against the grey afternoon. He stepped inside, shook the water from his coat, and ordered a cup of tea. Through the window, he watched the rain continue to fall on the empty square.

An old woman at the next table was reading a book, occasionally glancing up at the weather. "October rain always feels different," she said, noticing him watching the street. "It's not just water. It's the whole year, slowly ending."

Oliver thought about her words long after he left the café. There was something true in them — a kind of quiet sadness in October rain, but also a kind of peace, a reminder that endings can be gentle, too.$body$, 'system', 'en', 'b1', 221);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'The Old House on the Hill', $body$At the edge of town, where the paved road gives way to gravel and the streetlights finally disappear, there stands an old house that has fascinated local children for generations. Its windows are dark, its garden overgrown with wild grass, and its wooden fence leans dangerously to one side, as though tired of standing after so many decades.

When Beatrice inherited the property from a great-aunt she had barely known, she expected to sell it within weeks. Real estate agents warned her that houses like this — old, isolated, in need of extensive repair — rarely attracted serious buyers. But something about the place made her hesitate. Perhaps it was the letters she found in the attic, dozens of them, tied together with faded ribbon, written by her great-aunt to a man whose name appeared nowhere else in the family's history.

Over the following months, instead of listing the house for sale, Beatrice found herself returning to it every weekend, slowly clearing rooms that hadn't been touched in years. Each discovery — an old piano, a collection of botanical drawings, a diary written in careful, looping handwriting — added another layer to a story she was only beginning to understand.

Her great-aunt, it turned out, had once been engaged to a young painter who left for the war and never returned. Rather than marrying someone else, as her family had expected, she had chosen to stay in this house, alone, surrounded by his letters and her memories, for the rest of her long life.

By the time autumn arrived, Beatrice had stopped thinking about selling the house at all. Instead, she began restoring it, room by room, not to erase its past, but to honor it. The house, it seemed, had been waiting not for a buyer, but for someone willing to listen to what it had to say.$body$, 'system', 'en', 'b2', 309);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'A Letter Never Sent', $body$Among the boxes his mother left behind, Marcus found an envelope addressed to a name he didn't recognize — no stamp, no postmark, sealed but never sent. For weeks, he carried it in his jacket pocket, uncertain whether opening it would be an act of curiosity or betrayal.

His mother had died quietly, after a long illness, leaving behind a life that had always seemed, to Marcus at least, entirely ordinary. She had worked as a schoolteacher for thirty years, raised two children largely on her own, and rarely spoke about anything before his own childhood. The unopened letter suggested there was more to her story than he had ever imagined.

Eventually, curiosity won. Inside, he found several pages written in his mother's familiar handwriting, addressed to a man named Aleksander. The letter described a version of his mother he had never known — younger, uncertain, deeply in love, and facing a decision that would define the rest of her life. She had been offered a scholarship abroad, one that would separate her from Aleksander indefinitely. In the letter, she tried to explain why she couldn't ask him to wait for her, why choosing her own future meant, in some ways, choosing against her own heart.

The letter was never sent. Whether she changed her mind, lost her courage, or simply decided that some things were better left unsaid, Marcus would never know. What he did know was that his mother had built an entire life, a family, an identity, on the other side of a decision that must have cost her more than he had ever understood.

He didn't try to find Aleksander. Some mysteries, he decided, deserved to remain exactly that — not because the truth wasn't worth knowing, but because his mother, in choosing silence, had already told him everything he needed to understand about the kind of woman she had been.$body$, 'system', 'en', 'b2', 315);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'The Last Train Home', $body$Victor had missed the last train home twice that month already, both times because of meetings that ran longer than planned, both times ending with an expensive taxi ride and a quiet apartment waiting for him well past midnight. Tonight, he told himself, would be different.

At 10:47, with three minutes to spare, he sprinted through the station, weaving between late-night travelers and cleaning staff, and threw himself into the last carriage just as the doors closed behind him. Breathless, he found a seat near the window and allowed himself a rare moment of satisfaction.

The carriage was nearly empty — a young couple asleep against each other near the far end, a man in a business suit scrolling through his phone, and, across from Victor, an elderly woman knitting something pale blue, her needles moving with the quiet rhythm of long habit. 

Somewhere between the third and fourth stop, the train slowed unexpectedly and came to a complete stop between stations. The lights flickered, then steadied. An announcement crackled through unseen speakers, apologizing for a signal failure ahead, promising an update shortly.

Rather than the frustration Victor expected to feel, something unexpected happened: the woman across from him looked up from her knitting and smiled. "Well," she said, "seems like we're not going anywhere for a while." And then, without any obvious reason, she began to talk — about her late husband, about the sweater she was knitting for a grandson she rarely saw, about how she had ridden this same line for nearly forty years and had grown to appreciate its small, unplanned interruptions.

By the time the train finally began moving again, nearly thirty minutes later, Victor had learned more about a stranger's life than he had learned about most of his own colleagues in years of working alongside them. When he finally reached his stop, he found himself, for the first time in a long while, in no particular hurry to get home.$body$, 'system', 'en', 'b2', 327);

insert into texts (owner_id, title, body, source_type, language, level_tag, word_count)
values (null, 'Between Two Cities', $body$For nearly three years, Yasmin had lived a life divided neatly between two cities, spending weekdays in the capital for work and returning every Friday evening to the smaller coastal town where she had grown up and where her parents still lived. It was, by any reasonable measure, an exhausting arrangement — hours spent on trains, a small apartment in the city that never quite felt like home, and a persistent sense of belonging fully to neither place.

Friends occasionally asked why she didn't simply choose one city and commit to it entirely. The question always struck her as strange, as though life required such tidy decisions, as though a person couldn't reasonably hold two different versions of themselves at once — the ambitious professional who thrived on the energy of the capital, and the daughter who needed, every week, the particular quiet of the sea and her mother's kitchen.

The arrangement had never been entirely comfortable, but comfort, Yasmin had come to believe, was not always the most important thing. There was something valuable in the discomfort itself, in the weekly reminder that neither ambition nor belonging alone could sustain a whole life. The city gave her purpose and challenge; the coastal town gave her rest and rootedness. Losing either one, she suspected, would leave her diminished in ways she couldn't fully articulate.

On the train each Friday, watching the landscape shift from concrete towers to open fields to, eventually, the grey line of the sea, Yasmin often thought about how strange it was that a single life could contain such different rhythms without breaking apart. Perhaps, she thought, the discomfort of living between two places was simply the cost of refusing to give up either one — and perhaps that cost, however tiring, was one worth paying.$body$, 'system', 'en', 'b2', 299);
