"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";

import LoginForm from "@/components/LoginForm";
import {
  consumeAllOverlayHistory,
  useOverlayHistory,
} from "@/lib/hooks/useOverlayHistory";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: "login" | "signup";
  replaceOnSuccess?: boolean;
};

export default function AuthModal({
  open,
  onClose,
  onSuccess,
  initialMode = "login",
  replaceOnSuccess = false,
}: AuthModalProps) {
  const router = useRouter();
  const [mode, setMode] =
    useState<"login" | "signup">(
      initialMode,
    );
  const afterHistoryCloseRef =
    useRef<(() => void) | null>(
      null,
    );

  const { requestClose } =
    useOverlayHistory(
      "auth",
      open,
      () => {
        onClose();
        const after =
          afterHistoryCloseRef.current;
        afterHistoryCloseRef.current =
          null;
        after?.();
      },
    );

  useEffect(() => {
    if (open) {
      setMode(initialMode);
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        requestClose();
      }
    };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        "";
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, requestClose]);

  function handleHomeClick(
    event: MouseEvent<HTMLAnchorElement>,
  ) {
    event.preventDefault();
    onClose();
    consumeAllOverlayHistory();
    router.push("/");
  }

  function handleSuccess() {
    if (replaceOnSuccess) {
      onClose();
      onSuccess?.();
      return;
    }

    afterHistoryCloseRef.current =
      onSuccess ?? null;
    requestClose();
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[2px]"
      onClick={requestClose}
    >
      <div
        className="relative max-h-[90vh] w-[calc(100%-32px)] max-w-[420px] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#111111] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.55)] sm:p-8"
        onClick={(event) =>
          event.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          type="button"
          onClick={requestClose}
          aria-label="Close auth modal"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center text-lg text-zinc-500 transition hover:text-white"
        >
          ×
        </button>

        <div className="mb-6 flex justify-center pt-1">
          <Link
            href="/"
            onClick={handleHomeClick}
            className="group inline-flex items-center gap-2"
            aria-label="KOVEMU home"
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-violet-500"
            />
            <span className="text-[13px] font-semibold uppercase tracking-[0.34em] text-white">
              KOVEMU
            </span>
          </Link>
        </div>

        <LoginForm
          mode={mode}
          presentation="modal"
          onModeChange={setMode}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}
