import {
  demoWorks,
  type DemoWork,
} from "@/data/discoverWorks";

function shuffleWorks(
  works: DemoWork[],
): DemoWork[] {
  const shuffled = [...works];

  for (
    let index = shuffled.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1),
    );

    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

export function getDiscoverFeed(): DemoWork[] {
  return shuffleWorks(demoWorks);
}