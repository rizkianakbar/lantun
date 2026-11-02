/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { optionsFromDataset } from './dataset'
import { resolveOptions } from './options'
import { prepare } from './prepare'
import { rangeFor } from './textmap/textmap'

// Runs the real pipeline over every playground fixture, once with the page's own contentSelector
// and once auto-detecting, so extraction regressions show up without a browser.
const pages = import.meta.glob<string>('../../../apps/playground/fixtures/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
})

interface Expectation {
  include: string[]
  exclude: string[]
  sentence?: string
}

const NOISE = ['Advertisement']

const expected: Record<string, Expectation> = {
  'en-wp-sourdough.html': {
    include: ['A sourdough starter is nothing more', 'it will be ready by morning'],
    exclude: ['Contents', 'Print recipe', 'Day five: the starter', 'Jules', 'Popular posts', 'Accept'],
    sentence: 'Mr. Okafor, a baker in Leeds who tested this method with me, called it "boring in the best way," and I think that is exactly right.',
  },
  'en-wp-dieng.html': {
    include: ['Nobody tells you how cold Java', 'Dieng Culture Festival'],
    exclude: ['Mount Sindoro rising out of the clouds', 'affiliate links', 'Subscribe', 'Ferry hopping'],
  },
  'en-wp-font-size.html': {
    include: ['Open any ten blogs', 'worth writing down one more time'],
    exclude: ['max-width: 68ch', 'Leave a reply', 'Post comment'],
  },
  'en-news-flood.html': {
    include: ['Residents of several coastal towns', 'keep watching the tide tables'],
    exclude: [...NOISE, 'Residents stack sandbags', 'What a flood warning', 'Most read', 'Related stories', 'BREAKING'],
  },
  'en-news-badminton.html': {
    include: ['A packed Istora Senayan erupted', 'Australian Open in Sydney'],
    exclude: [...NOISE, 'celebrate match point', 'Trending', 'LIVE'],
    sentence: '(Reporting by SportsWire staff; editing by J. Mensah)',
  },
  'id-wp-nasi-uduk.html': {
    include: ['Nasi uduk adalah sarapan favorit', 'ceritakan hasilnya di kolom komentar'],
    exclude: ['Nasi uduk lengkap dengan telur', 'Rina', 'Resep populer', 'Bagikan'],
  },
  'id-wp-belajar-inggris.html': {
    include: ['Banyak orang merasa sudah belajar', 'Semoga bermanfaat'],
    exclude: ['Daftar isi', 'Artikel terbaru'],
    sentence: 'Dr. Andini, dosen linguistik yang saya wawancarai, mengatakan bahwa rasa takut salah adalah hambatan terbesar bagi pelajar di Indonesia, lebih besar dari tata bahasa.',
  },
  'id-news-banjir.html': {
    include: ['Hujan deras yang mengguyur Jakarta', 'layanan 112'],
    exclude: [...NOISE, 'Baca juga', 'Pengendara sepeda motor menerobos', 'Terpopuler', 'Berita Terkait', 'TERKINI'],
  },
  'id-news-cabai.html': {
    include: ['Harga cabai rawit merah di sejumlah pasar', 'rumah tangga berpendapatan rendah'],
    exclude: [...NOISE, 'Pedagang menata cabai', 'Terpopuler'],
  },
  'id-news-literasi.html': {
    include: ['Sebuah program literasi digital', 'secara mandiri oleh perangkat desa'],
    exclude: [...NOISE, 'Baca juga', 'Warga lansia mengikuti pelatihan', 'Tag:'],
  },
  'hostile-reset.html': {
    include: ['This page resets every element', 'the highlighting survived too'],
    exclude: ['Worst-case host styles'],
  },
}

const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

const files = Object.entries(pages).map(([path, html]) => [path.split('/').pop() as string, html] as const)

describe('prepare() on playground fixtures', () => {
  it('has an expectation for every fixture', () => {
    expect(files.length).toBeGreaterThanOrEqual(11)
    expect(files.map(([f]) => f).sort()).toEqual(Object.keys(expected).sort())
  })

  describe.each(files)('%s', (file, html) => {
    const exp = expected[file] as Expectation
    const doc = parse(html)
    const tag = doc.querySelector<HTMLScriptElement>('script[data-lantun]')
    const configured = resolveOptions(tag ? optionsFromDataset(tag.dataset) : {}, doc)

    describe.each([
      ['configured', configured],
      ['auto-detect', { ...configured, contentSelector: null, excludeSelectors: [] }],
    ])('%s', (_, opts) => {
      const result = prepare(doc, opts)

      it('reads the article and nothing else', () => {
        const text = result?.map.text ?? ''
        for (const s of exp.include) expect(text).toContain(s)
        for (const s of exp.exclude) expect(text).not.toContain(s)
      })

      it('segments into sentences', () => {
        const sentences = result?.sentences ?? []
        expect(sentences.length).toBeGreaterThan(3)
        if (exp.sentence) {
          const text = result?.map.text ?? ''
          expect(sentences.map((s) => text.slice(s.start, s.end))).toContain(exp.sentence)
        }
      })

      it('maps every word back to the same DOM text', () => {
        const { map, sentences } = result ?? { map: null, sentences: [] }
        if (!map) throw new Error('no result')
        for (const s of sentences) {
          for (const w of s.words) expect(rangeFor(map, w.start, w.end)?.toString()).toBe(map.text.slice(w.start, w.end))
        }
      })
    })
  })
})
