import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar";
import { BookOpen, ChevronRight, Settings } from "lucide-react";
import { RouteLink } from "@/components/primitives";
import { H } from "@/lib/bridge";
import { icons } from "@/lib/icons";
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

export { Navigation };
