# postgis

PoC project to test polygon area with a small Node.js server.

## Running with Docker

This project uses `docker-compose` to run a PostGIS database and the Node.js server.

Build and start the containers:

```bash
docker-compose up --build
```

The server will be available on [http://localhost:3000](http://localhost:3000) and the database on port `5432`.

### Creating the `polygon_areas` table

A SQL script is provided in `sql/create_polygon_areas.sql`:

```bash
docker-compose exec db psql -U postgres -f /app/sql/create_polygon_areas.sql
```

### API endpoint

`POST /check-location`

Body:

```json
{ "lat": 10.0, "lon": 20.0 }
```

The endpoint returns `{ "inside": true, "polygonId": 1 }` when the point is inside a stored polygon or `{ "inside": false }` otherwise.

### Environment variables

- `POSTGRES_PASSWORD` – password for the `postgres` user (set in `docker-compose.yml`).
- `DATABASE_URL` – connection string used by the server to reach the database.

Both are already defined in the compose file for local development.

### Tests

Run the unit tests with:

```bash
npm test
```

