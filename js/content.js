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
 *   bullets    list of bullet points
 *   tags       list of short labels (skills, tools…)
 *   images     list of { src: "assets/images/your-photo.jpg", caption: "…" }
 *   links      list of { label: "Visit site", url: "https://…" }
 *
 * Any of these except title can be left out.
 */


window.SITE = {
  name: "Your Name",   // ← put your name here (it isn't in the Common App pages you shared)
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
          title: "Hi, I'm Your Name",
          subtitle: "High school senior · Class of 2027",
          summary: "Rockets, materials science, sound and building things",
          body: [
            "I'm a senior at St. John Chrysostom Academy who likes building things that fly, make sound, or teach someone something new. I've tested materials to failure in university lab camps, designed and flown rockets, written a published guide to sport rocketry, and run the sound for every school play and concert.",
            "I'm headed toward engineering and materials science. My long-term goal is a master's degree and a career as a materials scientist and science educator."
          ],
          tags: ["Materials science", "Rocketry", "Engineering", "Teaching", "Audio tech"]
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
          title: "Kerbal Space Program Educational Mod",
          subtitle: "Creator · Grades 9–12",
          summary: "A popular mod that recreates 40+ real launch sites",
          body: [
            "I created an educational mod for Kerbal Space Program, a rocket simulation game that runs on real algebra, calculus and physics. My mod recreates more than 40 real-world launch sites so players can practise rocket concepts in realistic settings."
          ],
          tags: ["Game modding", "Rocket simulation", "Physics"]
        },
        {
          id: "guitars",
          title: "Guitar Building & Restoration",
          subtitle: "Hobby luthier · Grades 9–12",
          summary: "Bringing guitars back to life with solder and wood",
          body: ["I build and modify guitars to bring them back to life, as projects for myself and for others. Then I get to play them with family and friends."],
          tags: ["Luthiery", "Soldering", "Woodworking"]
        },
        {
          id: "this-site",
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
      id: "honors",
      label: "Honors",
      icon: "assets/icons/honors.svg",
      items: [
        {
          id: "magazine",
          title: "Published Magazine Author",
          subtitle: "Home Life Publishers · International · Grade 11",
          summary: "\"How to get in to Sport Rocketry\" (print)",
          body: ["Wrote \"How to get in to Sport Rocketry\", a print magazine article published internationally."]
        },
        {
          id: "nar-l1",
          title: "Level 1 High Power Rocket Certification",
          subtitle: "National Association of Rocketry · National · Grade 11",
          summary: "Certified to fly high-power rockets"
        },
        {
          id: "easton-speaker",
          title: "Speaker, Easton Library Space Program",
          subtitle: "With the Nurture Nature Center · State/Regional · Grade 11",
          summary: "Invited speaker at a public space program"
        },
        {
          id: "dante",
          title: "Dante Certification for AV Professionals",
          subtitle: "National · Grades 10–11",
          summary: "Training in digital audio, video and networking"
        },
        {
          id: "school-awards",
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
          title: "Lab & Engineering",
          summary: "Materials testing, rocketry and fabrication",
          tags: ["Hardness testing", "Tensile testing", "Microscopy", "Failure analysis", "Flight simulation", "3D printing", "Welding", "Molding"]
        },
        {
          id: "tech",
          title: "Tech & Audio",
          summary: "Computers, coding, AV and sound",
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
          title: "St. John Chrysostom Academy",
          subtitle: "Bethlehem, PA · 2023 – 2027 (expected graduation May 2027)",
          summary: "High school, Class of 2027",
          body: ["Senior-year courses include Honors Ancient Literature, Honors Ancient History, Astronomy, Philosophy and a Senior Thesis."]
        },
        {
          id: "dual-enrollment",
          title: "Dual Enrollment",
          subtitle: "Grove City College (2025 – 2026) · Northampton Community College (2026)",
          summary: "College coursework alongside high school",
          body: ["College-level courses taken during high school, including Preparatory Chemistry, General Chemistry I and Statistics."]
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
          summary: "Email, GitHub and LinkedIn",
          body: ["Interested in rocketry, materials science, or just want to talk shop? Reach out."],
          links: [
            { label: "Email: you@example.com", url: "mailto:you@example.com" },
            { label: "GitHub: lsamman", url: "https://github.com/lsamman" }
          ]
        }
      ]
    }
  ]
};
