import { writeFileSync } from "node:fs";
import { join } from "node:path";

// import { env } from "./config.js";

import {
  CargoQueryItem,
  // FlatChestData,
  PageQueryImage,
  FormattedWikiItems,
} from "./types/misc.js";

// const chestDataURL = new URL(
//   "https://api.merciasquill.com/user/seaofthieves/chest"
// );

// const headers = new Headers();
// headers.set("x-api-key", env.MERCIAS_QUILL_API_KEY);

// const fetchRequest = await fetch(chestDataURL, { headers });
// const chestResponse = await fetchRequest.json();

// const allCosmetics = Object.values(chestResponse).flat(1) as FlatChestData;

const wikiURL = new URL("https://seaofthieves.wiki.gg/api.php");
wikiURL.searchParams.set("action", "cargoquery");
wikiURL.searchParams.set("utf8", "true");
wikiURL.searchParams.set("format", "json");
wikiURL.searchParams.set("tables", "Variants");
wikiURL.searchParams.set(
  "fields",
  "Variants.description,Variants.imagename,Variants.prefix,Variants.fullname"
);

let allWikiItems: FormattedWikiItems[] = [];
let cargoQueryItems: FormattedWikiItems[] = [];
let cargoQueryOffset = 0;

function removeHtmlChars(str: string): string {
  // Do NOT switch the order of replacement
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;/g, "'")
    .replace(/&#0?38;/g, "&");
}

do {
  console.log("Fetched...", cargoQueryOffset);

  wikiURL.searchParams.set("offset", cargoQueryOffset + "");
  cargoQueryOffset += 50;

  const wikiFetchRequest = await fetch(wikiURL);
  const wikiResponse = await wikiFetchRequest.json();

  cargoQueryItems = wikiResponse.cargoquery.map(
    (item: { title: CargoQueryItem }) => {
      const itemName = removeHtmlChars(item.title.fullname);
      const itemSet = removeHtmlChars(item.title.prefix);
      const itemImg = "File:" + removeHtmlChars(item.title.imagename);
      const itemDesc = removeHtmlChars(
        item.title.description ?? "No description"
      );

      return { name: itemName, set: itemSet, img: itemImg, desc: itemDesc };
    }
  );

  const imgURL = new URL("https://seaofthieves.wiki.gg/api.php");
  imgURL.searchParams.set("action", "query");
  wikiURL.searchParams.set("utf8", "true");
  imgURL.searchParams.set("format", "json");
  imgURL.searchParams.set("prop", "imageinfo");
  imgURL.searchParams.set("iiprop", "url");
  imgURL.searchParams.set(
    "titles",
    cargoQueryItems.map((i: { img: string }) => i.img).join("|")
  );

  const imgFetchRequest = await fetch(imgURL);
  const imgResponse = (await imgFetchRequest.json()).query.pages;

  for (const image of Object.values(imgResponse) as PageQueryImage[]) {
    const itemInCompleteList = cargoQueryItems.find(
      (item) => item.img.replace(/_/g, " ") === image.title
    );

    if (!itemInCompleteList) {
      throw new Error(
        `Failed to find ${image.title} in list: ${JSON.stringify(cargoQueryItems, null, 2)}`
      );
    }

    if (image.missing !== undefined) {
      itemInCompleteList.img =
        "https://cdn.merciasquill.com/images/67035fed8ad30bf0035179c4";
      continue;
    }

    itemInCompleteList.img = image.imageinfo[0].url;
  }

  allWikiItems.push(...cargoQueryItems);

  await new Promise<void>((resolve) => setTimeout(() => resolve(), 1_000));
} while (cargoQueryItems.length === 50);

const itemsBy500Cosmetics = [];
let itemsInGroupsOf500 = [];

for (const item of allWikiItems) {
  itemsInGroupsOf500.push(item);

  if (itemsInGroupsOf500.length === 500) {
    itemsInGroupsOf500.push(itemsInGroupsOf500);
    itemsInGroupsOf500 = [];
  }
}

if (itemsInGroupsOf500.length > 0) itemsBy500Cosmetics.push(itemsInGroupsOf500);

const setOrganizedItems: Record<string, FormattedWikiItems[]> = {};

for (const item of allWikiItems) {
  if (!setOrganizedItems[item.set]) {
    setOrganizedItems[item.set] = [];
  }

  setOrganizedItems[item.set].push(item);
}

for (const set in setOrganizedItems) {
  console.log("Writing...", set);

  const setPath = join("./cosmetics/wiki/", set + ".md");

  const setsBy3Items = [];
  let itemsBy3Set = [];

  for (const item of setOrganizedItems[set].sort()) {
    itemsBy3Set.push(item);

    if (itemsBy3Set.length === 3) {
      setsBy3Items.push(itemsBy3Set);
      itemsBy3Set = [];
    }
  }

  if (itemsBy3Set.length > 0) setsBy3Items.push(itemsBy3Set);

  let setMarkdownContent = `# ${set}`;

  for (const row of setsBy3Items) {
    let itemNameRow = "|";
    let nameDividerRow = "|";

    let itemDescRow = "|";
    let itemImgRow = "|";

    for (const item of row) {
      itemNameRow += ` ${item.name} |`;
      nameDividerRow += ` ${item.name.replace(/./g, "-")} |`;

      itemDescRow += ` ${item.desc} |`;
      itemImgRow += ` [![${item.name} image thumbnail](${item.img})](https://seaofthieves.wiki.gg/wiki/${item.name.replace(/\s/g, "_")}) |`;
    }

    setMarkdownContent += `\n\n${itemNameRow}`;
    setMarkdownContent += `\n${nameDividerRow}`;

    setMarkdownContent += `\n${itemDescRow}`;
    setMarkdownContent += `\n${itemImgRow}`;
  }

  // MD standards of a trailing new line
  setMarkdownContent += "\n";

  writeFileSync(setPath, setMarkdownContent);
}

process.exit();
