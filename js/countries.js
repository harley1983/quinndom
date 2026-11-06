/* Country table: the 194 countries a player can collect (UN members and observer states; Israel is left out of the game,
   as decided with the stamp atlas). Dependent territories are not countries here.
   Row: [ISO code, name, capital, continent, aliases?]. Continents: AF Africa, AS Asia, EU Europe, NA North America, SA South America, OC Oceania.
   Passport answers must match a name or alias (ignoring capitals/accents), so "Ivory Coast" and "Cote d'Ivoire" both work. */
var Countries = (function () {
  var ROWS = [
    ["AF", "Afghanistan", "Kabul", "AS"],
    ["AL", "Albania", "Tirana", "EU"],
    ["DZ", "Algeria", "Algiers", "AF"],
    ["AD", "Andorra", "Andorra la Vella", "EU"],
    ["AO", "Angola", "Luanda", "AF"],
    ["AG", "Antigua and Barbuda", "St. John's", "NA", ["Antigua"]],
    ["AR", "Argentina", "Buenos Aires", "SA"],
    ["AM", "Armenia", "Yerevan", "AS"],
    ["AU", "Australia", "Canberra", "OC"],
    ["AT", "Austria", "Vienna", "EU"],
    ["AZ", "Azerbaijan", "Baku", "AS"],
    ["BS", "Bahamas", "Nassau", "NA", ["The Bahamas"]],
    ["BH", "Bahrain", "Manama", "AS"],
    ["BD", "Bangladesh", "Dhaka", "AS"],
    ["BB", "Barbados", "Bridgetown", "NA"],
    ["BY", "Belarus", "Minsk", "EU", ["Byelorussia"]],
    ["BE", "Belgium", "Brussels", "EU"],
    ["BZ", "Belize", "Belmopan", "NA"],
    ["BJ", "Benin", "Porto-Novo", "AF"],
    ["BT", "Bhutan", "Thimphu", "AS"],
    ["BO", "Bolivia", "Sucre", "SA"],
    ["BA", "Bosnia and Herzegovina", "Sarajevo", "EU", ["Bosnia", "Bosnia Herzegovina"]],
    ["BW", "Botswana", "Gaborone", "AF"],
    ["BR", "Brazil", "Brasília", "SA"],
    ["BN", "Brunei", "Bandar Seri Begawan", "AS", ["Brunei Darussalam"]],
    ["BG", "Bulgaria", "Sofia", "EU"],
    ["BF", "Burkina Faso", "Ouagadougou", "AF"],
    ["BI", "Burundi", "Gitega", "AF"],
    ["CV", "Cabo Verde", "Praia", "AF", ["Cape Verde"]],
    ["KH", "Cambodia", "Phnom Penh", "AS"],
    ["CM", "Cameroon", "Yaoundé", "AF"],
    ["CA", "Canada", "Ottawa", "NA"],
    ["CF", "Central African Republic", "Bangui", "AF", ["CAR"]],
    ["TD", "Chad", "N'Djamena", "AF"],
    ["CL", "Chile", "Santiago", "SA"],
    ["CN", "China", "Beijing", "AS", ["PRC", "People's Republic of China"]],
    ["CO", "Colombia", "Bogotá", "SA"],
    ["KM", "Comoros", "Moroni", "AF"],
    ["CG", "Congo", "Brazzaville", "AF", ["Republic of the Congo", "Congo-Brazzaville"]],
    ["CD", "DR Congo", "Kinshasa", "AF", ["Democratic Republic of the Congo", "Congo-Kinshasa", "DRC", "DROC"]],
    ["CR", "Costa Rica", "San José", "NA"],
    ["CI", "Côte d'Ivoire", "Yamoussoukro", "AF", ["Ivory Coast"]],
    ["HR", "Croatia", "Zagreb", "EU"],
    ["CU", "Cuba", "Havana", "NA"],
    ["CY", "Cyprus", "Nicosia", "AS"],
    ["CZ", "Czechia", "Prague", "EU", ["Czech Republic"]],
    ["DK", "Denmark", "Copenhagen", "EU"],
    ["DJ", "Djibouti", "Djibouti", "AF"],
    ["DM", "Dominica", "Roseau", "NA"],
    ["DO", "Dominican Republic", "Santo Domingo", "NA"],
    ["EC", "Ecuador", "Quito", "SA"],
    ["EG", "Egypt", "Cairo", "AF"],
    ["SV", "El Salvador", "San Salvador", "NA"],
    ["GQ", "Equatorial Guinea", "Ciudad de la Paz", "AF"],
    ["ER", "Eritrea", "Asmara", "AF"],
    ["EE", "Estonia", "Tallinn", "EU"],
    ["SZ", "Eswatini", "Mbabane", "AF", ["Swaziland"]],
    ["ET", "Ethiopia", "Addis Ababa", "AF"],
    ["FJ", "Fiji", "Suva", "OC"],
    ["FI", "Finland", "Helsinki", "EU"],
    ["FR", "France", "Paris", "EU"],
    ["GA", "Gabon", "Libreville", "AF"],
    ["GM", "Gambia", "Banjul", "AF", ["The Gambia"]],
    ["GE", "Georgia", "Tbilisi", "AS"],
    ["DE", "Germany", "Berlin", "EU", ["Deutschland"]],
    ["GH", "Ghana", "Accra", "AF"],
    ["GR", "Greece", "Athens", "EU"],
    ["GD", "Grenada", "St. George's", "NA"],
    ["GT", "Guatemala", "Guatemala City", "NA"],
    ["GN", "Guinea", "Conakry", "AF"],
    ["GW", "Guinea-Bissau", "Bissau", "AF"],
    ["GY", "Guyana", "Georgetown", "SA"],
    ["HT", "Haiti", "Port-au-Prince", "NA"],
    ["HN", "Honduras", "Tegucigalpa", "NA"],
    ["HU", "Hungary", "Budapest", "EU"],
    ["IS", "Iceland", "Reykjavík", "EU"],
    ["IN", "India", "New Delhi", "AS"],
    ["ID", "Indonesia", "Jakarta", "AS"],
    ["IR", "Iran", "Tehran", "AS", ["Persia"]],
    ["IQ", "Iraq", "Baghdad", "AS"],
    ["IE", "Ireland", "Dublin", "EU", ["Republic of Ireland"]],
    ["IT", "Italy", "Rome", "EU"],
    ["JM", "Jamaica", "Kingston", "NA"],
    ["JP", "Japan", "Tokyo", "AS"],
    ["JO", "Jordan", "Amman", "AS"],
    ["KZ", "Kazakhstan", "Astana", "AS"],
    ["KE", "Kenya", "Nairobi", "AF"],
    ["KI", "Kiribati", "Tarawa", "OC"],
    ["KW", "Kuwait", "Kuwait City", "AS"],
    ["KG", "Kyrgyzstan", "Bishkek", "AS", ["Kyrgyz Republic"]],
    ["LA", "Laos", "Vientiane", "AS", ["Lao PDR"]],
    ["LV", "Latvia", "Riga", "EU"],
    ["LB", "Lebanon", "Beirut", "AS"],
    ["LS", "Lesotho", "Maseru", "AF"],
    ["LR", "Liberia", "Monrovia", "AF"],
    ["LY", "Libya", "Tripoli", "AF"],
    ["LI", "Liechtenstein", "Vaduz", "EU"],
    ["LT", "Lithuania", "Vilnius", "EU"],
    ["LU", "Luxembourg", "Luxembourg", "EU"],
    ["MG", "Madagascar", "Antananarivo", "AF"],
    ["MW", "Malawi", "Lilongwe", "AF"],
    ["MY", "Malaysia", "Kuala Lumpur", "AS"],
    ["MV", "Maldives", "Malé", "AS"],
    ["ML", "Mali", "Bamako", "AF"],
    ["MT", "Malta", "Valletta", "EU"],
    ["MH", "Marshall Islands", "Majuro", "OC"],
    ["MR", "Mauritania", "Nouakchott", "AF"],
    ["MU", "Mauritius", "Port Louis", "AF"],
    ["MX", "Mexico", "Mexico City", "NA"],
    ["FM", "Micronesia", "Palikir", "OC", ["Federated States of Micronesia", "FSM"]],
    ["MD", "Moldova", "Chișinău", "EU", ["Republic of Moldova"]],
    ["MC", "Monaco", "Monaco", "EU"],
    ["MN", "Mongolia", "Ulaanbaatar", "AS"],
    ["ME", "Montenegro", "Podgorica", "EU"],
    ["MA", "Morocco", "Rabat", "AF"],
    ["MZ", "Mozambique", "Maputo", "AF"],
    ["MM", "Myanmar", "Naypyidaw", "AS", ["Burma"]],
    ["NA", "Namibia", "Windhoek", "AF"],
    ["NR", "Nauru", "Yaren", "OC"],
    ["NP", "Nepal", "Kathmandu", "AS"],
    ["NL", "Netherlands", "Amsterdam", "EU", ["Holland", "The Netherlands"]],
    ["NZ", "New Zealand", "Wellington", "OC", ["Aotearoa"]],
    ["NI", "Nicaragua", "Managua", "NA"],
    ["NE", "Niger", "Niamey", "AF"],
    ["NG", "Nigeria", "Abuja", "AF"],
    ["KP", "North Korea", "Pyongyang", "AS", ["DPRK", "Democratic People's Republic of Korea"]],
    ["MK", "North Macedonia", "Skopje", "EU", ["Macedonia"]],
    ["NO", "Norway", "Oslo", "EU"],
    ["OM", "Oman", "Muscat", "AS"],
    ["PK", "Pakistan", "Islamabad", "AS"],
    ["PW", "Palau", "Ngerulmud", "OC"],
    ["PS", "Palestine", "Western Asia", "AS", ["State of Palestine"]],
    ["PA", "Panama", "Panama City", "NA"],
    ["PG", "Papua New Guinea", "Port Moresby", "OC", ["PNG"]],
    ["PY", "Paraguay", "Asunción", "SA"],
    ["PE", "Peru", "Lima", "SA"],
    ["PH", "Philippines", "Manila", "AS", ["The Philippines"]],
    ["PL", "Poland", "Warsaw", "EU"],
    ["PT", "Portugal", "Lisbon", "EU"],
    ["QA", "Qatar", "Doha", "AS"],
    ["RO", "Romania", "Bucharest", "EU"],
    ["RU", "Russia", "Moscow", "EU", ["Russian Federation"]],
    ["RW", "Rwanda", "Kigali", "AF"],
    ["KN", "Saint Kitts and Nevis", "Basseterre", "NA", ["St Kitts and Nevis", "St Kitts", "St. Kitts and Nevis"]],
    ["LC", "Saint Lucia", "Castries", "NA", ["St Lucia", "St. Lucia"]],
    ["VC", "Saint Vincent and the Grenadines", "Kingstown", "NA", ["St Vincent and the Grenadines", "St Vincent", "St. Vincent"]],
    ["WS", "Samoa", "Apia", "OC"],
    ["SM", "San Marino", "San Marino", "EU"],
    ["ST", "São Tomé and Príncipe", "São Tomé", "AF", ["Sao Tome and Principe", "Sao Tome"]],
    ["SA", "Saudi Arabia", "Riyadh", "AS", ["KSA"]],
    ["SN", "Senegal", "Dakar", "AF"],
    ["RS", "Serbia", "Belgrade", "EU"],
    ["SC", "Seychelles", "Victoria", "AF"],
    ["SL", "Sierra Leone", "Freetown", "AF"],
    ["SG", "Singapore", "Singapore", "AS"],
    ["SK", "Slovakia", "Bratislava", "EU", ["Slovak Republic"]],
    ["SI", "Slovenia", "Ljubljana", "EU"],
    ["SB", "Solomon Islands", "Honiara", "OC"],
    ["SO", "Somalia", "Mogadishu", "AF"],
    ["ZA", "South Africa", "Pretoria", "AF", ["RSA"]],
    ["KR", "South Korea", "Seoul", "AS", ["Korea", "Republic of Korea"]],
    ["SS", "South Sudan", "Juba", "AF"],
    ["ES", "Spain", "Madrid", "EU", ["España"]],
    ["LK", "Sri Lanka", "Sri Jayawardenepura Kotte", "AS", ["Ceylon"]],
    ["SD", "Sudan", "Khartoum", "AF"],
    ["SR", "Suriname", "Paramaribo", "SA"],
    ["SE", "Sweden", "Stockholm", "EU"],
    ["CH", "Switzerland", "Bern", "EU"],
    ["SY", "Syria", "Damascus", "AS", ["Syrian Arab Republic"]],
    ["TJ", "Tajikistan", "Dushanbe", "AS"],
    ["TZ", "Tanzania", "Dodoma", "AF"],
    ["TH", "Thailand", "Bangkok", "AS", ["Siam"]],
    ["TL", "Timor-Leste", "Dili", "AS", ["East Timor"]],
    ["TG", "Togo", "Lomé", "AF"],
    ["TO", "Tonga", "Nuku'alofa", "OC"],
    ["TT", "Trinidad and Tobago", "Port of Spain", "NA", ["Trinidad"]],
    ["TN", "Tunisia", "Tunis", "AF"],
    ["TR", "Turkey", "Ankara", "AS", ["Türkiye", "Turkiye"]],
    ["TM", "Turkmenistan", "Ashgabat", "AS"],
    ["TV", "Tuvalu", "Funafuti", "OC"],
    ["UG", "Uganda", "Kampala", "AF"],
    ["UA", "Ukraine", "Kyiv", "EU", ["Kiev"]],
    ["AE", "United Arab Emirates", "Abu Dhabi", "AS", ["UAE", "Emirates"]],
    ["GB", "United Kingdom", "London", "EU", ["UK", "Britain", "Great Britain"]],
    ["US", "United States", "Washington, D.C.", "NA", ["USA", "US", "United States of America", "America"]],
    ["UY", "Uruguay", "Montevideo", "SA"],
    ["UZ", "Uzbekistan", "Tashkent", "AS"],
    ["VU", "Vanuatu", "Port Vila", "OC"],
    ["VA", "Vatican City", "Vatican City", "EU", ["Holy See", "Vatican"]],
    ["VE", "Venezuela", "Caracas", "SA"],
    ["VN", "Vietnam", "Hanoi", "AS", ["Viet Nam"]],
    ["YE", "Yemen", "Sanaa", "AS"],
    ["ZM", "Zambia", "Lusaka", "AF"],
    ["ZW", "Zimbabwe", "Harare", "AF"]
  ];

  /* Gold stamps (Harley's pick, 6 Nov 2026): 30 rarely visited countries, both tiers together.
     Which of these are "rare gold" (double bonus) is still to be decided. */
  var GOLD = ["NR","TV","KI","MH","FM","SB","TO","PW","ST","KM","TL","TM","MD","DM","VC","GW","GN","LR","SL","ER","DJ","ML","SS","LY","YE","SO","KP","LI","SM","GQ"];

  var CONTINENTS = { AF: 'Africa', AS: 'Asia', EU: 'Europe', NA: 'North America', SA: 'South America', OC: 'Oceania' };

  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ').replace(/['\u2019.,]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').trim();
  }

  var all = ROWS.map(function (r) {
    var c = { code: r[0], name: r[1], capital: r[2], continent: r[3], continentName: CONTINENTS[r[3]], aliases: r[4] || [], gold: GOLD.indexOf(r[0]) >= 0 };
    c.keys = [norm(c.name)].concat(c.aliases.map(norm));
    return c;
  });
  var byCode = {}, byKey = {};
  all.forEach(function (c) { byCode[c.code] = c; c.keys.forEach(function (k) { if (!byKey[k]) byKey[k] = c; }); });

  /* The country a typed answer means, or null if it is not a listed country. */
  function find(text) { var k = norm(text); return k ? (byKey[k] || null) : null; }

  /* Up to n suggestions while typing: names that start with it first, then word starts, then anywhere. */
  function suggest(text, n) {
    var q = norm(text); if (!q) return [];
    var scored = [];
    all.forEach(function (c) {
      var best = 99;
      c.keys.forEach(function (k, i) {
        var s = k === q ? 0 : k.indexOf(q) === 0 ? 1 + i * 0.1 : (' ' + k).indexOf(' ' + q) >= 0 ? 3 + i * 0.1 : k.indexOf(q) >= 0 ? 5 + i * 0.1 : 99;
        if (s < best) best = s;
      });
      if (best < 99) scored.push([best, c]);
    });
    scored.sort(function (a, b) { return a[0] - b[0] || (a[1].name < b[1].name ? -1 : 1); });
    return scored.slice(0, n || 8).map(function (x) { return x[1]; });
  }

  return { all: all, byCode: function (code) { return byCode[code] || null; }, find: find, suggest: suggest, normalize: norm, continents: CONTINENTS, count: all.length };
})();
