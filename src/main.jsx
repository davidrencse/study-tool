import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useDeferredValue,
} from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  CheckSquare,
  Timer,
  BookOpen,
  Files,
  Layers,
  GraduationCap,
  Sparkles,
  Code,
  Network,
  Settings,
  Search,
  Plus,
  Sun,
  Moon,
  ChevronRight,
  ArrowUpRight,
  NotebookPen,
  Bell,
  ArrowRight,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./index.css";
const WorkspaceSearch = React.lazy(
  () => import("./components/workspace-search"),
);
const H = window.StudyHub;
H.boot();
const icons = {
  dashboard: CalendarDays,
  tasks: CheckSquare,
  calendar: CalendarDays,
  focus: Timer,
  classes: BookOpen,
  notes: Files,
  cards: Layers,
  practice: GraduationCap,
  assist: Sparkles,
  leetcode: Code,
  graph: Network,
};
const emit = (name) => window.dispatchEvent(new Event(name));
const originalSave = H.Store.save.bind(H.Store);
H.Store.save = (...args) => {
  const before = H.Store.revision;
  const errorBefore = H.Store.saveError;
  const result = originalSave(...args);
  if (
    before !== H.Store.revision ||
    errorBefore !== H.Store.saveError ||
    !result
  )
    emit("study:data");
  return result;
};
H.App.refresh = () => emit("study:refresh");
H.App.renderNav = () => emit("study:data");
function useEvent(name) {
  const [n, set] = useState(0);
  useEffect(() => {
    const update = () => set((v) => v + 1);
    window.addEventListener(name, update);
    return () => window.removeEventListener(name, update);
  }, [name]);
  return n;
}
function theme() {
  H.applyTheme();
  const t = H.S().settings.theme;
  document.documentElement.classList.toggle(
    "dark",
    t === "dark" ||
      (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches),
  );
}
theme();
function RouteLink({ href, children, ...props }) {
  const { setOpenMobile } = useSidebar();
  return (
    <a href={href} onClick={() => setOpenMobile(false)} {...props}>
      {children}
    </a>
  );
}
function Navigation({ route }) {
  const selected =
    route.name === "classes"
      ? route.params[0]
      : route.query.class ||
        (route.name === "notes" ? H.getNote(route.params[0])?.classId : "");
  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="p-5">
        <RouteLink
          href="#/dashboard"
          className="flex items-center gap-3 font-semibold"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
            <BookOpen size={17} />
          </span>
          <span>
            Study Hub
            <span className="block text-xs font-normal text-muted-foreground">
              A place to focus
            </span>
          </span>
        </RouteLink>
      </SidebarHeader>
      <SidebarContent>
        {["Plan", "Classes", "Materials", "Tools"].map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {H.NAV.filter((n) => n.group === group).map((n) => {
                  const Icon = icons[n.id];
                  return (
                    <SidebarMenuItem key={n.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={n.views.includes(route.name)}
                      >
                        <RouteLink href={`#/${n.id}`}>
                          <Icon />
                          <span>{n.label}</span>
                        </RouteLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
              {group === "Classes" &&
                H.S().classes.map((c) => (
                  <Collapsible
                    key={`${c.id}:${selected === c.id}`}
                    defaultOpen={selected === c.id}
                    className="class-branch"
                  >
                    <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-sidebar-accent">
                      <ChevronRight
                        size={13}
                        className="class-chevron shrink-0"
                      />
                      <span className="truncate">{c.name}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {[
                          ["overview", "Overview"],
                          ["materials", "Materials"],
                          ["tasks", "Tasks & deadlines"],
                          ["info", "Class info"],
                        ].map(([key, label]) => (
                          <SidebarMenuSubItem key={key}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                selected === c.id &&
                                route.name === "classes" &&
                                (route.query.tab || "overview") === key
                              }
                            >
                              <RouteLink href={`#/classes/${c.id}?tab=${key}`}>
                                {label}
                              </RouteLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t p-3">
        <SidebarMenuButton asChild isActive={route.name === "settings"}>
          <RouteLink href="#/settings">
            <Settings />
            <span>Settings & backup</span>
          </RouteLink>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
function Heading({ title, description, children }) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
function Section({ title, description, href, children }) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && (
            <CardDescription className="mt-1">{description}</CardDescription>
          )}
        </div>
        {href && (
          <Button variant="ghost" size="sm" asChild>
            <a href={href}>
              View all <ArrowUpRight size={14} />
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
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
function Countdowns({ classId = "", limit = 2 }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    el.innerHTML = H.examCountdownPanel(classId, limit);
    const timer = H.startExamCountdowns(el);
    return () => clearInterval(timer);
  });
  return <div ref={ref} className="legacy-workspace" />;
}
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
function Classes() {
  return (
    <>
      <Heading
        title="Classes"
        description="Each class has its own materials, tasks, and deadlines."
      >
        <Button asChild variant="outline">
          <a href="#/grades">Grades</a>
        </Button>
        <Button onClick={() => H.classModal(null)}>
          <Plus />
          Add class
        </Button>
      </Heading>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {H.S().classes.map((c) => {
          const tasks = H.taskHubItems().filter(
            (t) => t.classId === c.id && !t.done,
          );
          return (
            <Card key={c.id} className="shadow-none">
              <CardHeader>
                <BookOpen size={21} className="mb-3 text-muted-foreground" />
                <CardTitle>
                  <a href={`#/classes/${c.id}`}>{c.name}</a>
                </CardTitle>
                <CardDescription>
                  {c.info?.code || c.info?.professor || "Class workspace"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-5 text-xs text-muted-foreground">
                  {H.S().notes.filter((n) => n.classId === c.id).length}{" "}
                  materials · {tasks.length} open tasks
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`#/classes/${c.id}?tab=materials`}>Materials</a>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`#/classes/${c.id}?tab=tasks`}>
                      Tasks <ArrowRight size={14} />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
function ClassOverview({ c }) {
  const notes = H.S()
    .notes.filter((n) => n.classId === c.id)
    .slice(0, 5);
  const tasks = H.taskHubFilter(H.taskHubItems(), { class: c.id }).slice(0, 5);
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Next tasks" href={`#/classes/${c.id}?tab=tasks`}>
          <TaskRows items={tasks} />
        </Section>
        <Section title="Materials" href={`#/classes/${c.id}?tab=materials`}>
          <div className="divide-y">
            {notes.map((n) => (
              <a
                key={n.id}
                href={`#/notes/${n.id}`}
                className="flex items-center gap-3 py-3 text-sm"
              >
                <Files size={16} />
                <span className="flex-1">{n.title}</span>
                <ChevronRight size={14} />
              </a>
            ))}
            {!notes.length && (
              <p className="py-4 text-sm text-muted-foreground">
                No materials yet.
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" asChild className="mt-4">
            <a href={`#/import?class=${c.id}`}>
              <Plus />
              Add material
            </a>
          </Button>
        </Section>
      </div>
      <div className="mt-6">
        <Countdowns classId={c.id} />
      </div>
    </>
  );
}
class PageBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Study page failed", error);
  }
  render() {
    return this.state.failed ? (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>This page couldn’t load</CardTitle>
          <CardDescription>
            Your saved data is still available. Retry this page or export a
            backup from Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            onClick={() => {
              this.setState({ failed: false });
              H.App.refresh();
            }}
          >
            Retry page
          </Button>
          <Button variant="outline" asChild>
            <a href="#/settings">Settings & backup</a>
          </Button>
        </CardContent>
      </Card>
    ) : (
      this.props.children
    );
  }
}
function RecoveryNotice() {
  return H.Store.recoveryRequired ? (
    <div role="alert" className="mb-6 rounded-lg border p-4">
      <h2>Saved data needs recovery</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The saved workspace couldn’t be read. Your original data has been
        preserved. Saving is paused; download it first, then restore a valid
        backup in Settings or explicitly reset the workspace there.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => H.downloadRecovery()}>
          Download original data
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href="#/settings">Open Settings</a>
        </Button>
      </div>
    </div>
  ) : H.Store.saveError ? (
    <div role="alert" className="mb-6 rounded-lg border p-4 text-sm">
      Changes aren’t saved to browser storage. Export a backup in Settings
      before closing this tab.{" "}
      <Button size="sm" variant="outline" onClick={() => H.Store.save()}>
        Retry saving
      </Button>
    </div>
  ) : null;
}
function Legacy({ route, revision }) {
  const host = useRef();
  const key = JSON.stringify(route);
  useLayoutEffect(() => {
    const view = H.Views[route.name];
    const el = host.current;
    H.App.viewEl = el;
    el.className = `legacy-workspace view view-${route.name}`;
    let observer, timer;
    const cleanup = () => {
      observer?.disconnect();
      clearInterval(timer);
      try {
        view.unmount?.();
      } finally {
        el.replaceChildren();
        if (H.App.viewEl === el) H.App.viewEl = null;
      }
    };
    try {
      el.innerHTML = view.render(route.params, route.query);
      if (route.name === "classes" && route.params[0]) {
        el.querySelector(".page-head")?.remove();
        el.querySelector(".class-tabs")?.remove();
      }
      view.mount?.(el, route.params, route.query);
      observer = H.watchDefinitions(el);
      timer = H.startExamCountdowns(el);
    } catch (error) {
      cleanup();
      throw error;
    }
    return cleanup;
  }, [key, revision]);
  return <div ref={host} />;
}
function ModalBody({ modal, setModal }) {
  const body = useRef();
  useLayoutEffect(() => {
    body.current.innerHTML = modal.html;
    body.current
      .querySelectorAll("[data-close]")
      .forEach((b) => b.addEventListener("click", () => setModal(null)));
    modal.options.onMount?.(body.current);
    body.current.querySelector("input,textarea,select")?.focus();
  }, [modal]);
  return (
    <div ref={body} className="legacy-workspace max-h-[75vh] overflow-y-auto" />
  );
}
function Modal({ modal, setModal }) {
  return (
    <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
      <DialogContent
        className={modal?.options.wide ? "sm:max-w-3xl" : "sm:max-w-xl"}
      >
        <DialogHeader>
          <DialogTitle>{modal?.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Edit your study workspace
          </DialogDescription>
        </DialogHeader>
        {modal && <ModalBody modal={modal} setModal={setModal} />}
      </DialogContent>
    </Dialog>
  );
}
class SearchLoadBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("Search could not load", error);
  }
  render() {
    return this.state.failed ? (
      <div
        role="alert"
        className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border bg-background p-4 shadow-lg"
      >
        <p className="text-sm">Search couldn’t load. Reload to try again.</p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (H.Store.save()) location.reload();
              else {
                this.props.onClose();
                location.hash = "#/settings";
              }
            }}
          >
            Reload
          </Button>
          <Button size="sm" variant="outline" onClick={this.props.onClose}>
            Close
          </Button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
const FastNavigation = React.memo(Navigation);
const FastToday = React.memo(Today);
const FastTasks = React.memo(Tasks);
const FastClasses = React.memo(Classes);
const FastClassOverview = React.memo(ClassOverview);
const FastLegacy = React.memo(Legacy);
function App() {
  const dataRevision = useEvent("study:data");
  const revision = useEvent("study:refresh");
  const [route, setRoute] = useState(() => H.App.parse());
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  H.App.current = route;
  const selectedTheme = H.S().settings.theme;
  useLayoutEffect(() => theme(), [selectedTheme]);
  const group = H.NAV.find((n) => n.views.includes(route.name));
  const c = route.name === "classes" && H.getClass(route.params[0]);
  useEffect(() => {
    H.setModalRenderer(
      (title, html, options = {}) => {
        setModal({ title, html, options });
        return null;
      },
      () => setModal(null),
    );
    const change = () => {
      setRoute(H.App.parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const schemeChange = () => {
      if (H.S().settings.theme === "system") {
        theme();
        emit("study:data");
      }
    };
    scheme.addEventListener("change", schemeChange);
    const keys = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", keys);
    if (!H.started) {
      H.Focus.start();
      H.Notify.start();
      H.started = true;
    }
    return () => {
      window.removeEventListener("hashchange", change);
      scheme.removeEventListener("change", schemeChange);
      window.removeEventListener("keydown", keys);
      H.Focus.stop();
      H.Notify.stop();
      H.started = false;
    };
  }, []);
  useEffect(() => {
    document.title = `${H.Views[route.name]?.title || "Study Hub"} · Study Hub`;
  }, [route]);
  const deferredQuery = useDeferredValue(query);
  const hits = useMemo(
    () => (search ? H.globalSearch(deferredQuery) : []),
    [search, deferredQuery, dataRevision, revision],
  );
  return (
    <TooltipProvider>
      <a
        className="skip"
        href="#view"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("view").focus();
        }}
      >
        Skip to content
      </a>
      <SidebarProvider>
        <FastNavigation
          route={route}
          dataRevision={dataRevision}
          revision={revision}
        />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-7">
            <SidebarTrigger />
            <Breadcrumb className="min-w-0 flex-1">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href={c ? "#/classes" : `#/${group?.id || route.name}`}
                  >
                    {c ? "Classes" : group?.group || "Workspace"}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="truncate">
                    {c
                      ? c.name
                      : route.name === "dashboard"
                        ? "Today"
                        : H.Views[route.name]?.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search />
            </Button>
            <a id="timer-pill" className="timer-pill" href="#/focus" hidden />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => H.Notify.toggle()}
            >
              <Bell />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => {
                H.S().settings.theme =
                  document.documentElement.classList.contains("dark")
                    ? "light"
                    : "dark";
                H.Store.save();
                theme();
              }}
            >
              {document.documentElement.classList.contains("dark") ? (
                <Sun />
              ) : (
                <Moon />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => H.newNote()}>
                  <NotebookPen />
                  New note
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => H.editPersonalTask()}>
                  <CheckSquare />
                  New task
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (location.hash = "#/import")}>
                  <Files />
                  Add material
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main
            id="view"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1300px] p-4 sm:p-7 lg:p-9"
          >
            <RecoveryNotice />
            {c && (
              <>
                <Heading
                  title={c.name}
                  description={c.info?.code || "Class workspace"}
                />
                <Tabs
                  value={route.query.tab || "overview"}
                  onValueChange={(tab) =>
                    (location.hash = `#/classes/${c.id}?tab=${tab}`)
                  }
                  className="mb-7"
                >
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="materials">Materials</TabsTrigger>
                    <TabsTrigger value="tasks">Tasks</TabsTrigger>
                    <TabsTrigger value="info">Class info</TabsTrigger>
                  </TabsList>
                </Tabs>
              </>
            )}
            {!c && group?.tabs && (
              <Tabs
                value={route.name}
                onValueChange={(name) => (location.hash = `#/${name}`)}
                className="mb-7"
              >
                <TabsList>
                  {group.tabs.map(([href, label, name]) => (
                    <TabsTrigger key={name} value={name}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <PageBoundary key={JSON.stringify(route)}>
              {route.name === "dashboard" ? (
                <FastToday dataRevision={dataRevision} revision={revision} />
              ) : route.name === "tasks" ? (
                <FastTasks
                  key={location.hash}
                  dataRevision={dataRevision}
                  revision={revision}
                />
              ) : route.name === "classes" && !route.params[0] ? (
                <FastClasses dataRevision={dataRevision} revision={revision} />
              ) : c && (route.query.tab || "overview") === "overview" ? (
                <FastClassOverview
                  c={c}
                  dataRevision={dataRevision}
                  revision={revision}
                />
              ) : c && route.query.tab === "tasks" ? (
                <FastTasks
                  key={c.id}
                  classId={c.id}
                  dataRevision={dataRevision}
                  revision={revision}
                />
              ) : (
                <FastLegacy route={route} revision={revision} />
              )}
            </PageBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
      {search && (
        <SearchLoadBoundary onClose={() => setSearch(false)}>
          <React.Suspense
            fallback={
              <div
                role="status"
                className="fixed bottom-5 right-5 z-50 rounded-md border bg-background p-3 text-sm"
              >
                Opening search…
              </div>
            }
          >
            <WorkspaceSearch
              open={search}
              onOpenChange={setSearch}
              query={query}
              onQueryChange={setQuery}
              hits={hits}
              onChoose={(hit) => {
                setSearch(false);
                if (hit.eventId) H.editEventModal(hit.eventId);
                else if (hit.cardId) H.cardEditModal(hit.cardId);
                else location.hash = hit.href;
              }}
            />
          </React.Suspense>
        </SearchLoadBoundary>
      )}
      <Modal modal={modal} setModal={setModal} />
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")).render(<App />);
