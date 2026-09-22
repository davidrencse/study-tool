import { useLayoutEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSidebar } from "@/components/ui/sidebar";
import { ArrowUpRight } from "lucide-react";
import { H } from "@/lib/bridge";
function RouteLink({ href, children, ...props }) {
  const { setOpenMobile } = useSidebar();
  return (
    <a href={href} onClick={() => setOpenMobile(false)} {...props}>
      {children}
    </a>
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

export { RouteLink, Heading, Section, Countdowns };
