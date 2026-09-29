<div align="center">

# 🌵 CactiGrow

### Grow. Mutate. Breed. Collect.

**A cactus cultivation, genetics, and multiplayer simulation game.**

*Every seed has potential. Every cactus tells a story.*

<br>

**An independent game developed by Garduru under Cascadia Cultivated.**

<br>

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Phaser](https://img.shields.io/badge/Phaser-2D_Game_Engine-blueviolet?style=for-the-badge)](https://phaser.io/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

<br>

**Status:** Active Development | Production Deployment in Progress

[Official Website](https://cactigrow.com) •
[Development Updates](https://cactigrow.com)

---

</div>

# 🌱 Welcome to CactiGrow

**CactiGrow** is an independently developed cactus cultivation and genetics simulation combining plant collection, breeding, genetic inheritance, mutations, and a growing multiplayer world.

What begins with a single seed can become an entire collection of genetically distinctive cacti.

Grow plants through their lifecycle, experiment with breeding combinations, discover unusual genetic traits, and develop your own virtual cactus-growing operation.

CactiGrow is more than a traditional farming game.

It's an evolving genetics simulation where individual plants have their own identity, characteristics, and lineage.

The game is being developed independently from its original CactiSwap prototype, with its own application, gameplay systems, database, and multiplayer infrastructure.

---

# 🎮 Gameplay

CactiGrow brings several interconnected gameplay systems together into one growing world.

<table>
<tr>
<td width="50%" valign="top">

### 🌵 Cultivation

Plant seeds and grow individual cacti through their lifecycle.

Manage your growing operation, collect mature plants, and develop your collection.

</td>
<td width="50%" valign="top">

### 🧬 Genetics & Breeding

Experiment with breeding combinations and explore genetic inheritance.

Individual bred seeds establish genetic characteristics and lineage, creating opportunities for distinctive specimens.

</td>
</tr>

<tr>
<td width="50%" valign="top">

### 🎨 Mutations & Variegation

Explore genetic variation, mutations, and visually distinctive cactus characteristics.

The plant-rendering system is being expanded to support different growth stages and variegation patterns.

</td>
<td width="50%" valign="top">

### 🏡 Your Growing Operation

Develop your cultivation environment through the Farm, Nursery, Garden, and additional gameplay systems.

Buildings and environmental features provide a foundation for continued expansion.

</td>
</tr>

<tr>
<td width="50%" valign="top">

### 🌎 Multiplayer World

Explore the Town through the game's multiplayer architecture.

The existing system supports authenticated player presence, automatic layering, movement synchronization, and reconnect handling.

Production multiplayer deployment and two-player acceptance testing are still pending.

</td>
<td width="50%" valign="top">

### 🔬 Discovery & Experimentation

Experiment with plant genetics, develop collections, and explore increasingly complex cultivation mechanics.

Additional research, treatment, progression, and discovery systems continue to evolve.

</td>
</tr>
</table>

---

# 🗺️ Explore the CactiGrow World

CactiGrow is organized around interconnected gameplay locations.

| Location | Purpose |
|:---|:---|
| 🌾 **Farm** | Your primary growing environment and game entry point. |
| 🌱 **Nursery** | Manage seeds, specimens, and plant development. |
| 🌵 **Garden** | Organize, display, and interact with your cactus collection. |
| 🏘️ **Town** | Explore the shared multiplayer environment. |
| 🎒 **Inventory** | Manage collected items and cultivation resources. |
| 🧬 **Genetics** | Explore breeding, inheritance, and genetic research systems. |

The world is designed to expand as additional gameplay, environments, and multiplayer features are developed.

---

# 🧬 Genetics: Every Plant Is Different

Genetics is central to the CactiGrow experience.

Rather than treating every cactus as an identical item, CactiGrow is being developed around individual specimens with genetic characteristics, inheritance, and lineage.

The existing breeding implementation establishes the characteristics of individually bred seeds when breeding occurs.

Planting those seeds creates their corresponding physical specimens without changing the original parents.

This provides a foundation for expanding genetic complexity while preserving individual plant identity.

### Genetics Development

Current and ongoing development includes:

- Genetic inheritance and breeding.
- Individually generated bred seeds.
- Plant lineage and clone-line identity.
- Quantitative genetic characteristics.
- Mutations and mutation tendencies.
- Visual genetics and pigmentation.
- Variegation patterns across growth stages.
- Genetics research and treatment systems.

Some genetics systems are implemented, while visual composition, balancing, and additional genetic possibilities remain under development.

---

# 🌐 Multiplayer Architecture

CactiGrow is being developed with its own multiplayer infrastructure.

The system is independent of the original CactiSwap Grow game.

Its architecture includes:

**Areas**

Individual multiplayer environments that provide the foundation for shared game locations.

**Automatic Layering**

Players are automatically assigned to logical layers, allowing shared locations to manage multiple groups of players.

**Realtime Presence**

Cloudflare Durable Objects coordinate active player presence and movement.

**Secure Admission**

Authenticated players receive short-lived admission tickets for realtime connections.

**Movement Synchronization**

The existing Town client supports remote player presence, movement updates, interpolation, and reconnection.

### Current Multiplayer Status

The multiplayer foundation and Town client have been implemented.

However, production multiplayer is not yet publicly enabled, and successful two-account gameplay on the official domain has not been verified.

The current priority is completing production deployment and connecting the existing systems.

---

# 🚧 Development Progress

CactiGrow has moved beyond its initial prototype and into an independently developed application with substantial gameplay and backend functionality.

The original prototype remains separate within CactiSwap.

The new CactiGrow is not a Base44-built game.

Its gameplay systems, persistent data, application architecture, and multiplayer infrastructure are independently developed.

### Project Status

| Development Area | Status |
|:---|:---|
| Independent application architecture | ✅ Implemented |
| React and TypeScript application | ✅ Implemented |
| Official website and PLAY NOW routing | ✅ Implemented |
| Cloudflare Worker backend | ✅ Implemented |
| PostgreSQL and Drizzle integration | ✅ Implemented |
| Authenticated player identity and bootstrap | ✅ Implemented |
| Persistent plant lifecycle foundation | ✅ Implemented |
| Breeding and genetic inheritance foundation | ✅ Implemented |
| Farm, Nursery, Garden, and Town integration | ✅ Implemented |
| Multiplayer Area and Layer architecture | ✅ Implemented |
| Multiplayer Durable Object runtime | ✅ Implemented |
| Secure multiplayer admission | ✅ Implemented |
| Town multiplayer client | ✅ Implemented |
| Variegation visual development | 🚧 In Progress |
| Production database configuration | 🚧 In Progress |
| Production authentication integration | 🚧 In Progress |
| Official production deployment | 🚧 In Progress |
| Production multiplayer activation | ⏳ Pending |
| Public gameplay testing and refinement | ⏳ Pending |
| Additional gameplay and world expansion | 📋 Planned |

**Note:** An implemented system is not necessarily production-ready. The project is undergoing production integration, and some gameplay features still require further testing and refinement.

---

# 🏗️ Architecture

CactiGrow is designed around one central principle:

**The game should own its own systems.**

The original game began within the CactiSwap ecosystem, but the new CactiGrow is independently developed.

This allows its gameplay, world, genetics, multiplayer, and supporting infrastructure to evolve without requiring modifications to CactiSwap.

### Architecture Overview

```text
                  CACTIGROW
                      |
           React + TypeScript
                      |
             Game Application
                /         \
             React       Phaser
                \         /
                 Game Client
                      |
               Cloudflare Worker
                      |
          +-----------+-----------+
          |                       |
      Game API              Realtime API
          |                       |
     PostgreSQL              Durable Objects
          |                       |
     Persistent Data         Areas & Layers
          |
     CactiGrow Players
          |
    Identity Adapter
          |
   Base44 Authentication
```

### Design Principles

**Independence**

CactiGrow owns its gameplay systems and persistent game data.

**Modularity**

Gameplay, rendering, authentication, and external integrations remain separated wherever practical.

**Server Authority**

Persistent gameplay actions are progressively moving behind authenticated server-side commands and database-backed state.

**Scalability**

The multiplayer architecture uses reusable Areas and automatic logical Layers.

**Replaceable Integrations**

External authentication is kept separate from the core game systems so the provider can be changed later.

**Maintainability**

TypeScript, structured application boundaries, automated tests, and versioned API contracts support continued development.

---

# ⚙️ Technology Stack

CactiGrow is developed using the following technologies.

| Technology | Purpose |
|:---|:---|
| TypeScript | Application and backend development |
| React | User interface |
| Vite | Frontend development and production builds |
| React Router | Application navigation |
| Phaser 3 | Interactive game-world rendering |
| Cloudflare Workers | Backend APIs and application hosting |
| Cloudflare Durable Objects | Realtime multiplayer coordination |
| Cloudflare Hyperdrive | PostgreSQL connection infrastructure |
| Neon PostgreSQL | Persistent game database |
| Drizzle ORM | Database schema and typed data access |
| Base44 | External account authentication |
| ESLint | Code quality |
| Git & GitHub | Version control |

Base44 is used only through an isolated authentication integration.

It does not operate CactiGrow's gameplay, database, genetics, or multiplayer systems.

---

# 🔗 The Cascadia Cultivated Ecosystem

CactiGrow is developed under **Cascadia Cultivated**, alongside several related projects.

These projects share an ecosystem while retaining their own identities and development paths.

### 🌵 CactiGrow

The independently developed cactus cultivation, genetics, and multiplayer simulation.

### 🔄 CactiSwap

The existing cactus-focused ecosystem, including the original Grow game.

CactiSwap and its original Grow game remain separate from the new CactiGrow.

The new CactiGrow is being connected to existing CactiSwap accounts through Base44 authentication.

Gameplay data, progression, inventory, and multiplayer remain independent.

### 📚 CactiWiki

A complementary encyclopedia project within the wider ecosystem.

### 🔮 Future Integration

Additional ecosystem integration may be considered as these projects evolve.

Shared currency and gameplay-data synchronization are not requirements for the initial CactiGrow launch.

---

# 🌍 Official Website

**CactiGrow's official website:**

### [cactigrow.com](https://cactigrow.com)

The independent application includes its own official homepage and integrated game routing.

The homepage features a **PLAY NOW** button that launches the existing game at `/play`.

The application also supports direct navigation to its other gameplay locations, including the Town.

Production deployment is currently in progress.

The website may not yet serve the new playable application until the production cutover is completed.

---

# 💻 Local Development

This repository contains the independently developed CactiGrow application.

The project uses Vite for frontend development and Cloudflare Workers for its backend infrastructure.

## Requirements

- Node.js compatible with the project's dependencies.
- npm.
- Git.
- Appropriate environment configuration for backend development.

Database-backed gameplay requires separately configured development infrastructure.

## Clone the Repository

```bash
git clone https://github.com/Garduru/CactiGrow.git

cd CactiGrow
```

## Install Dependencies

```bash
npm install
```

## Start the Frontend

```bash
npm run dev
```

## Start the Development Worker

```bash
npm run dev:worker
```

The development Worker requires the appropriate local environment and database configuration.

Do not use production credentials for local development.

## Build

```bash
npm run build
```

## Preview

```bash
npm run preview
```

## Code Quality

```bash
npm run lint
```

## Available Test Commands

```bash
npm run test:worker

npm run test:client

npm run test:website

npm run test:realtime

npm run test:multiplayer:client
```

Additional database, gameplay, multiplayer runtime, and deployment scripts are available in `package.json`.

Some tests require isolated database or Cloudflare-compatible runtime configuration.

---

# 📸 Development Showcase

CactiGrow's development includes gameplay environments, cultivation systems, plant assets, visual genetics, buildings, and multiplayer infrastructure.

Development previews will highlight the game's evolution as additional systems become available.

### Upcoming Showcase Content

- Farm and growing environments.
- Nursery and plant development.
- Genetics and breeding.
- Mutations and variegation.
- Buildings and world environments.
- Town and multiplayer gameplay.

Development screenshots and approved artwork may be added here as the project progresses.

---

# 🤝 Contributions & Feedback

CactiGrow is currently an independently managed development project.

Public contributions are not formally supported at this stage.

Constructive feedback and bug reports are welcome.

Contribution guidelines may be introduced as development progresses.

---

# 📜 Licensing & Ownership

CactiGrow is an original game developed under the Cascadia Cultivated umbrella.

The source code, game assets, artwork, branding, and other project content may have different ownership or licensing requirements.

Public visibility of this repository does not automatically grant permission to redistribute or commercially reuse proprietary CactiGrow content.

Refer to the repository's applicable license and asset-specific permissions.

---

<div align="center">

# 🧙 Meet the Developer

### Dom | Garduru

**Creator • Developer • Builder**

*Cascadia Cultivated*

<br>

Building projects at the intersection of technology, cultivation, electronics, experimentation, and game development.

From hardware and software to virtual cactus genetics, CactiGrow is one part of a much larger creative ecosystem.

<br>

**Independently built. Constantly evolving.**

### One seed at a time. 🌵

<br>

---

**© Cascadia Cultivated — CactiGrow**

</div>