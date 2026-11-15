import gsap from "gsap";
/** Pointer-based peel/drag with spring return. Keyboard drop is owned by Planner. */
export function bindStickerDrag(
  node: HTMLElement,
  onDrop: (x: number, y: number) => boolean,
) {
  let ghost: HTMLElement | null = null,
    dragging = false,
    startX = 0,
    startY = 0,
    rect: DOMRect;
  const move = (event: PointerEvent) => {
    if (
      !dragging &&
      Math.hypot(event.clientX - startX, event.clientY - startY) < 5
    )
      return;
    if (!ghost) {
      dragging = true;
      ghost = node.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;z-index:1000;pointer-events:none;margin:0;transform-origin:20% 80%;filter:drop-shadow(0 16px 8px #0003);`;
      document.body.append(ghost);
      node.style.opacity = ".25";
      gsap.fromTo(
        ghost,
        { scale: 1, rotation: 0 },
        { scale: 1.07, rotation: -5, duration: 0.15 },
      );
    }
    event.preventDefault();
    gsap.to(ghost, {
      x: event.clientX - startX,
      y: event.clientY - startY,
      rotation: gsap.utils.clamp(-12, 12, (event.clientX - startX) * 0.04),
      duration: 0.09,
      ease: "power2.out",
      overwrite: "auto",
    });
  };
  const end = (event: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    if (!ghost) return;
    const current = ghost;
    ghost = null;
    const accepted = onDrop(event.clientX, event.clientY);
    node.style.opacity = "";
    gsap.to(
      current,
      accepted
        ? {
            scale: 0.85,
            opacity: 0,
            duration: 0.2,
            onComplete: () => current.remove(),
          }
        : {
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            duration: 0.6,
            ease: "elastic.out(1,.45)",
            onComplete: () => current.remove(),
          },
    );
    dragging = false;
  };
  const down = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("button,a,input")
    )
      return;
    rect = node.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end, { once: true });
  };
  node.style.touchAction = "none";
  node.draggable = false;
  node.addEventListener("pointerdown", down);
  return () => {
    node.removeEventListener("pointerdown", down);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    ghost?.remove();
    node.style.opacity = "";
  };
}
