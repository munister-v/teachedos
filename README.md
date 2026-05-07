# TeachedOS

Standalone static build of the `TeachedOS` language-learning interface.

## Structure

- `index.html` — main OS shell
- `games/` — interactive embedded modules
- `scripts/` — data and curriculum bindings
- `styles/` — extracted application styles

## Deploy to GitHub Pages

1. Push the contents of this folder to a GitHub repository.
2. In GitHub, open `Settings -> Pages`.
3. Set source to `Deploy from a branch`.
4. Choose branch `main` and folder `/ (root)`.

## Notes

- No build step is required.
- The project is fully static.
- Embedded game mode uses `?embed=1` in iframe URLs.
