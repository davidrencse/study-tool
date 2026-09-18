# Study Hub interface

The app is a student's working desk: today's schedule, class materials and test preparation must remain easy to reach. The shadcn/ui sidebar and class subpages establish the hierarchy; Today shows a short list of priorities.

Palette: white, black and neutral greys only. Class identity uses the existing shapes and explicit labels. Light and dark themes share this monochrome rule.

Typography: Manrope for navigation, controls and headings; Literata for reading content; existing monospace for code. Left aligned text, restrained line lengths, clear labels, tabular countdowns.

Layout: neutral shadcn/ui sidebar, compact command bar, and consistent page headings. Class branches reveal Overview, Materials, Tasks, and Class info. Today prioritizes tasks and recent materials, with schedule and upcoming deadlines alongside. Task lists use shadcn checkboxes, tabs, search, and class/date filters. Shared search, creation menus, and dialogs use shadcn components. Existing document and study views mount inside the React shell through a compatibility bridge, with compact monochrome controls and their original storage model intact. Mobile navigation uses the shadcn sheet.

Review: avoid identical floating pills, large empty stat cards, gradients and decorative motion. Use different density for reading versus planning. Preserve all real controls and document embeds. Check screenshots in light/dark themes and narrow layouts, keyboard/menu behavior, and existing workflow regressions.
