"use client";

import { useEffect } from "react";

import PrivacyPolicyContent from "@/components/legal/PrivacyPolicyContent";
import TermsContent from "@/components/legal/TermsContent";
import { LEGAL_EFFECTIVE_DATE } from "@/components/legal/constants";
import { useOverlayHistory } from "@/lib/hooks/useOverlayHistory";

export type LegalModalType = "terms" | "privacy";

type LegalModalProps = {
  type: LegalModalType;
  open: boolean;
  onClose: () => void;
};

const MODAL_COPY: Record<
  LegalModalType,
  {
    title: string;
    ariaLabel: string;
  }
> = {
  terms: {
    title: "Terms of Service",
    ariaLabel: "Terms of Service",
  },
  privacy: {
    title: "Privacy Policy",
    ariaLabel: "Privacy Policy",
  },
};

export default function LegalModal({
  type,
  open,
  onClose,
}: LegalModalProps) {
  const { requestClose } = useOverlayHistory(
    "legal",
    open,
    onClose,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      requestClose();
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
      true,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;
      window.removeEventListener(
        "keydown",
        handleKeyDown,
        true,
      );
    };
  }, [open, requestClose]);

  if (!open) {
    return null;
  }

  const copy = MODAL_COPY[type];
  const titleId = `legal-modal-title-${type}`;

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={requestClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <h2
              id={titleId}
              className="text-2xl font-black tracking-tight text-gray-950"
            >
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Effective date: {LEGAL_EFFECTIVE_DATE}
            </p>
          </div>

          <button
            type="button"
            onClick={requestClose}
            aria-label={`Close ${copy.ariaLabel}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          {type === "terms" ? (
            <TermsContent />
          ) : (
            <PrivacyPolicyContent />
          )}
        </div>
      </div>
    </div>
  );
}
