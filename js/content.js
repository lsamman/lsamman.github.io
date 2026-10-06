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
  name: "Your Name",
  tagline: "Your Job Title · Your City",

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
          title: "Hello, I'm Your Name",
          subtitle: "Your Job Title",
          summary: "A short introduction about who you are",
          body: [
            "PLACEHOLDER: Write two or three sentences about yourself here: what you do, what you care about, and what you're looking for next.",
            "PLACEHOLDER: A second paragraph could mention a hobby or something that makes you memorable."
          ],
          images: [{ src: "assets/images/profile.svg", caption: "Replace with a photo of you" }]
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
          id: "job-1",
          title: "Job Title",
          subtitle: "Company Name · 2023 – Present",
          summary: "What you do there, in one line",
          body: ["PLACEHOLDER: Describe the role and the team in a sentence or two."],
          bullets: [
            "PLACEHOLDER: An achievement with a number in it (e.g. cut load times by 40%)",
            "PLACEHOLDER: Something you built or led",
            "PLACEHOLDER: Something you improved"
          ],
          tags: ["Skill", "Tool", "Another tool"]
        },
        {
          id: "job-2",
          title: "Previous Job Title",
          subtitle: "Previous Company · 2020 – 2023",
          summary: "What you did there, in one line",
          bullets: [
            "PLACEHOLDER: An achievement",
            "PLACEHOLDER: Another achievement"
          ],
          tags: ["Skill", "Tool"]
        }
      ]
    },

    {
      id: "projects",
      label: "Projects",
      icon: "assets/icons/projects.svg",
      items: [
        {
          id: "project-1",
          title: "Project One",
          subtitle: "Personal project · 2024",
          summary: "A one-line pitch for the project",
          body: ["PLACEHOLDER: What the project is, why you made it, and what you learned."],
          tags: ["HTML", "CSS", "JavaScript"],
          images: [
            { src: "assets/images/project-1.svg", caption: "Main screen" },
            { src: "assets/images/project-2.svg", caption: "Another view" },
            { src: "assets/images/project-3.svg", caption: "Close-up detail" }
          ],
          links: [{ label: "View on GitHub", url: "https://github.com/lsamman" }]
        },
        {
          id: "project-2",
          title: "Project Two",
          subtitle: "Team project · 2023",
          summary: "A one-line pitch for the project",
          body: ["PLACEHOLDER: Describe it here."],
          images: [{ src: "assets/images/project-2.svg", caption: "Screenshot" }]
        },
        {
          id: "this-site",
          title: "This Website",
          subtitle: "2026",
          summary: "A menu-style résumé with generated music",
          body: [
            "Hand-built with plain HTML, CSS and JavaScript. The wave background is drawn on a canvas, and the music is synthesised live in the browser with the Web Audio API, with no audio files."
          ],
          tags: ["HTML", "CSS", "JavaScript", "Web Audio", "Canvas"],
          links: [{ label: "Source code", url: "https://github.com/lsamman/lsamman.github.io" }]
        }
      ]
    },

    {
      id: "skills",
      label: "Skills",
      icon: "assets/icons/skills.svg",
      items: [
        {
          id: "technical",
          title: "Technical Skills",
          summary: "Languages, tools and platforms",
          tags: ["PLACEHOLDER", "Skill one", "Skill two", "Skill three", "Skill four"]
        },
        {
          id: "soft",
          title: "Other Strengths",
          summary: "Communication, leadership and more",
          bullets: ["PLACEHOLDER: e.g. Presenting to clients", "PLACEHOLDER: e.g. Mentoring new teammates"]
        }
      ]
    },

    {
      id: "education",
      label: "Education",
      icon: "assets/icons/education.svg",
      items: [
        {
          id: "degree",
          title: "Degree or Qualification",
          subtitle: "School / University · 2016 – 2020",
          summary: "Your course and grade",
          bullets: ["PLACEHOLDER: Honours, awards or notable coursework"]
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
          body: ["PLACEHOLDER: A friendly line inviting people to reach out."],
          links: [
            { label: "Email: you@example.com", url: "mailto:you@example.com" },
            { label: "GitHub: lsamman", url: "https://github.com/lsamman" },
            { label: "LinkedIn", url: "https://www.linkedin.com/" }
          ]
        }
      ]
    }
  ]
};
