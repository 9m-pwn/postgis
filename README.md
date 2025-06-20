# postgis

PoC project to test polygon area with a small Node.js server.

## Running with Docker

This project uses `docker-compose` to run a PostGIS database and the Node.js server.

Copy `.env.example` to `.env` and adjust credentials if needed, then build and start the containers:

```bash
docker-compose up --build
```

The server will be available on [http://localhost:3000](http://localhost:3000) and the database on port `5432`.
pgAdmin is exposed on [http://localhost:5050](http://localhost:5050) with default credentials `admin@example.com` / `admin`.

### Creating the `polygon_areas` table

A SQL script is provided in `sql/create_polygon_areas.sql`:

```bash
docker-compose exec db psql -U postgres -f /app/sql/create_polygon_areas.sql
```

To insert a circular area with a 1 km radius around a custom point:

```bash
docker-compose exec db psql -U postgres \
  -v lat=40.0 -v lon=-74.0 -v name='Home area' \
  -f /app/sql/create_circle_polygon.sql
```

The server automatically adds a circle polygon during startup using the
`CIRCLE_LAT`, `CIRCLE_LON`, and `CIRCLE_NAME` environment variables.

### API endpoints

`POST /polygons` – create a new polygon area

Coordinates must be provided as `[lon, lat]` pairs. Example body:

```json
{
  "name": "Area 1",
  "coordinates": [[10.0, 10.0], [10.0, 20.0], [20.0, 20.0], [10.0, 10.0]]
}
```

Example cURL:

```bash
curl -X POST http://localhost:3000/polygons \
  -H "Content-Type: application/json" \
  -d '{"name":"Area 1","coordinates":[[10,10],[10,20],[20,20],[10,10]]}'
```

`POST /check-location` – check whether a point is in any stored polygon

Example body:

```json
{ "lat": 10.0, "lon": 20.0 }
```

Example cURL:

```bash
curl -X POST http://localhost:3000/check-location \
  -H "Content-Type: application/json" \
  -d '{"lat":10.0,"lon":20.0}'
```

The endpoint returns `{ "inside": true, "polygonId": 1 }` when the point is inside a stored polygon or `{ "inside": false }` otherwise.

Swagger UI is available at `http://localhost:3000/api-docs` when the server is running.

The server automatically ensures the database, creates the PostGIS extension if needed, and ensures the `polygon_areas` table exist when it starts.

### Environment variables

Configuration is read from the `.env` file. Important variables include:

- `POSTGRES_PASSWORD` – password for the `postgres` user
- `POSTGRES_DB` – name of the database (defaults to `gis_database`)
- `DATABASE_URL` – connection string used by the server
- `CIRCLE_LAT` – latitude of the default circle polygon (default `40.0`)
- `CIRCLE_LON` – longitude of the default circle polygon (default `-74.0`)
- `CIRCLE_NAME` – name for the inserted circle polygon (default `Home area`)

All variables have defaults in `.env.example` for local development.

### Tests

Install dependencies and run the unit tests with:

```bash
npm install
npm test
```

If using Docker, the tests can be executed inside the server container:

```bash
docker-compose run --rm server npm test
```

### License

This project is released under the [MIT License](LICENSE).

