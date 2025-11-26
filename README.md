# Apex Assault: Dogfight Edition

<div align="center">
  <img src="/assets/Apex_Logo.png" alt="Apex Assault Logo" width="200" />
  <br/>
  <h3>High-Octane 3D Aerial Combat in Your Browser</h3>
</div>

## 🎮 Overview

**Apex Assault: Dogfight Edition** is an adrenaline-pumping 3D web-based flight combat game. Pilot legendary aircraft, engage in intense dogfights against waves of enemy AI, and survive to become the ultimate ace. Built with modern web technologies, it delivers a console-like experience directly in your browser.

## 🚀 Features

-   **Immersive 3D Graphics**: Stunning visuals powered by Three.js and React Three Fiber.
-   **Intense Combat**: Fast-paced dogfighting with dynamic enemy AI.
-   **Multiple Aircraft**: Choose from 3 distinct classes, each with unique stats and special skills.
-   **Wave-Based Survival**: Face increasingly difficult waves of enemies.
-   **Responsive Controls**: Support for both Mouse and Keyboard flight controls.
-   **Progression**: Track your score, kills, and wave progress.

## 🕹️ How to Play

### Controls

| Action | Mouse Mode (Default) | Keyboard Mode |
| :--- | :--- | :--- |
| **Steer** | Mouse Movement | Arrow Keys |
| **Throttle** | `W` (Boost) / `S` (Brake) | `W` (Boost) / `S` (Brake) |
| **Fire** | Left Click / `Space` | Left Click / `Space` |
| **Special Skill** | `E` / `Left Shift` | `E` / `Left Shift` |
| **Pause** | `ESC` | `ESC` |

### Objective

1.  **Survive**: Defeat all enemies in the current wave to advance.
2.  **Score**: Earn points by destroying enemy aircraft.
3.  **Win**: Survive until **Wave 10** to complete the mission.

## ✈️ Hangar: Aircraft & Skills

Choose your ride wisely. Each aircraft caters to a different playstyle.

### 1. F-14 Tomcat (Fighter)
*The balanced choice for any ace.*
-   **Stats**: Balanced Speed, Turn, and Health.
-   **Weapon**: Standard Machine Gun.
-   **Special Skill**: **Homer Missile** - Fires a high-damage tracking missile that locks onto the nearest enemy.
-   **Cooldown**: 10s

### 2. Spitfire MK (Propeller)
*Old school cool. High damage, high agility.*
-   **Stats**: High Turn Speed, High Damage, Lower Top Speed.
-   **Weapon**: Heavy Cannons.
-   **Special Skill**: **Trailing Missile** - Fires a backward-tracking missile to surprise enemies on your six.
-   **Cooldown**: 10s

### 3. Apache AH-64 (Helicopter)
*A flying tank. Slow but deadly.*
-   **Stats**: High Health, Extreme Turn Speed, Low Speed.
-   **Weapon**: Rapid-fire Gatling Gun (Low damage per hit, high fire rate).
-   **Special Skill**: **Missile Barrage** - Unleashes a swarm of homing missiles for 2.5 seconds.
-   **Cooldown**: 10s

## 🛠️ For Developers

### Tech Stack

-   **Frontend Framework**: [React](https://reactjs.org/)
-   **3D Engine**: [Three.js](https://threejs.org/) via [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
-   **State Management**: [Zustand](https://github.com/pmndrs/zustand)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Icons**: [Lucide React](https://lucide.dev/)

### Project Structure

```
src/
├── components/
│   ├── GameScene.tsx    # Main 3D scene and game loop logic
│   ├── Models.tsx       # 3D model components (Fighter, Propeller, etc.)
│   └── UI.tsx           # HUD, Menus, and Overlays
├── store.ts             # Global game state (Zustand)
├── types.ts             # TypeScript definitions and Game Constants
├── App.tsx              # Root component
└── main.tsx             # Entry point
```

### Running Locally

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the development server**:
    ```bash
    npm run dev
    ```
4.  **Build for production**:
    ```bash
    npm run build
    ```

## 🤝 Contribution

Contributions are welcome! If you have ideas for new planes, enemies, or features:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 🐞 Bug Reports

If you find a bug, please open an issue on the [GitHub repository](https://github.com/FrancisCodex/ApexAssault/issues).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Created by @FrancisCodex**
