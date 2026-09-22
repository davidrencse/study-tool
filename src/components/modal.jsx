import { useLayoutEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export { ModalBody, Modal };
