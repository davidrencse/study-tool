import { useEffect, useState } from "react";
const H = window.StudyHub;
H.boot();

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

export { H, emit, useEvent, theme };
