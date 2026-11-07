# Builds js/prompts.js: the passport prompts (30 approved + 30 new) and their valid answers (ISO codes).
# Run: python3 tools/build_prompts.py   (checks every code exists in js/countries.js)
import json, re, unicodedata
src = open('js/countries.js', encoding='utf8').read()
rows = re.findall(r'\["([A-Z]{2})", "([^"]+)"', src)
NAMES = dict(rows); CODES = set(NAMES)
W = 'https://en.wikipedia.org/wiki/'

def same_letter():
    out = []
    for c, n in rows:
        s = ''.join(ch for ch in unicodedata.normalize('NFD', n.lower()) if 'a' <= ch <= 'z')
        if s and s[0] == s[-1]: out.append(c)
    return out


def letters(t): return ''.join(ch for ch in unicodedata.normalize('NFD', t.lower()) if 'a' <= ch <= 'z')
def pick(f): return [c for c, n in rows if f(n)]
CAPS = {c: cap for c, n, cap in re.findall(r'\["([A-Z]{2})", "([^"]+)", "([^"]+)"', src)}
def vowel_start(): return pick(lambda n: letters(n)[0] in 'aeiou')
def short_name(): return pick(lambda n: len(letters(n)) <= 4)
def has_z(): return pick(lambda n: 'z' in letters(n))
def cap_same(): return [c for c, n in rows if letters(CAPS[c]) == letters(n)]
def double_letter(): return pick(lambda n: any(re.search(r'(.)\1', letters(w)) for w in re.split(r'[ -]', n)))
def cap_b(): return [c for c, n in rows if letters(CAPS[c]).startswith('b')]
def multi_word(): return pick(lambda n: ' ' in n.strip())
def hidden_country():
    out = []
    for c, n in rows:
        for c2, m in rows:
            if c != c2 and len(m) >= 4 and letters(m) in letters(n) and letters(m) != letters(n): out.append(c); break
    return out

# id, text, family, level, rule, source, checked (page opened by Claude), answers
P = [
 (1, 'Has over 100 million people', 'People', 'Easy', 'Latest UN population estimate (2024).', 'https://population.un.org/wpp/', True,
  'IN CN US ID PK NG BR BD RU ET MX JP EG PH CD VN'),
 (2, 'Has 3 or more official languages', 'People', 'Easy', 'Official at national level; regional and sign languages do not count. Switzerland counts under its federal constitution (German, French, Italian).', W+'List_of_official_languages_by_country_and_territory', True,
  'CH ZA BO ZW SG LU BE RW SC VU FJ BA ET PG BI KM GQ'),
 (3, 'Is landlocked', 'Size and shape', 'Easy', 'No coastline on an ocean or sea; the Caspian counts as a lake.', W+'Landlocked_country', True,
  'AF AD AM AT AZ BY BT BO BW BF BI CF TD CZ SZ ET HU KZ KG LA LS LI LU MW ML MD MN NP NE MK PY RW SM RS SK SS CH TJ TM UG UZ VA ZM ZW'),
 (4, 'Is made up entirely of islands', 'Size and shape', 'Easy', 'Countries that share an island count. Australia counts as a continent, not an island.', W+'List_of_island_countries', True,
  'AG BS BH BB BN CV KM CU CY DM DO FJ GD HT IS ID IE JM JP KI MG MV MT MH MU FM NR NZ PW PG PH WS ST SC SG SB LK KN LC VC TL TO TT TV GB VU'),
 (5, 'Is larger than 1 million km²', 'Size and shape', 'Easy', 'Total area including inland water.', W+'List_of_countries_and_dependencies_by_area', True,
  'RU CA CN US BR AU IN AR KZ DZ CD SA MX ID SD LY IR MN PE TD NE AO ML ZA CO ET BO MR EG'),
 (6, 'Borders the United States', 'Neighbours', 'Easy', 'Land borders only.', W+'Borders_of_the_United_States', False, 'CA MX'),
 (7, 'Is in Africa and on the Mediterranean Sea', 'Location', 'Medium', '', W+'Mediterranean_Sea', False, 'EG LY TN DZ MA'),
 (8, 'Has a moon on its flag', 'Symbols', 'Easy', 'Crescents and full moons count (Laos, Palau), including small ones inside an emblem (Croatia, Moldova). National flag only.', W+'List_of_national_flags_of_sovereign_states', False,
  'DZ AZ KM LY MY MV MR PK SG TN TR TM UZ NP LA PW MN BN HR MD'),
 (9, 'Has an official national flower', 'Symbols', 'Hard', 'Only flowers the source says were made official by law, decree or the government.', W+'List_of_national_flowers', True,
  'KH ID KR AU US TJ'),
 (10, 'Has hosted the Summer Olympics', 'History', 'Easy', 'Games held up to 2024; the Soviet Union counts as Russia.', W+'List_of_Olympic_Games_host_cities', True,
  'GR FR US GB SE BE NL DE FI AU IT JP MX CA RU KR ES CN BR'),
 (11, 'Has a name that starts and ends with the same letter', 'Wordplay', 'Easy', 'Uses the country name as the game writes it; names of more than one word count.', '', True, None),
 (12, 'Has fewer than 1 million people', 'People', 'Medium', 'Latest UN population estimate (2024).', 'https://population.un.org/wpp/', True,
  'AD AG BS BB BZ BT BN CV KM CY DM FJ GD GY IS KI LI LU MV MT MH FM MC ME NR PW KN LC VC WS SM ST SC SB SR TO TV VU VA'),
 (13, 'Has a capital that is not its largest city', 'People', 'Medium', 'As the source lists it.', W+'List_of_countries_whose_capital_is_not_their_largest_city', True,
  'AU BZ BJ BO BR BI CM CA CN EC GQ GM IN CI KZ LI FM MT MA MM NR NZ NG PK PW PH SM ZA CH TZ TT TR AE US VN'),
 (14, 'Borders at least 5 countries', 'Neighbours', 'Medium', 'Land borders only; Kosovo and Western Sahara count as neighbours.', W+'List_of_countries_and_territories_by_number_of_land_borders', True,
  'CN RU BR DE CD AT FR RS TZ TR ZM HU ML NE SA UA DZ IR PL SD LY TD AF BO BF CF GN IN IQ IT ME KZ PE AR CO MM LA UZ AZ SY JO KE UG ET SS CM CG MZ ZA CI SN BG RO SK BY CH ES HR MK'),
 (15, 'Has a mountain higher than 5,000 m', 'Size and shape', 'Medium', 'Peaks on a border count for every country they touch.', W+'List_of_elevation_extremes_by_country', True,
  'NP CN IN PK BT AF TJ KG KZ MM IR RU GE TR TZ KE UG CD AR CL PE BO EC CO MX US CA'),
 (16, 'Crosses the Equator', 'Location', 'Medium', 'Land or territorial waters (Maldives, Kiribati and the United States through its Pacific islands).', W+'Equator', True, 'EC CO BR ID KE UG SO CD CG GA ST MV KI US'),
 (17, 'Has a flag with three vertical stripes', 'Symbols', 'Medium', 'An emblem on the middle stripe counts (Mexico, Peru); Canada\'s wide middle stripe counts.', W+'Triband_(flag)', True,
  'FR IT IE BE RO MD AD MX GT PE NG CI GN ML SN TD CM MN BB VC CA'),
 (18, 'Has a flag with no red', 'Symbols', 'Medium', 'Any red anywhere, emblems included, rules a flag out. Orange and maroon are not red.', W+'List_of_national_flags_of_sovereign_states', False,
  'BR UA SE GR AR BS BB BA BW CY EE FI GA HN JM KZ FM NR PW RW LC VC SL SB SO UY IN IE CI NE SA PK BT MH TZ NG'),
 (19, 'Drives on the left', 'Symbols', 'Medium', '', W+'Left-_and_right-hand_traffic', True,
  'AG AU BS BD BB BT BW BN CY DM SZ FJ GD GY IN ID IE JM JP KE KI LS MW MY MV MT MU MZ NA NR NP NZ PK PG KN LC VC WS SC SG SB ZA LK SR TZ TH TL TO TT TV UG GB ZM ZW'),
 (20, 'Gained independence after 1950', 'History', 'Medium', 'Independence date in 1951 or later. Soviet, Yugoslav and Czechoslovak break-ups count. Vietnam (1945) does not; Yemen (1967) does.', W+'List_of_national_independence_days', True,
  'LY SD MA TN GH GN CM SN TG ML MG CD SO BJ NE BF CI TD CF CG GA NG MR SL TZ RW BI DZ UG KE MW ZM GM BW LS MU SZ GQ GW MZ CV KM ST AO SC DJ ZW NA ER SS KH LA MY SG MV KW CY BH QA AE BD BN TL KZ KG TJ TM UZ AM AZ GE MT EE LV LT BY UA MD SI HR MK BA ME CZ SK JM TT BB GY BS GD SR DM LC VC BZ AG KN WS NR TO FJ PG SB TV KI VU MH FM PW YE'),
 (21, 'Was once part of the Ottoman Empire', 'History', 'Medium', 'Ruled directly or as a vassal, for all or a large part of today\'s country.', W+'Territorial_evolution_of_the_Ottoman_Empire', False,
  'TR GR BG RO RS ME BA MK AL HU MD CY EG LY TN DZ SD ER IQ SY LB JO PS SA YE KW QA'),
 (22, 'Was a French colony or protectorate', 'History', 'Medium', 'Includes League of Nations mandates (Lebanon, Syria, Togo, Cameroon) and the Anglo-French New Hebrides (Vanuatu). Countries where France held only a small part (Canada, United States) do not count.', W+'French_colonial_empire', True,
  'DZ TN MA MR SN ML GN CI BF NE BJ TG CM TD CF CG GA MG KM DJ MU SC VN LA KH LB SY HT LC VU'),
 (23, 'Was part of the Soviet Union', 'History', 'Medium', '', W+'Post-Soviet_states', True, 'AM AZ BY EE GE KZ KG LV LT MD RU TJ TM UA UZ'),
 (24, 'Is a monarchy today', 'History', 'Medium', 'Has its own monarch. Countries whose head of state is the British monarch don\'t count; the United Kingdom does.', W+'List_of_current_monarchies', True,
  'AD BH BE BT BN KH DK SZ JP JO KW LS LI LU MY MC MA NL NO OM QA SA ES SE TH TO AE GB VA'),
 (25, 'Has coastlines on two different oceans or seas', 'Size and shape', 'Hard', 'Waters counted: Pacific, Atlantic, Indian, Arctic, Southern, Mediterranean, Caribbean, Black, Red and Baltic. A sea counts apart from the ocean it joins.', W+'List_of_countries_by_length_of_coastline', False,
  'US CA MX CO PA CR NI HN GT CL RU ZA ID AU MY TH ES FR MA EG TR SA YE DJ DE DK SE NO VE CU HT DO AG KN DM LC VC GD TT'),
 (26, 'Borders exactly one country', 'Neighbours', 'Hard', 'Land borders as the source counts them (Bahrain by its causeway, Cyprus by the British bases).', W+'List_of_countries_and_territories_by_number_of_land_borders', True,
  'PT DK LS HT DO CA IE MC SM VA GM QA KR BN TL GB PG BH CY'),
 (27, 'Has territory on two continents', 'Location', 'Hard', 'Mainland, islands and enclaves that are part of the country count. Overseas territories that are not part of the country, and Antarctic claims, do not.', W+'Transcontinental_country', True,
  'RU TR KZ AZ GE EG PA GR IT ES PT UA YE NL DK FR US CO VE CL EC MX CR JP AU ID MY BN PH PG'),
 (28, 'Has a mythical creature on its flag', 'Symbols', 'Hard', 'National flag only. Kept narrow on purpose: only Bhutan\'s dragon qualifies.', W+'Flag_of_Bhutan', False, 'BT'),
 (29, 'Shares a time zone with Vietnam (UTC+7)', 'Location', 'Hard', 'The capital\'s standard time is UTC+7. Vietnam itself does not count.', W+'UTC%2B07:00', True, 'TH LA KH ID'),
 (30, 'Moved its capital to a new city after 1950', 'History', 'Hard', 'The move is official. Botswana and Mauritania count (their colonial capitals were outside the country); Equatorial Guinea counts (Ciudad de la Paz, Jan 2026). Indonesia and Egypt do not yet.', W+'List_of_purpose-built_national_capitals', True,
  'BR PK MW TZ CI NG BZ KZ MM PW LK BI FM DE BW MR GQ'),
 # ---- batch 2 (31-60), drafted 7 Nov 2026. Computed lists come from js/countries.js, so they are checked by construction.
 (31, 'Has over 60 million people', 'People', 'Medium', 'Latest UN population estimate (2024). Italy (about 59 million) just misses.', 'https://population.un.org/wpp/', False,
  'IN CN US ID PK NG BR BD RU ET MX JP EG PH CD VN IR TR DE TH GB TZ FR ZA'),
 (32, 'Has under 100,000 people', 'People', 'Hard', 'Latest UN population estimate (2024). Seychelles, Tonga and Saint Vincent are just above the line.', 'https://population.un.org/wpp/', False,
  'LI SM MC PW NR TV VA DM KN MH AD AG'),
 (33, 'Is smaller than 1,000 km²', 'Size and shape', 'Medium', 'Total area including inland water.', W+'List_of_countries_and_dependencies_by_area', False,
  'VA MC NR TV SM LI MH KN MV MT GD VC BB AG SC PW AD LC FM SG TO DM BH KI ST'),
 (34, 'Is in Asia and landlocked', 'Size and shape', 'Medium', 'No coastline on an ocean or sea; the Caspian counts as a lake. Azerbaijan and Kazakhstan count.', W+'Landlocked_country', True,
  'AF AM AZ BT KZ KG LA MN NP TJ TM UZ'),
 (35, 'Is in Europe and landlocked', 'Size and shape', 'Medium', 'No coastline on an ocean or sea. Bosnia and Herzegovina does not count (it has a short Adriatic coast at Neum).', W+'Landlocked_country', True,
  'AD AT BY CZ HU LI LU MD MK SM RS SK CH VA'),
 (36, 'Is doubly landlocked', 'Size and shape', 'Hard', 'Landlocked, and every neighbour is landlocked too. Kept narrow on purpose: only two countries qualify.', W+'Doubly_landlocked_country', False, 'LI UZ'),
 (37, 'Is in Oceania', 'Location', 'Easy', 'Australia, New Zealand, Papua New Guinea and the Pacific island nations.', W+'Oceania', False,
  'AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU'),
 (38, 'Is in South America', 'Location', 'Easy', 'The 12 independent countries; French Guiana is not a country.', W+'South_America', False,
  'AR BO BR CL CO EC GY PY PE SR UY VE'),
 (39, 'Is in the Caribbean', 'Location', 'Medium', 'Island countries in the Caribbean Sea and the nearby Atlantic. Belize, Guyana and Suriname are on the mainland and do not count.', W+'Caribbean', False,
  'AG BS BB CU DM DO GD HT JM KN LC VC TT'),
 (40, 'Is in Central America', 'Location', 'Easy', 'The seven countries on the land bridge between Mexico and Colombia.', W+'Central_America', False, 'BZ CR SV GT HN NI PA'),
 (41, 'Has a coast on the Mediterranean Sea', 'Location', 'Hard', 'Bosnia and Herzegovina counts (Neum). Israel is not in the game.', W+'Mediterranean_Sea', False,
  'ES FR MC IT MT SI HR BA ME AL GR TR CY SY LB PS EG LY TN DZ MA'),
 (42, 'Borders China', 'Neighbours', 'Medium', 'Land borders only.', W+'Borders_of_China', False, 'AF BT IN KZ KG LA MN MM NP KP PK RU TJ VN'),
 (43, 'Borders Russia', 'Neighbours', 'Medium', 'Land borders only; Lithuania and Poland count through Kaliningrad.', W+'Borders_of_Russia', False,
  'NO FI EE LV LT PL BY UA GE AZ KZ CN MN KP'),
 (44, 'Borders Brazil', 'Neighbours', 'Medium', 'Land borders only; France counts through French Guiana.', W+'Borders_of_Brazil', False,
  'AR BO CO FR GY PY PE SR UY VE'),
 (45, 'Has a Nordic cross on its flag', 'Symbols', 'Medium', 'An off-centre cross on a plain field: the five Nordic countries.', W+'Nordic_cross_flag', False, 'DK FI IS NO SE'),
 (46, 'Has an eagle on its flag', 'Symbols', 'Hard', 'National flag only; double-headed eagles count. Condors do not.', W+'List_of_national_flags_of_sovereign_states', False,
  'AL EG KZ MD ME MX RS ZM'),
 (47, 'Has the Union Jack on its flag', 'Symbols', 'Medium', 'The United Kingdom itself is not counted; the answer is flags that carry it in the corner.', W+'Flags_with_the_Union_Jack', False, 'AU NZ FJ TV'),
 (48, 'Was once part of Yugoslavia', 'History', 'Medium', 'The six republics. Kosovo is not in the game.', W+'Yugoslavia', False, 'SI HR BA RS ME MK'),
 (49, 'Was a Portuguese colony', 'History', 'Medium', 'Ruled by Portugal until independence.', W+'Portuguese_Empire', False, 'AO MZ CV GW ST TL BR'),
 (50, 'Was a Spanish colony', 'History', 'Medium', 'Ruled by Spain until independence (1898 for Cuba and the Philippines). Short or early Spanish rule that ended long before (Jamaica, Trinidad) does not count.', W+'Spanish_Empire', False,
  'MX GT HN SV NI CR PA CU DO CO VE EC PE BO CL AR UY PY PH GQ'),
 (51, 'Has hosted the Winter Olympics', 'History', 'Medium', 'Games held up to 2026. Bosnia and Herzegovina counts for Sarajevo 1984 (then Yugoslavia).', W+'List_of_Olympic_Games_host_cities', False,
  'AT BA CA CN FR DE IT JP KR NO RU CH US'),
 (52, 'Has hosted the men\'s football World Cup', 'History', 'Medium', 'Tournaments up to 2026. England counts as the United Kingdom; Japan, South Korea and the 2026 co-hosts count.', W+'List_of_FIFA_World_Cup_hosts', False,
  'UY IT FR BR CH SE CL GB MX DE AR ES US JP KR ZA RU QA CA'),
 (53, 'Has a name that starts with a vowel', 'Wordplay', 'Easy', 'A, E, I, O or U, using the country name as the game writes it.', '', True, vowel_start),
 (54, 'Has a name with 4 letters or fewer', 'Wordplay', 'Medium', 'Counts letters only, using the country name as the game writes it.', '', True, short_name),
 (55, 'Has a Z in its name', 'Wordplay', 'Medium', 'Uses the country name as the game writes it; names of more than one word count.', '', True, has_z),
 (56, 'Has a capital with the same name as the country', 'Wordplay', 'Hard', 'Uses the capital as the game writes it. Kept narrow on purpose.', '', True, cap_same),
 (57, 'Has a double letter in its name', 'Wordplay', 'Medium', 'Two of the same letter side by side inside one word (the Marshall Islands, Greece).', '', True, double_letter),
 (58, 'Has a capital that starts with B', 'Wordplay', 'Medium', 'Uses the capital as the game writes it.', '', True, cap_b),
 (59, 'Has a name with more than one word', 'Wordplay', 'Easy', 'Hyphenated names (Guinea-Bissau, Timor-Leste) count as one word.', '', True, multi_word),
 (60, 'Has another country\'s name hidden inside its name', 'Wordplay', 'Hard', 'Another game country\'s full name sits inside it (Niger in Nigeria, Mali in Somalia).', '', True, hidden_country),

]
out, errors = [], []
for (n, text, fam, lvl, rule, srcu, checked, ans) in P:
    codes = ans() if callable(ans) else (same_letter() if ans is None else ans.split())
    bad = [c for c in codes if c not in CODES]
    dup = sorted({c for c in codes if codes.count(c) > 1})
    if bad or dup: errors.append((n, bad, dup))
    out.append({'id': 'pp%02d' % n, 'text': text, 'family': fam, 'level': lvl, 'rule': rule, 'source': srcu,
                'sourceChecked': checked, 'answers': sorted(set(codes))})
assert not errors, errors
js = ('/* Passport prompts, approved by Harley in review rounds 1 and 2 (6 Nov 2026). Generated by tools/build_prompts.py.\n'
      '   answers = ISO codes from js/countries.js. sourceChecked = Claude opened the source page; the rest are drafted\n'
      '   from general knowledge and still need checking against the source before release (PRD NFR-7). */\n'
      'var Prompts = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n')
open('js/prompts.js', 'w', encoding='utf8').write(js)
for o in out: print('%-5s %-5s %3d  %s' % (o['id'], o['level'], len(o['answers']), o['text']))
print('pp11:', ', '.join(NAMES[c] for c in out[10]['answers']))
