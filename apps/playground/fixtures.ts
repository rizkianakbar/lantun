// Single source of truth for the fixture list: the Vite build, the index page and E2E all read it.
export interface Fixture {
  file: string;
  lang: "id" | "en";
  layout: "wordpress" | "news" | "hostile";
  title: string;
}

export const fixtures: Fixture[] = [
  {
    file: "en-wp-sourdough.html",
    lang: "en",
    layout: "wordpress",
    title: "Sourdough starter (recipe blog)",
  },
  {
    file: "en-wp-dieng.html",
    lang: "en",
    layout: "wordpress",
    title: "Dieng Plateau (travel blog)",
  },
  {
    file: "en-wp-font-size.html",
    lang: "en",
    layout: "wordpress",
    title: "Font size tutorial (tech blog, code blocks)",
  },
  {
    file: "en-news-flood.html",
    lang: "en",
    layout: "news",
    title: "Coastal flooding (news portal)",
  },
  {
    file: "en-news-badminton.html",
    lang: "en",
    layout: "news",
    title: "Badminton final (sports news)",
  },
  {
    file: "id-wp-nasi-uduk.html",
    lang: "id",
    layout: "wordpress",
    title: "Nasi uduk (blog resep)",
  },
  {
    file: "id-wp-belajar-inggris.html",
    lang: "id",
    layout: "wordpress",
    title: "Belajar bahasa Inggris (blog tips)",
  },
  {
    file: "id-news-banjir.html",
    lang: "id",
    layout: "news",
    title: "Genangan di Jakarta (portal berita)",
  },
  {
    file: "id-news-cabai.html",
    lang: "id",
    layout: "news",
    title: "Harga cabai (berita ekonomi)",
  },
  {
    file: "id-news-literasi.html",
    lang: "id",
    layout: "news",
    title: "Literasi digital desa (berita teknologi)",
  },
  {
    file: "hostile-reset.html",
    lang: "en",
    layout: "hostile",
    title: "Aggressive global CSS reset",
  },
];
