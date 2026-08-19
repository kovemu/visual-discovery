type RemoveAllPicksDialogProps = {
  artistName: string;
  pickCount: number;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function RemoveAllPicksDialog({
  artistName,
  pickCount,
  removing,
  onCancel,
  onConfirm,
}: RemoveAllPicksDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) =>
          event.stopPropagation()
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-all-title"
      >
        <h2
          id="remove-all-title"
          className="text-lg font-black text-gray-950"
        >
          Remove all {pickCount}{" "}
          {pickCount === 1 ? "Pick" : "Picks"}{" "}
          from {artistName}?
        </h2>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={removing}
            className="rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:text-gray-950 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={removing}
            className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
