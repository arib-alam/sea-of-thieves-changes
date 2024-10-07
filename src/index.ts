import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { env } from "./config.js";

import {
  CargoQueryItem,
  FlatChestData,
  PageQueryImage,
  FormattedWikiItems,
  FormattedRareItems,
} from "./types/misc.js";

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

// Fetching information for Wiki's internal database

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

const setOrganizedWikiItems: Record<string, FormattedWikiItems[]> = {};

for (const item of allWikiItems) {
  if (!setOrganizedWikiItems[item.set]) {
    setOrganizedWikiItems[item.set] = [];
  }

  setOrganizedWikiItems[item.set].push(item);
}

// -------------------------------------------------

// Fetching information for Rare's internal database

const chestDataURL = new URL(
  "https://api.merciasquill.com/user/seaofthieves/chest"
);

const headers = new Headers();
headers.set("x-api-key", env.MERCIAS_QUILL_API_KEY);

const fetchRequest = await fetch(chestDataURL, { headers });
const chestResponse = await fetchRequest.json();

const allRareItems = Object.values(chestResponse).flat(1) as FlatChestData;

const nameOrganizedRareItems = allRareItems.reduce(
  (organizedItems: FormattedRareItems, item) => {
    organizedItems[item.name.replace(/\u{2019}/u, "'")] = {
      id: item.id,
      name: item.name,
      description: item.description,
    };

    return organizedItems;
  },
  {}
);

// -------------------------------------------------

for (const set in setOrganizedWikiItems) {
  console.log("Writing...", set);

  const setWikiPath = join("./cosmetics/wiki/", set + ".md");
  const setRarePath = join("./cosmetics/rare/", set + ".md");

  const setsBy3Items = [];
  let itemsBy3Set = [];

  for (const item of setOrganizedWikiItems[set].sort()) {
    itemsBy3Set.push(item);

    if (itemsBy3Set.length === 3) {
      setsBy3Items.push(itemsBy3Set);
      itemsBy3Set = [];
    }
  }

  if (itemsBy3Set.length > 0) setsBy3Items.push(itemsBy3Set);

  let wikiSetMarkdownContent = `# ${set}`;

  for (const row of setsBy3Items) {
    let wikiItemNameRow = "|";
    let wikiNameDividerRow = "|";

    let wikiItemDescRow = "|";
    let wikiItemImgRow = "|";

    for (const item of row) {
      wikiItemNameRow += ` ${item.name} |`;
      wikiNameDividerRow += ` ${item.name.replace(/./g, "-")} |`;

      wikiItemDescRow += ` ${item.desc} |`;
      wikiItemImgRow += ` [![${item.name} image thumbnail](${item.img})](https://seaofthieves.wiki.gg/wiki/${item.name.replace(/\s/g, "_")}) |`;
    }

    wikiSetMarkdownContent += `\n\n${wikiItemNameRow}`;
    wikiSetMarkdownContent += `\n${wikiNameDividerRow}`;

    wikiSetMarkdownContent += `\n${wikiItemDescRow}`;
    wikiSetMarkdownContent += `\n${wikiItemImgRow}`;
  }

  // MD standards of a trailing new line
  wikiSetMarkdownContent += "\n";

  writeFileSync(setWikiPath, wikiSetMarkdownContent);

  let rareSetMarkdownContent = `# ${set}`;

  for (const row of setsBy3Items) {
    let rareItemNameRow = "|";
    let rareNameDividerRow = "|";

    let rareItemIdRow = "|";
    let rareItemDescRow = "|";
    let rareItemImgRow = "|";

    for (const item of row) {
      const rareItem = nameOrganizedRareItems[item.name];

      const itemName = rareItem?.name ?? "*" + item.name + "*";
      const itemId = rareItem?.id ?? "*Unknown cosmetic id*";
      const itemDesc = rareItem?.description ?? "*" + item.desc + "*";
      const itemImg = rareItem
        ? item.img
        : "https://cdn.merciasquill.com/images/67035fed8ad30bf0035179c4";

      rareItemNameRow += ` ${itemName} |`;
      rareNameDividerRow += ` ${itemName.replace(/./g, "-")} |`;

      rareItemIdRow += ` ${itemId} |`;
      rareItemDescRow += ` ${itemDesc} |`;
      rareItemImgRow += ` [![${itemName} image thumbnail](${itemImg})](https://seaofthieves.wiki.gg/wiki/${item.name.replace(/\s/g, "_")}) |`;
    }

    rareSetMarkdownContent += `\n\n${rareItemNameRow}`;
    rareSetMarkdownContent += `\n${rareNameDividerRow}`;

    rareSetMarkdownContent += `\n${rareItemIdRow}`;
    rareSetMarkdownContent += `\n${rareItemDescRow}`;
    rareSetMarkdownContent += `\n${rareItemImgRow}`;
  }

  // MD standards of a trailing new line
  rareSetMarkdownContent += "\n";

  writeFileSync(setRarePath, rareSetMarkdownContent);
}

process.exit();
