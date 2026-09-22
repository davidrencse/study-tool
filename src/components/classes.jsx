import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, ChevronRight, Files, Plus } from "lucide-react";
import { Countdowns, Heading, Section } from "@/components/primitives";
import { TaskRows } from "@/components/tasks";
import { H } from "@/lib/bridge";
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

export { Classes, ClassOverview };
