/*
 * ★ THIS IS THE FILE YOU EDIT ★
 *
 * Everything shown on the website comes from here. Replace the placeholder
 * text with your own details. Keep the punctuation (quotes, commas, brackets)
 * intact. If the site goes blank after an edit, a missing comma or quote is
 * the usual culprit. Open the browser console (F12) to see where.
 *
 * Each category has a list of items. Each item opens a detail page and can have:
 *   title      big heading (required)
 *   subtitle   smaller line under the title, e.g. "Company · 2023 – Present"
 *   summary    one-line description shown in the menu when the item is selected
 *   body       list of paragraphs
 *   bullets    list of bullet points (a bullet can also be { text: "…", url: "https://…" } to make it a link)
 *   tags       list of short labels (skills, tools…)
 *   images     list of { src: "assets/images/your-photo.jpg", caption: "…" }
 *   photo      a square picture shown in place of the icon, e.g. "assets/images/avatar.png"
 *   links      list of { label: "Visit site", url: "https://…" }
 *
 * Any of these except title can be left out.
 */


window.SITE = {
  name: "Dreamliner",
  tagline: "Rocketry · Materials science · Class of 2027",

  // Last.fm "now playing" tile. Leave blank to hide it.
  // apiKey: free from https://www.last.fm/api/account/create. Use the API key only, never the shared secret.
  lastfm: {
    user: "",
    apiKey: ""
  },

  categories: [
    {
      id: "about",
      label: "About",
      icon: "assets/icons/about.svg",
      items: [
        {
          id: "me",
          title: "Hi, I'm Dreamliner",
          photo: "assets/images/avatar.png",   // made with nikonautic's Picrew maker
          subtitle: "High school senior · Class of 2027",
          summary: "Rockets, materials science, sound and building things",
          body: [
            "I'm a senior at St. John Chrysostom Academy who likes building things that fly, make sound, or teach someone something new. I've tested materials to failure in university lab camps, designed and flown rockets, written a published guide to sport rocketry, and run the sound for every school play and concert.",
            "I'm headed toward engineering and materials science, with a master's degree along the way. My end goal is to work in the aerospace industry."
          ],
          tags: ["Aerospace", "Materials science", "Rocketry", "Engineering", "Teaching", "Audio tech"]
        },
        {
          id: "resume",
          title: "Résumé at a glance",
          subtitle: "Everything on one page",
          summary: "Plain one-page version of this site",
          body: ["Prefer a simple layout? Open the plain version below. It lists every section of this site on one scrolling page."],
          links: [{ label: "Open plain version", url: "#/plain" }]
        }
      ]
    },

    {
      id: "experience",
      label: "Experience",
      icon: "assets/icons/experience.svg",
      items: [
        {
          id: "eisenman-camp",
          photo: "assets/images/eisenman-camp.jpg",
          title: "Materials Education Foundation Eisenman Camp",
          subtitle: "Summer program · Grade 12",
          summary: "Selected as 1 of 28 students from 15 states and France",
          body: ["An intensive materials science camp, about 60 hours across one week."],
          bullets: [
            "Tested materials to failure with hardness, tensile and microscopy lab tests",
            "Presented findings on why and how the materials failed",
            "Selected as 1 of 28 participants from 15 states and France"
          ],
          tags: ["Hardness testing", "Tensile testing", "Microscopy", "Failure analysis"]
        },
        {
          id: "lehigh-camp",
          photo: "assets/images/lehigh-camp.jpg",
          title: "Lehigh University Material Science Camp",
          subtitle: "Summer program · Grade 11",
          summary: "Selected as 1 of 16 students from 9 school districts",
          bullets: [
            "Examined the properties of metals, polymers and gases in lab experiments",
            "Welded and molded materials hands-on",
            "Selected as 1 of 16 participants from 9 school districts"
          ],
          tags: ["Metals", "Polymers", "Welding", "Molding"]
        },
        {
          id: "community-rocketry",
          photo: "assets/images/community-rocketry.jpg",
          title: "Community Science Program",
          subtitle: "Instructional Speaker & Launch Administrator · St. John Chrysostom Academy · Grade 12",
          summary: "Designed and led a rocketry program for 20 kids aged 9–15",
          body: ["I designed and led a community science program with a local non-profit to get kids into rocketry. Every attendee built and launched their own rocket."],
          bullets: [
            "20 participants, ages 9–15",
            "Ran instruction and launch-day operations"
          ],
          tags: ["Teaching", "Public speaking", "Rocketry", "Program design"]
        },
        {
          id: "porphyrian-society",
          photo: "assets/images/porphyrian-society.jpg",
          title: "Porphyrian Society (Technology Club)",
          subtitle: "Founding member, Vice President, President · Grades 9–12",
          summary: "Founded and led the school's technology club",
          bullets: [
            "Led computer builds and student tech projects",
            "Taught 10–20 younger students about computer hardware, coding and robotics",
            "Fundraised over $1,000 for the club"
          ],
          tags: ["Leadership", "PC building", "Coding", "Robotics", "Fundraising"]
        },
        {
          id: "rocket-team",
          photo: "assets/images/rocket-team.jpg",
          title: "4-H Morris County & Resistojets Rocket Team",
          subtitle: "Rocket Assembly & Design Specialist · Grades 10–11",
          summary: "Designed, flew and iterated competition rockets",
          bullets: [
            "Helped design, fly and iterate the team's rocket for contests and projects",
            "Ran failure analysis and flight simulations",
            "Designed and 3D-printed parts"
          ],
          body: ["The club closed in 2026."],
          tags: ["Rocket design", "Flight simulation", "Failure analysis", "3D printing"]
        },
        {
          id: "sound-tech",
          photo: "assets/images/sound-tech.jpg",
          title: "Microphone & Sound Technician",
          subtitle: "St. John Chrysostom Academy · Grades 9–12",
          summary: "The school's first sound specialist",
          bullets: [
            "Sound specialist for all school plays and concerts",
            "Set up the school's first sound system, run from an iPad",
            "Trained my replacement"
          ],
          tags: ["Live sound", "AV systems", "Training"]
        },
        {
          id: "dbe-volunteer",
          photo: "assets/images/dbe-volunteer.jpg",
          title: "Daughters of the British Empire / Commonwealth of Nations",
          subtitle: "Tech Services & Assembly Volunteer · Grades 9–12",
          summary: "Tech and hands-on help for a senior citizens' charity group",
          body: ["The organization raises over $20,000 a year for nursing homes and for babies with hearing loss."],
          bullets: [
            "Built photo booths and assembled displays",
            "Entered data",
            "Made jam for fundraising"
          ],
          tags: ["Volunteering", "Community service"]
        },
        {
          id: "choir",
          title: "Upper School Choir",
          subtitle: "Bass · St. John Chrysostom Academy · Grades 9–12",
          summary: "Bass singer at school, local venues and churches",
          body: ["I sing bass in the school choir and have performed at school, local venues, nearby churches, local nonprofits and on religious holidays."],
          tags: ["Music", "Performance"]
        }
      ]
    },

    {
      id: "projects",
      label: "Projects",
      icon: "assets/icons/projects.svg",
      items: [
        {
          id: "ksp-mod",
          photo: "assets/images/ksp-mod.jpg",
          title: "Dreamliner's KSRSS Site Expansion",
          subtitle: "Kerbal Space Program mod · Creator · 2024 – present",
          summary: "A popular mod that recreates 40+ real launch sites",
          body: [
            "An educational mod for Kerbal Space Program, a rocket simulation game that runs on real algebra, calculus and physics. It recreates more than 40 real-world launch sites for KSRSS (a Kerbal-sized version of our real solar system), so players can practise rocket concepts in realistic settings.",
            "Built on Kerbal Konstructs and integrated with a long list of other community mods. I've maintained it through multiple updates since March 2024, with European spaceports planned next. Released under CC BY-NC-SA."
          ],
          tags: ["Game modding", "Kerbal Konstructs", "Rocket simulation", "Physics", "Open source"],
          links: [
            { label: "Forum thread", url: "https://forum.kerbalspaceprogram.com/topic/224317-dreamliners-site-expansion-for-ksrss/" },
            { label: "Source on GitHub", url: "https://github.com/lsamman/Dreamliners-Site-Expansion" }
          ]
        },
        {
          id: "guitars",
          photo: "assets/images/guitars.jpg",
          title: "Guitar Building & Restoration",
          subtitle: "Hobby luthier · Grades 9–12",
          summary: "Bringing guitars back to life with solder and wood",
          body: ["I build and modify guitars to bring them back to life, as projects for myself and for others. Then I get to play them with family and friends."],
          tags: ["Luthiery", "Soldering", "Woodworking"]
        },
        {
          id: "this-site",
          photo: "assets/images/this-site.jpg",
          title: "This Website",
          subtitle: "2026",
          summary: "A console-dashboard résumé with a live city and generated music",
          body: [
            "Hand-built with plain HTML, CSS and JavaScript. The city skyline follows your time of day, and the jungle soundtrack is synthesised live in the browser with the Web Audio API, with no audio files."
          ],
          tags: ["HTML", "CSS", "JavaScript", "Web Audio", "Canvas"],
          links: [{ label: "Source code", url: "https://github.com/lsamman/lsamman.github.io" }]
        }
      ]
    },

    {
      id: "websites",
      label: "Websites",
      icon: "assets/icons/websites.svg",
      items: [
        {
          id: "legend-of-chris-wiki",
          photo: "assets/images/legend-of-chris-wiki.jpg",
          title: "The Legend Of Chris Wiki",
          subtitle: "lsamman.github.io/legend-of-chris-wiki · 2026",
          summary: "The Chris Files",
          body: [
            "A fan wiki for The Legend Of Chris, an absurdist comedy book written with friends. It has over 300 articles covering every character, place, planet, item and event, with search, categories and backlinks. It's styled to look like the original document.",
            "The site is generated from the article text by a small Python script and deployed automatically with GitHub Pages."
          ],
          tags: ["Static site generator", "Python", "HTML", "CSS", "JavaScript", "GitHub Pages"],
          links: [
            { label: "Visit site", url: "https://lsamman.github.io/legend-of-chris-wiki/" },
            { label: "Source on GitHub", url: "https://github.com/lsamman/legend-of-chris-wiki" }
          ]
        },
        {
          id: "resume-site",
          photo: "assets/images/this-site.jpg",
          title: "Dreamliner.web",
          subtitle: "lsamman.github.io · 2026",
          summary: "The console-dashboard résumé you're looking at",
          body: ["My personal résumé site, styled like a 2010-era console dashboard. More details are under Projects."],
          links: [
            { label: "More about this site", url: "#/projects/this-site" },
            { label: "Source on GitHub", url: "https://github.com/lsamman/lsamman.github.io" }
          ]
        }
      ]
    },

    {
      id: "honors",
      label: "Honors",
      icon: "assets/icons/honors.svg",
      items: [
        {
          id: "magazine",
          photo: "assets/images/magazine.jpg",
          title: "Published Magazine Author",
          subtitle: "Home Life Publishers · International · Grade 11",
          summary: "\"How to get in to Sport Rocketry\" (print)",
          body: ["Wrote \"How to get in to Sport Rocketry\", a print magazine article published internationally."]
        },
        {
          id: "nar-l1",
          photo: "assets/images/nar-l1.jpg",
          title: "Level 1 High Power Rocket Certification",
          subtitle: "National Association of Rocketry · National · Grade 11",
          summary: "Certified to fly high-power rockets"
        },
        {
          id: "easton-speaker",
          photo: "assets/images/easton-speaker.jpg",
          title: "Speaker, Easton Library Space Program",
          subtitle: "With the Nurture Nature Center · State/Regional · Grade 11",
          summary: "Invited speaker at a public space program"
        },
        {
          id: "dante",
          photo: "assets/images/dante.jpg",
          title: "Dante Certification for AV Professionals",
          subtitle: "National · Grades 10–11",
          summary: "Training in digital audio, video and networking"
        },
        {
          id: "school-awards",
          photo: "assets/images/sjca-crest.png",
          title: "St. John's Annual Awards",
          subtitle: "School · Grades 9 & 11",
          summary: "Literature, Perseverance and Art awards",
          bullets: ["Literature Award", "Perseverance Award", "Art Award"]
        }
      ]
    },

    {
      id: "skills",
      label: "Skills",
      icon: "assets/icons/skills.svg",
      items: [
        {
          id: "lab",
          photo: "assets/images/lab.jpg",
          title: "Lab & Engineering",
          summary: "Materials testing, rocketry and fabrication",
          body: [
            "Most of my lab experience comes from the Materials Education Foundation's Eisenman Camp, where I was selected as 1 of 28 students from 15 states and France. Over a 60-hour week we tested materials to failure, then worked out and presented why they failed. I use the same failure-analysis mindset on rockets: test, find what broke, iterate."
          ],
          bullets: [
            "Hardness and tensile testing to measure strength and find failure points",
            "Microscopy to examine fracture surfaces and material structure",
            "Presenting test findings and failure analysis to an audience",
            "Hands-on work with metals, polymers and gases at Lehigh University's Material Science Camp, including welding and molding"
          ],
          links: [{ label: "More about the Eisenman Camp", url: "#/experience/eisenman-camp" }],
          tags: ["Hardness testing", "Tensile testing", "Microscopy", "Failure analysis", "Flight simulation", "3D printing", "Welding", "Molding"]
        },
        {
          id: "tech",
          photo: "assets/images/tech.jpg",
          title: "Tech & Audio",
          summary: "Computers, coding, AV and sound",
          body: ["I've worked with Dante networked sound systems for school concerts and plays."],
          tags: ["PC building", "Coding", "Robotics", "Dante AV networking", "Live sound", "Soldering"]
        },
        {
          id: "people",
          title: "Leadership & Teaching",
          summary: "Leading clubs, running programs, public speaking",
          bullets: [
            "Founded and led a school technology club",
            "Designed and taught a rocketry program for 20 kids",
            "Public speaker at a library space program"
          ]
        }
      ]
    },

    {
      id: "education",
      label: "Education",
      icon: "assets/icons/education.svg",
      items: [
        {
          id: "sjca",
          photo: "assets/images/sjca-crest.png",
          title: "St. John Chrysostom Academy",
          subtitle: "Bethlehem, PA · 2023 – 2027 (expected graduation May 2027)",
          summary: "High school, Class of 2027",
          body: ["Senior-year courses include Honors Ancient Literature, Honors Ancient History, Astronomy, Philosophy and a Senior Thesis."]
        },
        {
          id: "dual-enrollment",
          photo: "assets/images/dual-enrollment.jpg",
          title: "Dual Enrollment",
          subtitle: "Grove City College (2025 – 2026) · Northampton Community College (2026)",
          summary: "College coursework alongside high school",
          body: ["College-level courses taken during high school, including Preparatory Chemistry, General Chemistry I and Statistics."]
        }
      ]
    },

    {
      id: "listening",
      label: "What I'm Listening To",
      icon: "assets/icons/listening.svg",
      items: [
        {
          id: "forever",
          title: "Forever",
          subtitle: "My Apple Music playlist · 297 songs",
          summary: "The songs on repeat right now",
          body: ["The songs I have on repeat, listed as title and artist."],
          links: [{ label: "Open on Apple Music", url: "https://music.apple.com/us/playlist/forever/pl.u-pMylDXlF5rM3xNx" }],
          bullets: [
            "Stateside — PinkPantheress",
            "Nobody’s Son — Sabrina Carpenter",
            "4BLOOD (feat. Hatsune Miku) — KIRA",
            "Hatsune Miku No Syouthitsu (feat. Hatsune Miku) — cosMo@Bousou-P",
            "meltdown (feat. 鏡音リン) — iroha",
            "STARS — ¥$, Kanye West & Ty Dolla $ign",
            "Vodka Cranberry — Conan Gray",
            "Girl Like Me — PinkPantheress",
            "HYAENA — Travis Scott",
            "No Child Left Behind — Kanye West",
            "House Tour — Sabrina Carpenter",
            "Manchild — Sabrina Carpenter",
            "How many miles — Mk.gee",
            "Crazy Chicks — Ken Ashcorp",
            "Hazard Duty Pay! — JPEGMAFIA",
            "Die In a Fire (feat. EileMonty & Orko) — The Living Tombstone",
            "This Comes From Inside — The Living Tombstone",
            "Candy — Mk.gee",
            "F1 — Hans Zimmer",
            "Mosquito — PinkPantheress",
            "All Falls Apart — Polyphia",
            "Don't Forget — Trevor Alan Gomes",
            "the ends — Travis Scott",
            "Fight Til I'm Good Enough (feat. Allanah Fitzgerald, Elsie Lovelock & Michael Kovach) — The Living Tombstone",
            "Remyxomatosis (Cristian Vogel RMX) — Radiohead",
            "Deeper Underground (Full Version) — Jamiroquai",
            "Butterfly — Jamiroquai",
            "Soul Education — Jamiroquai",
            "Space Cowboy — Jamiroquai",
            "Planet Home — Jamiroquai",
            "Canned Heat — Jamiroquai",
            "Family Business — Kanye West",
            "We Don't Know What Tomorrow Brings — The Smile",
            "Thin Thing — The Smile",
            "The Same — The Smile",
            "OXYGEN — Sean Leon",
            "Beautiful — Katie Ladner, Alice Lee, Jessica Keenan Wynn, Barrett Wilbert Weed & Elle McLemore",
            "I Can't Fix You (feat. Crusher-P) — The Living Tombstone",
            "Field of Hopes and Dreams — Trevor Alan Gomes",
            "Don't Forget (feat. Laura Shigihara) — Toby Fox",
            "Golden — HUNTR/X, EJAE, AUDREY NUNA, REI AMI & KPop Demon Hunters Cast",
            "Lay Down (Safe & Sound) — Trip Lee",
            "Spoken For — FLAVOR FOLEY",
            "All of the Lights — Kanye West",
            "90210 (feat. Kacy Hill) — Travis Scott",
            "Do You Know Where Your Children Are — Michael Jackson",
            "Chicago — Michael Jackson",
            "The Subway — Chappell Roan",
            "BIRDBRAIN (feat. OK Glass) — Jamie Paige",
            "New Again — Kanye West",
            "S33K H3LP — femtanyl",
            "Ready Or Not — After 7",
            "Big Poe (feat. Sk8brd) — Tyler, The Creator & Pharrell Williams",
            "Ring Ring Ring — Tyler, The Creator",
            "Don't Tap That Glass / Tweakin' — Tyler, The Creator",
            "Tell Me What It Is — Tyler, The Creator",
            "Aria Math — C418",
            "True Love Waits (Live in Oslo) — Radiohead",
            "Closing In — Garrett Williamson & Scott Wozniak",
            "Unknown P: Fire in the Booth — Unknown P & Charlie Sloth",
            "Power — Kanye West",
            "New Person, Same Old Mistakes — Tame Impala",
            "See You Again (feat. Kali Uchis) — Tyler, The Creator",
            "Hook — Blues Traveler",
            "HEAVEN TO ME — Tyler, The Creator",
            "Where I End and You Begin — Radiohead",
            "The Less I Know the Better — Tame Impala",
            "Since U Been Gone — Kelly Clarkson",
            "Ultralight Beam — Sunday Service Choir",
            "Live & Learn\" ...Main Theme of \"Sonic Adventure 2\" — Crush 40",
            "I Am... All of Me — Crush 40",
            "MAINTENANCE — Ye",
            "DAMN — Kanye West",
            "PREACHER MAN — Kanye West",
            "Illegal — PinkPantheress",
            "Every Hour (feat. Sunday Service Choir) — Kanye West",
            "On God — Kanye West",
            "Through The Wire — Kanye West",
            "TRUE LOVE — Ye",
            "Mean girls featuring julian casablancas — Charli xcx & Julian Casablancas",
            "I think about it all the time featuring bon iver — Charli xcx & Bon Iver",
            "NOKIA — Drake",
            "Ball — The Rich Kidz",
            "EVIL J0RDAN — Playboi Carti",
            "Kids See Ghosts (feat. Yasiin Bey) — KIDS SEE GHOSTS",
            "Ghost Town (feat. PARTYNEXTDOOR) — Kanye West",
            "I Thought About Killing You — Kanye West",
            "SUZY — Ye",
            "Pretty Girls — Reneé Rapp",
            "All Around the World — Lisa Stansfield",
            "Used To Know! — 2pointO & Hatsune Miku",
            "MEMORY LEAK — 2pointO & Hatsune Miku",
            "Everything is romantic featuring caroline polachek — Charli xcx & Caroline Polachek",
            "Runaway (feat. Pusha T) — Kanye West",
            "Miku — Anamanaguchi & Hatsune Miku",
            "Disconnected — Azumi Takahashi / Lotus Juice / ATLUS Sound Team",
            "Brain Stew — Green Day",
            "Contract on the World Love Jam — Public Enemy",
            "Brothers Gonna Work It Out — Public Enemy",
            "intro (end of the world) [extended] — Ariana Grande",
            "we can't be friends (wait for your love) — Ariana Grande",
            "supernatural — Ariana Grande",
            "bye — Ariana Grande",
            "So I featuring a. g. cook — Charli xcx & A. G. Cook",
            "Pt. 2 — Kanye West",
            "Wolves — Kanye West",
            "Ultralight Beam — Kanye West",
            "Mayonaise — The Smashing Pumpkins",
            "Salvation — The Cranberries",
            "Zombie — The Cranberries",
            "Maniac — Conan Gray",
            "Sympathy is a knife featuring ariana grande — Charli xcx & Ariana Grande",
            "California — Chappell Roan",
            "My Kink Is Karma — Chappell Roan",
            "Mystic Rhythms — Rush",
            "Invisible — Duran Duran",
            "Headlock — Imogen Heap",
            "Busy Woman — Sabrina Carpenter",
            "CN TOWER — PARTYNEXTDOOR & Drake",
            "Indigo — NXCRE & The Villains",
            "Usurper — NXCRE & The Villains",
            "Twisted (Rock) — NXCRE & The Villains",
            "wacced out murals — Kendrick Lamar",
            "Hey Ya! — Outkast",
            "Stronger Than You (feat. Estelle) — Steven Universe",
            "Donda — Kanye West",
            "Never Abandon Your Family — Kanye West",
            "Come to Life — Kanye West",
            "Hurricane (feat. Lil Baby) — Kanye West & The Weeknd",
            "On Sight — Kanye West",
            "Homecoming (feat. Chris Martin) — Kanye West",
            "Everything In Its Right Place — Radiohead",
            "PUSH UR T3MPRR — femtanyl",
            "GIRL HELL 1999 — femtanyl",
            "L’AMOUR DE MA VIE [OVER NOW EXTENDED EDIT] — Billie Eilish",
            "360 — Charli xcx",
            "Femininomenon — Chappell Roan",
            "Good Luck, Babe! — Chappell Roan",
            "End of Beginning — Djo",
            "Lithonia — Childish Gambino",
            "Sunburn — The Living Tombstone",
            "365 — Charli xcx",
            "HOT TO GO! — Chappell Roan",
            "Thoughts — Charli xcx",
            "Girl, so confusing featuring lorde — Charli xcx & Lorde",
            "I think about it all the time — Charli xcx",
            "After Midnight — Chappell Roan",
            "Coffee — Chappell Roan",
            "Casual — Chappell Roan",
            "Kaleidoscope — Chappell Roan",
            "Pink Pony Club — Chappell Roan",
            "Naked In Manhattan — Chappell Roan",
            "Godzilla (feat. Juice WRLD) — Eminem",
            "Without Me — Eminem",
            "The Real Slim Shady — Eminem",
            "Take Control — Weezer",
            "St. Chroma (feat. Daniel Caesar) — Tyler, The Creator",
            "Damage, Inc. — Metallica",
            "Battery — Metallica",
            "Metropolis, Pt. 1: The Miracle and the Sleeper — Dream Theater",
            "Figure You Out — Djo",
            "Slither — Djo",
            "Wait for Sleep — Dream Theater",
            "Pull Me Under — Dream Theater",
            "Even Flow — Pearl Jam",
            "Private Eyes — Daryl Hall & John Oates",
            "The Bends — Radiohead",
            "Change — Djo",
            "Friends of P. — The Rentals",
            "Plush — Stone Temple Pilots",
            "Blue — PinkPantheress",
            "Shut up and Trust This — Ken Ashcorp",
            "In the Zone — Ken Ashcorp",
            "Burgz — Ken Ashcorp",
            "Cadmium Colors — Jamie Paige",
            "Bazooka — Miami XO",
            "Follow God — Kanye West",
            "FLY — Quavo & Lenny Kravitz",
            "BACK TO ME — ¥$, Kanye West & Ty Dolla $ign",
            "TALKING — ¥$, Kanye West & Ty Dolla $ign",
            "Sedai No SCREAM (feat. Teddyloid) — DEMONDICE",
            "LAST BREATH — Ye",
            "Cello Concerto in E Minor, Op. 85: I. Adagio - Moderato — Sheku Kanneh-Mason, London Symphony Orchestra & Sir Simon Rattle",
            "Cello Concerto in E Minor (also arr. as Viola Concerto by F. Salmond), Op. 85: I. Adagio - Moderato - II. Lento - Allegro molto — Yo-Yo Ma, André Previn & London Symphony Orchestra",
            "B.Y.O.B. — System Of A Down",
            "Blood On the Leaves — Kanye West",
            "Only One (feat. Paul McCartney) — Kanye West",
            "Daftendirekt — Daft Punk",
            "Life Of The Party — Kanye West & André 3000",
            "Keep My Spirit Alive — Kanye West",
            "Constant Repeat — Charli xcx",
            "Welcome To the World of the Plastic Beach (feat. Snoop Dogg and Hypnotic Brass Ensemble) — Gorillaz",
            "In the Air Tonight — Phil Collins",
            "WAKE UP F1LTHY — Playboi Carti & Travis Scott",
            "House featuring John Cale — Charli xcx & John Cale",
            "Dying for You — Charli xcx",
            "Wall of Sound — Charli xcx",
            "Eyes of the World featuring Sky Ferreira — Charli xcx",
            "Tokyo Ghetto — EVE",
            "Walk The Walk (feat. Yuno Miles, Nezlo & Jaysstra) — SF Frank",
            "Out of Myself — Charli xcx",
            "Stateside (with Zara Larsson) — PinkPantheress",
            "All I Need — Slushii",
            "POP OUT — Playboi Carti",
            "Who Is Going to Sleep with Your Wife — Ashnell Games",
            "BODY THE PISTOL — femtanyl",
            "MY HEAD HURTS — femtanyl",
            "SHOWS YOU THE WAY TO THE HIWAY — femtanyl",
            "MAN BITES DOG — femtanyl",
            "IS THIS IT — femtanyl",
            "What You Saying — Lil Uzi Vert",
            "Euclid — Sleep Token",
            "The Summoning — Sleep Token",
            "WAR GIRL — astrid & femtanyl",
            "Pornography — Travis Scott",
            "back to friends — sombr",
            "Back to Friends — Social Repose",
            "Sympathy is a knife — Social Repose",
            "THIS ONE'S FOR THE 2000's FURRIES — MAILPUP",
            "Hot Dog — Limp Bizkit",
            "Intro — Limp Bizkit",
            "Rollin' (Air Raid Vehicle) — Limp Bizkit",
            "My Way — Limp Bizkit",
            "All Apologies — Nirvana",
            "In Bloom — Nirvana",
            "Lithium — Nirvana",
            "SICK OF IT — femtanyl",
            "Kaleidoskull — Lemon Demon",
            "you ready? — Nettspend",
            "trap house 2016 — Nettspend",
            "Shock The World (Inspired By House Is Not A Home) [House Is Not A Home] — That Boy Franco",
            "Levels — Avicii",
            "Samba de Janeiro — Bellini",
            "Complete Inside Me — Money For The Toll",
            "Emotion — Daft Punk",
            "THANK GOD — Travis Scott",
            "Chains of Love — Charli xcx",
            "MODERN JAM (feat. Teezo Touchdown) — Travis Scott",
            "Big Bag — Tyler, The Creator",
            "Sweet Bod — Lemon Demon",
            "Doomed — Maphra",
            "CITY — femtanyl",
            "bag TF up — bbno$",
            "Tek It — Cafuné",
            "HEAD UP — femtanyl",
            "Romeo — PinkPantheress",
            "Stars — PinkPantheress",
            "LAST BREATH — Kanye West & Peso Pluma",
            "KING — Kanye West",
            "ALL THE LOVE — Kanye West & Andre Troutman",
            "PUNCH DRUNK — Kanye West",
            "MAMA’S FAVORITE (feat. Nine Vicious) — Kanye West",
            "SISTERS AND BROTHERS — Kanye West",
            "BULLY — Kanye West & CeeLo Green",
            "HIGHS AND LOWS — Kanye West",
            "WHITE LINES — Kanye West & Andre Troutman",
            "Famous — Kanye West",
            "24/7 — The Rich Kidz",
            "Color Your Night — Lotus Juice / Azumi Takahashi / ATLUS Sound Team / ATLUS GAME MUSIC",
            "We Don't Care — Kanye West",
            "Cruel World — Yuno Miles",
            "Use This Gospel (feat. Clipse & Kenny G) — Kanye West",
            "Welcome To Heartbreak (feat. Kid Cudi) — Kanye West",
            "How to Disappear into Strings — Radiohead",
            "Got To Be Real (95) — Cheryl Lynn",
            "No More Parties in LA — Kanye West",
            "Heartless — Kanye West",
            "Say You Will — Kanye West",
            "Ur Special — Her Side of the Bed",
            "Cold (feat. DJ Khaled) — Kanye West",
            "Diamonds from Sierra Leone (Remix) [feat. JAŸ-Z] — Kanye West",
            "We Major (feat. Nas & Really Doe) — Kanye West",
            "30 Hours — Kanye West",
            "SPEED DEMON — Justin Bieber",
            "ALL I CAN TAKE — Justin Bieber",
            "Beauty and a Beat (feat. Nicki Minaj) — Justin Bieber",
            "I DO — Justin Bieber",
            "YUKON — Justin Bieber",
            "GO BABY — Justin Bieber",
            "Feel So Good — Jamiroquai",
            "O Superman — Laurie Anderson",
            "Unbreakable — Michael Jackson",
            "Last Rizzmas — SecretAsian6",
            "4X4 — Travis Scott",
            "Make Them Cry — Drake",
            "Whisper My Name — Drake",
            "Bang Bang Bang (feat. BBpanzu) [lil yappa/minus b remix] — lil yappa",
            "WOLF — Tyler, The Creator",
            "Dust — Drake",
            "Janice STFU — Drake",
            "National Treasures — Drake",
            "Don’t Worry — Drake",
            "Hoe Phase — Drake",
            "Road Trips — Drake",
            "Goose and The Juice — Drake",
            "Catch Me If You Can — SEGA",
            "Outside Tweaking — Drake & Stunna Sandy"
          ]
        }
      ]
    },

    {
      id: "contact",
      label: "Contact",
      icon: "assets/icons/contact.svg",
      items: [
        {
          id: "get-in-touch",
          title: "Get in touch",
          summary: "Email, Discord and GitHub",
          body: [
            "Interested in rocketry, materials science, or just want to talk shop? Reach out.",
            "Discord: dreamliners"
          ],
          links: [
            { label: "Email: william_vella@icloud.com", url: "mailto:william_vella@icloud.com" },
            { label: "GitHub: lsamman", url: "https://github.com/lsamman" }
          ]
        },
        {
          id: "photo-credits",
          title: "Photo credits",
          summary: "Where the pictures on this site come from",
          body: ["Apart from my profile picture, my school's crest, the screenshot of this site and the Legend Of Chris cover art, the pictures here are illustrative photos from Wikimedia Commons, used under their free licenses. Thanks to their photographers. Each line links to the original file and its license."],
          bullets: [
            { text: "Eisenman Camp: \"Kunststoffzugprobe Dauerfestigkeit 02\" by Hb tuw, CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Kunststoffzugprobe_Dauerfestigkeit_02.jpg" },
            { text: "Lehigh camp: \"Welding Student\" by Tstc, CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Welding_Student.jpg" },
            { text: "Community Science Program: \"An photograph of a model rocket being launched, taken in 2019\" by newmexico.photographer, CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:An_photograph_of_a_model_rocket_being_launched,_taken_in_2019.jpg" },
            { text: "Porphyrian Society: \"Intel DTC-AAL03 and Asus motherboard 20080206\" by Victorrocha, CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Intel_DTC-AAL03_and_Asus_motherboard_20080206.jpg" },
            { text: "Rocket team: \"Level 3 high power rocket at launch pad\" by National Association of Rocketry, CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Level_3_high_power_rocket_at_launch_pad.jpg" },
            { text: "Sound technician: \"Stagetec AURUS 02\" by CLI, CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Stagetec_AURUS_02.jpg" },
            { text: "DBE volunteering: \"Jam jar, Kazakhstan\" by Nurken, CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Jam_jar,_Kazakhstan.jpg" },
            { text: "KSP mod: \"Space Launch Complex 40 at Cape Canaveral (aerial)\" by SpaceX, CC0", url: "https://commons.wikimedia.org/wiki/File:Space_Launch_Complex_40_at_Cape_Canaveral_(aerial).jpg" },
            { text: "Guitar building: \"1 Rockinger electric guitar headstock 1980s vintage\" by Elmschrat, CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:1_Rockinger_electric_guitar_headstock_1980s_vintage.jpg" },
            { text: "Magazine author: \"A rocketry triptych (42308755852)\" by Steve Jurvetson, CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:A_rocketry_triptych_(42308755852).jpg" },
            { text: "Level 1 certification: \"A glorious launch of my Red Mongoose rocket to Mach 1.4 (52387748282)\" by Steve Jurvetson, CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:A_glorious_launch_of_my_Red_Mongoose_rocket_to_Mach_1.4_(52387748282).jpg" },
            { text: "Easton Library speaker: \"Easton Area Public Library\" by Semmendinger, CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Easton_Area_Public_Library.jpg" },
            { text: "Dante certification: \"RJ45 Ethernet Cable\" by Khairil Yusof from Malaysia, CC BY 2.0", url: "https://commons.wikimedia.org/wiki/File:RJ45_Ethernet_Cable.jpg" },
            { text: "Lab & Engineering: \"Laboratory Optical Microscope\" by Aliva Sahoo, CC BY-SA 4.0", url: "https://commons.wikimedia.org/wiki/File:Laboratory_Optical_Microscope.jpg" },
            { text: "Tech & Audio: \"Soldering iron (UK Plug)\" by ooml, CC BY-SA 2.0", url: "https://commons.wikimedia.org/wiki/File:Soldering_iron_(UK_Plug).jpg" },
            { text: "Dual enrollment: \"Grove City College Campus\" by Mark Schellhase, CC BY-SA 3.0", url: "https://commons.wikimedia.org/wiki/File:Grove_City_College_Campus.jpg" }
          ]
        }
      ]
    }
  ]
};
