import { Button } from "@/components/ui/button";
import { ArrowRight, CheckSquare, ChevronRight, Files, GraduationCap, Layers, Timer } from "lucide-react";
import { Countdowns, Heading, Section } from "@/components/primitives";
import { TaskRows } from "@/components/tasks";
import { H } from "@/lib/bridge";
function ScheduleToday() {
  const today = H.todayStr();
  const events = H.occurrences(today, today).filter(H.isScheduled);
  return (
    <Section title="Today’s schedule" href="#/schedule">
      <div className="divide-y">
        {events.length ? (
          events.map((e) => (
            <button
              key={e.id}
              onClick={() => H.editEventModal(e.id)}
              className="flex w-full items-start gap-3 py-3 text-left"
            >
              <span className="w-16 shrink-0 text-xs text-muted-foreground">
                {e.time ? H.fmtTime(e.time) : "All day"}
              </span>
              <span className="text-sm font-medium">
                {e.title}
                <span className="block text-xs font-normal text-muted-foreground">
                  {e.location || H.className(e.classId)}
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="py-3 text-sm text-muted-foreground">
            No scheduled events today.
          </p>
        )}
      </div>
    </Section>
  );
}
function Today() {
  const today = H.todayStr();
  const open = H.taskHubFilter(H.taskHubItems(), {});
  const nowItems = open.filter((t) => t.date && t.date <= today);
  const upcoming = open.filter((t) => t.date > today).slice(0, 4);
  const notes = [...H.S().notes]
    .sort((a, b) => (b.updated || 0) - (a.updated || 0))
    .slice(0, 4);
  return (
    <>
      <Heading
        title="Today"
        description={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      >
        <Button asChild>
          <a href="#/focus">
            <Timer />
            Start focusing
          </a>
        </Button>
      </Heading>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Section
            title="Your priorities"
            description="Overdue and due today"
            href="#/tasks"
          >
            <TaskRows items={nowItems.slice(0, 6)} />
            {nowItems.length > 6 && (
              <Button variant="link" asChild>
                <a href="#/tasks?when=overdue">
                  See {nowItems.length - 6} more tasks <ArrowRight />
                </a>
              </Button>
            )}
          </Section>
          <Section title="Continue studying" href="#/notes">
            <div className="divide-y">
              {notes.length ? (
                notes.map((n) => (
                  <a
                    key={n.id}
                    href={`#/notes/${n.id}`}
                    className="flex items-center gap-3 py-3"
                  >
                    <Files size={17} className="text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {n.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {H.className(n.classId)}
                      </span>
                    </span>
                    <ChevronRight size={15} />
                  </a>
                ))
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  Add your notes or slides to get started.
                </p>
              )}
            </div>
          </Section>
        </div>
        <div className="space-y-6">
          <ScheduleToday />
          <Section title="Coming up" href="#/calendar">
            <TaskRows items={upcoming} />
          </Section>
          <Countdowns />
          <Section title="Study tools">
            <div className="space-y-1">
              {[
                ["#/cards", "Flashcards", "Review what you know", Layers],
                [
                  "#/practice",
                  "Practice exams",
                  "Test your understanding",
                  GraduationCap,
                ],
                [
                  "#/daily",
                  "Daily routine",
                  "Small steps, every day",
                  CheckSquare,
                ],
              ].map(([href, title, desc, Icon]) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-md p-2 hover:bg-muted"
                >
                  <Icon size={18} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="text-xs text-muted-foreground">
                      {desc}
                    </span>
                  </span>
                  <ChevronRight size={14} />
                </a>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}

export { ScheduleToday, Today };
