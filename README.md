# TeachedOS

Standalone static build of the `TeachedOS` language-learning interface.

## Structure

- `index.html` — main OS shell
- `games/` — interactive embedded modules
- `scripts/` — app data, curriculum bindings, shared helpers, game data, and per-game logic in `scripts/games/`
- `styles/` — extracted application styles plus shared game foundation

## Deploy to GitHub Pages

1. Push the contents of this folder to a GitHub repository.
2. In GitHub, open `Settings -> Pages`.
3. Set source to `Deploy from a branch`.
4. Choose branch `main` and folder `/ (root)`.

## Notes

- No build step is required.
- The project is fully static.
- Embedded game mode uses `?embed=1` in iframe URLs.
- Repeated game shell styles live in `styles/games-base.css`.
