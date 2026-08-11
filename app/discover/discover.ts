import { allCreators, type Creator } from "@/data/creators";

function shuffleCreators(creators: Creator[]): Creator[] {
  const shuffled = [...creators];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

export function getDiscoverFeed(
  repeatCount = 3,
): Creator[] {
  const expandedCreators = Array.from(
    { length: repeatCount },
    () => shuffleCreators(allCreators),
  ).flat();

  return expandedCreators;
}