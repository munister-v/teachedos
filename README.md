# TeachedOS

Standalone static build of the `TeachedOS` language-learning interface.

## Structure

- `index.html` — main OS shell
- `games/` — interactive embedded modules
- `scripts/` — data and curriculum bindings

## Deploy to GitHub Pages

1. Create a new GitHub repository.
2. Upload the contents of this folder to the repository root.
3. In GitHub, open `Settings -> Pages`.
4. Set source to `Deploy from a branch`.
5. Choose branch `main` and folder `/ (root)`.

## Notes

- No build step is required.
- The project is fully static.
- Embedded game mode uses `?embed=1` in iframe URLs.
