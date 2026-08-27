import {
  CREATOR_CATEGORY_OPTIONS,
  formatCreatorCategoryLabel,
  isCreatorCategory,
} from "@/lib/creator/creatorCategories";

type CreatorCategorySelectProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function CreatorCategorySelect({
  value,
  onChange,
  className,
}: CreatorCategorySelectProps) {
  const showLegacyOption =
    Boolean(value) && !isCreatorCategory(value);

  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
      className={className}
    >
      {showLegacyOption ? (
        <option value={value}>
          {formatCreatorCategoryLabel(value)} (legacy)
        </option>
      ) : null}
      {CREATOR_CATEGORY_OPTIONS.map((option) => (
        <option
          key={option.value}
          value={option.value}
        >
          {option.label}
        </option>
      ))}
    </select>
  );
}
