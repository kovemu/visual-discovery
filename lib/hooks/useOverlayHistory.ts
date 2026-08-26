"use client";

import { useCallback, useEffect, useRef } from "react";

export type OverlayId =
  | "work"
  | "picks"
  | "auth"
  | "search"
  | "legal";

const STACK_KEY = "kovemuOverlayStack";

type OverlayRegistration = {
  id: OverlayId;
  isOpen: () => boolean;
  close: () => void;
};

const registrations = new Set<OverlayRegistration>();
let popstateBound = false;
let skipPopstateCount = 0;

function isOverlayId(value: unknown): value is OverlayId {
  return (
    value === "work" ||
    value === "picks" ||
    value === "auth" ||
    value === "search" ||
    value === "legal"
  );
}

export function getOverlayStack(
  historyState: unknown = window.history.state,
): OverlayId[] {
  if (
    !historyState ||
    typeof historyState !== "object"
  ) {
    return [];
  }

  const stack = (
    historyState as {
      [STACK_KEY]?: unknown;
    }
  )[STACK_KEY];

  if (!Array.isArray(stack)) {
    return [];
  }

  return stack.filter(isOverlayId);
}

export function skipOverlayPopstates(
  count = 1,
) {
  skipPopstateCount += Math.max(0, count);
}

export function consumeAllOverlayHistory() {
  const count = getOverlayStack().length;

  if (count <= 0) {
    return 0;
  }

  skipOverlayPopstates(1);
  window.history.go(-count);
  return count;
}

export function pushOverlayHistory(
  id: OverlayId,
) {
  const state = window.history.state ?? {};
  const stack = getOverlayStack(state);

  if (stack[stack.length - 1] === id) {
    return;
  }

  window.history.pushState(
    {
      ...state,
      [STACK_KEY]: [...stack, id],
    },
    "",
    window.location.href,
  );
}

export function requestOverlayClose(
  id: OverlayId,
) {
  const stack = getOverlayStack();

  if (stack[stack.length - 1] === id) {
    window.history.back();
    return true;
  }

  return false;
}

function handleGlobalPopstate(
  event: PopStateEvent,
) {
  if (skipPopstateCount > 0) {
    skipPopstateCount -= 1;
    return;
  }

  const stack = getOverlayStack(event.state);

  for (const registration of registrations) {
    if (
      !stack.includes(registration.id) &&
      registration.isOpen()
    ) {
      registration.close();
    }
  }

  const top = stack[stack.length - 1];

  if (!top) {
    return;
  }

  const topIsOpen = [...registrations].some(
    (registration) =>
      registration.id === top &&
      registration.isOpen(),
  );

  if (!topIsOpen) {
    window.history.back();
  }
}

function bindPopstateListener() {
  if (
    popstateBound ||
    typeof window === "undefined"
  ) {
    return;
  }

  popstateBound = true;
  window.addEventListener(
    "popstate",
    handleGlobalPopstate,
  );
}

export function useOverlayHistory(
  id: OverlayId,
  open: boolean,
  onCloseFromHistory: () => void,
) {
  const openRef = useRef(open);
  const closeRef = useRef(onCloseFromHistory);
  openRef.current = open;
  closeRef.current = onCloseFromHistory;

  useEffect(() => {
    bindPopstateListener();

    const registration: OverlayRegistration =
      {
        id,
        isOpen: () => openRef.current,
        close: () => closeRef.current(),
      };

    registrations.add(registration);

    return () => {
      registrations.delete(registration);
    };
  }, [id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    pushOverlayHistory(id);
  }, [id, open]);

  const requestClose = useCallback(() => {
    if (requestOverlayClose(id)) {
      return;
    }

    if (
      !getOverlayStack().includes(id) &&
      openRef.current
    ) {
      closeRef.current();
    }
  }, [id]);

  return { requestClose };
}
