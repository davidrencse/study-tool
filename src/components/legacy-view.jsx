import { useLayoutEffect, useRef } from "react";
import { H } from "@/lib/bridge";
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

export { Legacy };
