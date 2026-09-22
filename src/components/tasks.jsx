import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search } from "lucide-react";
import { Countdowns, Heading, Section } from "@/components/primitives";
import { H } from "@/lib/bridge";
function TaskRows({ items }) {
  return (
    <div className="divide-y">
      {items.length ? (
        items.map((t) => (
          <div
            key={`${t.kind}:${t.id}`}
            className="flex items-center gap-3 py-3"
          >
            <Checkbox
              checked={t.done}
              aria-label={`Complete ${t.title}`}
              onCheckedChange={(done) => {
                if (t.kind === "lists") H.setTodoDone(t.record, done);
                else t.record.done = done;
                H.Store.save();
              }}
            />
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() =>
                t.kind === "coursework"
                  ? H.editEventModal(t.id)
                  : t.kind === "personal"
                    ? H.editPersonalTask(t.id)
                    : (location.hash = `#/todo?item=${t.id}`)
              }
            >
              <span
                className={`block text-sm font-medium ${t.done ? "line-through text-muted-foreground" : ""}`}
              >
                {t.title}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t.classId ? `${H.className(t.classId)} · ` : ""}
                {t.detail}
              </span>
            </button>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t.date ? H.relDay(t.date) : "Anytime"}
            </span>
          </div>
        ))
      ) : (
        <p className="py-5 text-sm text-muted-foreground">
          Nothing here. You’re clear.
        </p>
      )}
    </div>
  );
}
function Tasks({ classId }) {
  const [q, setQ] = useState(H.App.current.query.q || "");
  const [status, setStatus] = useState(H.App.current.query.status || "open");
  const [source, setSource] = useState(H.App.current.query.source || "all");
  const [classFilter, setClassFilter] = useState(
    H.App.current.query.class || "",
  );
  const [when, setWhen] = useState(H.App.current.query.when || "");
  const [expanded, setExpanded] = useState({});
  const items = H.taskHubFilter(H.taskHubItems(), {
    ...H.App.current.query,
    q,
    status,
    source,
    class: classId || classFilter,
    when,
  });
  return (
    <>
      <Heading
        title={classId ? "Tasks & deadlines" : "Tasks"}
        description="A clear list of what needs your attention."
      >
        <Button
          variant="outline"
          onClick={() =>
            H.editEventModal(null, { kind: "deadline", classId: classId || "" })
          }
        >
          Add coursework
        </Button>
        <Button onClick={() => H.editPersonalTask(null, { classId })}>
          <Plus />
          New task
        </Button>
      </Heading>
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          aria-label="Search tasks"
          placeholder="Search tasks…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {!classId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {classFilter ? H.className(classFilter) : "All classes"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup
                value={classFilter}
                onValueChange={setClassFilter}
              >
                <DropdownMenuRadioItem value="">
                  All classes
                </DropdownMenuRadioItem>
                {H.S().classes.map((c) => (
                  <DropdownMenuRadioItem key={c.id} value={c.id}>
                    {c.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {
                {
                  "": "Any date",
                  overdue: "Overdue",
                  today: "Today",
                  week: "Next 7 days",
                }[when]
              }
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value={when} onValueChange={setWhen}>
              {[
                ["", "Any date"],
                ["overdue", "Overdue"],
                ["today", "Today"],
                ["week", "Next 7 days"],
              ].map(([v, label]) => (
                <DropdownMenuRadioItem key={v} value={v}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Tabs value={source} onValueChange={setSource} className="mb-5">
        <TabsList>
          <TabsTrigger value="all">Everything</TabsTrigger>
          <TabsTrigger value="coursework">Coursework</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="space-y-5">
        {(source === "all"
          ? [
              ["coursework", "Coursework"],
              ["personal", "Personal tasks"],
              ["lists", "From your lists"],
            ]
          : [
              [
                source,
                source === "coursework"
                  ? "Coursework"
                  : source === "personal"
                    ? "Personal tasks"
                    : "From your lists",
              ],
            ]
        ).map(([kind, label]) => {
          const rows = items.filter((t) => t.kind === kind);
          if (!rows.length && source === "all") return null;
          const limited = source === "all" && !expanded[kind];
          return (
            <Section
              key={kind}
              title={label}
              description={`${rows.length} ${status === "done" ? "completed" : "tasks"}`}
            >
              <TaskRows items={limited ? rows.slice(0, 8) : rows} />
              {source === "all" && rows.length > 8 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    setExpanded((v) => ({ ...v, [kind]: !v[kind] }))
                  }
                >
                  {expanded[kind] ? "Show fewer" : `Show all ${rows.length}`}
                </Button>
              )}
            </Section>
          );
        })}
        {!items.length && source === "all" && (
          <Section title="All clear">
            <p className="py-4 text-sm text-muted-foreground">
              No tasks match these filters.
            </p>
          </Section>
        )}
      </div>
      {classId && (
        <div className="mt-6">
          <Countdowns classId={classId} />
        </div>
      )}
    </>
  );
}

export { TaskRows, Tasks };
