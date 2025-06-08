# postgis

PoC project to test polygon area

## Running with Docker

This project uses `docker-compose` to run a PostGIS database and the Node.js server.

Build and start the containers:

```bash
docker-compose up --build
```

The server will be available on [http://localhost:3000](http://localhost:3000) and the database on port `5432`.

### Creating the `polygon_areas` table

Run the following command to open a `psql` shell inside the database container:

```bash
docker-compose exec db psql -U postgres
```

Then create the table:

```sql
CREATE TABLE polygon_areas (
  id SERIAL PRIMARY KEY,
  geom GEOMETRY(POLYGON, 4326)
);
```

Exit `psql` with `\q`.

### Environment variables

- `POSTGRES_PASSWORD` – password for the `postgres` user (set in `docker-compose.yml`).
- `DATABASE_URL` – connection string used by the server to reach the database.

Both are already defined in the compose file for local development.
