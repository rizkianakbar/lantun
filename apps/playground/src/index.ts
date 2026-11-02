import { type Fixture, fixtures } from "../fixtures";

const TAGS: Record<Fixture["layout"], string> = {
  hostile: "all: unset",
  wordpress: "WordPress",
  news: "News portal",
};

function fixtureLink(f: Fixture): HTMLLIElement {
  const li = document.createElement("li");
  const a = document.createElement("a");
  const name = document.createElement("span");
  const tag = document.createElement("span");

  a.href = `/fixtures/${f.file}`;
  name.className = "name";
  name.textContent = f.title;
  tag.className = "tag";
  tag.textContent = TAGS[f.layout];
  a.append(name, tag);
  li.append(a);

  return li;
}

for (const f of fixtures) {
  const list = document.getElementById(f.layout === "hostile" ? "hostile" : f.lang);

  list?.append(fixtureLink(f));
}

// Re-running destroys the previous copy first, so the bookmarklet doubles as "reload widget".
const bookmarklet = `javascript:(()=>{window.LantunReader?.destroy();const s=document.createElement('script');s.src='http://localhost:4173/widget.js?'+Date.now();document.documentElement.appendChild(s)})()`;

document.getElementById("bookmarklet")?.setAttribute("href", bookmarklet);
