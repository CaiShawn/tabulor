# Fonts

All three fonts below are licensed under the SIL Open Font License (OFL) v1.1
and are bundled inside this extension so the extension has **zero network
calls** at runtime.

| File | Font | Size | Source | License |
|---|---|---|---|---|
| `inter-latin-wght-normal.woff2` | Inter (variable, Latin subset) | 47 KB | [fontsource-variable/inter](https://github.com/fontsource/font-files/tree/master/fonts/variable/inter) | OFL-1.1 |
| `meslo-lg-mono-regular.woff2` | Meslo LG Mono (Regular, no icons) | 77 KB | upstream [Meslo-Font](https://github.com/ryanoasis/nerd-fonts/tree/master/patched-fonts/Meslo) — original Meslo base by André Berg, subsetted via `fontTools.subset` (no Nerd Font glyphs, basic Latin + Latin-1 + common punctuation/symbols/box-drawing only) | OFL-1.1 |
| `noto-sans-sc-regular.woff2` | Noto Sans SC (Simplified Chinese subset) | 1.1 MB | [fontsource/noto-sans-sc](https://github.com/fontsource/font-files/tree/master/fonts/google/noto-sans-sc) | OFL-1.1 |

Total fonts directory: **~1.23 MB**, all OFL-1.1.

## Why no Nerd Font icons in the Meslo file

The full Nerd Fonts-patched Meslo file is ~2.9 MB because it bundles 3,600+
icon glyphs (Font Awesome, Material, Devicons, Octicons, Powerline, etc.).
The extension doesn't reference any of them, so we strip them out. If you
ever need a glyph, you can:

1. Use the `:noto-sans-sc` fallback for CJK / symbols, or
2. Re-subset from upstream with a wider Unicode range (`pyftsubset
   meslo-lg-nerd-mono-regular.ttf --unicodes=U+0020-007E,U+E000-F8FF,...`).

Full upstream license texts:

- Inter: <https://github.com/rsms/inter/blob/master/LICENSE.txt>
- Meslo (Nerd Fonts base, unpatched upstream is André Berg's Meslo): <https://github.com/nerdFonts/nerd-fonts/blob/master/LICENSE>
- Noto Sans SC: <https://github.com/googlefonts/noto-cjk/blob/main/LICENSE>

OFL v1.1 reference: <https://scripts.sil.org/OFL>
