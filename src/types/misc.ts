export type FlatChestData = {
  image: string;
  id: string;
  name: string;
  description: string;
  tags: string[];
}[];

export type FormattedRareItems = Record<
  string,
  { id: string; name: string; description: string }
>;

export type CargoQueryItem = {
  prefix: string;
  fullname: string;
  description: string;
  imagename: string;
};

export type PageQueryImage = {
  title: string;
  missing?: string;
  imageinfo: { url: string }[];
};

export type FormattedWikiItems = {
  name: string;
  set: string;
  img: string;
  desc: string;
};
