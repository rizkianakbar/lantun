import { fixtures } from "../fixtures";

for (const f of fixtures) {
  const list = document.getElementById(
    f.layout === "hostile" ? "hostile" : f.lang,
  );
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = `/fixtures/${f.file}`;
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = f.title;
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent =
    f.layout === "hostile"
      ? "all: unset"
      : f.layout === "wordpress"
        ? "WordPress"
        : "News portal";
  a.append(name, tag);
  li.append(a);
  list?.append(li);
}

// Re-running destroys the previous copy first, so the bookmarklet doubles as "reload widget".
const bookmarklet = `javascript:(()=>{window.LantunReader?.destroy();const s=document.createElement('script');s.src='http://localhost:4173/widget.js?'+Date.now();document.documentElement.appendChild(s)})()`;
document.getElementById("bookmarklet")?.setAttribute("href", bookmarklet);
