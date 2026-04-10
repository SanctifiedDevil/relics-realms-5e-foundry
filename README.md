# Relics & Realms - D&D 5e Module for Foundry VTT

Browse, import, and manage your homebrew D&D 5e content from [Relics & Realms](https://relicsandrealms.com) directly inside Foundry VTT.

## Features

- **In-App Browser** — Browse your creations and purchased content without leaving Foundry
- **One-Click Import** — Import weapons, armor, spells, feats, monsters, classes, subclasses, backgrounds, journals, maps, and audio with a single click
- **Two Tabs** — Switch between "My Creations" (content you've published) and "My Collection" (content you've purchased or saved)
- **Compendium Support** — Imported items are stored in a dedicated compendium for easy organization
- **World Items** — Optionally import directly to your world's Items tab for immediate use
- **Map Import** — Maps import as fully configured Foundry scenes with grid settings, dimensions, and background images
- **Monster Import** — Monsters import as NPC actors with full stat blocks, abilities, and inventory
- **Audio Import** — Audio files import as playlist sounds, organized by category
- **Search** — Search across all your content types from the browser
- **Automatic Updates** — Re-importing an item updates the existing version instead of creating duplicates

## Supported Content Types

| Type | Import Target | Details |
|------|--------------|---------|
| Weapons | Item (weapon) | Damage, properties, rarity, weight, price |
| Armor | Item (equipment) | AC, attunement, rarity |
| Equipment | Item (equipment) | Weight, price, rarity |
| Spells | Item (spell) | Level, school, components, range, duration, damage, saves |
| Feats | Item (feat) | Prerequisites, description |
| Monsters | Actor (NPC) | Full stat block, abilities, legendary actions, inventory |
| Classes | Item (class) | Description |
| Subclasses | Item (subclass) | Description |
| Backgrounds | Item (background) | Description |
| Journals | Journal Entry | Multi-page support |
| Maps | Scene | Grid, dimensions, background image |
| Audio | Playlist Sound | Category-based playlists |
| Bundles | Multiple | Imports all items in the bundle at once |

## Getting Started

### 1. Create an Account

Visit [relicsandrealms.com](https://relicsandrealms.com) and create a free account. You can browse free content, purchase premium content from other creators, or publish your own.

### 2. Install the Module

Copy the module folder (`homebrew-hub-5e`) into your Foundry VTT `Data/modules/` directory, then enable it in your world's module settings.

### 3. Sign In

1. Open Foundry VTT and load your world
2. Click the Relics & Realms icon in the sidebar (tower icon)
3. Enter your Relics & Realms email and password
4. You're in! Browse and import your content

## Module Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **API URL** | The Relics & Realms server URL | `https://relicsandrealms.com` |
| **Compendium Name** | Name of the compendium for imported items | `homebrew-hub-imports` |
| **Also add to World Items** | Import items directly to the world Items tab | Enabled |

## How Importing Works

When you click "Import" on an item:

1. The content data is fetched from Relics & Realms
2. It's mapped to the appropriate dnd5e system data format
3. A copy is created in your import compendium
4. Optionally, a copy is also added to your world Items/Actors/Journals
5. If the item was previously imported, the existing copy is updated

Imported items are tracked by their Relics & Realms ID, so re-importing always updates rather than duplicates.

## Bundle Imports

Bundles (content packs) can be imported all at once. Each item in the bundle is imported individually to its appropriate location (Items, Actors, Journals, Scenes, or Playlists).

## Publishing Content

To publish your own homebrew content:

1. Visit [relicsandrealms.com/dashboard](https://relicsandrealms.com/dashboard)
2. Enable Creator Mode in your profile settings
3. Create and publish content using the Workshop
4. Your content will appear in the Bazaar for others to browse and purchase
5. Set up Stripe Connect in Creator Settings to receive payouts from sales

## Compatibility

- **Foundry VTT**: v11 - v14
- **Game System**: dnd5e (D&D 5th Edition)

## Support

- Website: [relicsandrealms.com](https://relicsandrealms.com)
- Report issues: [relicsandrealms.com/report](https://relicsandrealms.com/report)
- Help center: [relicsandrealms.com/help](https://relicsandrealms.com/help)
