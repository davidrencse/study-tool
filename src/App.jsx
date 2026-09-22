import React, { useDeferredValue, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Bell, CheckSquare, Files, Moon, NotebookPen, Plus, Search, Sun } from "lucide-react";
import { PageBoundary, RecoveryNotice, SearchLoadBoundary } from "@/components/boundaries";
import { ClassOverview, Classes } from "@/components/classes";
import { Heading } from "@/components/primitives";
import { Legacy } from "@/components/legacy-view";
import { Modal } from "@/components/modal";
import { Navigation } from "@/components/navigation";
import { Tasks } from "@/components/tasks";
import { Today } from "@/components/today";
import { H, emit, theme, useEvent } from "@/lib/bridge";
const WorkspaceSearch = React.lazy(
  () => import("./components/workspace-search"),
);

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

export { App };
