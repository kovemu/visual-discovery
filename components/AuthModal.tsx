"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import LoginForm from "@/components/LoginForm";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: "login" | "signup";
};

export default function AuthModal({
  open,
  onClose,
  onSuccess,
  initialMode = "login",
}: AuthModalProps) {
  const [mode, setMode] =
    useState<"login" | "signup">(
      initialMode,
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
        onClose();
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
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-[440px] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl sm:p-8"
        onClick={(event) =>
          event.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close auth modal"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
        >
          ×
        </button>

        <div className="mb-6 pt-2 text-center">
          <Link
            href="/"
            onClick={onClose}
            className="inline-block text-[30px] font-black leading-none text-fuchsia-600 transition hover:text-fuchsia-700"
          >
            Kovemu
          </Link>
        </div>

        <LoginForm
          mode={mode}
          presentation="modal"
          onModeChange={setMode}
          onSuccess={() => {
            onSuccess?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
}
