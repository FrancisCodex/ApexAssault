# Apex Assault: Dogfight Edition

<div align="center">
  <img src="/assets/Apex_Logo.png" alt="Apex Assault Logo" width="200" />
  <br/>
  <h3>High-Octane 3D Aerial Combat in Your Browser</h3>
</div>

## 🎮 Overview

**Apex Assault** is an adrenaline-pumping 3D web-based flight combat game. Pilot legendary aircraft, engage in intense dogfights against waves of enemy AI, and survive to become the ultimate ace. Built with modern web technologies, it delivers a console-like experience directly in your browser.

## 🚀 Features

-   **Immersive 3D Graphics**: Stunning visuals powered by Three.js and React Three Fiber.
-   **Intense Combat**: Fast-paced dogfighting with dynamic enemy AI.
-   **Multiple Aircraft**: Choose from 3 distinct classes, each with unique stats and special skills.
-   **Wave-Based Survival**: Face increasingly difficult waves of enemies.
-   **Responsive Controls**: Support for both Mouse and Keyboard flight controls.
-   **Progression**: Track your score, kills, and wave progress.
-   **Plane Movement**: Very Fun Plane Movements and maneuvers you can try.
-   **AI**: AI is not perfect but it is fun to play against.

## 🕹️ How to Play

### Controls

| Action | Mouse Mode (Default) | Keyboard Mode |
| :--- | :--- | :--- |
| **Steer** | Mouse Movement | Arrow Keys |
| **Throttle** | `W` (Boost) / `S` (Brake) | `W` (Boost) / `S` (Brake) |
| **Fire** | Left Click / `Space` | Left Click / `Space` |
| **Special Skill** | `E` / `Left Shift` | `E` / `Left Shift` |
| **Flares** | `F` / `Right Shift` | `F` / `Right Shift` |
| **Pause** | `ESC` | `ESC` |

### Objective

1.  **Survive**: Defeat all enemies in the current wave to advance.
2.  **Score**: Earn points by destroying enemy aircraft.
3.  **Win**: Survive until **Wave 10** to complete the mission.

## ✈️ Hangar: Aircraft & Skills

Choose your ride wisely. Each aircraft caters to a different playstyle.

### 1. F-14 Tomcat (Fighter)
*The balanced choice for any ace.*
-   **Description**: The F-14 Tomcat is a United States Navy fighter aircraft that is known for its balanced stats and special skills.
-   **Stats**: Balanced Speed, Turn, and Health.
-   **Weapon**: Standard Machine Gun.
-   **Special Skill**: **Homer Missile** - Fires 5 long-range and high-damage tracking missiles on click that lock onto the nearest enemy. The Homing Missiles are very deadly missiles that is effective against long-range targets solo targets.
-   **Cooldown**: 10s
-   **Duration**: 10s or until all 5 missiles are used.
-   **Flares**: Flares are used to counter enemy missiles.
-   **Agile Movement**: The F-14 is the most agile plane in the game.

### 2. Spitfire MK (Propeller)
*Old school cool. High damage, high agility.*
-   **Description**: The Spitfire is a classic British fighter aircraft that is known for its agility and high damage.
-   **Stats**: High Turn Speed, High Damage, Lower Top Speed.
-   **Weapon**: Heavy Cannons.
-   **Special Skill**: **Trailing Missile** - Fires a backward-tracking missile to surprise enemies on your six. The missile has a medium distance limit and high damage that is effective when getting chased by multiple enemies.
-   **Cooldown**: 10s
-   **Duration**: 3s
-   **Flares**: Flares are used to counter enemy missiles.
-   **DPS**: The Spitfire is the highest DPS plane in the game.

### 3. Apache AH-64 (Helicopter)
*A flying tank. Slow but deadly.*
-   **Description**: The Apache is a Soviet-era attack helicopter that is known for its high health and durability.
-   **Stats**: High Health, Extreme Turn Speed, Low Speed.
-   **Weapon**: Rapid-fire Gatling Gun (Low damage per hit, high fire rate).
-   **Special Skill**: **Missile Barrage** - Unleashes a swarm of homing missiles for 2.5 seconds on click, very good in close range combat against swarming enemies. Missiles are not as effective against long-range targets but has the highest Damage Per Second for homing missiles.
-   **Cooldown**: 10s
-   **Duration**: 2.5s
-   **Flares**: Flares are used to counter enemy missiles.
-   **Durability**: The Apache is the most durable plane in the game.
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
